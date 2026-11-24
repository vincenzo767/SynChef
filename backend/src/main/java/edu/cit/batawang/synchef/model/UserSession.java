package edu.cit.batawang.synchef.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Server-side authentication session. The browser only holds an opaque random token in an
 * HttpOnly cookie; the database stores its SHA-256 hash so a leaked table cannot be replayed.
 */
@Entity
@Table(name = "user_sessions", indexes = {
    @Index(name = "idx_user_sessions_token", columnList = "token_hash", unique = true),
    @Index(name = "idx_user_sessions_user", columnList = "user_id")
})
@Data
@NoArgsConstructor
public class UserSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "token_hash", nullable = false, length = 64, unique = true)
    private String tokenHash;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt;

    /** Truncated User-Agent, shown in the "active sessions" list. */
    @Column(name = "user_agent", length = 200)
    private String userAgent;
}
