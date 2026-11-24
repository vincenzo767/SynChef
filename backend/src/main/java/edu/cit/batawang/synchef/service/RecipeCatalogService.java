package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.dto.RecipeDtos.CategoryTag;
import edu.cit.batawang.synchef.dto.RecipeDtos.CountryOption;
import edu.cit.batawang.synchef.dto.RecipeDtos.CountryResponse;
import edu.cit.batawang.synchef.dto.RecipeDtos.IngredientLine;
import edu.cit.batawang.synchef.dto.RecipeDtos.PageResponse;
import edu.cit.batawang.synchef.dto.RecipeDtos.RecipeDetail;
import edu.cit.batawang.synchef.dto.RecipeDtos.RecipeFacets;
import edu.cit.batawang.synchef.dto.RecipeDtos.RecipeSummary;
import edu.cit.batawang.synchef.dto.RecipeDtos.StepLine;
import edu.cit.batawang.synchef.exception.ApiException;
import edu.cit.batawang.synchef.model.Country;
import edu.cit.batawang.synchef.model.Recipe;
import edu.cit.batawang.synchef.model.Step;
import edu.cit.batawang.synchef.repository.CountryRepository;
import edu.cit.batawang.synchef.repository.RecipeRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Read model of the recipe catalogue: search, detail, facets, recommendations and countries.
 */
@Service
@RequiredArgsConstructor
public class RecipeCatalogService {

    private static final int MAX_PAGE_SIZE = 48;
    private static final List<String> DIFFICULTIES = List.of("EASY", "MEDIUM", "HARD");

    private final RecipeRepository recipeRepository;
    private final CountryRepository countryRepository;

