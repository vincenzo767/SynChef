package edu.cit.batawang.synchef.integration;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Real-time cooking: authoritative state, timers, collaboration and statistics.
 */
class CookingSessionIT extends IntegrationTestSupport {

    private long carbonaraId() throws Exception {
        return read(mvc.perform(get("/api/recipes").param("query", "italian carbonara")).andReturn())
                .get("content").get(0).get("id").asLong();
    }

    @Test
    void sessionLifecycleWithSharedCollaboration() throws Exception {
        Account host = register();
        Account friend = register();
        Account stranger = register();
        long recipeId = carbonaraId();

        JsonNode session = read(mvc.perform(jsonBody(as(host, post("/api/cooking-sessions")),
                        Map.of("recipeId", recipeId, "servings", 2)))
                .andExpect(status().isOk()).andReturn());
        long id = session.get("id").asLong();
        assertThat(session.get("recipe").get("scaledSteps").size()).isEqualTo(6);
        assertThat(session.get("participants").get(0).get("host").asBoolean()).isTrue();

        // Starting again resumes the same session (progress is not lost).
        JsonNode resumed = read(mvc.perform(jsonBody(as(host, post("/api/cooking-sessions")),
                Map.of("recipeId", recipeId, "servings", 2))).andReturn());
        assertThat(resumed.get("id").asLong()).isEqualTo(id);

        mvc.perform(as(stranger, get("/api/cooking-sessions/" + id))).andExpect(status().isForbidden());

        mvc.perform(jsonBody(as(host, post("/api/cooking-sessions/" + id + "/step")), Map.of("index", 99)))
                .andExpect(status().isBadRequest());
        mvc.perform(jsonBody(as(host, post("/api/cooking-sessions/" + id + "/step")), Map.of("index", 2)))
                .andExpect(jsonPath("$.currentStepIndex").value(2))
                .andExpect(jsonPath("$.lastAction").value(org.hamcrest.Matchers.containsString("moved to step 3")));

        // Timers: step 0 has a 600 s timer; step 1 has none.
        mvc.perform(as(host, post("/api/cooking-sessions/" + id + "/timers/1/start").with(csrf())))
                .andExpect(status().isBadRequest());
        mvc.perform(as(host, post("/api/cooking-sessions/" + id + "/timers/0/start").with(csrf())))
                .andExpect(jsonPath("$.timers[0].state").value("RUNNING"))
                .andExpect(jsonPath("$.timers[0].durationSeconds").value(600));
        mvc.perform(as(host, post("/api/cooking-sessions/" + id + "/timers/0/pause").with(csrf())))
                .andExpect(jsonPath("$.timers[0].state").value("PAUSED"));

        String code = read(mvc.perform(as(host, post("/api/cooking-sessions/" + id + "/share").with(csrf())))
                .andExpect(status().isOk()).andReturn()).get("joinCode").asText();
        assertThat(code).hasSize(6);

        mvc.perform(jsonBody(as(friend, post("/api/cooking-sessions/join")), Map.of("code", "ZZZZZZ")))
                .andExpect(status().isNotFound());
        mvc.perform(jsonBody(as(friend, post("/api/cooking-sessions/join")), Map.of("code", code.toLowerCase())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participants.length()").value(2));

        // The friend can drive the shared session too.
        mvc.perform(jsonBody(as(friend, post("/api/cooking-sessions/" + id + "/steps/2/completion")), Map.of("completed", true)))
                .andExpect(jsonPath("$.completedSteps[0]").value(2));

        mvc.perform(as(friend, post("/api/cooking-sessions/" + id + "/abandon").with(csrf()))).andExpect(status().isForbidden());
        mvc.perform(as(host, post("/api/cooking-sessions/" + id + "/complete").with(csrf())))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.joinCode").doesNotExist());

        mvc.perform(as(host, get("/api/users/me/stats"))).andExpect(jsonPath("$.recipesCooked").value(1));
        mvc.perform(as(friend, get("/api/cooking-sessions/history"))).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(as(host, post("/api/cooking-sessions/" + id + "/timers/0/start").with(csrf())))
                .andExpect(status().isConflict());
    }

    @Test
    void hostLeavingTransfersHosting() throws Exception {
        Account host = register();
        Account friend = register();
        long id = read(mvc.perform(jsonBody(as(host, post("/api/cooking-sessions")),
                Map.of("recipeId", carbonaraId(), "servings", 4))).andReturn()).get("id").asLong();
        String code = read(mvc.perform(as(host, post("/api/cooking-sessions/" + id + "/share").with(csrf()))).andReturn())
                .get("joinCode").asText();
        mvc.perform(jsonBody(as(friend, post("/api/cooking-sessions/join")), Map.of("code", code))).andExpect(status().isOk());

        mvc.perform(as(host, post("/api/cooking-sessions/" + id + "/leave").with(csrf())))
                .andExpect(jsonPath("$.hostUserId").value(friend.id()))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
        mvc.perform(as(host, get("/api/cooking-sessions/" + id))).andExpect(status().isForbidden());
        mvc.perform(as(friend, get("/api/cooking-sessions/active"))).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void servingsAreValidated() throws Exception {
        Account host = register();
        mvc.perform(jsonBody(as(host, post("/api/cooking-sessions")), Map.of("recipeId", carbonaraId(), "servings", 0)))
                .andExpect(status().isBadRequest());
        mvc.perform(jsonBody(as(host, post("/api/cooking-sessions")), Map.of("recipeId", 424242, "servings", 2)))
                .andExpect(status().isNotFound());
    }
}
