package edu.cit.batawang.synchef.integration;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Map;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SynCookIT extends IntegrationTestSupport {

    private Map<String, Object> dish(String privacy, String image) {
        Map<String, Object> body = new java.util.HashMap<>(Map.of(
                "title", "Grandma's Sinigang", "country", "Philippines",
                "ingredients", List.of("1 kg pork ribs", "tamarind"),
                "procedures", List.of("Boil the pork.", "Add tamarind."),
                "privacy", privacy));
        if (image != null) body.put("imageUrl", image);
        return body;
    }

    @Test
    void ownershipPrivacyAndCommentsAreEnforced() throws Exception {
        Account owner = register();
        Account other = register();

        JsonNode created = read(mvc.perform(jsonBody(as(owner, post("/api/syncook")), dish("PUBLIC", null)))
                .andExpect(status().isCreated()).andReturn());
        long id = created.get("id").asLong();

        mvc.perform(jsonBody(as(other, put("/api/syncook/" + id)), dish("PUBLIC", null))).andExpect(status().isForbidden());
        mvc.perform(as(other, delete("/api/syncook/" + id).with(csrf()))).andExpect(status().isForbidden());

        mvc.perform(jsonBody(as(other, post("/api/syncook/" + id + "/comments")), Map.of("content", "x")))
                .andExpect(status().isBadRequest());
        mvc.perform(jsonBody(as(other, post("/api/syncook/" + id + "/comments")), Map.of("content", "Looks delicious!")))
                .andExpect(status().isCreated());
        mvc.perform(as(owner, get("/api/users/me/notifications")))
                .andExpect(jsonPath("$[0].type").value("SYNCOOK_COMMENT"));
        mvc.perform(as(other, get("/api/syncook/public")))
                .andExpect(status().isOk());

        JsonNode privateDish = read(mvc.perform(jsonBody(as(owner, post("/api/syncook")), dish("PRIVATE", null)))
                .andExpect(status().isCreated()).andReturn());
        mvc.perform(as(other, get("/api/syncook/" + privateDish.get("id").asLong()))).andExpect(status().isForbidden());

        mvc.perform(as(owner, delete("/api/syncook/" + id).with(csrf()))).andExpect(status().isNoContent());
    }

    @Test
    void unsafeImagesAndOversizedPayloadsAreRejected() throws Exception {
        Account owner = register();
        mvc.perform(jsonBody(as(owner, post("/api/syncook")), dish("PUBLIC", "javascript:alert(document.cookie)")))
                .andExpect(status().isBadRequest());
        mvc.perform(jsonBody(as(owner, post("/api/syncook")), Map.of("title", "", "country", "PH",
                        "ingredients", List.of(), "procedures", List.of())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void imageUploadVerifiesFileContent() throws Exception {
        Account owner = register();
        MockMultipartFile fakePng = new MockMultipartFile("file", "evil.png", "image/png", "<script>".getBytes());
        mvc.perform(as(owner, multipart("/api/syncook/images").file(fakePng).with(csrf()))).andExpect(status().isBadRequest());

        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
        MockMultipartFile realPng = new MockMultipartFile("file", "dish.png", "image/png", png);
        mvc.perform(as(owner, multipart("/api/syncook/images").file(realPng).with(csrf())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.startsWith("/uploads/syncook-images/dish-")));
    }

    @Test
    void reportWorkflowNotifiesOwnerAndAllowsAppeal() throws Exception {
        Account owner = register();
        Account reporter = register();
        Account admin = admin();
        long dishId = read(mvc.perform(jsonBody(as(owner, post("/api/syncook")), dish("PUBLIC", null))).andReturn()).get("id").asLong();

        mvc.perform(jsonBody(as(owner, post("/api/reports")), Map.of("recipeId", dishId, "reason", "Spam")))
                .andExpect(status().isBadRequest());
        long reportId = read(mvc.perform(jsonBody(as(reporter, post("/api/reports")),
                        Map.of("recipeId", dishId, "category", "Recipe", "reason", "Spam or repeated content")))
                .andExpect(status().isCreated()).andReturn()).get("id").asLong();
        mvc.perform(jsonBody(as(reporter, post("/api/reports")), Map.of("recipeId", dishId, "reason", "Again")))
                .andExpect(status().isConflict());

        mvc.perform(as(reporter, post("/api/admin/reports/" + reportId + "/file-notice").with(csrf()))).andExpect(status().isForbidden());
        mvc.perform(as(admin, post("/api/admin/reports/" + reportId + "/file-notice").with(csrf())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FILED"));

        mvc.perform(as(owner, get("/api/users/me/reports")))
                .andExpect(jsonPath("$[0].status").value("FILED"))
                .andExpect(jsonPath("$[0].reporterName").doesNotExist());
        mvc.perform(jsonBody(as(reporter, post("/api/reports/" + reportId + "/appeal")), Map.of("message", "Not mine")))
                .andExpect(status().isForbidden());
        mvc.perform(jsonBody(as(owner, post("/api/reports/" + reportId + "/appeal")), Map.of("message", "This is my original recipe.")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPEALED"));

        mvc.perform(as(admin, post("/api/admin/reports/" + reportId + "/dismiss").with(csrf())))
                .andExpect(jsonPath("$.status").value("DISMISSED"));
        mvc.perform(as(admin, post("/api/admin/reports/" + reportId + "/resolve").with(csrf()))).andExpect(status().isConflict());
    }
}
