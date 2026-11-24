package edu.cit.batawang.synchef.security;

import edu.cit.batawang.synchef.service.CookingSessionService;
import edu.cit.batawang.synchef.service.SynCookService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Authorizes STOMP frames:
 * <ul>
 *   <li>CONNECT requires an authenticated WebSocket handshake.</li>
 *   <li>SUBSCRIBE is allowed only to destinations the user may read.</li>
 *   <li>SEND is rejected — clients mutate state only through the CSRF-protected REST API.</li>
 * </ul>
 */
@Component
public class StompAuthorizationInterceptor implements ChannelInterceptor {

    private static final Pattern COOKING_TOPIC = Pattern.compile("^/topic/cooking-sessions/(\\d+)$");
    private static final Pattern SYNCOOK_TOPIC = Pattern.compile("^/topic/syncook/(\\d+)/comments$");

    // Lazily resolved: these services depend on the messaging template created by the broker config.
    private final ObjectProvider<CookingSessionService> cookingSessions;
    private final ObjectProvider<SynCookService> synCook;

    public StompAuthorizationInterceptor(ObjectProvider<CookingSessionService> cookingSessions,
                                         ObjectProvider<SynCookService> synCook) {
        this.cookingSessions = cookingSessions;
        this.synCook = synCook;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }
        StompCommand command = accessor.getCommand();
        AuthenticatedUser user = principalOf(accessor.getUser());

        switch (command) {
            case CONNECT -> {
                if (user == null) throw new MessageDeliveryException("Authentication required");
            }
            case SUBSCRIBE -> {
                if (user == null || !canSubscribe(user, accessor.getDestination())) {
                    throw new MessageDeliveryException("Subscription not permitted");
                }
            }
            case SEND -> throw new MessageDeliveryException("Client messages are not accepted");
            default -> { /* DISCONNECT, UNSUBSCRIBE, ACK, etc. */ }
        }
        return message;
    }

    boolean canSubscribe(AuthenticatedUser user, String destination) {
        if (destination == null) return false;
        if (destination.startsWith("/user/queue/")) return true;
        if (destination.startsWith("/topic/admin/")) return user.isAdmin();

        Matcher cooking = COOKING_TOPIC.matcher(destination);
        if (cooking.matches()) {
            return cookingSessions.getObject().canAccess(Long.parseLong(cooking.group(1)), user.id());
        }
        Matcher comments = SYNCOOK_TOPIC.matcher(destination);
        if (comments.matches()) {
            return synCook.getObject().canRead(Long.parseLong(comments.group(1)), user.id());
        }
        return false;
    }

    private AuthenticatedUser principalOf(Principal principal) {
        if (principal instanceof Authentication authentication
                && authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return user;
        }
        return null;
    }
}
