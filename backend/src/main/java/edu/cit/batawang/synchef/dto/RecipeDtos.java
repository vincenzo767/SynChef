package edu.cit.batawang.synchef.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Catalogue DTOs (entities are never serialized directly).
 */
public final class RecipeDtos {

    private RecipeDtos() {
    }

    public record RecipeSummary(
            Long id,
            String name,
            String description,
            String imageUrl,
            String cuisine,
            String region,
            String countryCode,
            String countryName,
            String flagEmoji,
            Integer totalTimeMinutes,
            String difficulty,
            Integer defaultServings,
            int stepCount,
            int timerCount
    ) {
    }

    public record CategoryTag(Long id, String name, String icon, String color) {
    }

    public record IngredientLine(
            Long id,
            String name,
            String amountText,
            BigDecimal quantity,
            String unit,
            String preparation,
            boolean optional,
            String notes
    ) {
    }

    public record StepLine(
            Long id,
            int orderIndex,
            String instruction,
            Integer timerSeconds,
            String timerLabel,
            String tips,
            String temperature,
            boolean parallel,
            Integer parallelGroup
    ) {
    }

    public record RecipeDetail(
            RecipeSummary summary,
            String culturalContext,
            Integer prepTimeMinutes,
            Integer cookTimeMinutes,
            List<CategoryTag> categories,
            List<IngredientLine> ingredients,
            List<StepLine> steps,
            /* Provenance: recipe source page, photo licence page, optional video (all nullable). */
            String sourceUrl,
            String imageSourceUrl,
            String videoUrl
    ) {
    }

    public record CountryOption(String code, String name, String flagEmoji, long recipeCount) {
    }

    public record RecipeFacets(List<String> regions, List<CountryOption> countries, List<String> difficulties) {
    }

    public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
    }

    public record CountryResponse(
            Long id,
            String code,
            String name,
            String continent,
            String flagEmoji,
            Double latitude,
            Double longitude,
            String description,
            long recipeCount
    ) {
    }
}
