package edu.cit.batawang.synchef.controller;

import edu.cit.batawang.synchef.dto.AdminStatsResponse;
import edu.cit.batawang.synchef.dto.AdminUserResponse;
import edu.cit.batawang.synchef.dto.AnalyticsResponse;
import edu.cit.batawang.synchef.dto.ModerationCommentResponse;
import edu.cit.batawang.synchef.security.AuthenticatedUser;
import edu.cit.batawang.synchef.service.AdminService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Administration API — every route requires ROLE_ADMIN (SecurityConfig).
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    public record RoleRequest(@NotBlank @Pattern(regexp = "^(USER|ADMIN)$", message = "Role must be USER or ADMIN") String role) {
    }

    @GetMapping("/stats")
    public AdminStatsResponse getStats() {
        return adminService.computeStats();
    }

    @GetMapping("/analytics")
    public AnalyticsResponse getAnalytics() {
        return adminService.getAnalytics();
    }

    @GetMapping("/users")
    public List<AdminUserResponse> getAllUsers() {
        return adminService.getAllUsers();
    }

    @PatchMapping("/users/{id}/status")
    public AdminUserResponse toggleStatus(@AuthenticationPrincipal AuthenticatedUser admin, @PathVariable Long id) {
        return adminService.toggleUserStatus(admin.id(), id);
    }

    @PatchMapping("/users/{id}/role")
    public AdminUserResponse changeRole(@AuthenticationPrincipal AuthenticatedUser admin, @PathVariable Long id,
                                        @Valid @RequestBody RoleRequest body) {
        return adminService.changeUserRole(admin.id(), id, body.role());
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@AuthenticationPrincipal AuthenticatedUser admin, @PathVariable Long id) {
        adminService.deleteUser(admin.id(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/comments")
    public List<ModerationCommentResponse> getAllComments() {
        return adminService.getAllComments();
    }

    @DeleteMapping("/comments/{id}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long id) {
        adminService.deleteComment(id);
        return ResponseEntity.noContent().build();
    }
}
