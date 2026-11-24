package edu.cit.batawang.synchef.integration;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Authentication, session cookie, CSRF and credential-handling guarantees.
 */
class AuthSecurityIT extends IntegrationTestSupport {

    @Test
    void registrationSetsHardenedHttpOnlyCookieAndNeverReturnsCredentials() throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/register").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", "Cookie.Test@Example.com", "username", "cookie_test", "password", "CorrectHorse9",
                                "confirmPassword", "CorrectHorse9", "fullName", "Cookie Tester"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("cookie.test@example.com"))
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContain("token").doesNotContain("password\"").doesNotContain("CorrectHorse9");
        assertThat(result.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
                .anySatisfy(h -> assertThat(h).startsWith(SESSION_COOKIE + "=")
                        .contains("HttpOnly").contains("Secure").contains("SameSite=Lax").contains("Path=/"));
    }

    @Test
    void stateChangingRequestsWithoutCsrfTokenAreRejected() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emailOrUsername\":\"x\",\"password\":\"y\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void sessionCookieAuthenticatesAndLogoutRevokesItServerSide() throws Exception {
        Account account = register();
        mvc.perform(as(account, get("/api/users/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(account.username()))
                .andExpect(jsonPath("$.hasPassword").value(true));

        mvc.perform(as(account, post("/api/auth/logout").with(csrf()))).andExpect(status().isNoContent());

        // The same cookie value replayed after logout must no longer work.
        mvc.perform(as(account, get("/api/users/me"))).andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpointsRequireAuthentication() throws Exception {
        mvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(get("/api/syncook/public")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/cooking-sessions/active")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users/me").cookie(new Cookie(SESSION_COOKIE, "forged-token-value")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginFailuresAreGenericAndRateLimited() throws Exception {
        Account account = register();
        String ip = nextIp();
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/login").with(csrf()).with(r -> { r.setRemoteAddr(ip); return r; })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsString(Map.of("emailOrUsername", account.email(), "password", "wrong-password"))))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.message").value("Incorrect email/username or password"));
        }
        mvc.perform(post("/api/auth/login").with(csrf()).with(r -> { r.setRemoteAddr(ip); return r; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("emailOrUsername", account.email(), "password", account.password()))))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void registrationValidatesInput() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).with(r -> { r.setRemoteAddr(nextIp()); return r; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", "not-an-email", "username", "a",
                                "password", "short", "confirmPassword", "short", "fullName", ""))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.email").exists())
                .andExpect(jsonPath("$.fieldErrors.password").exists());
    }

    @Test
    void passwordChangeRequiresCurrentPasswordAndRevokesOtherSessions() throws Exception {
        Account account = register();
        Account secondDevice = login(account.email(), account.password());

        mvc.perform(jsonBody(as(account, post("/api/users/me/password")),
                        Map.of("currentPassword", "wrong", "newPassword", "BrandNewPass9", "confirmPassword", "BrandNewPass9")))
                .andExpect(status().isBadRequest());

        mvc.perform(jsonBody(as(account, post("/api/users/me/password")),
                        Map.of("currentPassword", account.password(), "newPassword", "BrandNewPass9", "confirmPassword", "BrandNewPass9")))
                .andExpect(status().isNoContent());

        mvc.perform(as(account, get("/api/users/me"))).andExpect(status().isOk());
        mvc.perform(as(secondDevice, get("/api/users/me"))).andExpect(status().isUnauthorized());
        login(account.email(), "BrandNewPass9");
    }

    @Test
    void accountDeletionRequiresConfirmationAndRemovesAccess() throws Exception {
        Account account = register();
        mvc.perform(jsonBody(as(account, delete("/api/users/me")), Map.of("password", account.password(), "confirmation", "nope")))
                .andExpect(status().isBadRequest());
        mvc.perform(jsonBody(as(account, delete("/api/users/me")), Map.of("password", account.password(), "confirmation", "DELETE")))
                .andExpect(status().isNoContent());
        mvc.perform(as(account, get("/api/users/me"))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").with(csrf()).with(r -> { r.setRemoteAddr(nextIp()); return r; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("emailOrUsername", account.email(), "password", account.password()))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void securityHeadersArePresent() throws Exception {
        MvcResult result = mvc.perform(get("/api/recipes/facets")).andExpect(status().isOk()).andReturn();
        assertThat(result.getResponse().getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(result.getResponse().getHeader("X-Frame-Options")).isEqualTo("DENY");
        assertThat(result.getResponse().getHeader("Content-Security-Policy")).contains("frame-ancestors 'none'");
    }

    @Test
    void profileUpdatePersists() throws Exception {
        Account account = register();
        JsonNode updated = read(mvc.perform(jsonBody(as(account, org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/users/me")),
                        Map.of("fullName", "Renamed Chef", "countryCode", "jp", "countryName", "Japan")))
                .andExpect(status().isOk()).andReturn());
        assertThat(updated.get("fullName").asText()).isEqualTo("Renamed Chef");
        assertThat(updated.get("countryCode").asText()).isEqualTo("JP");

        mvc.perform(jsonBody(as(account, org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/users/me/preferences")),
                        Map.of("themePreference", "PURPLE")))
                .andExpect(status().isBadRequest());
    }
}
