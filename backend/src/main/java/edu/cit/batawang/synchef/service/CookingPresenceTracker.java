package edu.cit.batawang.synchef.service;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;

import edu.cit.batawang.synchef.security.AuthenticatedUser;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Tracks which participants currently have a live connection to a cooking session topic, so the
 * UI can show who is online. Purely in-memory: presence is ephemeral by nature.
 */
@Component
@RequiredArgsConstructor
public class CookingPresenceTracker {

    private static final Pattern TOPIC = Pattern.compile("^/topic/cooking-sessions/(\\d+)$");

    public record PresenceChanged(Long cookingSessionId) {
    }

    private record Subscription(Long cookingSessionId, Long userId) {
    }

    private final ApplicationEventPublisher events;

    /** websocket session id → (subscription id → subscription). */
    private final Map<String, Map<String, Subscription>> byConnection = new ConcurrentHashMap<>();

    public Set<Long> onlineUsers(Long cookingSessionId) {
        return byConnection.values().stream()
                .flatMap(m -> m.values().stream())
                .filter(s -> s.cookingSessionId().equals(cookingSessionId))
                .map(Subscription::userId)
                .collect(Collectors.toSet());
    }

    @EventListener
    public void onSubscribe(SessionSubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String destination = accessor.getDestination();
        if (destination == null) return;
        Matcher m = TOPIC.matcher(destination);
        Long userId = userId(event.getUser());
        if (!m.matches() || userId == null || accessor.getSessionId() == null || accessor.getSubscriptionId() == null) {
            return;
        }
        Long sessionId = Long.parseLong(m.group(1));
        byConnection.computeIfAbsent(accessor.getSessionId(), k -> new ConcurrentHashMap<>())
                .put(accessor.getSubscriptionId(), new Subscription(sessionId, userId));
        events.publishEvent(new PresenceChanged(sessionId));
    }

    @EventListener
    public void onUnsubscribe(SessionUnsubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Map<String, Subscription> subs = accessor.getSessionId() == null ? null : byConnection.get(accessor.getSessionId());
        if (subs == null || accessor.getSubscriptionId() == null) return;
        Subscription removed = subs.remove(accessor.getSubscriptionId());
        if (removed != null) {
            events.publishEvent(new PresenceChanged(removed.cookingSessionId()));
        }
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        Map<String, Subscription> subs = byConnection.remove(event.getSessionId());
        if (subs == null) return;
        subs.values().stream().map(Subscription::cookingSessionId).distinct()
                .forEach(id -> events.publishEvent(new PresenceChanged(id)));
    }

    private Long userId(java.security.Principal principal) {
        if (principal instanceof Authentication auth && auth.getPrincipal() instanceof AuthenticatedUser user) {
            return user.id();
        }
        return null;
    }
}
