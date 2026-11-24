package edu.cit.batawang.synchef.security;

import edu.cit.batawang.synchef.service.CookingSessionService;
import edu.cit.batawang.synchef.service.SynCookService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StompAuthorizationInterceptorTest {

    private final CookingSessionService cooking = mock(CookingSessionService.class);
    private final SynCookService synCook = mock(SynCookService.class);
    private final StompAuthorizationInterceptor interceptor = new StompAuthorizationInterceptor(provider(cooking), provider(synCook));

    private final AuthenticatedUser user = new AuthenticatedUser(7L, "USER", 1L);
    private final AuthenticatedUser admin = new AuthenticatedUser(1L, "ADMIN", 2L);

    @Test
    void adminTopicsRequireAdminRole() {
        assertThat(interceptor.canSubscribe(user, "/topic/admin/stats")).isFalse();
        assertThat(interceptor.canSubscribe(admin, "/topic/admin/stats")).isTrue();
    }

    @Test
    void cookingTopicsRequireParticipation() {
        when(cooking.canAccess(5L, 7L)).thenReturn(true);
        when(cooking.canAccess(6L, 7L)).thenReturn(false);
        assertThat(interceptor.canSubscribe(user, "/topic/cooking-sessions/5")).isTrue();
        assertThat(interceptor.canSubscribe(user, "/topic/cooking-sessions/6")).isFalse();
    }

    @Test
    void commentTopicsFollowDishVisibility() {
        when(synCook.canRead(3L, 7L)).thenReturn(true);
        assertThat(interceptor.canSubscribe(user, "/topic/syncook/3/comments")).isTrue();
        assertThat(interceptor.canSubscribe(user, "/topic/syncook/4/comments")).isFalse();
    }

    @Test
    void userQueuesAllowedUnknownTopicsDenied() {
        assertThat(interceptor.canSubscribe(user, "/user/queue/notifications")).isTrue();
        assertThat(interceptor.canSubscribe(user, "/topic/user-profile/1")).isFalse();
        assertThat(interceptor.canSubscribe(user, "/topic/timer-updates")).isFalse();
    }

    @Test
    void rejectsAnonymousConnectAndAnyClientSend() {
        assertThatThrownBy(() -> interceptor.preSend(frame(StompCommand.CONNECT, null, null), null))
                .isInstanceOf(MessageDeliveryException.class);
        assertThatThrownBy(() -> interceptor.preSend(frame(StompCommand.SEND, user, "/app/anything"), null))
                .isInstanceOf(MessageDeliveryException.class);
        assertThat(interceptor.preSend(frame(StompCommand.CONNECT, user, null), null)).isNotNull();
    }

    private Message<byte[]> frame(StompCommand command, AuthenticatedUser principal, String destination) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        if (principal != null) {
            accessor.setUser(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
        }
        if (destination != null) accessor.setDestination(destination);
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    @SuppressWarnings("unchecked")
    private static <T> ObjectProvider<T> provider(T bean) {
        ObjectProvider<T> provider = mock(ObjectProvider.class);
        when(provider.getObject()).thenReturn(bean);
        return provider;
    }
}
