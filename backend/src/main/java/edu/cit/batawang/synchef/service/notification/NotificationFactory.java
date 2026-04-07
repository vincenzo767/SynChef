package edu.cit.batawang.synchef.service.notification;

import edu.cit.batawang.synchef.model.AppNotification;
import org.springframework.stereotype.Component;

@Component
public class NotificationFactory {

    public static final String TYPE_SYSTEM_WELCOME = "SYSTEM_WELCOME";
    public static final String TYPE_COMMENT = "SYNCOOK_COMMENT";

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
}
