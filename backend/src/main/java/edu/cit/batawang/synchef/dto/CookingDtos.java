package edu.cit.batawang.synchef.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.Instant;
import java.util.List;

public final class CookingDtos {

    private CookingDtos() {
    }

    public record StartSessionRequest(
            @NotNull(message = "Recipe is required") Long recipeId,
            @NotNull @Min(value = 1, message = "Servings must be at least 1")
            @Max(value = 50, message = "Servings must be 50 or fewer") Integer servings
    ) {
    }

    public record StepRequest(@NotNull @Min(0) Integer index) {
    }

    public record CompleteStepRequest(@NotNull Boolean completed) {
    }

    public record JoinRequest(
            @NotBlank(message = "Enter a session code")
            @Pattern(regexp = "^[A-Za-z0-9]{6,8}$", message = "Session codes are 6 letters or digits") String code
    ) {
    }

    public record TimerView(Integer stepIndex, String label, Integer durationSeconds, String state,
                            Instant endsAt, Integer remainingSeconds) {
    }

    public record ParticipantView(Long userId, String displayName, Instant joinedAt, boolean host, boolean online) {
    }

    /**
     * Full session state. {@code recipe} is included on fetch/create only; real-time broadcasts omit it.
     * {@code serverTime} lets clients correct clock skew when computing timer countdowns.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CookingSessionView(
            Long id,
            Long recipeId,
            String recipeName,
            String recipeImageUrl,
            Integer servings,
            Integer currentStepIndex,
            Integer totalSteps,
            List<Integer> completedSteps,
            List<TimerView> timers,
            List<ParticipantView> participants,
            String status,
            String joinCode,
            Long hostUserId,
            Instant startedAt,
            Instant updatedAt,
            Instant completedAt,
            Long version,
            Instant serverTime,
            String lastAction,
            ScaledRecipeDTO recipe
    ) {
    }
}
