package edu.cit.batawang.synchef.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import edu.cit.batawang.synchef.dto.AuthResponse;
import edu.cit.batawang.synchef.dto.GoogleLoginRequest;
import edu.cit.batawang.synchef.dto.LoginRequest;
import edu.cit.batawang.synchef.dto.RegisterRequest;
import edu.cit.batawang.synchef.model.User;
import edu.cit.batawang.synchef.repository.UserRepository;
import edu.cit.batawang.synchef.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;
import java.util.Locale;
import java.util.Optional;

/**
 * Service for user authentication and registration
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {
    
    private final UserRepository userRepository;
    private final JwtTokenProvider tokenProvider;
    private final NotificationService notificationService;
    private final AdminService adminService;
    private static final PasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder();

    @Value("${app.google.client-id:}")
    private String googleClientId;
    
    /**
     * Register a new user
     */
    public AuthResponse register(RegisterRequest request) {
        String email = normalize(request.getEmail());
        String username = normalize(request.getUsername());
        String fullName = normalize(request.getFullName());

        if (isBlank(email) || isBlank(username) || isBlank(fullName)) {
            throw new IllegalArgumentException("Email, username, and full name are required");
        }

        if (isBlank(request.getPassword()) || isBlank(request.getConfirmPassword())) {
            throw new IllegalArgumentException("Password and confirm password are required");
        }

        // Validate password match
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new IllegalArgumentException("Passwords do not match");
        }
        
        // Check if email already exists
        if (userRepository.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("Email already registered");
        }
        
        // Check if username already exists
        if (userRepository.findByUsername(username).isPresent()) {
            throw new IllegalArgumentException("Username already taken");
        }
        
        // Create new user
        User user = new User();
        user.setEmail(email);
        user.setUsername(username);
        user.setPassword(PASSWORD_ENCODER.encode(request.getPassword()));
        user.setFullName(fullName);
        user.setEmailVerified(false);
        user.setActive(true);
        if (!isBlank(request.getCountryCode())) {
            user.setCountryCode(request.getCountryCode().toUpperCase().trim());
        }
        if (!isBlank(request.getCountryName())) {
            user.setCountryName(request.getCountryName().trim());
        }
        
        user = userRepository.save(user);
        notificationService.createWelcomeNotifications(user);
        adminService.broadcastStats();

        log.info("User registered: {}", user.getEmail());

        return buildAuthResponse(user);
    }
    
    /**
     * Login user with email/username and password
     */
    public AuthResponse login(LoginRequest request) {
        String emailOrUsername = normalize(request.getEmailOrUsername());
        if (isBlank(emailOrUsername) || isBlank(request.getPassword())) {
            throw new IllegalArgumentException("Email/username and password are required");
        }

        // Find user by email or username
        Optional<User> userOpt = userRepository.findByEmail(emailOrUsername)
                .or(() -> userRepository.findByUsername(emailOrUsername));
        
        if (userOpt.isEmpty()) {
            throw new IllegalArgumentException("Invalid email or username");
        }
        
        User user = userOpt.get();
        
        if (isBlank(user.getPassword())) {
            throw new IllegalArgumentException("Password login is unavailable for this account.");
        }

        // Support both legacy plain-text and BCrypt-hashed passwords
        boolean passwordMatches = PASSWORD_ENCODER.matches(request.getPassword(), user.getPassword())
                || user.getPassword().equals(request.getPassword());

        if (!passwordMatches) {
            throw new IllegalArgumentException("Invalid password");
        }

        // Upgrade legacy plain-text password to BCrypt after successful login
        if (user.getPassword().equals(request.getPassword())) {
            user.setPassword(PASSWORD_ENCODER.encode(request.getPassword()));
            userRepository.save(user);
        }
        
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new IllegalArgumentException("Account is inactive");
        }
        
        log.info("User logged in: {}", user.getEmail());
        
        return buildAuthResponse(user);
    }

    /**
     * Login or register user with Google Sign-In ID token.
     */
    public AuthResponse loginWithGoogle(GoogleLoginRequest request) {
        GoogleIdToken.Payload payload = verifyGoogleToken(request);
        String email = normalize(payload.getEmail());
        if (isBlank(email)) {
            throw new IllegalArgumentException("Google account does not provide an email");
        }
        if (!Boolean.TRUE.equals(payload.getEmailVerified())) {
            throw new IllegalArgumentException("Google email is not verified");
        }

        String fullName = extractGoogleName(payload, email);
        String profileImageUrl = normalize((String) payload.get("picture"));

        Optional<User> existing = userRepository.findByEmail(email);
        User user;
        if (existing.isPresent()) {
            user = updateExistingGoogleUser(existing.get(), fullName, profileImageUrl);
        } else {
            user = createGoogleUser(email, fullName, profileImageUrl);
        }

        log.info("User logged in with Google: {}", user.getEmail());
        return buildAuthResponse(user);
    }
    
    /**
     * Build AuthResponse from User entity
     */
    private AuthResponse buildAuthResponse(User user) {
        String token = tokenProvider.generateToken(user);

        AuthResponse response = new AuthResponse();
        response.setToken(token);
        response.setType("Bearer");
        response.setId(user.getId());
        response.setEmail(user.getEmail());
        response.setUsername(user.getUsername());
        response.setFullName(user.getFullName());
        response.setProfileImageUrl(user.getProfileImageUrl());
        response.setEmailVerified(user.getEmailVerified());
        response.setCountryCode(user.getCountryCode());
        response.setCountryName(user.getCountryName());
        response.setFavoriteRecipeIds(
            user.getFavoriteRecipeIds() != null ? user.getFavoriteRecipeIds() : new java.util.ArrayList<>()
        );
        response.setCreatedAt(user.getCreatedAt());
        response.setRole(user.getRole() != null ? user.getRole() : "USER");

        return response;
    }
    
    private String normalize(String value) {
        return value == null ? null : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private GoogleIdToken.Payload verifyGoogleToken(GoogleLoginRequest request) {
        if (isBlank(googleClientId)) {
            throw new IllegalArgumentException("Google login is not configured on the server");
        }

        if (request == null || isBlank(request.getIdToken())) {
            throw new IllegalArgumentException("Google token is required");
        }

        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    GoogleNetHttpTransport.newTrustedTransport(),
                        GsonFactory.getDefaultInstance()
            )
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(request.getIdToken());
            if (idToken == null) {
                throw new IllegalArgumentException("Invalid Google token");
            }

            return idToken.getPayload();
        } catch (GeneralSecurityException | IOException e) {
            log.error("Failed to verify Google ID token", e);
            throw new IllegalArgumentException("Unable to validate Google token");
        }
    }

    private String generateUniqueUsername(String email, String fullName) {
        String source = !isBlank(fullName) ? fullName : email.substring(0, email.indexOf('@'));
        String base = source
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "_")
            .replaceAll("(^_+)|(_+$)", "");

        if (isBlank(base)) {
            base = "user";
        }

        String candidate = base;
        int suffix = 1;
        while (userRepository.findByUsername(candidate).isPresent()) {
            candidate = base + suffix;
            suffix++;
        }

        return candidate;
    }

    private User updateExistingGoogleUser(User user, String fullName, String profileImageUrl) {
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new IllegalArgumentException("Account is inactive");
        }

        boolean changed = false;
        if (!Boolean.TRUE.equals(user.getEmailVerified())) {
            user.setEmailVerified(true);
            changed = true;
        }

        if (!isBlank(fullName) && isBlank(user.getFullName())) {
            user.setFullName(fullName);
            changed = true;
        }

        if (!isBlank(profileImageUrl) && isBlank(user.getProfileImageUrl())) {
            user.setProfileImageUrl(profileImageUrl);
            changed = true;
        }

        return changed ? userRepository.save(user) : user;
    }

    private User createGoogleUser(String email, String fullName, String profileImageUrl) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(generateUniqueUsername(email, fullName));
        user.setPassword(null);
        user.setFullName(fullName);
        user.setProfileImageUrl(profileImageUrl);
        user.setEmailVerified(true);
        user.setActive(true);

        user = userRepository.save(user);
        notificationService.createWelcomeNotifications(user);
        adminService.broadcastStats();
        return user;
    }

    private String extractGoogleName(GoogleIdToken.Payload payload, String email) {
        String fullName = normalize((String) payload.get("name"));
        if (!isBlank(fullName)) {
            return fullName;
        }
        return email.substring(0, email.indexOf('@'));
    }

}
