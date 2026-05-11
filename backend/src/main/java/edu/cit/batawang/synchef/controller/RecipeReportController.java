package edu.cit.batawang.synchef.controller;

import edu.cit.batawang.synchef.dto.RecipeReportRequest;
import edu.cit.batawang.synchef.dto.RecipeReportResponse;
import edu.cit.batawang.synchef.service.RecipeReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@CrossOrigin(originPatterns = {"http://localhost:*", "http://127.0.0.1:*"})
public class RecipeReportController {

    private final RecipeReportService reportService;

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return null;
        Object principal = auth.getPrincipal();
        if (principal instanceof Number n) return n.longValue();
        if (principal instanceof String s && !"anonymousUser".equalsIgnoreCase(s)) {
            try { return Long.parseLong(s); } catch (NumberFormatException ignored) { /* fall through */ }
        }
        return null;
    }

    /** POST /api/reports — authenticated user files a report on a SynCook recipe. */
    @PostMapping("/api/reports")
    public ResponseEntity<RecipeReportResponse> createReport(@RequestBody RecipeReportRequest request) {
        Long userId = currentUserId();
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(reportService.createReport(userId, request));
    }

    /** GET /api/admin/reports — admin retrieves all reports (newest first). */
    @GetMapping("/api/admin/reports")
    public ResponseEntity<List<RecipeReportResponse>> getAllReports() {
        return ResponseEntity.ok(reportService.getAllReports());
    }

    /** POST /api/admin/reports/{id}/file-notice — admin files a formal notice. */
    @PostMapping("/api/admin/reports/{id}/file-notice")
    public ResponseEntity<RecipeReportResponse> fileNotice(@PathVariable Long id) {
        return ResponseEntity.ok(reportService.fileNotice(id));
    }

    /** POST /api/admin/reports/{id}/resolve — mark report resolved. */
    @PostMapping("/api/admin/reports/{id}/resolve")
    public ResponseEntity<Map<String, String>> resolveReport(@PathVariable Long id) {
        reportService.fileNotice(id); // reuse same flow; status update is sufficient for now
        return ResponseEntity.ok(Map.of("status", "RESOLVED"));
    }
}
