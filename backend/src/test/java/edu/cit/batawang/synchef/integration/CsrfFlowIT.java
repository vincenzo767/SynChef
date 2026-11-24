package edu.cit.batawang.synchef.integration;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exercises the real double-submit CSRF flow exactly as the SPA performs it. Runs in its own
 * application context because spring-security-test's {@code csrf()} post-processor (used by the
 * other suites) swaps the CSRF repository on the shared filter instance.
 */
@TestPropertySource(properties = "synchef.test.context=csrf-flow")
class CsrfFlowIT extends IntegrationTestSupport {

    @Test
    void sessionProbeIssuesReadableCsrfCookieAndAnonymousState() throws Exception {
        MvcResult result = mvc.perform(get("/api/auth/session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false))
                .andReturn();
        assertThat(result.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
                .anySatisfy(h -> assertThat(h).startsWith("XSRF-TOKEN=").contains("Secure").doesNotContain("HttpOnly"));
    }

    /**
     * Regression: CsrfAuthenticationStrategy treated every cookie-authenticated request as a new
     * login and cleared the XSRF-TOKEN cookie, so every write after sign-in failed with 403.
     */
    @Test
    void csrfTokenSurvivesAuthenticatedRequests() throws Exception {
        Cookie xsrf = mvc.perform(get("/api/auth/session")).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertThat(xsrf).isNotNull();
        MvcResult registered = mvc.perform(post("/api/auth/register").cookie(xsrf).header("X-XSRF-TOKEN", xsrf.getValue())
                        .with(r -> { r.setRemoteAddr(nextIp()); return r; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"csrf.flow@example.com\",\"username\":\"csrf_flow\",\"password\":\"CsrfFlow123\","
                                + "\"confirmPassword\":\"CsrfFlow123\",\"fullName\":\"Csrf Flow\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        Cookie session = sessionCookie(registered);

        MvcResult read = mvc.perform(get("/api/users/me").cookie(session, xsrf)).andExpect(status().isOk()).andReturn();
        assertThat(read.getResponse().getHeaders(HttpHeaders.SET_COOKIE)).noneMatch(h -> h.startsWith("XSRF-TOKEN="));

        mvc.perform(post("/api/users/me/notifications/read-all").cookie(session, xsrf).header("X-XSRF-TOKEN", xsrf.getValue()))
                .andExpect(status().isOk());
    }

    @Test
    void headerMatchingCookieIsAcceptedAndMismatchRejected() throws Exception {
        Cookie xsrf = mvc.perform(get("/api/auth/session")).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertThat(xsrf).isNotNull();

        mvc.perform(post("/api/auth/login").cookie(xsrf).header("X-XSRF-TOKEN", xsrf.getValue())
                        .with(r -> { r.setRemoteAddr(nextIp()); return r; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emailOrUsername\":\"nobody@example.com\",\"password\":\"whatever1\"}"))
                .andExpect(status().isUnauthorized());

        mvc.perform(post("/api/auth/login").cookie(xsrf).header("X-XSRF-TOKEN", "forged")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emailOrUsername\":\"nobody@example.com\",\"password\":\"whatever1\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }
}
