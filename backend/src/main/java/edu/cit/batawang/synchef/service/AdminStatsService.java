package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.dto.AdminStatsResponse;
import edu.cit.batawang.synchef.repository.RecipeReportRepository;
import edu.cit.batawang.synchef.repository.SynCookCommentRepository;
import edu.cit.batawang.synchef.repository.SynCookRecipeRepository;
import edu.cit.batawang.synchef.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Live platform counters for the admin dashboard, pushed to {@code /topic/admin/stats}
 * (subscription restricted to admins by the STOMP interceptor).
 */
@Service
@RequiredArgsConstructor
public class AdminStatsService {

    private final UserRepository userRepository;
    private final SynCookRecipeRepository synCookRecipeRepository;
    private final RecipeReportRepository reportRepository;
    private final SynCookCommentRepository commentRepository;
    private final RealtimePublisher realtime;

    @Transactional(readOnly = true)
    public AdminStatsResponse computeStats() {
        AdminStatsResponse s = new AdminStatsResponse();
        s.setTotalUsers(userRepository.count());
        s.setActiveUsers(userRepository.countByActive(true));
        s.setBannedUsers(userRepository.countByActive(false));
        s.setTotalSynCookRecipes(synCookRecipeRepository.count());
        s.setPublicRecipes(synCookRecipeRepository.countByPrivacy("PUBLIC"));
        s.setPendingReports(reportRepository.countByStatus(RecipeReportService.PENDING)
                + reportRepository.countByStatus(RecipeReportService.APPEALED));
        s.setTotalReports(reportRepository.count());
        s.setTotalComments(commentRepository.count());
        return s;
    }

    public void broadcastStats() {
        realtime.toTopic("/topic/admin/stats", computeStats());
    }
}
