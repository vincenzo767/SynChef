package edu.cit.batawang.synchef.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Authentication and account DTOs. Credentials never appear in responses.
 */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank(message = "Email is required")
            @Email(message = "Enter a valid email address")
            @Size(max = 100, message = "Email is too long")
            String email,

            @NotBlank(message = "Username is required")
            @Pattern(regexp = "^[A-Za-z0-9._-]{3,30}$",
                    message = "Username must be 3–30 characters: letters, numbers, dot, dash or underscore")
            String username,

            @NotBlank(message = "Password is required")
            @Size(min = 8, max = 128, message = "Password must be 8–128 characters")
            String password,

            @NotBlank(message = "Please confirm your password")
            String confirmPassword,

            @NotBlank(message = "Full name is required")
            @Size(max = 200, message = "Full name is too long")
            String fullName,

            @Size(max = 10) String countryCode,
            @Size(max = 150) String countryName
    ) {
    }

    public record LoginRequest(
            @NotBlank(message = "Email or username is required") @Size(max = 100) String emailOrUsername,
            @NotBlank(message = "Password is required") @Size(max = 128) String password
    ) {
    }

    public record GoogleLoginRequest(
            @NotBlank(message = "Google token is required") @Size(max = 4096) String idToken
    ) {
    }

    /** The signed-in user's own profile. */
    public record UserProfileResponse(
            Long id,
            String email,
            String username,
            String fullName,
            String profileImageUrl,
            Boolean emailVerified,
            String countryCode,
            String countryName,
            List<Long> favoriteRecipeIds,
            LocalDateTime createdAt,
            String role,
            String themePreference,
            boolean notifyOnComments,
            boolean hasPassword
    ) {
    }

    /** Boot-time session probe: always 200 so the SPA can distinguish "anonymous" from errors. */
    public record SessionResponse(boolean authenticated, UserProfileResponse user, boolean googleEnabled,
                                  String googleClientId) {
    }

    public record UpdateProfileRequest(
            @NotBlank(message = "Full name is required") @Size(max = 200, message = "Full name is too long") String fullName,
            @Size(max = 10) String countryCode,
            @Size(max = 150) String countryName
    ) {
    }

    public record UpdatePreferencesRequest(
            @Pattern(regexp = "^(LIGHT|DARK|SYSTEM)$", message = "Theme must be LIGHT, DARK or SYSTEM") String themePreference,
            Boolean notifyOnComments
    ) {
    }

    public record ChangePasswordRequest(
            @Size(max = 128) String currentPassword,
            @NotBlank(message = "New password is required")
            @Size(min = 8, max = 128, message = "Password must be 8–128 characters") String newPassword,
            @NotBlank(message = "Please confirm your new password") String confirmPassword
    ) {
    }

    public record DeleteAccountRequest(
            @Size(max = 128) String password,
            @NotBlank(message = "Type DELETE to confirm") String confirmation
    ) {
    }

    public record SessionInfo(Long id, Instant createdAt, Instant lastSeenAt, String userAgent, boolean current) {
    }

    public record UserStatsResponse(
            int savedRecipes,
            int countriesExplored,
            int recipesCooked,
            long totalCookingMinutes,
            int activeSessions,
            int sharedDishes
    ) {
    }
}
