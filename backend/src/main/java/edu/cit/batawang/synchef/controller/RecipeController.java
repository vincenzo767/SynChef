package edu.cit.batawang.synchef.controller;

import edu.cit.batawang.synchef.dto.RecipeDtos.PageResponse;
import edu.cit.batawang.synchef.dto.RecipeDtos.RecipeDetail;
import edu.cit.batawang.synchef.dto.RecipeDtos.RecipeFacets;
import edu.cit.batawang.synchef.dto.RecipeDtos.RecipeSummary;
import edu.cit.batawang.synchef.dto.ScaledRecipeDTO;
import edu.cit.batawang.synchef.dto.TimerOrchestrationDTO;
import edu.cit.batawang.synchef.repository.UserRepository;
import edu.cit.batawang.synchef.security.CurrentUser;
import edu.cit.batawang.synchef.service.RecipeCatalogService;
import edu.cit.batawang.synchef.service.RecipePreparationFacade;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

/**
 * Public, read-only catalogue API. (The former unauthenticated {@code POST /api/recipes}, which
 * bound the JPA entity directly, was removed: it was unused and allowed anonymous writes.)
 */
@RestController
@RequestMapping("/api/recipes")
@RequiredArgsConstructor
@Validated
public class RecipeController {

    private final RecipeCatalogService catalogService;
    private final RecipePreparationFacade preparationFacade;
    private final CurrentUser currentUser;
    private final UserRepository userRepository;

    @GetMapping
    public PageResponse<RecipeSummary> search(
            @RequestParam(required = false) @Size(max = 100) String query,
            @RequestParam(required = false) @Size(max = 40) String region,
            @RequestParam(required = false) @Size(max = 10) String country,
            @RequestParam(required = false) @Size(max = 10) String difficulty,
            @RequestParam(required = false) @Min(1) @Max(1440) Integer maxMinutes,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "12") @Min(1) @Max(48) int size) {
        return catalogService.search(query, region, country, difficulty, maxMinutes, page, size);
    }

    @GetMapping("/facets")
    public ResponseEntity<RecipeFacets> facets() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(5))).body(catalogService.facets());
    }

    /** Country-aware picks: explicit {@code countryCode}, else the signed-in user's country. */
    @GetMapping("/recommendations")
    public List<RecipeSummary> recommendations(@RequestParam(required = false) @Size(max = 10) String countryCode,
                                               @RequestParam(defaultValue = "6") @Min(1) @Max(24) int limit) {
        String code = countryCode;
        if (code == null || code.isBlank()) {
            code = currentUser.principal()
                    .flatMap(p -> userRepository.findById(p.id()))
                    .map(u -> u.getCountryCode())
                    .orElse(null);
        }
        return catalogService.recommendations(code, limit);
    }

    @GetMapping("/{id}")
    public RecipeDetail getRecipe(@PathVariable Long id) {
        return catalogService.getDetail(id);
    }

    @GetMapping("/{id}/scale")
    public ScaledRecipeDTO getScaledRecipe(@PathVariable Long id,
                                           @RequestParam @Min(1) @Max(50) Integer servings) {
        return preparationFacade.getScaledRecipe(id, servings);
    }

    @GetMapping("/{id}/timer-sequence")
    public TimerOrchestrationDTO getTimerSequence(@PathVariable Long id) {
        return preparationFacade.getTimerOrchestration(id);
    }

    @GetMapping("/country/code/{countryCode}")
    public List<RecipeSummary> byCountryCode(@PathVariable @Size(max = 10) String countryCode) {
        return catalogService.byCountry(countryCode);
    }
}
