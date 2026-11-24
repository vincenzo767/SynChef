package edu.cit.batawang.synchef.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Publishes real-time events. When called inside a transaction, delivery is deferred until
 * after commit so subscribers never see state that is later rolled back.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RealtimePublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public void toUser(Long userId, String queue, Object payload) {
        afterCommit(() -> messagingTemplate.convertAndSendToUser(String.valueOf(userId), queue, payload));
    }

    public void toTopic(String destination, Object payload) {
        afterCommit(() -> messagingTemplate.convertAndSend(destination, payload));
    }

    private void afterCommit(Runnable action) {
        Runnable safe = () -> {
            try {
                action.run();
            } catch (RuntimeException ex) {
                log.warn("Real-time delivery failed: {}", ex.getMessage());
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    safe.run();
                }
            });
        } else {
            safe.run();
        }
    }
}
