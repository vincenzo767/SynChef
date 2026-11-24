package edu.cit.batawang.synchef.config.migration;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.cit.batawang.synchef.model.Category;
import edu.cit.batawang.synchef.model.Country;
import edu.cit.batawang.synchef.model.Ingredient;
import edu.cit.batawang.synchef.model.Recipe;
import edu.cit.batawang.synchef.model.RecipeIngredient;
import edu.cit.batawang.synchef.model.Step;
import edu.cit.batawang.synchef.repository.CategoryRepository;
import edu.cit.batawang.synchef.repository.CountryRepository;
import edu.cit.batawang.synchef.repository.IngredientRepository;
import edu.cit.batawang.synchef.repository.RecipeRepository;
import edu.cit.batawang.synchef.service.AmountParser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Set;
import java.util.List;
import java.util.Map;

/**
 * Seeds the curated global catalogue (29 recipes, 32 countries) from
 * {@code seed/curated-recipes.json} and {@code seed/countries.json}. These files are a verbatim
 * conversion of the catalogue that previously shipped inside the web bundle and the Android app,
 * so the backend is now the single source of truth. Idempotent: entries are matched by
 * {@code catalogNumber} / country code and never overwritten.
 */
@Component
@Slf4j
public class CatalogSeeder {

    private final CountryRepository countryRepository;
    private final IngredientRepository ingredientRepository;
    private final RecipeRepository recipeRepository;
    private final CategoryRepository categoryRepository;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate tx;

    public CatalogSeeder(CountryRepository countryRepository, IngredientRepository ingredientRepository,
                         RecipeRepository recipeRepository, CategoryRepository categoryRepository,
                         ObjectMapper objectMapper, PlatformTransactionManager transactionManager) {
        this.countryRepository = countryRepository;
        this.ingredientRepository = ingredientRepository;
        this.recipeRepository = recipeRepository;
        this.categoryRepository = categoryRepository;
        this.objectMapper = objectMapper;
        this.tx = new TransactionTemplate(transactionManager);
    }

    record CountrySeed(String code, String name, String continent, String flagEmoji, Double latitude,
                       Double longitude, String description) {
    }

    record IngredientSeed(String amount, String item, String preparation, boolean optional) {
    }

    record StepSeed(String instruction, Integer timerSeconds, String timerLabel, String tip) {
    }

    record RecipeSeed(Integer catalogNumber, String name, String description, String culturalContext,
                      String countryCode, String region, String cuisine, Integer totalTimeMinutes,
                      String difficulty, Integer defaultServings, String imageUrl, String imageSourceUrl,
                      List<IngredientSeed> ingredients, List<StepSeed> steps) {
    }

    record ImportedIngredient(String amount, String item) {
    }

    record ImportedStep(String instruction, Integer timerSeconds, String timerLabel) {
    }

    /** One TheMealDB recipe (see seed/themealdb-recipes.json; snapshot of https://www.themealdb.com). */
    record ImportedRecipe(String sourceRef, String name, String countryCode, String region, String cuisine,
                          String category, String imageUrl, String sourceUrl, String videoUrl,
                          List<ImportedIngredient> ingredients, List<ImportedStep> steps) {
    }

    public record ImageFixes(Map<Integer, ImageFix> byCatalogNumber, ImageFix adobongSitaw) {
    }

    public record ImageFix(String imageUrl, String imageSourceUrl) {
    }

    private static final int IMPORT_CHUNK = 50;

    @Transactional
    public int seedCountries() {
        int created = 0;
        for (CountrySeed seed : read("seed/countries.json", new TypeReference<List<CountrySeed>>() {})) {
            if (countryRepository.findByCode(seed.code()).isPresent()
                    || countryRepository.findByName(seed.name()).isPresent()) {
                continue;
            }
            Country country = new Country();
            country.setCode(seed.code());
            country.setName(seed.name());
            country.setContinent(seed.continent());
            country.setFlagEmoji(seed.flagEmoji());
            country.setLatitude(seed.latitude());
            country.setLongitude(seed.longitude());
            country.setDescription(seed.description());
            countryRepository.save(country);
            created++;
        }
        if (created > 0) log.info("Seeded {} catalogue countries", created);
        return created;
    }

