package edu.cit.batawang.synchef.controller;

import edu.cit.batawang.synchef.dto.*;
import edu.cit.batawang.synchef.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@CrossOrigin(originPatterns = {"http://localhost:*", "http://127.0.0.1:*"})
public class AdminController {

    private final AdminService adminService;

    /** GET /api/admin/stats — live dashboard counts */
    @GetMapping("/api/admin/stats")
    public ResponseEntity<AdminStatsResponse> getStats() {
        return ResponseEntity.ok(adminService.computeStats());
    }

    /** GET /api/admin/analytics — full analytics payload */
    @GetMapping("/api/admin/analytics")
    public ResponseEntity<AnalyticsResponse> getAnalytics() {
        return ResponseEntity.ok(adminService.getAnalytics());
    }

    /** GET /api/admin/users — list all users */
    @GetMapping("/api/admin/users")
    public ResponseEntity<List<AdminUserResponse>> getAllUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    /** PATCH /api/admin/users/{id}/status — toggle active / banned */
    @PatchMapping("/api/admin/users/{id}/status")
    public ResponseEntity<AdminUserResponse> toggleStatus(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.toggleUserStatus(id));
    }

    /** PATCH /api/admin/users/{id}/role — change role (USER | ADMIN) */
    @PatchMapping("/api/admin/users/{id}/role")
    public ResponseEntity<AdminUserResponse> changeRole(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String role = body.get("role");
        if (role == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(adminService.changeUserRole(id, role));
    }

    /** DELETE /api/admin/users/{id} — permanently delete a user */
    @DeleteMapping("/api/admin/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        adminService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    /** GET /api/admin/comments — list all comments for moderation */
    @GetMapping("/api/admin/comments")
    public ResponseEntity<List<ModerationCommentResponse>> getAllComments() {
        return ResponseEntity.ok(adminService.getAllComments());
    }

    /** DELETE /api/admin/comments/{id} — remove a comment */
    @DeleteMapping("/api/admin/comments/{id}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long id) {
        adminService.deleteComment(id);
        return ResponseEntity.noContent().build();
    }
}
