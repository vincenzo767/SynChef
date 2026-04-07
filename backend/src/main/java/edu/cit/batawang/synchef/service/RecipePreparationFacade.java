package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.dto.ScaledRecipeDTO;
import edu.cit.batawang.synchef.dto.TimerOrchestrationDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RecipePreparationFacade {

    private final RecipeScalingService recipeScalingService;
    private final TimerOrchestrationService timerOrchestrationService;

    public ScaledRecipeDTO getScaledRecipe(Long recipeId, Integer servings) {
        return recipeScalingService.scaleRecipe(recipeId, servings);
    }

    public TimerOrchestrationDTO getTimerOrchestration(Long recipeId) {
        return timerOrchestrationService.orchestrateTimers(recipeId);
    }
}
