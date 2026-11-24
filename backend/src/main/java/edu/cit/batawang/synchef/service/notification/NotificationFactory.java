package edu.cit.batawang.synchef.service.notification;

import edu.cit.batawang.synchef.model.AppNotification;
import org.springframework.stereotype.Component;

@Component
public class NotificationFactory {

    public static final String TYPE_SYSTEM_WELCOME = "SYSTEM_WELCOME";
    public static final String TYPE_COMMENT        = "SYNCOOK_COMMENT";
    public static final String TYPE_ADMIN_REPORT   = "ADMIN_REPORT";   // admin receives when user reports
    public static final String TYPE_REPORT_FILED   = "REPORT_FILED";   // owner receives when admin files notice
    public static final String TYPE_REPORT_APPEAL  = "REPORT_APPEAL";  // admin receives when owner appeals
    public static final String TYPE_REPORT_CLOSED  = "REPORT_CLOSED";  // owner receives when report is closed

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
        String msg = "Filed: " + reason
                   + ". Please review your dish and edit it, or submit an appeal if you believe this is a mistake.";
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

    /** Sent to each admin when the owner appeals a notice. */
    public AppNotification createAppeal(Long adminRecipientId, Long ownerId, String ownerName,
                                        String recipeTitle, Long recipeId) {
        String msg = (ownerName == null ? "A chef" : ownerName) + " appealed the notice on \""
                + cap(recipeTitle, 120) + "\".";
        return AppNotification.builder()
            .recipientId(adminRecipientId)
            .senderId(ownerId)
            .senderName(ownerName)
            .type(TYPE_REPORT_APPEAL)
            .title("Report Appeal")
            .message(cap(msg, 590))
            .referenceRecipeId(recipeId)
            .isRead(false)
            .isSystem(false)
            .build();
    }

    /** Sent to the owner when a report on their dish is closed. */
    public AppNotification createReportOutcome(Long ownerRecipientId, String recipeTitle, Long recipeId, String status) {
        String msg = "RESOLVED".equals(status)
                ? "The report on \"" + cap(recipeTitle, 120) + "\" was reviewed and resolved. Thank you for your cooperation."
                : "The report on \"" + cap(recipeTitle, 120) + "\" was reviewed and dismissed. No action is needed.";
        return AppNotification.builder()
            .recipientId(ownerRecipientId)
            .type(TYPE_REPORT_CLOSED)
            .title("Report closed")
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
