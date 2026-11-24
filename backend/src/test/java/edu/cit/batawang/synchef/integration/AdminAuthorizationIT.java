package edu.cit.batawang.synchef.integration;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression tests for audit finding S1 (admin API reachable by any signed-in user).
 */
class AdminAuthorizationIT extends IntegrationTestSupport {

    @Test
    void regularUsersCannotReachAdminApi() throws Exception {
        Account user = register();
        Account victim = register();
        mvc.perform(as(user, get("/api/admin/users"))).andExpect(status().isForbidden());
        mvc.perform(as(user, get("/api/admin/stats"))).andExpect(status().isForbidden());
        mvc.perform(as(user, delete("/api/admin/users/" + victim.id()).with(csrf()))).andExpect(status().isForbidden());
        mvc.perform(jsonBody(as(user, patch("/api/admin/users/" + user.id() + "/role")), Map.of("role", "ADMIN")))
                .andExpect(status().isForbidden());
        mvc.perform(as(victim, get("/api/users/me"))).andExpect(status().isOk());
    }

    @Test
    void anonymousCallersGet401() throws Exception {
        mvc.perform(get("/api/admin/users")).andExpect(status().isUnauthorized());
    }

    @Test
    void adminsCanManageUsersWithGuardRails() throws Exception {
        Account admin = admin();
        Account target = register();

        mvc.perform(as(admin, get("/api/admin/users"))).andExpect(status().isOk());
        mvc.perform(as(admin, get("/api/admin/analytics"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.userRegistrationsLast30Days.length()").value(30));

        // Suspension takes effect immediately for the target's existing session.
        mvc.perform(as(admin, patch("/api/admin/users/" + target.id() + "/status").with(csrf())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
        mvc.perform(as(target, get("/api/users/me"))).andExpect(status().isUnauthorized());

        // Admins cannot lock themselves out.
        mvc.perform(as(admin, patch("/api/admin/users/" + admin.id() + "/status").with(csrf())))
                .andExpect(status().isBadRequest());
        mvc.perform(jsonBody(as(admin, patch("/api/admin/users/" + admin.id() + "/role")), Map.of("role", "USER")))
                .andExpect(status().isBadRequest());
        mvc.perform(jsonBody(as(admin, patch("/api/admin/users/" + target.id() + "/role")), Map.of("role", "OWNER")))
                .andExpect(status().isBadRequest());

        mvc.perform(as(admin, delete("/api/admin/users/" + target.id()).with(csrf()))).andExpect(status().isNoContent());
        mvc.perform(as(admin, delete("/api/admin/users/" + target.id()).with(csrf()))).andExpect(status().isNotFound());
    }
}
