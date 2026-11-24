package edu.cit.batawang.synchef.integration;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The backend is the single source of truth for the curated catalogue.
 */
class CatalogIT extends IntegrationTestSupport {

    @Test
    void curatedCatalogueIsSeededAndSearchable() throws Exception {
        JsonNode page = read(mvc.perform(get("/api/recipes").param("size", "48")).andExpect(status().isOk()).andReturn());
        // 29 curated + the original "Adobong Sitaw" + 792 imported TheMealDB recipes.
        assertThat(page.get("totalElements").asInt()).isEqualTo(822);

        mvc.perform(get("/api/recipes").param("query", "italian carbonara"))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].name").value("Italian Carbonara"))
                .andExpect(jsonPath("$.content[0].countryCode").value("IT"));

        JsonNode middleEast = read(mvc.perform(get("/api/recipes").param("region", "Middle East").param("size", "48")).andReturn());
        assertThat(middleEast.get("content").findValuesAsText("name")).contains("Lebanese Hummus");

        // LIKE wildcards in user input are escaped.
        mvc.perform(get("/api/recipes").param("query", "%")).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void detailPreservesAuthoredAmountsAndScales() throws Exception {
        JsonNode search = read(mvc.perform(get("/api/recipes").param("query", "italian carbonara")).andReturn());
        long id = search.get("content").get(0).get("id").asLong();

        JsonNode detail = read(mvc.perform(get("/api/recipes/" + id)).andExpect(status().isOk()).andReturn());
        assertThat(detail.get("ingredients").get(0).get("amountText").asText()).isEqualTo("400g");
        assertThat(detail.get("steps").get(0).get("timerSeconds").asInt()).isEqualTo(600);
        assertThat(detail.get("culturalContext").asText()).contains("Rome");

        JsonNode scaled = read(mvc.perform(get("/api/recipes/" + id + "/scale").param("servings", "6"))
                .andExpect(status().isOk()).andReturn());
        assertThat(scaled.get("scaledIngredients").get(0).get("displayAmount").asText()).isEqualTo("600g");

        mvc.perform(get("/api/recipes/" + id + "/scale").param("servings", "0")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/recipes/999999")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Recipe not found"));
    }

    @Test
    void facetsCountriesAndRecommendations() throws Exception {
        mvc.perform(get("/api/recipes/facets")).andExpect(status().isOk())
                .andExpect(jsonPath("$.regions.length()").value(7));
        JsonNode countries = read(mvc.perform(get("/api/countries")).andExpect(status().isOk()).andReturn());
        assertThat(countries.size()).isGreaterThanOrEqualTo(32);
        JsonNode recs = read(mvc.perform(get("/api/recipes/recommendations").param("countryCode", "TH").param("limit", "3"))
                .andExpect(status().isOk()).andReturn());
        assertThat(recs.get(0).get("countryCode").asText()).isEqualTo("TH");
    }

    @Test
    void anonymousWritesToCatalogueAreNotPossible() throws Exception {
        mvc.perform(post("/api/recipes").with(csrf()).contentType("application/json").content("{\"name\":\"x\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void favoritesReferenceRealRecipes() throws Exception {
        Account account = register();
        JsonNode search = read(mvc.perform(get("/api/recipes").param("query", "thai pad thai")).andReturn());
        long id = search.get("content").get(0).get("id").asLong();

        mvc.perform(as(account, post("/api/users/me/favorites/" + id).with(csrf()))).andExpect(status().isOk());
        mvc.perform(as(account, post("/api/users/me/favorites/987654").with(csrf()))).andExpect(status().isNotFound());
        mvc.perform(as(account, get("/api/users/me/favorites/recipes")))
                .andExpect(jsonPath("$[0].name").value("Thai Pad Thai"));
        mvc.perform(as(account, get("/api/users/me/stats")))
                .andExpect(jsonPath("$.savedRecipes").value(1))
                .andExpect(jsonPath("$.countriesExplored").value(1));
    }

    @Test
    void importedRecipesCarryProvenanceAndScaleInBatches() throws Exception {
        JsonNode search = read(mvc.perform(get("/api/recipes").param("query", "Eggplant Adobo")).andReturn());
        JsonNode summary = search.get("content").get(0);
        assertThat(summary.get("countryCode").asText()).isEqualTo("PH");
        assertThat(summary.get("defaultServings").isNull()).isTrue();
        long id = summary.get("id").asLong();

        JsonNode detail = read(mvc.perform(get("/api/recipes/" + id)).andExpect(status().isOk()).andReturn());
        assertThat(detail.get("sourceUrl").asText()).startsWith("https://www.themealdb.com/meal/");
        assertThat(detail.get("summary").get("imageUrl").asText()).startsWith("https://www.themealdb.com/images/");
        assertThat(detail.get("steps").size()).isGreaterThan(1);
        assertThat(detail.get("ingredients").get(0).get("amountText").asText()).isEqualTo("1 lb");

        JsonNode doubled = read(mvc.perform(get("/api/recipes/" + id + "/scale").param("servings", "2")).andReturn());
        assertThat(doubled.get("originalServings").isNull()).isTrue();
        assertThat(doubled.get("scaledIngredients").get(0).get("displayAmount").asText()).isEqualTo("2 lb");
    }

    @Test
    void everyCountryIsSeededAndCuratedPhotosAreAttributed() throws Exception {
        JsonNode countries = read(mvc.perform(get("/api/countries")).andReturn());
        assertThat(countries.size()).isGreaterThanOrEqualTo(196);
        assertThat(countries.findValuesAsText("code")).contains("FJ", "NE", "BT", "IS", "SR", "KH", "ZA");

        JsonNode search = read(mvc.perform(get("/api/recipes").param("query", "Greek Moussaka")).andReturn());
        long id = search.get("content").get(0).get("id").asLong();
        JsonNode detail = read(mvc.perform(get("/api/recipes/" + id)).andReturn());
        assertThat(detail.get("summary").get("imageUrl").asText()).contains("wikimedia.org");
        assertThat(detail.get("imageSourceUrl").asText()).contains("wiki");
    }
}
