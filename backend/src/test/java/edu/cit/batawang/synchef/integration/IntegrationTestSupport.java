package edu.cit.batawang.synchef.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
abstract class IntegrationTestSupport {

    static final String SESSION_COOKIE = "SYNCHEF_SESSION";
    private static final AtomicInteger IP = new AtomicInteger(1);

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected ObjectMapper json;

    /** Each test client gets its own address so the login rate limiter doesn't interfere. */
    protected String nextIp() {
        int n = IP.incrementAndGet();
        return "10.1." + (n / 250) + "." + (n % 250);
    }

    protected record Account(String email, String username, String password, Cookie session, long id) {
    }

    protected Account register() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String email = "chef-" + suffix + "@example.com";
        String username = "chef_" + suffix;
        String password = "Sup3rSecret-" + suffix;
        String ip = nextIp();
        MvcResult result = mvc.perform(post("/api/auth/register").with(csrf()).with(r -> { r.setRemoteAddr(ip); return r; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", email, "username", username, "password", password,
                                "confirmPassword", password, "fullName", "Chef " + suffix,
                                "countryCode", "IT", "countryName", "Italy"))))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode body = json.readTree(result.getResponse().getContentAsString());
        return new Account(email, username, password, sessionCookie(result), body.get("id").asLong());
    }

    protected Account login(String identifier, String password) throws Exception {
        String ip = nextIp();
        MvcResult result = mvc.perform(post("/api/auth/login").with(csrf()).with(r -> { r.setRemoteAddr(ip); return r; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("emailOrUsername", identifier, "password", password))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = json.readTree(result.getResponse().getContentAsString());
        return new Account(body.get("email").asText(), body.get("username").asText(), password,
                sessionCookie(result), body.get("id").asLong());
    }

    protected Account admin() throws Exception {
        return login("admin@test.local", "AdminTestPassword!1");
    }

    protected Cookie sessionCookie(MvcResult result) {
        String header = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE).stream()
                .filter(h -> h.startsWith(SESSION_COOKIE + "="))
                .findFirst()
                .orElseThrow(() -> new AssertionError("No session cookie issued"));
        String value = header.substring(SESSION_COOKIE.length() + 1, header.indexOf(';'));
        return new Cookie(SESSION_COOKIE, value);
    }

    protected MockHttpServletRequestBuilder as(Account account, MockHttpServletRequestBuilder request) {
        return request.cookie(account.session());
    }

    protected MockHttpServletRequestBuilder jsonBody(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return request.with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
    }

    protected JsonNode read(MvcResult result) throws Exception {
        return json.readTree(result.getResponse().getContentAsString());
    }
}
