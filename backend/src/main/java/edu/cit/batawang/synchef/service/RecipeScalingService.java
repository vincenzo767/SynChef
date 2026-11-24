package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.dto.ScaledIngredientDTO;
import edu.cit.batawang.synchef.dto.ScaledRecipeDTO;
import edu.cit.batawang.synchef.dto.ScaledStepDTO;
import edu.cit.batawang.synchef.exception.ApiException;
import edu.cit.batawang.synchef.model.Recipe;
import edu.cit.batawang.synchef.model.RecipeIngredient;
import edu.cit.batawang.synchef.model.Step;
import edu.cit.batawang.synchef.repository.RecipeRepository;
import edu.cit.batawang.synchef.service.scaling.IngredientRoundingStrategy;
import edu.cit.batawang.synchef.service.scaling.TimerScalingStrategy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Scales ingredient quantities (Strategy: measurement-aware rounding) and, for steps flagged
 * {@code scalesWithServings}, timer durations (Strategy: logarithmic). Descriptive amounts are
 * returned unchanged.
 */
@Service
@RequiredArgsConstructor
public class RecipeScalingService {

    public static final int MIN_SERVINGS = 1;
    public static final int MAX_SERVINGS = 50;

    private final RecipeRepository recipeRepository;
    private final IngredientRoundingStrategy ingredientRoundingStrategy;
    private final TimerScalingStrategy timerScalingStrategy;

    @Transactional(readOnly = true)
    public ScaledRecipeDTO scaleRecipe(Long recipeId, Integer requestedServings) {
        Recipe recipe = recipeRepository.findById(recipeId)
                .orElseThrow(() -> ApiException.notFound("Recipe not found"));
        return scale(recipe, requestedServings);
    }

    public ScaledRecipeDTO scale(Recipe recipe, Integer requestedServings) {
        if (requestedServings == null || requestedServings < MIN_SERVINGS || requestedServings > MAX_SERVINGS) {
            throw ApiException.badRequest("Servings must be between " + MIN_SERVINGS + " and " + MAX_SERVINGS);
        }
        // Without a published yield, "servings" are batches of the recipe as written (×1, ×2 …).
        boolean yieldKnown = recipe.getDefaultServings() != null && recipe.getDefaultServings() > 0;
        int originalServings = yieldKnown ? recipe.getDefaultServings() : 1;
        double factor = (double) requestedServings / originalServings;

        List<ScaledIngredientDTO> ingredients = recipe.getIngredients().stream()
                .map(ri -> scaleIngredient(ri, factor)).toList();
        List<ScaledStepDTO> steps = recipe.getSteps().stream()
                .map(step -> scaleStep(step, factor)).toList();

        ScaledRecipeDTO result = new ScaledRecipeDTO();
        result.setRecipeId(recipe.getId());
        result.setRecipeName(recipe.getName());
        result.setOriginalServings(yieldKnown ? originalServings : null);
        result.setRequestedServings(requestedServings);
        result.setScalingFactor(factor);
        result.setScaledIngredients(ingredients);
        result.setScaledSteps(steps);
        result.setAdjustedTotalTime(adjustedTotalTime(recipe, factor));
        return result;
    }

    private ScaledIngredientDTO scaleIngredient(RecipeIngredient ri, double factor) {
        BigDecimal original = ri.getQuantity();
        BigDecimal scaled = null;
        if (original != null) {
            scaled = original.multiply(BigDecimal.valueOf(factor)).setScale(2, RoundingMode.HALF_UP);
            scaled = ingredientRoundingStrategy.round(scaled, ri.getUnit());
        }
        ScaledIngredientDTO dto = new ScaledIngredientDTO();
        dto.setIngredientId(ri.getIngredient().getId());
        dto.setIngredientName(ri.getIngredient().getName());
        dto.setOriginalQuantity(original);
        dto.setScaledQuantity(scaled);
        dto.setUnit(ri.getUnit());
        dto.setDisplayAmount(factor == 1.0 && ri.getAmountText() != null
                ? ri.getAmountText()
                : AmountParser.display(scaled, ri.getUnit(), ri.getAmountText()));
        dto.setPreparation(ri.getPreparation());
        dto.setIsOptional(Boolean.TRUE.equals(ri.getIsOptional()));
        dto.setNotes(ri.getNotes());
        return dto;
    }

    private ScaledStepDTO scaleStep(Step step, double factor) {
        Integer timer = step.getTimerSeconds() != null && step.getTimerSeconds() > 0 ? step.getTimerSeconds() : null;
        Integer scaledTimer = timer;
        if (timer != null && Boolean.TRUE.equals(step.getScalesWithServings())) {
            scaledTimer = timerScalingStrategy.scale(timer, factor);
        }
        ScaledStepDTO dto = new ScaledStepDTO();
        dto.setStepId(step.getId());
        dto.setOrderIndex(step.getOrderIndex());
        dto.setInstruction(step.getInstruction());
        dto.setHasTimer(timer != null);
        dto.setOriginalTimerSeconds(timer);
        dto.setScaledTimerSeconds(scaledTimer);
        dto.setTimerLabel(step.getTimerLabel());
        dto.setIsParallel(Boolean.TRUE.equals(step.getIsParallel()));
        dto.setParallelGroup(step.getParallelGroup());
        dto.setTips(step.getTips());
        dto.setTemperature(step.getTemperature());
        return dto;
    }

    private Integer adjustedTotalTime(Recipe recipe, double factor) {
        Integer prep = recipe.getPrepTimeMinutes();
        Integer cook = recipe.getCookTimeMinutes();
        if (prep == null || cook == null) {
            // Only a total is published (curated catalogue): scale it gently like cook time.
            Integer total = recipe.getTotalTimeMinutes();
            return total == null ? null : (int) Math.round(total * Math.pow(factor, 0.3));
        }
        return (int) (prep * Math.pow(factor, 0.5)) + (int) (cook * Math.pow(factor, 0.3));
    }
}
