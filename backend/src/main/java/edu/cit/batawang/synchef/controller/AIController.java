package edu.cit.batawang.synchef.controller;

import edu.cit.batawang.synchef.exception.ApiException;
import edu.cit.batawang.synchef.security.AuthenticatedUser;
import edu.cit.batawang.synchef.security.RateLimiter;
import edu.cit.batawang.synchef.service.AIAssistantService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Optional AI assistant. Requires a signed-in user (it spends a paid API quota), is rate limited per
 * user, and reports 503 when no API key is configured instead of returning canned "AI" text.
 */
@RestController
@RequestMapping("/api/ai")
@Validated
public class AIController {

    private final AIAssistantService aiService;
    private final RateLimiter rateLimiter;
    private final boolean enabled;

    public AIController(AIAssistantService aiService, RateLimiter rateLimiter,
                        @Value("${spring.ai.openai.api-key:}") String apiKey) {
        this.aiService = aiService;
        this.rateLimiter = rateLimiter;
        this.enabled = apiKey != null && !apiKey.isBlank() && !"not-configured".equals(apiKey);
    }

    public record SubstitutionRequest(@NotBlank @Size(max = 120) String ingredientName,
                                      @Size(max = 80) String userRegion,
                                      @Size(max = 10) List<@Size(max = 60) String> allergies) {
    }

    public record TimingOptimizationRequest(@NotEmpty @Size(max = 40) List<@Size(max = 1000) String> stepDescriptions,
                                            @Min(1) @Max(50) Integer servings) {
    }

    public record TipsRequest(@NotBlank @Size(max = 200) String recipeName,
                              @Size(max = 20) String skillLevel,
                              @Size(max = 10) List<@Size(max = 60) String> dietaryRestrictions) {
    }

    @GetMapping("/status")
    public Map<String, Boolean> status() {
        return Map.of("enabled", enabled);
    }

    @PostMapping("/substitutions")
    public List<String> getSubstitutions(@AuthenticationPrincipal AuthenticatedUser user,
                                         @Valid @RequestBody SubstitutionRequest request) {
        guard(user);
        return aiService.suggestSubstitutions(request.ingredientName(),
                request.userRegion() == null || request.userRegion().isBlank() ? "any region" : request.userRegion(),
                request.allergies() == null ? List.of() : request.allergies());
    }

    @PostMapping("/optimize-timing")
    public Map<String, String> optimizeTiming(@AuthenticationPrincipal AuthenticatedUser user,
                                              @Valid @RequestBody TimingOptimizationRequest request) {
        guard(user);
        return Map.of("text", aiService.optimizeTimingStrategy(request.stepDescriptions(),
                request.servings() == null ? 4 : request.servings()));
    }

    @PostMapping("/personalized-tips")
    public Map<String, String> getPersonalizedTips(@AuthenticationPrincipal AuthenticatedUser user,
                                                   @Valid @RequestBody TipsRequest request) {
        guard(user);
        return Map.of("text", aiService.generatePersonalizedTips(request.recipeName(),
                request.skillLevel() == null || request.skillLevel().isBlank() ? "beginner" : request.skillLevel(),
                request.dietaryRestrictions() == null ? List.of() : request.dietaryRestrictions()));
    }

    @GetMapping("/cultural-context")
    public Map<String, String> getCulturalContext(@AuthenticationPrincipal AuthenticatedUser user,
                                                  @RequestParam @NotBlank @Size(max = 200) String dishName,
                                                  @RequestParam @NotBlank @Size(max = 10) String countryCode) {
        guard(user);
        return Map.of("text", aiService.explainCulturalContext(dishName, countryCode));
    }

    private void guard(AuthenticatedUser user) {
        if (!enabled) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_DISABLED", "The AI assistant is not configured");
        }
        rateLimiter.check("ai:" + user.id(), 20);
    }
}
