package edu.cit.batawang.synchef.security;

import edu.cit.batawang.synchef.config.AppSecurityProperties;
import edu.cit.batawang.synchef.model.User;
import edu.cit.batawang.synchef.model.UserSession;
import edu.cit.batawang.synchef.repository.UserRepository;
import edu.cit.batawang.synchef.repository.UserSessionRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseCookie;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

/**
 * Server-managed sessions. Tokens are 256-bit random values from {@link SecureRandom};
 * only their SHA-256 digest is persisted. Revocation is immediate (row deletion).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SessionService {

    private static final Duration LAST_SEEN_GRANULARITY = Duration.ofMinutes(5);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserSessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final AppSecurityProperties properties;

    public record IssuedSession(String rawToken, UserSession session) {}

    public record ResolvedSession(UserSession session, User user) {}

    @Transactional
    public IssuedSession create(Long userId, String userAgent) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        Instant now = Instant.now();
        UserSession session = new UserSession();
        session.setTokenHash(hash(raw));
        session.setUserId(userId);
        session.setCreatedAt(now);
        session.setLastSeenAt(now);
        session.setExpiresAt(now.plus(properties.getSessionTtl()));
        session.setUserAgent(truncate(userAgent, 200));
        return new IssuedSession(raw, sessionRepository.save(session));
    }

    /** Validates a raw cookie token. Returns empty for unknown, expired, idle or inactive-user sessions. */
    @Transactional
    public Optional<ResolvedSession> resolve(String rawToken) {
        if (rawToken == null || rawToken.isBlank() || rawToken.length() > 128) {
            return Optional.empty();
        }
        Optional<UserSession> found = sessionRepository.findByTokenHash(hash(rawToken));
        if (found.isEmpty()) {
            return Optional.empty();
        }
        UserSession session = found.get();
        Instant now = Instant.now();
        if (session.getExpiresAt().isBefore(now)
                || session.getLastSeenAt().plus(properties.getSessionIdleTimeout()).isBefore(now)) {
            sessionRepository.delete(session);
            return Optional.empty();
        }
        Optional<User> user = userRepository.findById(session.getUserId());
        if (user.isEmpty() || !Boolean.TRUE.equals(user.get().getActive())) {
            sessionRepository.delete(session);
            return Optional.empty();
        }
        if (session.getLastSeenAt().plus(LAST_SEEN_GRANULARITY).isBefore(now)) {
            session.setLastSeenAt(now);
        }
        return Optional.of(new ResolvedSession(session, user.get()));
    }

    @Transactional
    public void revoke(Long sessionId) {
        sessionRepository.deleteById(sessionId);
    }

    @Transactional
    public int revokeAll(Long userId) {
        return sessionRepository.deleteByUserId(userId);
    }

    @Transactional
    public int revokeOthers(Long userId, Long keepSessionId) {
        return sessionRepository.deleteByUserIdExcept(userId, keepSessionId);
    }

    @Transactional(readOnly = true)
    public List<UserSession> listForUser(Long userId) {
        return sessionRepository.findByUserIdOrderByLastSeenAtDesc(userId);
    }

    @Scheduled(fixedDelayString = "PT1H", initialDelayString = "PT5M")
    @Transactional
    public void purgeExpired() {
        Instant now = Instant.now();
        int removed = sessionRepository.deleteExpired(now, now.minus(properties.getSessionIdleTimeout()));
        if (removed > 0) {
            log.info("Purged {} expired sessions", removed);
        }
    }

    public String readToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) {
            if (properties.getSessionCookieName().equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    public ResponseCookie sessionCookie(String rawToken) {
        return baseCookie(rawToken).maxAge(properties.getSessionTtl()).build();
    }

    public ResponseCookie clearedSessionCookie() {
        return baseCookie("").maxAge(Duration.ZERO).build();
    }

    private ResponseCookie.ResponseCookieBuilder baseCookie(String value) {
        return ResponseCookie.from(properties.getSessionCookieName(), value)
                .httpOnly(true)
                .secure(properties.isCookieSecure())
                .sameSite(properties.getCookieSameSite())
                .path("/");
    }

    static String hash(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
