package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.dto.RecipeReportResponse;
import edu.cit.batawang.synchef.dto.SynCookDtos.AppealRequest;
import edu.cit.batawang.synchef.dto.SynCookDtos.ReportRequest;
import edu.cit.batawang.synchef.exception.ApiException;
import edu.cit.batawang.synchef.model.RecipeReport;
import edu.cit.batawang.synchef.model.SynCookRecipe;
import edu.cit.batawang.synchef.model.User;
import edu.cit.batawang.synchef.repository.RecipeReportRepository;
import edu.cit.batawang.synchef.repository.SynCookRecipeRepository;
import edu.cit.batawang.synchef.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Report workflow: PENDING → FILED (owner notified) → APPEALED (owner responds) → RESOLVED | DISMISSED.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RecipeReportService {

    public static final String PENDING = "PENDING";
    public static final String FILED = "FILED";
    public static final String APPEALED = "APPEALED";
    public static final String RESOLVED = "RESOLVED";
    public static final String DISMISSED = "DISMISSED";

    private static final Set<String> CATEGORIES = Set.of("Critical", "Medium", "Recipe");

    private final RecipeReportRepository reportRepository;
    private final SynCookRecipeRepository recipeRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final RealtimePublisher realtime;
    private final AdminStatsService adminStats;

    @Transactional
    public RecipeReportResponse createReport(Long reporterId, ReportRequest request) {
        SynCookRecipe recipe = recipeRepository.findById(request.recipeId())
                .orElseThrow(() -> ApiException.notFound("Dish not found"));
        if (recipe.getOwnerId().equals(reporterId)) {
            throw ApiException.badRequest("You can't report your own dish");
        }
        if (!"PUBLIC".equalsIgnoreCase(recipe.getPrivacy())) {
            throw ApiException.forbidden("This dish is private");
        }
        if (reportRepository.existsByReporterIdAndRecipeId(reporterId, recipe.getId())) {
            throw ApiException.conflict("You have already reported this dish");
        }
        User reporter = userRepository.findById(reporterId).orElseThrow(() -> ApiException.unauthorized("Please sign in"));

        String category = request.category() != null && CATEGORIES.contains(request.category()) ? request.category() : "Recipe";
        RecipeReport report = new RecipeReport();
        report.setReporterId(reporterId);
        report.setReporterName(reporter.displayName());
        report.setRecipeId(recipe.getId());
        report.setRecipeTitle(recipe.getTitle());
        report.setRecipeOwnerId(recipe.getOwnerId());
        report.setRecipeOwnerName(recipe.getOwnerName());
        report.setCategory(category);
        report.setReason(request.reason().trim());
        report.setReportReason(request.reason().trim());
        report.setReportType(category);
        report.setStatus(PENDING);
        report = reportRepository.save(report);

        notificationService.notifyAdminsOfReport(report, userRepository.findAllByRole("ADMIN"));
        RecipeReportResponse response = toResponse(report);
        realtime.toTopic("/topic/admin/reports", response);
        adminStats.broadcastStats();
        log.info("Report created: id={} recipeId={}", report.getId(), report.getRecipeId());
        return response;
    }

    @Transactional(readOnly = true)
    public List<RecipeReportResponse> getAllReports() {
        return reportRepository.findAllByOrderByReportDateDesc().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<RecipeReportResponse> reportsOnMyDishes(Long ownerId) {
        return reportRepository.findByRecipeOwnerIdOrderByReportDateDesc(ownerId).stream()
                .filter(r -> !PENDING.equals(r.getStatus()))
                .map(this::toOwnerResponse).toList();
    }

    @Transactional
    public RecipeReportResponse fileNotice(Long reportId) {
        RecipeReport report = require(reportId);
        if (!PENDING.equals(report.getStatus())) {
            throw ApiException.conflict("A notice can only be filed for a pending report");
        }
        report.setStatus(FILED);
        report = reportRepository.save(report);
        notificationService.notifyOwnerOfNotice(report);
        return publishUpdate(report);
    }

    @Transactional
    public RecipeReportResponse close(Long reportId, boolean resolved) {
        RecipeReport report = require(reportId);
        if (RESOLVED.equals(report.getStatus()) || DISMISSED.equals(report.getStatus())) {
            throw ApiException.conflict("This report is already closed");
        }
        boolean ownerWasNotified = !PENDING.equals(report.getStatus());
        report.setStatus(resolved ? RESOLVED : DISMISSED);
        report.setResolvedAt(LocalDateTime.now());
        report = reportRepository.save(report);
        if (ownerWasNotified) {
            notificationService.notifyOwnerOfOutcome(report);
        }
        return publishUpdate(report);
    }

    @Transactional
    public RecipeReportResponse appeal(Long reportId, Long ownerId, AppealRequest request) {
        RecipeReport report = require(reportId);
        if (!ownerId.equals(report.getRecipeOwnerId())) {
            throw ApiException.forbidden("Only the dish owner can appeal this report");
        }
        if (!FILED.equals(report.getStatus())) {
            throw ApiException.conflict("Only filed notices can be appealed");
        }
        report.setAppealMessage(request.message().trim());
        report.setStatus(APPEALED);
        report = reportRepository.save(report);
        notificationService.notifyAdminsOfAppeal(report, userRepository.findAllByRole("ADMIN"));
        publishUpdate(report);
        return toOwnerResponse(report);
    }

    private RecipeReportResponse publishUpdate(RecipeReport report) {
        RecipeReportResponse response = toResponse(report);
        realtime.toTopic("/topic/admin/reports/update", response);
        adminStats.broadcastStats();
        return response;
    }

    private RecipeReport require(Long id) {
        return reportRepository.findById(id).orElseThrow(() -> ApiException.notFound("Report not found"));
    }

    private RecipeReportResponse toResponse(RecipeReport r) {
        RecipeReportResponse res = new RecipeReportResponse();
        res.setId(r.getId());
        res.setReporterId(r.getReporterId());
        res.setReporterName(r.getReporterName());
        res.setRecipeId(r.getRecipeId());
        res.setRecipeTitle(r.getRecipeTitle());
        res.setRecipeOwnerId(r.getRecipeOwnerId());
        res.setRecipeOwnerName(r.getRecipeOwnerName());
        res.setCategory(r.getCategory());
        res.setReason(r.getReason());
        res.setStatus(r.getStatus());
        res.setReportDate(r.getReportDate());
        res.setAppealMessage(r.getAppealMessage());
        res.setResolvedAt(r.getResolvedAt());
        return res;
    }

    /** Owner view: the reporter's identity is not disclosed. */
    private RecipeReportResponse toOwnerResponse(RecipeReport r) {
        RecipeReportResponse res = toResponse(r);
        res.setReporterId(null);
        res.setReporterName(null);
        return res;
    }
}