    @Transactional(readOnly = true)
    public PageResponse<RecipeSummary> search(String query, String region, String countryCode, String difficulty,
                                              Integer maxMinutes, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        Specification<Recipe> spec = buildSpec(query, region, countryCode, difficulty, maxMinutes);
        Page<Recipe> result = recipeRepository.findAll(spec,
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Order.asc("name"))));
        return new PageResponse<>(
                result.getContent().stream().map(RecipeCatalogService::toSummary).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public RecipeDetail getDetail(Long id) {
        return toDetail(requireRecipe(id));
    }

    @Transactional(readOnly = true)
    public List<RecipeSummary> getSummaries(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        Map<Long, Recipe> byId = new HashMap<>();
        recipeRepository.findAllById(ids).forEach(r -> byId.put(r.getId(), r));
        return ids.stream().map(byId::get).filter(Objects::nonNull).distinct()
                .map(RecipeCatalogService::toSummary).toList();
    }

    /**
     * Recipes from the user's country first, then the same culinary region, then the rest.
     */
    @Transactional(readOnly = true)
    public List<RecipeSummary> recommendations(String countryCode, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 24);
        List<Recipe> all = recipeRepository.findAll(Sort.by("name"));
        if (countryCode == null || countryCode.isBlank()) {
            return all.stream().limit(safeLimit).map(RecipeCatalogService::toSummary).toList();
        }
        String code = countryCode.trim().toUpperCase(Locale.ROOT);
        String region = all.stream()
                .filter(r -> code.equals(r.getCountry().getCode()))
                .map(Recipe::getRegion).filter(Objects::nonNull).findFirst()
                .orElseGet(() -> countryRepository.findByCode(code).map(c -> regionForContinent(c.getContinent())).orElse(null));
        Comparator<Recipe> relevance = Comparator.comparingInt(r -> {
            if (code.equals(r.getCountry().getCode())) return 0;
            if (region != null && region.equals(r.getRegion())) return 1;
            return 2;
        });
        return all.stream().sorted(relevance).limit(safeLimit).map(RecipeCatalogService::toSummary).toList();
    }

    @Transactional(readOnly = true)
    public RecipeFacets facets() {
        Map<String, Long> counts = recipeCountsByCountry();
        List<CountryOption> countries = countryRepository.findAll().stream()
                .filter(c -> counts.getOrDefault(c.getCode(), 0L) > 0)
                .sorted(Comparator.comparing(Country::getName))
                .map(c -> new CountryOption(c.getCode(), c.getName(), c.getFlagEmoji(), counts.get(c.getCode())))
                .toList();
        return new RecipeFacets(recipeRepository.findDistinctRegions(), countries, DIFFICULTIES);
    }

    @Transactional(readOnly = true)
    public List<CountryResponse> countries() {
        Map<String, Long> counts = recipeCountsByCountry();
        return countryRepository.findAll().stream()
                .sorted(Comparator.comparing(Country::getName))
                .map(c -> toCountry(c, counts.getOrDefault(c.getCode(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public CountryResponse country(String code) {
        Country country = countryRepository.findByCode(code.trim().toUpperCase(Locale.ROOT))
                .orElseThrow(() -> ApiException.notFound("Country not found"));
        return toCountry(country, recipeCountsByCountry().getOrDefault(country.getCode(), 0L));
    }

    @Transactional(readOnly = true)
    public List<RecipeSummary> byCountry(String code) {
        return recipeRepository.findByCountryCode(code.trim().toUpperCase(Locale.ROOT)).stream()
                .map(RecipeCatalogService::toSummary).toList();
    }

    public Recipe requireRecipe(Long id) {
        return recipeRepository.findById(id).orElseThrow(() -> ApiException.notFound("Recipe not found"));
    }

    // ── mapping ─────────────────────────────────────────────────────────────

    public static RecipeSummary toSummary(Recipe r) {
        Country c = r.getCountry();
        int timers = (int) r.getSteps().stream().filter(s -> s.getTimerSeconds() != null && s.getTimerSeconds() > 0).count();
        return new RecipeSummary(
                r.getId(), r.getName(), r.getDescription(), r.getImageUrl(),
                r.getCuisine(), r.getRegion() != null ? r.getRegion() : regionForContinent(c.getContinent()),
                c.getCode(), c.getName(), c.getFlagEmoji(),
                r.getTotalTimeMinutes(), r.getDifficultyLevel(), r.getDefaultServings(),
                r.getSteps().size(), timers);
    }

    static RecipeDetail toDetail(Recipe r) {
        List<CategoryTag> categories = r.getCategories().stream()
                .map(c -> new CategoryTag(c.getId(), c.getName(), c.getIconName(), c.getColorCode())).toList();
        List<IngredientLine> ingredients = r.getIngredients().stream()
                .map(ri -> new IngredientLine(ri.getId(), ri.getIngredient().getName(),
                        ri.getAmountText() != null ? ri.getAmountText()
                                : AmountParser.display(ri.getQuantity(), ri.getUnit(), null),
                        ri.getQuantity(), ri.getUnit(), ri.getPreparation(),
                        Boolean.TRUE.equals(ri.getIsOptional()), ri.getNotes()))
                .toList();
        List<StepLine> steps = new ArrayList<>();
        for (Step s : r.getSteps()) {
            steps.add(new StepLine(s.getId(), s.getOrderIndex(), s.getInstruction(),
                    s.getTimerSeconds() != null && s.getTimerSeconds() > 0 ? s.getTimerSeconds() : null,
                    s.getTimerLabel(), s.getTips(), s.getTemperature(),
                    Boolean.TRUE.equals(s.getIsParallel()), s.getParallelGroup()));
        }
        return new RecipeDetail(toSummary(r), r.getCulturalContext(), r.getPrepTimeMinutes(), r.getCookTimeMinutes(),
                categories, ingredients, steps, r.getSourceUrl(), r.getImageSourceUrl(), r.getVideoUrl());
    }

    private static CountryResponse toCountry(Country c, long recipeCount) {
        return new CountryResponse(c.getId(), c.getCode(), c.getName(), c.getContinent(), c.getFlagEmoji(),
                c.getLatitude(), c.getLongitude(), c.getDescription(), recipeCount);
    }

    private Map<String, Long> recipeCountsByCountry() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (Object[] row : recipeRepository.countByCountryCode()) {
            counts.put((String) row[0], ((Number) row[1]).longValue());
        }
        return counts;
    }

    /** Maps stored continent keys (e.g. NORTH_AMERICA) to display regions. */
    static String regionForContinent(String continent) {
        if (continent == null) return null;
        String[] words = continent.toLowerCase(Locale.ROOT).split("_");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (w.isEmpty()) continue;
            if (!sb.isEmpty()) sb.append(' ');
            sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1));
        }
        return sb.toString();
    }

    private Specification<Recipe> buildSpec(String query, String region, String countryCode, String difficulty,
                                            Integer maxMinutes) {
        return (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (query != null && !query.isBlank()) {
                String like = "%" + escapeLike(query.trim().toLowerCase(Locale.ROOT)) + "%";
                var country = root.join("country");
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like, '\\'),
                        cb.like(cb.lower(root.get("cuisine")), like, '\\'),
                        cb.like(cb.lower(country.get("name")), like, '\\')));
            }
            if (region != null && !region.isBlank()) {
                predicates.add(cb.equal(root.get("region"), region.trim()));
            }
            if (countryCode != null && !countryCode.isBlank()) {
                predicates.add(cb.equal(root.get("country").get("code"), countryCode.trim().toUpperCase(Locale.ROOT)));
            }
            if (difficulty != null && !difficulty.isBlank()) {
                predicates.add(cb.equal(cb.upper(root.get("difficultyLevel")), difficulty.trim().toUpperCase(Locale.ROOT)));
            }
            if (maxMinutes != null && maxMinutes > 0) {
                predicates.add(cb.lessThanOrEqualTo(root.get("totalTimeMinutes"), maxMinutes));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
