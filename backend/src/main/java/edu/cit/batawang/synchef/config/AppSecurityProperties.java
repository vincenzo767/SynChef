package edu.cit.batawang.synchef.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@Data
@ConfigurationProperties(prefix = "app.security")
public class AppSecurityProperties {
    /** Name of the HttpOnly session cookie. */
    private String sessionCookieName = "SYNCHEF_SESSION";
    /** Mark cookies Secure (HTTPS-only). Browsers accept Secure cookies on http://localhost. */
    private boolean cookieSecure = true;
    /** SameSite attribute for auth/CSRF cookies: Lax or Strict. */
    private String cookieSameSite = "Lax";
    /** Absolute lifetime of a session. */
    private Duration sessionTtl = Duration.ofDays(7);
    /** A session unused for this long is rejected. */
    private Duration sessionIdleTimeout = Duration.ofHours(48);
    /** Max authentication attempts per client+identifier within the window. */
    private int loginRateLimit = 10;
    private Duration loginRateWindow = Duration.ofMinutes(5);
}
