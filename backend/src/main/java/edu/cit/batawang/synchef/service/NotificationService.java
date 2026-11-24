package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.dto.NotificationResponse;
import edu.cit.batawang.synchef.exception.ApiException;
import edu.cit.batawang.synchef.model.AppNotification;
import edu.cit.batawang.synchef.model.RecipeReport;
import edu.cit.batawang.synchef.model.SynCookRecipe;
import edu.cit.batawang.synchef.model.User;
import edu.cit.batawang.synchef.repository.AppNotificationRepository;
import edu.cit.batawang.synchef.repository.UserRepository;
import edu.cit.batawang.synchef.service.notification.NotificationFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Persists in-app notifications and pushes each one to the recipient's private
 * {@code /user/queue/notifications} destination in real time.
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    public static final String USER_QUEUE = "/queue/notifications";

    private final AppNotificationRepository notificationRepository;
    private final NotificationFactory notificationFactory;
    private final UserRepository userRepository;
    private final RealtimePublisher realtime;

    @Transactional
    public void createWelcomeNotifications(User user) {
        long existing = notificationRepository.countByRecipientIdAndType(user.getId(), NotificationFactory.TYPE_SYSTEM_WELCOME);
        if (existing >= 2) {
            return;
        }
        save(notificationFactory.createSystemWelcome(user.getId(), "Welcome, Chef!",
                "Welcome to SynChef, " + user.displayName() + "! Thank you for joining our global cooking community."));
        save(notificationFactory.createSystemWelcome(user.getId(), "Start exploring",
                "Explore global flavors, cook along in real time and share your own dishes with fellow chefs."));
    }

    @Transactional
    public void createCommentNotification(SynCookRecipe recipe, User actor, String commentContent) {
        if (recipe.getOwnerId() == null || actor.getId() == null || recipe.getOwnerId().equals(actor.getId())) {
            return;
        }
        boolean ownerWantsIt = userRepository.findById(recipe.getOwnerId())
                .map(owner -> !Boolean.FALSE.equals(owner.getNotifyOnComments()))
                .orElse(false);
        if (!ownerWantsIt) {
            return;
        }
        String actorName = actor.displayName();
        String message = actorName + " commented on your dish \"" + recipe.getTitle() + "\": " + preview(commentContent);
        save(notificationFactory.createComment(recipe.getOwnerId(), actor.getId(), actorName, recipe.getId(), message));
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getNotifications(Long userId, boolean unreadOnly) {
        List<AppNotification> notifications = unreadOnly
                ? notificationRepository.findByRecipientIdAndIsReadFalseOrderByCreatedAtDesc(userId)
                : notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId);
        return notifications.stream().limit(100).map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) {
        return notificationRepository.countByRecipientIdAndIsReadFalse(userId);
    }

    @Transactional
    public NotificationResponse markAsRead(Long userId, Long notificationId) {
        AppNotification notification = notificationRepository.findByIdAndRecipientId(notificationId, userId)
                .orElseThrow(() -> ApiException.notFound("Notification not found"));
        if (!Boolean.TRUE.equals(notification.getIsRead())) {
            notification.setIsRead(true);
            notification = notificationRepository.save(notification);
        }
        return toResponse(notification);
    }

    @Transactional
    public long markAllAsRead(Long userId) {
        List<AppNotification> unread = notificationRepository.findByRecipientIdAndIsReadFalseOrderByCreatedAtDesc(userId);
        unread.forEach(notification -> notification.setIsRead(true));
        notificationRepository.saveAll(unread);
        return unread.size();
    }

    /** A user filed a report — every admin is notified. */
    @Transactional
    public void notifyAdminsOfReport(RecipeReport report, List<User> admins) {
        for (User admin : admins) {
            save(notificationFactory.createAdminReport(admin.getId(), report.getReporterId(), report.getReporterName(),
                    report.getRecipeTitle(), report.getRecipeId(), report.getReason()));
        }
    }

    /** An admin filed a notice — the recipe owner is notified. */
    @Transactional
    public void notifyOwnerOfNotice(RecipeReport report) {
        if (report.getRecipeOwnerId() == null) return;
        save(notificationFactory.createFileNotice(report.getRecipeOwnerId(), report.getRecipeTitle(),
                report.getRecipeId(), report.getReason()));
    }

    /** The owner appealed a notice — admins are notified. */
    @Transactional
    public void notifyAdminsOfAppeal(RecipeReport report, List<User> admins) {
        for (User admin : admins) {
            save(notificationFactory.createAppeal(admin.getId(), report.getRecipeOwnerId(), report.getRecipeOwnerName(),
                    report.getRecipeTitle(), report.getRecipeId()));
        }
    }

    /** The report was resolved or dismissed — the owner is told the outcome. */
    @Transactional
    public void notifyOwnerOfOutcome(RecipeReport report) {
        if (report.getRecipeOwnerId() == null) return;
        save(notificationFactory.createReportOutcome(report.getRecipeOwnerId(), report.getRecipeTitle(),
                report.getRecipeId(), report.getStatus()));
    }

    @Transactional
    public void deleteAllFor(Long userId) {
        notificationRepository.deleteByRecipient(userId);
    }

    private void save(AppNotification notification) {
        AppNotification saved = notificationRepository.save(notification);
        realtime.toUser(saved.getRecipientId(), USER_QUEUE, toResponse(saved));
    }

    private NotificationResponse toResponse(AppNotification entity) {
        return new NotificationResponse(
                entity.getId(),
                entity.getType(),
                entity.getTitle(),
                entity.getMessage(),
                entity.getSenderId(),
                entity.getSenderName(),
                entity.getReferenceRecipeId(),
                entity.getIsRead(),
                entity.getIsSystem(),
                entity.getCreatedAt()
        );
    }

    private String preview(String content) {
        if (content == null) return "";
        String normalized = content.trim().replaceAll("\\s+", " ");
        return normalized.length() <= 80 ? normalized : normalized.substring(0, 77) + "...";
    }
}
