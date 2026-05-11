package edu.cit.batawang.synchef.service.notification;

import edu.cit.batawang.synchef.model.AppNotification;
import org.springframework.stereotype.Component;

@Component
public class NotificationFactory {

    public static final String TYPE_SYSTEM_WELCOME = "SYSTEM_WELCOME";
    public static final String TYPE_COMMENT        = "SYNCOOK_COMMENT";
    public static final String TYPE_ADMIN_REPORT   = "ADMIN_REPORT";   // admin receives when user reports
    public static final String TYPE_REPORT_FILED   = "REPORT_FILED";   // owner receives when admin files notice

    public AppNotification createSystemWelcome(Long recipientId, String title, String message) {
        return AppNotification.builder()
            .recipientId(recipientId)
            .type(TYPE_SYSTEM_WELCOME)
            .title(title)
            .message(message)
            .isRead(false)
            .isSystem(true)
            .build();
    }

    public AppNotification createComment(
        Long recipientId,
        Long senderId,
        String senderName,
        Long recipeId,
        String message
    ) {
        return AppNotification.builder()
            .recipientId(recipientId)
            .senderId(senderId)
            .senderName(senderName)
            .type(TYPE_COMMENT)
            .title("Chef!")
            .message(message)
            .referenceRecipeId(recipeId)
            .isRead(false)
            .isSystem(false)
            .build();
    }

    /** Sent to each admin when a user submits a recipe report. */
    public AppNotification createAdminReport(
        Long adminRecipientId,
        Long reporterId,
        String reporterName,
        String recipeTitle,
        Long recipeId,
        String reason
    ) {
        String msg = reporterName + " reported \"" + cap(recipeTitle, 120) + "\": " + reason;
        return AppNotification.builder()
            .recipientId(adminRecipientId)
            .senderId(reporterId)
            .senderName(reporterName)
            .type(TYPE_ADMIN_REPORT)
            .title("New Recipe Report")
            .message(cap(msg, 590))
            .referenceRecipeId(recipeId)
            .isRead(false)
            .isSystem(false)
            .build();
    }

    /** Sent to the recipe owner when admin clicks "File for Notice". */
    public AppNotification createFileNotice(
        Long ownerRecipientId,
        String recipeTitle,
        Long recipeId,
        String reason
    ) {
        String msg = "Admin filed a notice on your recipe. Reason: " + reason
                   + ". Please review within 7 days or the recipe may be removed.";
        return AppNotification.builder()
            .recipientId(ownerRecipientId)
            .type(TYPE_REPORT_FILED)
            .title(cap(recipeTitle, 175))
            .message(cap(msg, 590))
            .referenceRecipeId(recipeId)
            .isRead(false)
            .isSystem(true)
            .build();
    }

    private static String cap(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}
