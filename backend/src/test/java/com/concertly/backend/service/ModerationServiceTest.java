package com.concertly.backend.service;

import com.concertly.backend.model.MessagePrivacy;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.BlockRepository;
import com.concertly.backend.repository.FollowRepository;
import com.concertly.backend.repository.MessageRepository;
import com.concertly.backend.repository.ReportRepository;
import com.concertly.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/** Mesaj gizliliği kuralları — taciz akışının ilk savunma hattı. */
@ExtendWith(MockitoExtension.class)
class ModerationServiceTest {

    @Mock private BlockRepository blockRepository;
    @Mock private ReportRepository reportRepository;
    @Mock private UserRepository userRepository;
    @Mock private FollowRepository followRepository;
    @Mock private MessageRepository messageRepository;

    private ModerationService service;
    private User receiver;

    @BeforeEach
    void setUp() {
        service = new ModerationService(blockRepository, reportRepository, userRepository,
                followRepository, messageRepository);
        receiver = new User();
        ReflectionTestUtils.setField(receiver, "id", 2L);
        receiver.setUsername("ayse");
    }

    @Test
    void everyoneCanMessageByDefault() {
        when(messageRepository.conversationExists(1L, 2L)).thenReturn(false);
        receiver.setMessagePrivacy(MessagePrivacy.EVERYONE);

        assertDoesNotThrow(() -> service.requireCanMessage(1L, receiver));
    }

    @Test
    void nobodyRejectsNewConversation() {
        when(messageRepository.conversationExists(1L, 2L)).thenReturn(false);
        receiver.setMessagePrivacy(MessagePrivacy.NOBODY);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.requireCanMessage(1L, receiver));
        assertTrue(ex.getMessage().contains("DM_CLOSED"));
    }

    @Test
    void followingOnlyRejectsStranger() {
        when(messageRepository.conversationExists(1L, 2L)).thenReturn(false);
        when(followRepository.existsByFollowerIdAndFollowingId(2L, 1L)).thenReturn(false);
        receiver.setMessagePrivacy(MessagePrivacy.FOLLOWING);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.requireCanMessage(1L, receiver));
        assertTrue(ex.getMessage().contains("DM_FOLLOWING_ONLY"));
    }

    @Test
    void followingOnlyAllowsSomeoneTheReceiverFollows() {
        when(messageRepository.conversationExists(1L, 2L)).thenReturn(false);
        when(followRepository.existsByFollowerIdAndFollowingId(2L, 1L)).thenReturn(true);
        receiver.setMessagePrivacy(MessagePrivacy.FOLLOWING);

        assertDoesNotThrow(() -> service.requireCanMessage(1L, receiver));
    }

    /** Ayarını sonradan daraltan kullanıcı mevcut sohbetlerinden kopmamalı. */
    @Test
    void existingConversationSurvivesStricterSetting() {
        when(messageRepository.conversationExists(1L, 2L)).thenReturn(true);
        receiver.setMessagePrivacy(MessagePrivacy.NOBODY);

        assertDoesNotThrow(() -> service.requireCanMessage(1L, receiver));
    }
}