    @Transactional
    public int seedRecipes() {
        List<RecipeSeed> seeds = read("seed/curated-recipes.json", new TypeReference<List<RecipeSeed>>() {});
        Map<String, Ingredient> ingredientCache = new HashMap<>();
        int created = 0;
        for (RecipeSeed seed : seeds) {
            if (recipeRepository.findByCatalogNumber(seed.catalogNumber()).isPresent()) {
                continue;
            }
            Country country = countryRepository.findByCode(seed.countryCode())
                    .orElseThrow(() -> new IllegalStateException("Missing country " + seed.countryCode()));

            Recipe recipe = new Recipe();
            recipe.setCatalogNumber(seed.catalogNumber());
            recipe.setName(seed.name());
            recipe.setDescription(seed.description());
            recipe.setCulturalContext(seed.culturalContext());
            recipe.setCountry(country);
            recipe.setRegion(seed.region());
            recipe.setCuisine(seed.cuisine());
            recipe.setTotalTimeMinutes(seed.totalTimeMinutes());
            recipe.setDifficultyLevel(seed.difficulty());
            recipe.setDefaultServings(seed.defaultServings());
            recipe.setImageUrl(seed.imageUrl());
            recipe.setImageSourceUrl(seed.imageSourceUrl());

            List<RecipeIngredient> lines = new ArrayList<>();
            int order = 1;
            for (IngredientSeed i : seed.ingredients()) {
                AmountParser.ParsedAmount parsed = AmountParser.parse(i.amount());
                RecipeIngredient line = new RecipeIngredient();
                line.setRecipe(recipe);
                line.setIngredient(ingredient(i.item(), ingredientCache));
                line.setQuantity(parsed.quantity());
                line.setUnit(parsed.unit());
                line.setAmountText(i.amount());
                line.setOrderIndex(order++);
                line.setPreparation(i.preparation());
                line.setIsOptional(i.optional());
                lines.add(line);
            }
            recipe.setIngredients(lines);

            List<Step> steps = new ArrayList<>();
            int index = 1;
            for (StepSeed s : seed.steps()) {
                Step step = new Step();
                step.setRecipe(recipe);
                step.setOrderIndex(index++);
                step.setInstruction(s.instruction());
                step.setHasTimer(s.timerSeconds() != null && s.timerSeconds() > 0);
                step.setTimerSeconds(s.timerSeconds());
                step.setTimerLabel(s.timerLabel());
                step.setTips(s.tip());
                step.setIsParallel(false);
                step.setScalesWithServings(false);
                steps.add(step);
            }
            recipe.setSteps(steps);
            recipeRepository.save(recipe);
            created++;
        }
        if (created > 0) log.info("Seeded {} catalogue recipes", created);
        return created;
    }

