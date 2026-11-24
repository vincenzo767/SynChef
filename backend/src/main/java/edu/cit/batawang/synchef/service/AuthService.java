package edu.cit.batawang.synchef.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import edu.cit.batawang.synchef.dto.AuthDtos.GoogleLoginRequest;
import edu.cit.batawang.synchef.dto.AuthDtos.LoginRequest;
import edu.cit.batawang.synchef.dto.AuthDtos.RegisterRequest;
import edu.cit.batawang.synchef.dto.AuthDtos.UserProfileResponse;
import edu.cit.batawang.synchef.exception.ApiException;
import edu.cit.batawang.synchef.model.User;
import edu.cit.batawang.synchef.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;
import java.util.Locale;
import java.util.Optional;

/**
 * Credential verification and account creation. Session issuance happens in the controller.
 * Login failures return one generic message to avoid revealing which accounts exist.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    /** Result of a successful sign-in, materialized inside the transaction. */
    public record AuthResult(Long userId, UserProfileResponse profile) {
    }

    static final String INVALID_CREDENTIALS = "Incorrect email/username or password";

    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AdminStatsService adminStats;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.google.client-id:}")
    private String googleClientId;

    /** Real BCrypt hash compared against when the account does not exist, to keep response times uniform. */
    private String dummyHash;

    @PostConstruct
    void initDummyHash() {
        dummyHash = passwordEncoder.encode("synchef-timing-equalizer");
    }

    public boolean isGoogleEnabled() {
        return googleClientId != null && !googleClientId.isBlank();
    }

    public String googleClientId() {
        return isGoogleEnabled() ? googleClientId : null;
    }

    @Transactional
    public AuthResult register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String username = request.username().trim();
        String fullName = request.fullName().trim();

        if (!request.password().equals(request.confirmPassword())) {
            throw ApiException.badRequest("Passwords do not match");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("An account with this email already exists");
        }
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw ApiException.conflict("This username is already taken");
        }

        User user = new User();
        user.setEmail(email);
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setFullName(fullName);
        user.setEmailVerified(false);
        user.setActive(true);
        user.setRole("USER");
        if (notBlank(request.countryCode())) {
            user.setCountryCode(request.countryCode().trim().toUpperCase(Locale.ROOT));
        }
        if (notBlank(request.countryName())) {
            user.setCountryName(request.countryName().trim());
        }

        user = userRepository.save(user);
        notificationService.createWelcomeNotifications(user);
        adminStats.broadcastStats();
        log.info("User registered: id={}", user.getId());
        return result(user);
    }

    @Transactional(readOnly = true)
    public AuthResult login(LoginRequest request) {
        String identifier = request.emailOrUsername().trim();
        Optional<User> found = userRepository.findByEmail(identifier)
                .or(() -> userRepository.findByEmail(identifier.toLowerCase(Locale.ROOT)))
                .or(() -> userRepository.findByUsername(identifier));

        if (found.isEmpty() || found.get().getPassword() == null || found.get().getPassword().isBlank()) {
            passwordEncoder.matches(request.password(), dummyHash);
            if (found.isPresent()) {
                // Account exists but was created with Google — give a helpful, non-sensitive hint.
                throw ApiException.unauthorized("This account uses Google sign-in. Continue with Google instead.");
            }
            throw ApiException.unauthorized(INVALID_CREDENTIALS);
        }

        User user = found.get();
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw ApiException.unauthorized(INVALID_CREDENTIALS);
        }
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw ApiException.forbidden("This account has been suspended. Contact support for help.");
        }
        log.info("User logged in: id={}", user.getId());
        return result(user);
    }

    @Transactional
    public AuthResult loginWithGoogle(GoogleLoginRequest request) {
        GoogleIdToken.Payload payload = verifyGoogleToken(request.idToken());
        String email = payload.getEmail() == null ? null : payload.getEmail().trim().toLowerCase(Locale.ROOT);
        if (!notBlank(email)) {
            throw ApiException.unauthorized("Google account does not provide an email");
        }
        if (!Boolean.TRUE.equals(payload.getEmailVerified())) {
            throw ApiException.unauthorized("Google email is not verified");
        }

        String fullName = extractGoogleName(payload, email);
        String picture = (String) payload.get("picture");

        Optional<User> existing = userRepository.findByEmail(email);
        User user = existing.isPresent()
                ? updateExistingGoogleUser(existing.get(), fullName, picture)
                : createGoogleUser(email, fullName, picture);
        log.info("User logged in with Google: id={}", user.getId());
        return result(user);
    }

    private GoogleIdToken.Payload verifyGoogleToken(String idToken) {
        if (!isGoogleEnabled()) {
            throw ApiException.badRequest("Google sign-in is not configured on the server");
        }
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    GoogleNetHttpTransport.newTrustedTransport(), GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();
            GoogleIdToken token = verifier.verify(idToken);
            if (token == null) {
                throw ApiException.unauthorized("Invalid Google token");
            }
            return token.getPayload();
        } catch (GeneralSecurityException | IOException | IllegalArgumentException e) {
            log.warn("Google ID token verification failed: {}", e.getClass().getSimpleName());
            throw ApiException.unauthorized("Unable to validate Google sign-in");
        }
    }

    private User updateExistingGoogleUser(User user, String fullName, String picture) {
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw ApiException.forbidden("This account has been suspended. Contact support for help.");
        }
        boolean changed = false;
        if (!Boolean.TRUE.equals(user.getEmailVerified())) {
            user.setEmailVerified(true);
            changed = true;
        }
        if (notBlank(fullName) && !notBlank(user.getFullName())) {
            user.setFullName(fullName);
            changed = true;
        }
        if (notBlank(picture) && !notBlank(user.getProfileImageUrl()) && picture.startsWith("https://")) {
            user.setProfileImageUrl(picture);
            changed = true;
        }
        return changed ? userRepository.save(user) : user;
    }

    private User createGoogleUser(String email, String fullName, String picture) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(generateUniqueUsername(email, fullName));
        user.setPassword(null);
        user.setFullName(fullName);
        user.setProfileImageUrl(notBlank(picture) && picture.startsWith("https://") ? picture : null);
        user.setEmailVerified(true);
        user.setActive(true);
        user.setRole("USER");
        user = userRepository.save(user);
        notificationService.createWelcomeNotifications(user);
        adminStats.broadcastStats();
        return user;
    }

    private String generateUniqueUsername(String email, String fullName) {
        String source = notBlank(fullName) ? fullName : email.substring(0, email.indexOf('@'));
        String base = source.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("(^_+)|(_+$)", "");
        if (base.length() < 3) base = "chef_" + base;
        if (base.length() > 24) base = base.substring(0, 24);
        String candidate = base;
        int suffix = 1;
        while (userRepository.existsByUsernameIgnoreCase(candidate)) {
            candidate = base + suffix++;
        }
        return candidate;
    }

    private String extractGoogleName(GoogleIdToken.Payload payload, String email) {
        String name = (String) payload.get("name");
        return notBlank(name) ? name.trim() : email.substring(0, email.indexOf('@'));
    }

    private static AuthResult result(User user) {
        return new AuthResult(user.getId(), UserMapper.toProfile(user));
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
