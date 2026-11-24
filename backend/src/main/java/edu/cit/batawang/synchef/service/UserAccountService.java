package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.dto.AuthDtos.ChangePasswordRequest;
import edu.cit.batawang.synchef.dto.AuthDtos.DeleteAccountRequest;
import edu.cit.batawang.synchef.dto.AuthDtos.SessionInfo;
import edu.cit.batawang.synchef.dto.AuthDtos.UpdatePreferencesRequest;
import edu.cit.batawang.synchef.dto.AuthDtos.UpdateProfileRequest;
import edu.cit.batawang.synchef.dto.AuthDtos.UserProfileResponse;
import edu.cit.batawang.synchef.dto.AuthDtos.UserStatsResponse;
import edu.cit.batawang.synchef.dto.RecipeDtos.RecipeSummary;
import edu.cit.batawang.synchef.exception.ApiException;
import edu.cit.batawang.synchef.model.CookingSession;
import edu.cit.batawang.synchef.model.Recipe;
import edu.cit.batawang.synchef.model.User;
import edu.cit.batawang.synchef.repository.CookingSessionRepository;
import edu.cit.batawang.synchef.repository.RecipeReportRepository;
import edu.cit.batawang.synchef.repository.RecipeRepository;
import edu.cit.batawang.synchef.repository.SynCookCommentRepository;
import edu.cit.batawang.synchef.repository.SynCookRecipeRepository;
import edu.cit.batawang.synchef.repository.UserRepository;
import edu.cit.batawang.synchef.security.SessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * The signed-in user's own account: profile, preferences, favorites, password, sessions,
 * statistics and account deletion.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserAccountService {

    public static final String PROFILE_QUEUE = "/queue/profile";
    private static final Duration MAX_COUNTED_SESSION = Duration.ofHours(6);

    private final UserRepository userRepository;
    private final RecipeRepository recipeRepository;
    private final CookingSessionRepository cookingSessionRepository;
    private final SynCookRecipeRepository synCookRecipeRepository;
    private final SynCookCommentRepository commentRepository;
    private final RecipeReportRepository reportRepository;
    private final SynCookService synCookService;
    private final NotificationService notificationService;
    private final ProfileImageStorageService imageStorage;
    private final SessionService sessionService;
    private final PasswordEncoder passwordEncoder;
    private final RealtimePublisher realtime;
    private final RecipeCatalogService catalogService;

    @Transactional(readOnly = true)
    public UserProfileResponse profile(Long userId) {
        return UserMapper.toProfile(require(userId));
    }

    @Transactional
    public UserProfileResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = require(userId);
        user.setFullName(request.fullName().trim());
        if (request.countryCode() != null && !request.countryCode().isBlank()) {
            user.setCountryCode(request.countryCode().trim().toUpperCase(Locale.ROOT));
            user.setCountryName(request.countryName() != null && !request.countryName().isBlank()
                    ? request.countryName().trim() : user.getCountryCode());
        }
        return publish(userRepository.save(user));
    }

    @Transactional
    public UserProfileResponse updatePreferences(Long userId, UpdatePreferencesRequest request) {
        User user = require(userId);
        if (request.themePreference() != null) {
            user.setThemePreference(request.themePreference());
        }
        if (request.notifyOnComments() != null) {
            user.setNotifyOnComments(request.notifyOnComments());
        }
        return publish(userRepository.save(user));
    }

    @Transactional
    public UserProfileResponse uploadProfileImage(Long userId, MultipartFile file) {
        User user = require(userId);
        String previous = user.getProfileImageUrl();
        user.setProfileImageUrl(imageStorage.store(file, userId));
        imageStorage.deleteIfLocal(previous);
        return publish(userRepository.save(user));
    }

    // ── favorites ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Long> favorites(Long userId) {
        return new ArrayList<>(require(userId).getFavoriteRecipeIds());
    }

    @Transactional(readOnly = true)
    public List<RecipeSummary> favoriteRecipes(Long userId) {
        return catalogService.getSummaries(require(userId).getFavoriteRecipeIds());
    }

    @Transactional
    public List<Long> addFavorite(Long userId, Long recipeId) {
        if (!recipeRepository.existsById(recipeId)) {
            throw ApiException.notFound("Recipe not found");
        }
        User user = require(userId);
        if (!user.getFavoriteRecipeIds().contains(recipeId)) {
            user.getFavoriteRecipeIds().add(recipeId);
            publish(userRepository.save(user));
        }
        return new ArrayList<>(user.getFavoriteRecipeIds());
    }

    @Transactional
    public List<Long> removeFavorite(Long userId, Long recipeId) {
        User user = require(userId);
        if (user.getFavoriteRecipeIds().remove(recipeId)) {
            publish(userRepository.save(user));
        }
        return new ArrayList<>(user.getFavoriteRecipeIds());
    }

    // ── security ────────────────────────────────────────────────────────────

    @Transactional
    public void changePassword(Long userId, Long currentSessionId, ChangePasswordRequest request) {
        User user = require(userId);
        boolean hasPassword = user.getPassword() != null && !user.getPassword().isBlank();
        if (hasPassword && (request.currentPassword() == null
                || !passwordEncoder.matches(request.currentPassword(), user.getPassword()))) {
            throw ApiException.badRequest("Your current password is incorrect");
        }
        if (!request.newPassword().equals(request.confirmPassword())) {
            throw ApiException.badRequest("New passwords do not match");
        }
        if (hasPassword && passwordEncoder.matches(request.newPassword(), user.getPassword())) {
            throw ApiException.badRequest("Choose a password you haven't used for this account");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        int revoked = sessionService.revokeOthers(userId, currentSessionId);
        log.info("Password changed for user {}; {} other sessions revoked", userId, revoked);
    }

    @Transactional(readOnly = true)
    public List<SessionInfo> sessions(Long userId, Long currentSessionId) {
        return sessionService.listForUser(userId).stream()
                .map(s -> new SessionInfo(s.getId(), s.getCreatedAt(), s.getLastSeenAt(), s.getUserAgent(),
                        s.getId().equals(currentSessionId)))
                .toList();
    }

    @Transactional
    public int signOutOtherSessions(Long userId, Long currentSessionId) {
        return sessionService.revokeOthers(userId, currentSessionId);
    }

    @Transactional
    public void deleteOwnAccount(Long userId, DeleteAccountRequest request) {
        User user = require(userId);
        if (!"DELETE".equals(request.confirmation())) {
            throw ApiException.badRequest("Type DELETE to confirm");
        }
        boolean hasPassword = user.getPassword() != null && !user.getPassword().isBlank();
        if (hasPassword && (request.password() == null || !passwordEncoder.matches(request.password(), user.getPassword()))) {
            throw ApiException.badRequest("Your password is incorrect");
        }
        if (user.isAdmin() && userRepository.findAllByRole("ADMIN").stream()
                .filter(u -> Boolean.TRUE.equals(u.getActive())).count() <= 1) {
            throw ApiException.badRequest("Assign another administrator before deleting the last admin account");
        }
        deleteAccountData(user);
    }

    /**
     * Removes a user and everything they own. Moderation records are kept but anonymized.
     */
    @Transactional
    public void deleteAccountData(User user) {
        Long userId = user.getId();
        sessionService.revokeAll(userId);
        notificationService.deleteAllFor(userId);

        synCookRecipeRepository.findByOwnerId(userId).forEach(synCookService::deleteRecipe);
        commentRepository.deleteByAuthorId(userId);

        List<CookingSession> hosted = cookingSessionRepository.findByHostUserId(userId);
        cookingSessionRepository.deleteAll(hosted);
        cookingSessionRepository.findForUserByStatus(userId, CookingSession.STATUS_ACTIVE)
                .forEach(s -> s.getParticipants().removeIf(p -> p.getUserId().equals(userId)));

        reportRepository.findAll().forEach(report -> {
            boolean changed = false;
            if (userId.equals(report.getReporterId())) {
                report.setReporterName("Deleted user");
                changed = true;
            }
            if (userId.equals(report.getRecipeOwnerId())) {
                report.setRecipeOwnerName("Deleted user");
                changed = true;
            }
            if (changed) reportRepository.save(report);
        });

        imageStorage.deleteIfLocal(user.getProfileImageUrl());
        userRepository.delete(user);
        log.info("Deleted account {}", userId);
    }

    // ── statistics ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public UserStatsResponse stats(Long userId) {
        User user = require(userId);
        List<Recipe> favorites = recipeRepository.findAllById(user.getFavoriteRecipeIds());
        List<CookingSession> completed = cookingSessionRepository.findForUserByStatus(userId, CookingSession.STATUS_COMPLETED);
        int active = cookingSessionRepository.findForUserByStatus(userId, CookingSession.STATUS_ACTIVE).size();

        Set<String> countries = new HashSet<>();
        favorites.forEach(r -> countries.add(r.getCountry().getCode()));
        Set<Long> cookedRecipes = new HashSet<>();
        long minutes = 0;
        for (CookingSession s : completed) {
            cookedRecipes.add(s.getRecipe().getId());
            countries.add(s.getRecipe().getCountry().getCode());
            if (s.getCompletedAt() != null) {
                Duration d = Duration.between(s.getStartedAt(), s.getCompletedAt());
                minutes += Math.min(d.toMinutes(), MAX_COUNTED_SESSION.toMinutes());
            }
        }
        int shared = synCookRecipeRepository.findByOwnerId(userId).size();
        return new UserStatsResponse(favorites.size(), countries.size(), cookedRecipes.size(), minutes, active, shared);
    }

    private UserProfileResponse publish(User user) {
        UserProfileResponse profile = UserMapper.toProfile(user);
        realtime.toUser(user.getId(), PROFILE_QUEUE, profile);
        return profile;
    }

    private User require(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> ApiException.unauthorized("Please sign in"));
    }
}