    /**
     * Imports the TheMealDB snapshot. Runs in chunks (one transaction each) so the persistence
     * context stays small; already-imported recipes (by sourceRef) are skipped.
     */
    public int seedImportedRecipes() {
        List<ImportedRecipe> seeds = read("seed/themealdb-recipes.json", new TypeReference<List<ImportedRecipe>>() {});
        Set<String> existing = new HashSet<>(recipeRepository.findAllSourceRefs());
        List<ImportedRecipe> pending = seeds.stream().filter(r -> !existing.contains(r.sourceRef())).toList();
        if (pending.isEmpty()) return 0;
        log.info("Importing {} TheMealDB recipes...", pending.size());
        Map<String, Ingredient> ingredientCache = new HashMap<>();
        Map<String, Category> categoryCache = new HashMap<>();
        Map<String, Country> countryCache = new HashMap<>();
        int created = 0;
        for (int from = 0; from < pending.size(); from += IMPORT_CHUNK) {
            List<ImportedRecipe> chunk = pending.subList(from, Math.min(pending.size(), from + IMPORT_CHUNK));
            Integer saved = tx.execute(status -> {
                int n = 0;
                for (ImportedRecipe seed : chunk) {
                    Country country = countryCache.computeIfAbsent(seed.countryCode(),
                            code -> countryRepository.findByCode(code).orElse(null));
                    if (country == null) continue;
                    recipeRepository.save(toRecipe(seed, country, ingredientCache, categoryCache));
                    n++;
                }
                return n;
            });
            created += saved == null ? 0 : saved;
        }
        log.info("Imported {} TheMealDB recipes", created);
        return created;
    }

    public ImageFixes imageFixes() {
        return read("seed/curated-image-fixes.json", new TypeReference<ImageFixes>() {});
    }

    private Recipe toRecipe(ImportedRecipe seed, Country country, Map<String, Ingredient> ingredientCache,
                            Map<String, Category> categoryCache) {
        Recipe recipe = new Recipe();
        recipe.setSourceRef(seed.sourceRef());
        recipe.setSourceUrl(seed.sourceUrl());
        recipe.setVideoUrl(seed.videoUrl());
        recipe.setName(seed.name());
        recipe.setCountry(country);
        recipe.setRegion(seed.region());
        recipe.setCuisine(seed.cuisine());
        recipe.setImageUrl(seed.imageUrl());
        if (seed.category() != null) {
            recipe.setCategories(new ArrayList<>(List.of(category(seed.category(), categoryCache))));
        }
        List<RecipeIngredient> lines = new ArrayList<>();
        int order = 1;
        for (ImportedIngredient i : seed.ingredients()) {
            AmountParser.ParsedAmount parsed = AmountParser.parse(i.amount());
            RecipeIngredient line = new RecipeIngredient();
            line.setRecipe(recipe);
            line.setIngredient(ingredient(i.item(), ingredientCache));
            line.setQuantity(parsed.quantity());
            line.setUnit(parsed.unit());
            line.setAmountText(i.amount() == null || i.amount().isBlank() ? null : i.amount());
            line.setOrderIndex(order++);
            line.setIsOptional(false);
            lines.add(line);
        }
        recipe.setIngredients(lines);
        List<Step> steps = new ArrayList<>();
        int index = 1;
        for (ImportedStep st : seed.steps()) {
            Step step = new Step();
            step.setRecipe(recipe);
            step.setOrderIndex(index++);
            step.setInstruction(st.instruction());
            step.setHasTimer(st.timerSeconds() != null && st.timerSeconds() > 0);
            step.setTimerSeconds(st.timerSeconds());
            step.setTimerLabel(st.timerLabel());
            step.setIsParallel(false);
            step.setScalesWithServings(false);
            steps.add(step);
        }
        recipe.setSteps(steps);
        return recipe;
    }

    private Category category(String name, Map<String, Category> cache) {
        return cache.computeIfAbsent(name, n -> categoryRepository.findByName(n).orElseGet(() -> {
            Category c = new Category();
            c.setName(n);
            return categoryRepository.save(c);
        }));
    }

    private Ingredient ingredient(String rawName, Map<String, Ingredient> cache) {
        String name = rawName.length() > 200 ? rawName.substring(0, 200) : rawName;
        return cache.computeIfAbsent(name, n -> ingredientRepository.findByName(n).orElseGet(() -> {
            Ingredient ingredient = new Ingredient();
            ingredient.setName(n);
            ingredient.setIsTraditional(false);
            return ingredientRepository.save(ingredient);
        }));
    }

    private <T> T read(String path, TypeReference<T> type) {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return objectMapper.readValue(in, type);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read seed file " + path, e);
        }
    }
}
