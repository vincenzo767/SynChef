package edu.cit.batawang.synchef.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Authoritative state of a real-time cooking run. Clients render this state and send commands;
 * every change is persisted (so progress survives reloads and device switches) and broadcast to
 * all participants over STOMP. {@link Version} guards against concurrent edits from participants.
 */
@Entity
@Table(name = "cooking_sessions", indexes = {
    @Index(name = "idx_cooking_sessions_host_status", columnList = "host_user_id,status"),
    @Index(name = "idx_cooking_sessions_join_code", columnList = "join_code", unique = true)
})
@Data
@NoArgsConstructor
public class CookingSession {

    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_COMPLETED = "COMPLETED";
    public static final String STATUS_ABANDONED = "ABANDONED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipe_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Recipe recipe;

    @Column(name = "host_user_id", nullable = false)
    private Long hostUserId;

    @Column(nullable = false)
    private Integer servings;

    @Column(name = "current_step_index", nullable = false)
    private Integer currentStepIndex = 0;

    @Column(nullable = false, length = 12)
    private String status = STATUS_ACTIVE;

    /** Short code other users enter to cook along; null until the host shares the session. */
    @Column(name = "join_code", length = 8, unique = true)
    private String joinCode;

    @ElementCollection
    @CollectionTable(name = "cooking_session_completed_steps", joinColumns = @JoinColumn(name = "session_id"))
    @Column(name = "step_index")
    private Set<Integer> completedSteps = new LinkedHashSet<>();

    @ElementCollection
    @CollectionTable(name = "cooking_session_timers", joinColumns = @JoinColumn(name = "session_id"))
    private List<CookingTimer> timers = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "cooking_session_participants", joinColumns = @JoinColumn(name = "session_id"))
    private List<CookingParticipant> participants = new ArrayList<>();

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Version
    private Long version;

    public boolean isActive() {
        return STATUS_ACTIVE.equals(status);
    }

    public boolean hasParticipant(Long userId) {
        return participants.stream().anyMatch(p -> p.getUserId().equals(userId));
    }
}
