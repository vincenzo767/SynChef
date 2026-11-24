package edu.cit.batawang.synchef.security;

import edu.cit.batawang.synchef.config.AppSecurityProperties;
import edu.cit.batawang.synchef.exception.ApiException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RateLimiterTest {

    @Test
    void blocksAfterLimitPerClientAndIdentifier() {
        AppSecurityProperties props = new AppSecurityProperties();
        props.setLoginRateLimit(3);
        RateLimiter limiter = new RateLimiter(props);

        for (int i = 0; i < 3; i++) {
            limiter.checkAuthAttempt("10.0.0.1", "chef@example.com");
        }
        assertThatThrownBy(() -> limiter.checkAuthAttempt("10.0.0.1", "CHEF@example.com"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Too many attempts");
        // A different client is unaffected.
        assertThatCode(() -> limiter.checkAuthAttempt("10.0.0.2", "chef@example.com")).doesNotThrowAnyException();
    }
}
