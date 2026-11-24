package edu.cit.batawang.synchef.controller;

import edu.cit.batawang.synchef.dto.RecipeReportResponse;
import edu.cit.batawang.synchef.dto.SynCookDtos.AppealRequest;
import edu.cit.batawang.synchef.dto.SynCookDtos.ReportRequest;
import edu.cit.batawang.synchef.security.AuthenticatedUser;
import edu.cit.batawang.synchef.security.RateLimiter;
import edu.cit.batawang.synchef.service.RecipeReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Report workflow. {@code /api/admin/**} routes are restricted to ROLE_ADMIN in SecurityConfig.
 */
@RestController
@RequiredArgsConstructor
public class RecipeReportController {

    private final RecipeReportService reportService;
    private final RateLimiter rateLimiter;

    @PostMapping("/api/reports")
    public ResponseEntity<RecipeReportResponse> createReport(@AuthenticationPrincipal AuthenticatedUser user,
                                                             @Valid @RequestBody ReportRequest request) {
        rateLimiter.check("report:" + user.id(), 20);
        return ResponseEntity.status(HttpStatus.CREATED).body(reportService.createReport(user.id(), request));
    }

    @PostMapping("/api/reports/{id}/appeal")
    public RecipeReportResponse appeal(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id,
                                       @Valid @RequestBody AppealRequest request) {
        return reportService.appeal(id, user.id(), request);
    }

    @GetMapping("/api/admin/reports")
    public List<RecipeReportResponse> getAllReports() {
        return reportService.getAllReports();
    }

    @PostMapping("/api/admin/reports/{id}/file-notice")
    public RecipeReportResponse fileNotice(@PathVariable Long id) {
        return reportService.fileNotice(id);
    }

    @PostMapping("/api/admin/reports/{id}/resolve")
    public RecipeReportResponse resolve(@PathVariable Long id) {
        return reportService.close(id, true);
    }

    @PostMapping("/api/admin/reports/{id}/dismiss")
    public RecipeReportResponse dismiss(@PathVariable Long id) {
        return reportService.close(id, false);
    }
}
