package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.dto.RecipeReportRequest;
import edu.cit.batawang.synchef.dto.RecipeReportResponse;
import edu.cit.batawang.synchef.model.RecipeReport;
import edu.cit.batawang.synchef.model.SynCookRecipe;
import edu.cit.batawang.synchef.model.User;
import edu.cit.batawang.synchef.repository.RecipeReportRepository;
import edu.cit.batawang.synchef.repository.SynCookRecipeRepository;
import edu.cit.batawang.synchef.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class RecipeReportService {

    private final RecipeReportRepository reportRepository;
    private final SynCookRecipeRepository recipeRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public RecipeReportResponse createReport(Long reporterId, RecipeReportRequest request) {
        if (request.getRecipeId() == null || request.getReason() == null || request.getReason().isBlank()) {
            throw new IllegalArgumentException("Recipe ID and reason are required");
        }

        SynCookRecipe recipe = recipeRepository.findById(request.getRecipeId())
            .orElseThrow(() -> new IllegalArgumentException("Recipe not found"));

        if (reportRepository.existsByReporterIdAndRecipeId(reporterId, request.getRecipeId())) {
            throw new IllegalArgumentException("You have already reported this recipe");
        }

        User reporter = userRepository.findById(reporterId)
            .orElseThrow(() -> new IllegalStateException("Reporter user not found"));

        RecipeReport report = new RecipeReport();
        report.setReporterId(reporterId);
        report.setReporterName(reporter.getFullName() != null ? reporter.getFullName() : reporter.getUsername());
        report.setRecipeId(recipe.getId());
        report.setRecipeTitle(recipe.getTitle());
        report.setRecipeOwnerId(recipe.getOwnerId());
        report.setRecipeOwnerName(recipe.getOwnerName());
        String category = request.getCategory() != null ? request.getCategory() : "Recipe";
        report.setCategory(category);
        report.setReason(request.getReason());
        report.setReportReason(request.getReason());
        report.setReportType(category);
        report.setStatus("PENDING");

        report = reportRepository.save(report);

        List<User> admins = userRepository.findAllByRole("ADMIN");
        notificationService.notifyAdminsOfReport(report, admins);

        RecipeReportResponse response = toResponse(report);
        messagingTemplate.convertAndSend("/topic/admin/reports", response);

        log.info("Recipe report created: reportId={} recipeId={} by userId={}", report.getId(), report.getRecipeId(), reporterId);
        return response;
    }

    @Transactional(readOnly = true)
    public List<RecipeReportResponse> getAllReports() {
        return reportRepository.findAllByOrderByReportDateDesc()
            .stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public RecipeReportResponse fileNotice(Long reportId) {
        RecipeReport report = reportRepository.findById(reportId)
            .orElseThrow(() -> new IllegalArgumentException("Report not found"));

        report.setStatus("FILED");
        report = reportRepository.save(report);

        notificationService.notifyOwnerOfNotice(report);

        RecipeReportResponse response = toResponse(report);
        messagingTemplate.convertAndSend("/topic/admin/reports/update", response);

        log.info("Notice filed for reportId={} recipeId={} ownerId={}", report.getId(), report.getRecipeId(), report.getRecipeOwnerId());
        return response;
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
        return res;
    }
}
