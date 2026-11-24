package edu.cit.batawang.synchef.security;

import edu.cit.batawang.synchef.config.AppSecurityProperties;
import edu.cit.batawang.synchef.exception.ApiException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Fixed-window, in-memory limiter for credential endpoints (login, register, Google sign-in,
 * password change). Limits per client+identifier and, more loosely, per client.
 * For multi-instance deployments, move the counters to a shared store.
 */
@Component
public class RateLimiter {

    private final ConcurrentMap<String, Window> windows = new ConcurrentHashMap<>();
    private final int limit;
    private final Duration window;

    public RateLimiter(AppSecurityProperties properties) {
        this.limit = properties.getLoginRateLimit();
        this.window = properties.getLoginRateWindow();
    }

    public void checkAuthAttempt(String clientAddress, String identifier) {
        String id = identifier == null ? "" : identifier.trim().toLowerCase(Locale.ROOT);
        consume("auth:" + clientAddress + ":" + id, limit);
        consume("auth-ip:" + clientAddress, limit * 3);
    }

    public void check(String key, int max) {
        consume(key, max);
    }

    private void consume(String key, int max) {
        Instant now = Instant.now();
        Window current = windows.compute(key, (k, w) -> {
            if (w == null || w.start.plus(window).isBefore(now)) {
                return new Window(now, 1);
            }
            return new Window(w.start, w.count + 1);
        });
        if (current.count > max) {
            throw ApiException.tooManyRequests("Too many attempts. Please wait a few minutes and try again.");
        }
    }

    @Scheduled(fixedDelayString = "PT10M")
    public void evictStale() {
        Instant cutoff = Instant.now().minus(window);
        windows.entrySet().removeIf(e -> e.getValue().start.isBefore(cutoff));
    }

    private record Window(Instant start, int count) {}
}
