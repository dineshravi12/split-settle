package com.splitsettle.api.realtime;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class GroupActivityBroadcaster {
    private final SimpMessagingTemplate messaging;

    // After commit, so clients that refetch on this event see the new data
    @TransactionalEventListener(fallbackExecution = true)
    public void broadcast(GroupActivityEvent event) {
        messaging.convertAndSend("/topic/groups/" + event.groupId(), event.activity());
    }
}
