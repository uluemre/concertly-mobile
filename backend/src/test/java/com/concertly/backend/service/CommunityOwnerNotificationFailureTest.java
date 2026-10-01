package com.concertly.backend.service;

import com.concertly.backend.repository.NotificationRepository;
import com.concertly.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** B1: devir bildirimi (sendSystem) başarısız olursa hesap silme akışı bozulmamalı. */
class CommunityOwnerNotificationFailureTest {

    @Test
    void sendSystemSwallowsRepositoryFailure() {
        NotificationRepository nr = mock(NotificationRepository.class);
        UserRepository ur = mock(UserRepository.class);
        when(nr.existsByRecipientIdAndTypeAndEntityId(any(), any(), any())).thenThrow(new IllegalStateException("db"));
        NotificationService s = new NotificationService(nr, ur, mock(ExpoPushService.class), mock(PushMessageFactory.class));
        assertDoesNotThrow(() -> s.sendSystem(2L, "community_ownership", "community", 10L, "x"));
    }

    @Test
    void sendSystemSwallowsMissingRecipient() {
        NotificationRepository nr = mock(NotificationRepository.class);
        UserRepository ur = mock(UserRepository.class);
        when(ur.findById(any())).thenReturn(java.util.Optional.empty());
        NotificationService s = new NotificationService(nr, ur, mock(ExpoPushService.class), mock(PushMessageFactory.class));
        assertDoesNotThrow(() -> s.sendSystem(2L, "community_ownership", "community", 10L, "x"));
    }
}
