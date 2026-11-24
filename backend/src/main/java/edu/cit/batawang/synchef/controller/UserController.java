package edu.cit.batawang.synchef.controller;

import edu.cit.batawang.synchef.dto.AuthDtos.ChangePasswordRequest;
import edu.cit.batawang.synchef.dto.AuthDtos.DeleteAccountRequest;
import edu.cit.batawang.synchef.dto.AuthDtos.SessionInfo;
import edu.cit.batawang.synchef.dto.AuthDtos.UpdatePreferencesRequest;
import edu.cit.batawang.synchef.dto.AuthDtos.UpdateProfileRequest;
import edu.cit.batawang.synchef.dto.AuthDtos.UserProfileResponse;
import edu.cit.batawang.synchef.dto.AuthDtos.UserStatsResponse;
import edu.cit.batawang.synchef.dto.NotificationResponse;
import edu.cit.batawang.synchef.dto.RecipeDtos.RecipeSummary;
import edu.cit.batawang.synchef.dto.RecipeReportResponse;
import edu.cit.batawang.synchef.security.AuthenticatedUser;
import edu.cit.batawang.synchef.security.RateLimiter;
import edu.cit.batawang.synchef.security.SessionService;
import edu.cit.batawang.synchef.service.NotificationService;
import edu.cit.batawang.synchef.service.RecipeReportService;
import edu.cit.batawang.synchef.service.UserAccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * The signed-in user's own resources. Every endpoint operates on the authenticated principal;
 * there is no way to address another user's data here.
 */
@RestController
@RequestMapping("/api/users/me")
@RequiredArgsConstructor
public class UserController {

    private final UserAccountService accountService;
    private final NotificationService notificationService;
    private final RecipeReportService reportService;
    private final SessionService sessionService;
    private final RateLimiter rateLimiter;

    @GetMapping
    public UserProfileResponse me(@AuthenticationPrincipal AuthenticatedUser user) {
        return accountService.profile(user.id());
    }

    @PutMapping
    public UserProfileResponse updateProfile(@AuthenticationPrincipal AuthenticatedUser user,
                                             @Valid @RequestBody UpdateProfileRequest request) {
        return accountService.updateProfile(user.id(), request);
    }

    @PutMapping("/preferences")
    public UserProfileResponse updatePreferences(@AuthenticationPrincipal AuthenticatedUser user,
                                                 @Valid @RequestBody UpdatePreferencesRequest request) {
        return accountService.updatePreferences(user.id(), request);
    }

    @PostMapping(value = "/profile-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UserProfileResponse uploadProfileImage(@AuthenticationPrincipal AuthenticatedUser user,
                                                  @RequestParam("file") MultipartFile file) {
        rateLimiter.check("upload:" + user.id(), 20);
        return accountService.uploadProfileImage(user.id(), file);
    }

    @GetMapping("/stats")
    public UserStatsResponse stats(@AuthenticationPrincipal AuthenticatedUser user) {
        return accountService.stats(user.id());
    }

    // ── favorites ───────────────────────────────────────────────────────────

    @GetMapping("/favorites")
    public List<Long> favorites(@AuthenticationPrincipal AuthenticatedUser user) {
        return accountService.favorites(user.id());
    }

    @GetMapping("/favorites/recipes")
    public List<RecipeSummary> favoriteRecipes(@AuthenticationPrincipal AuthenticatedUser user) {
        return accountService.favoriteRecipes(user.id());
    }

    @PostMapping("/favorites/{recipeId}")
    public List<Long> addFavorite(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long recipeId) {
        return accountService.addFavorite(user.id(), recipeId);
    }

    @DeleteMapping("/favorites/{recipeId}")
    public List<Long> removeFavorite(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long recipeId) {
        return accountService.removeFavorite(user.id(), recipeId);
    }

    // ── security & sessions ─────────────────────────────────────────────────

    @PostMapping("/password")
    public ResponseEntity<Void> changePassword(@AuthenticationPrincipal AuthenticatedUser user,
                                               @Valid @RequestBody ChangePasswordRequest request) {
        rateLimiter.check("password:" + user.id(), 5);
        accountService.changePassword(user.id(), user.sessionId(), request);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/sessions")
    public List<SessionInfo> sessions(@AuthenticationPrincipal AuthenticatedUser user) {
        return accountService.sessions(user.id(), user.sessionId());
    }

    @PostMapping("/sessions/revoke-others")
    public Map<String, Integer> revokeOtherSessions(@AuthenticationPrincipal AuthenticatedUser user) {
        return Map.of("revoked", accountService.signOutOtherSessions(user.id(), user.sessionId()));
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteAccount(@AuthenticationPrincipal AuthenticatedUser user,
                                              @Valid @RequestBody DeleteAccountRequest request) {
        rateLimiter.check("delete:" + user.id(), 5);
        accountService.deleteOwnAccount(user.id(), request);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, sessionService.clearedSessionCookie().toString())
                .build();
    }

    // ── notifications ───────────────────────────────────────────────────────

    @GetMapping("/notifications")
    public List<NotificationResponse> notifications(@AuthenticationPrincipal AuthenticatedUser user,
                                                    @RequestParam(name = "unreadOnly", defaultValue = "false") boolean unreadOnly) {
        return notificationService.getNotifications(user.id(), unreadOnly);
    }

    @GetMapping("/notifications/unread-count")
    public Map<String, Long> unreadCount(@AuthenticationPrincipal AuthenticatedUser user) {
        return Map.of("unreadCount", notificationService.unreadCount(user.id()));
    }

    @PatchMapping("/notifications/{id}/read")
    public NotificationResponse markAsRead(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return notificationService.markAsRead(user.id(), id);
    }

    @PostMapping("/notifications/read-all")
    public Map<String, Long> markAllAsRead(@AuthenticationPrincipal AuthenticatedUser user) {
        return Map.of("markedCount", notificationService.markAllAsRead(user.id()));
    }

    /** Reports filed against the user's own dishes (reporter identity withheld). */
    @GetMapping("/reports")
    public List<RecipeReportResponse> reportsOnMyDishes(@AuthenticationPrincipal AuthenticatedUser user) {
        return reportService.reportsOnMyDishes(user.id());
    }
}
