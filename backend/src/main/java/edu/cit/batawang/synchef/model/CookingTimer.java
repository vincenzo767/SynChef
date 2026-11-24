package edu.cit.batawang.synchef.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * A step timer inside a cooking session. A RUNNING timer is described by its absolute end time,
 * so every client derives the same remaining time from the server clock (no drift, survives reloads).
 */
@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CookingTimer {

    public static final String RUNNING = "RUNNING";
    public static final String PAUSED = "PAUSED";
    public static final String DONE = "DONE";

    @Column(name = "step_index", nullable = false)
    private Integer stepIndex;

    @Column(name = "label", length = 100)
    private String label;

    @Column(name = "duration_seconds", nullable = false)
    private Integer durationSeconds;

    @Column(name = "state", nullable = false, length = 10)
    private String state;

    /** Set while RUNNING. */
    @Column(name = "ends_at")
    private Instant endsAt;

    /** Set while PAUSED. */
    @Column(name = "remaining_seconds")
    private Integer remainingSeconds;
}
