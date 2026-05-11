package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.dto.NotificationResponse;
import edu.cit.batawang.synchef.model.AppNotification;
import edu.cit.batawang.synchef.model.RecipeReport;
import edu.cit.batawang.synchef.model.SynCookRecipe;
import edu.cit.batawang.synchef.model.User;
import edu.cit.batawang.synchef.repository.AppNotificationRepository;
import edu.cit.batawang.synchef.service.notification.NotificationFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final AppNotificationRepository notificationRepository;
    private final NotificationFactory notificationFactory;

    @Transactional
    public void createWelcomeNotifications(User user) {
        long existing = notificationRepository.countByRecipientIdAndType(user.getId(), NotificationFactory.TYPE_SYSTEM_WELCOME);
        if (existing >= 2) {
            return;
        }

        saveSystemNotification(
            user.getId(),
            "Chef!",
            "Welcome to SynChef, " + safeName(user) + "! Thank you for joining the world's largest online cooking community."
        );

        saveSystemNotification(
            user.getId(),
            "Chef!",
            "Start exploring global flavors and connect with fellow chefs around the world."
        );
    }

    @Transactional
    public void createCommentNotification(SynCookRecipe recipe, User actor, String commentContent) {
        if (recipe.getOwnerId() == null || actor.getId() == null || recipe.getOwnerId().equals(actor.getId())) {
            return;
        }

        String actorName = safeName(actor);
        String message = actorName + " commented on your dish \"" + recipe.getTitle() + "\": " + preview(commentContent);

        AppNotification notification = notificationFactory.createComment(
            recipe.getOwnerId(),
            actor.getId(),
            actorName,
            recipe.getId(),
            message
        );
        notificationRepository.save(notification);
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getNotifications(Long userId, boolean unreadOnly) {
        List<AppNotification> notifications = unreadOnly
            ? notificationRepository.findByRecipientIdAndIsReadFalseOrderByCreatedAtDesc(userId)
            : notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId);

        return notifications.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) {
        return notificationRepository.countByRecipientIdAndIsReadFalse(userId);
    }

    @Transactional
    public NotificationResponse markAsRead(Long userId, Long notificationId) {
        AppNotification notification = notificationRepository.findByIdAndRecipientId(notificationId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Notification not found"));
        if (!Boolean.TRUE.equals(notification.getIsRead())) {
            notification.setIsRead(true);
            notification = notificationRepository.save(notification);
        }
        return toResponse(notification);
    }

    @Transactional
    public long markAllAsRead(Long userId) {
        List<AppNotification> unread = notificationRepository.findByRecipientIdAndIsReadFalseOrderByCreatedAtDesc(userId);
        if (unread.isEmpty()) {
            return 0;
        }
        unread.forEach(notification -> notification.setIsRead(true));
        notificationRepository.saveAll(unread);
        return unread.size();
    }

    /** Called when a user files a report — notifies every admin. */
    @Transactional
    public void notifyAdminsOfReport(RecipeReport report, List<User> admins) {
        for (User admin : admins) {
            AppNotification n = notificationFactory.createAdminReport(
                admin.getId(),
                report.getReporterId(),
                report.getReporterName(),
                report.getRecipeTitle(),
                report.getRecipeId(),
                report.getReason()
            );
            notificationRepository.save(n);
        }
    }

    /** Called when admin clicks "File for Notice" — notifies the recipe owner. */
    @Transactional
    public void notifyOwnerOfNotice(RecipeReport report) {
        if (report.getRecipeOwnerId() == null) return;
        AppNotification n = notificationFactory.createFileNotice(
            report.getRecipeOwnerId(),
            report.getRecipeTitle(),
            report.getRecipeId(),
            report.getReason()
        );
        notificationRepository.save(n);
    }

    private void saveSystemNotification(Long recipientId, String title, String message) {
        AppNotification notification = notificationFactory.createSystemWelcome(recipientId, title, message);
        notificationRepository.save(notification);
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
        if (content == null) {
            return "";
        }
        String normalized = content.trim().replaceAll("\\s+", " ");
        if (normalized.length() <= 80) {
            return normalized;
        }
        return normalized.substring(0, 77) + "...";
    }

    private String safeName(User user) {
        if (user == null) {
            return "Chef";
        }
        if (user.getFullName() != null && !user.getFullName().trim().isEmpty()) {
            return user.getFullName().trim();
        }
        if (user.getUsername() != null && !user.getUsername().trim().isEmpty()) {
            return user.getUsername().trim();
        }
        return "Chef";
    }
}
