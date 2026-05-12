package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.dto.*;
import edu.cit.batawang.synchef.model.*;
import edu.cit.batawang.synchef.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminService {

    private final UserRepository userRepository;
    private final SynCookRecipeRepository synCookRecipeRepository;
    private final RecipeReportRepository reportRepository;
    private final SynCookCommentRepository commentRepository;
    private final RecipeRepository recipeRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // ── Stats ──────────────────────────────────────────────────────────────

    public AdminStatsResponse computeStats() {
        AdminStatsResponse s = new AdminStatsResponse();
        s.setTotalUsers(userRepository.count());
        s.setActiveUsers(userRepository.countByActive(true));
        s.setBannedUsers(userRepository.countByActive(false));
        s.setTotalSynCookRecipes(synCookRecipeRepository.count());
        s.setPublicRecipes(synCookRecipeRepository.countByPrivacy("PUBLIC"));
        s.setPendingReports(reportRepository.countByStatus("PENDING"));
        s.setTotalReports(reportRepository.count());
        s.setTotalComments(commentRepository.count());
        return s;
    }

    public void broadcastStats() {
        messagingTemplate.convertAndSend("/topic/admin/stats", computeStats());
    }

    // ── User management ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AdminUserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::toUserResponse)
                .sorted(Comparator.comparing(AdminUserResponse::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
    }

    @Transactional
    public AdminUserResponse toggleUserStatus(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setActive(!Boolean.TRUE.equals(user.getActive()));
        user = userRepository.save(user);
        broadcastStats();
        log.info("User {} active toggled to {}", userId, user.getActive());
        return toUserResponse(user);
    }

    @Transactional
    public AdminUserResponse changeUserRole(Long userId, String role) {
        if (!"USER".equals(role) && !"ADMIN".equals(role)) {
            throw new IllegalArgumentException("Role must be USER or ADMIN");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setRole(role);
        user = userRepository.save(user);
        broadcastStats();
        log.info("User {} role set to {}", userId, role);
        return toUserResponse(user);
    }

    @Transactional
    public void deleteUser(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("User not found");
        }
        userRepository.deleteById(userId);
        broadcastStats();
        log.info("User {} deleted by admin", userId);
    }

    // ── Comment moderation ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ModerationCommentResponse> getAllComments() {
        return commentRepository.findAllWithRecipeOrderByCreatedAtDesc().stream()
                .map(this::toCommentResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteComment(Long commentId) {
        if (!commentRepository.existsById(commentId)) {
            throw new IllegalArgumentException("Comment not found");
        }
        commentRepository.deleteById(commentId);
        broadcastStats();
        log.info("Comment {} deleted by admin", commentId);
    }

    // ── Analytics ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AnalyticsResponse getAnalytics() {
        AnalyticsResponse a = new AnalyticsResponse();
        a.setOverview(computeStats());
        a.setPlatformRecipes(recipeRepository.count());
        a.setUserRegistrationsLast30Days(buildUserTrend());
        a.setReportsLast30Days(buildReportsTrend());
        return a;
    }

    // ── Mappers ───────────────────────────────────────────────────────────

    private AdminUserResponse toUserResponse(User u) {
        AdminUserResponse r = new AdminUserResponse();
        r.setId(u.getId());
        r.setEmail(u.getEmail());
        r.setUsername(u.getUsername());
        r.setFullName(u.getFullName());
        r.setRole(u.getRole() != null ? u.getRole() : "USER");
        r.setActive(Boolean.TRUE.equals(u.getActive()));
        r.setCountryCode(u.getCountryCode());
        r.setCountryName(u.getCountryName());
        r.setProfileImageUrl(u.getProfileImageUrl());
        r.setCreatedAt(u.getCreatedAt());
        return r;
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

    // ── Trend helpers ─────────────────────────────────────────────────────

    private List<Map<String, Object>> buildUserTrend() {
        List<User> users = userRepository.findAll();
        LocalDate cutoff = LocalDate.now().minusDays(29);
        Map<LocalDate, Long> counts = initDayMap(cutoff);
        for (User u : users) {
            if (u.getCreatedAt() != null) {
                LocalDate day = u.getCreatedAt().toLocalDate();
                if (!day.isBefore(cutoff) && !day.isAfter(LocalDate.now())) {
                    counts.merge(day, 1L, Long::sum);
                }
            }
        }
        return toList(counts);
    }

    private List<Map<String, Object>> buildReportsTrend() {
        List<RecipeReport> reports = reportRepository.findAll();
        LocalDate cutoff = LocalDate.now().minusDays(29);
        Map<LocalDate, Long> counts = initDayMap(cutoff);
        for (RecipeReport rp : reports) {
            if (rp.getReportDate() != null) {
                LocalDate day = rp.getReportDate().toLocalDate();
                if (!day.isBefore(cutoff) && !day.isAfter(LocalDate.now())) {
                    counts.merge(day, 1L, Long::sum);
                }
            }
        }
        return toList(counts);
    }

    private Map<LocalDate, Long> initDayMap(LocalDate from) {
        Map<LocalDate, Long> m = new TreeMap<>();
        for (int i = 0; i < 30; i++) m.put(from.plusDays(i), 0L);
        return m;
    }

    private List<Map<String, Object>> toList(Map<LocalDate, Long> counts) {
        return counts.entrySet().stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", e.getKey().toString());
            m.put("count", e.getValue());
            return m;
        }).collect(Collectors.toList());
    }
}
