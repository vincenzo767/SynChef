package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.dto.AdminStatsResponse;
import edu.cit.batawang.synchef.dto.AdminUserResponse;
import edu.cit.batawang.synchef.dto.AnalyticsResponse;
import edu.cit.batawang.synchef.dto.ModerationCommentResponse;
import edu.cit.batawang.synchef.exception.ApiException;
import edu.cit.batawang.synchef.model.SynCookComment;
import edu.cit.batawang.synchef.model.User;
import edu.cit.batawang.synchef.repository.CookingSessionRepository;
import edu.cit.batawang.synchef.repository.RecipeReportRepository;
import edu.cit.batawang.synchef.repository.RecipeRepository;
import edu.cit.batawang.synchef.repository.SynCookCommentRepository;
import edu.cit.batawang.synchef.repository.UserRepository;
import edu.cit.batawang.synchef.security.SessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Administrator use cases. Every endpoint calling this service is restricted to ROLE_ADMIN by
 * SecurityConfig; additional guard rails prevent an admin from locking themselves out or
 * removing the last administrator.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminService {

    private static final int TREND_DAYS = 30;

    private final UserRepository userRepository;
    private final RecipeReportRepository reportRepository;
    private final SynCookCommentRepository commentRepository;
    private final RecipeRepository recipeRepository;
    private final CookingSessionRepository cookingSessionRepository;
    private final AdminStatsService stats;
    private final SessionService sessionService;
    private final UserAccountService userAccountService;

    public AdminStatsResponse computeStats() {
        return stats.computeStats();
    }

    /** Kept for callers that broadcast after a change. */
    public void broadcastStats() {
        stats.broadcastStats();
    }

    @Transactional(readOnly = true)
    public List<AdminUserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(UserMapper::toAdmin)
                .sorted(Comparator.comparing(AdminUserResponse::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    @Transactional
    public AdminUserResponse toggleUserStatus(Long actingAdminId, Long userId) {
        if (actingAdminId.equals(userId)) {
            throw ApiException.badRequest("You can't suspend your own account");
        }
        User user = requireUser(userId);
        boolean activate = !Boolean.TRUE.equals(user.getActive());
        if (!activate && user.isAdmin() && countActiveAdmins() <= 1) {
            throw ApiException.badRequest("The last active administrator can't be suspended");
        }
        user.setActive(activate);
        user = userRepository.save(user);
        if (!activate) {
            sessionService.revokeAll(userId); // suspension takes effect immediately
        }
        stats.broadcastStats();
        log.info("Admin {} set user {} active={}", actingAdminId, userId, activate);
        return UserMapper.toAdmin(user);
    }

    @Transactional
    public AdminUserResponse changeUserRole(Long actingAdminId, Long userId, String role) {
        if (!"USER".equals(role) && !"ADMIN".equals(role)) {
            throw ApiException.badRequest("Role must be USER or ADMIN");
        }
        if (actingAdminId.equals(userId)) {
            throw ApiException.badRequest("You can't change your own role");
        }
        User user = requireUser(userId);
        if (user.isAdmin() && "USER".equals(role) && countActiveAdmins() <= 1) {
            throw ApiException.badRequest("At least one administrator must remain");
        }
        user.setRole(role);
        user = userRepository.save(user);
        stats.broadcastStats();
        log.info("Admin {} set user {} role={}", actingAdminId, userId, role);
        return UserMapper.toAdmin(user);
    }

    @Transactional
    public void deleteUser(Long actingAdminId, Long userId) {
        if (actingAdminId.equals(userId)) {
            throw ApiException.badRequest("Delete your own account from Settings instead");
        }
        User user = requireUser(userId);
        if (user.isAdmin() && countActiveAdmins() <= 1) {
            throw ApiException.badRequest("The last administrator can't be deleted");
        }
        userAccountService.deleteAccountData(user);
        stats.broadcastStats();
        log.info("Admin {} deleted user {}", actingAdminId, userId);
    }

    @Transactional(readOnly = true)
    public List<ModerationCommentResponse> getAllComments() {
        return commentRepository.findAllWithRecipeOrderByCreatedAtDesc().stream()
                .map(this::toCommentResponse)
                .toList();
    }

    @Transactional
    public void deleteComment(Long commentId) {
        if (!commentRepository.existsById(commentId)) {
            throw ApiException.notFound("Comment not found");
        }
        commentRepository.deleteById(commentId);
        stats.broadcastStats();
    }

    @Transactional(readOnly = true)
    public AnalyticsResponse getAnalytics() {
        LocalDate from = LocalDate.now().minusDays(TREND_DAYS - 1L);
        LocalDateTime since = from.atStartOfDay();

        AnalyticsResponse a = new AnalyticsResponse();
        a.setOverview(stats.computeStats());
        a.setPlatformRecipes(recipeRepository.count());
        a.setUserRegistrationsLast30Days(trend(from, userRepository.findCreatedAtSince(since).stream()
                .map(LocalDateTime::toLocalDate).toList()));
        a.setReportsLast30Days(trend(from, reportRepository.findReportDatesSince(since).stream()
                .map(LocalDateTime::toLocalDate).toList()));
        Instant sinceInstant = since.atZone(ZoneId.systemDefault()).toInstant();
        a.setCookingSessionsLast30Days(trend(from, cookingSessionRepository.findStartedAtSince(sinceInstant).stream()
                .map(i -> i.atZone(ZoneId.systemDefault()).toLocalDate()).toList()));
        return a;
    }

    private long countActiveAdmins() {
        return userRepository.findAllByRole("ADMIN").stream().filter(u -> Boolean.TRUE.equals(u.getActive())).count();
    }

    private User requireUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private ModerationCommentResponse toCommentResponse(SynCookComment c) {
        ModerationCommentResponse r = new ModerationCommentResponse();
        r.setId(c.getId());
        r.setRecipeId(c.getRecipe().getId());
        r.setRecipeTitle(c.getRecipe().getTitle());
        r.setAuthorId(c.getAuthorId());
        r.setAuthorName(c.getAuthorName());
        r.setContent(c.getContent());
        r.setCreatedAt(c.getCreatedAt());
        return r;
    }

    private List<Map<String, Object>> trend(LocalDate from, List<LocalDate> days) {
        Map<LocalDate, Long> counts = new TreeMap<>();
        for (int i = 0; i < TREND_DAYS; i++) counts.put(from.plusDays(i), 0L);
        LocalDate today = LocalDate.now();
        for (LocalDate day : days) {
            if (day != null && !day.isBefore(from) && !day.isAfter(today)) {
                counts.merge(day, 1L, Long::sum);
            }
        }
        return counts.entrySet().stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", e.getKey().toString());
            m.put("count", e.getValue());
            return m;
        }).toList();
    }
}
