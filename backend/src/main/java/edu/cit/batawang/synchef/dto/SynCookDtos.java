package edu.cit.batawang.synchef.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class SynCookDtos {

    private SynCookDtos() {
    }

    public record SynCookRecipeRequest(
            @NotBlank(message = "Dish name is required")
            @Size(min = 3, max = 180, message = "Dish name must be 3–180 characters") String title,

            @NotBlank(message = "Country is required")
            @Size(min = 2, max = 120, message = "Country must be 2–120 characters") String country,

            @NotEmpty(message = "Add at least one ingredient")
            @Size(max = 60, message = "A dish can list at most 60 ingredients")
            List<@Size(max = 300, message = "Each ingredient must be 300 characters or less") String> ingredients,

            @NotEmpty(message = "Add at least one procedure step")
            @Size(max = 60, message = "A dish can have at most 60 steps")
            List<@Size(max = 1000, message = "Each step must be 1000 characters or less") String> procedures,

            /* Validated in SynCookService: uploaded path, http(s) URL or legacy data URL. */
            @Size(max = 7_500_000, message = "Image is too large") String imageUrl,

            @Pattern(regexp = "^(?i)(PUBLIC|PRIVATE)?$", message = "Privacy must be PUBLIC or PRIVATE") String privacy
    ) {
    }

    public record CommentRequest(
            @NotBlank(message = "Comment is required")
            @Size(min = 2, max = 500, message = "Comment must be 2–500 characters") String content
    ) {
    }

    public record ReportRequest(
            @NotNull(message = "Recipe is required") Long recipeId,
            @Size(max = 50) String category,
            @NotBlank(message = "Please choose a reason") @Size(max = 500) String reason
    ) {
    }

    public record AppealRequest(
            @NotBlank(message = "Please explain your appeal")
            @Size(max = 1000, message = "Appeal must be 1000 characters or less") String message
    ) {
    }

    public record ImageUploadResponse(String url) {
    }
}
