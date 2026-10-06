package com.concertly.backend.service;

import com.concertly.backend.model.MessagePrivacy;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.BlockRepository;
import com.concertly.backend.repository.BuddySwipeRepository;
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
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Mesaj gizliliği kuralları — taciz akışının ilk savunma hattı. */
@ExtendWith(MockitoExtension.class)
class ModerationServiceTest {

    @Mock private BlockRepository blockRepository;
    @Mock private ReportRepository reportRepository;
    @Mock private UserRepository userRepository;
    @Mock private FollowRepository followRepository;
    @Mock private MessageRepository messageRepository;
    @Mock private BuddySwipeRepository buddySwipeRepository;

    private ModerationService service;
    private User receiver;

    @BeforeEach
    void setUp() {
        service = new ModerationService(blockRepository, reportRepository, userRepository,
                followRepository, messageRepository, buddySwipeRepository);
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
    void concertBuddyMatchCanStartAConversationEvenWhenDmsAreClosed() {
        when(messageRepository.conversationExists(1L, 2L)).thenReturn(false);
        when(buddySwipeRepository.existsBySwiperIdAndTargetIdAndLikedTrue(1L, 2L)).thenReturn(true);
        when(buddySwipeRepository.existsBySwiperIdAndTargetIdAndLikedTrue(2L, 1L)).thenReturn(true);
        receiver.setMessagePrivacy(MessagePrivacy.NOBODY);

        assertDoesNotThrow(() -> service.requireCanMessage(1L, receiver));
    }

    @Test
    void followingOnlyRejectsStranger() {
        when(messageRepository.conversationExists(1L, 2L)).thenReturn(false);
        when(followRepository.isAcceptedFollower(2L, 1L)).thenReturn(false);
        receiver.setMessagePrivacy(MessagePrivacy.FOLLOWING);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.requireCanMessage(1L, receiver));
        assertTrue(ex.getMessage().contains("DM_FOLLOWING_ONLY"));
    }

    @Test
    void followingOnlyAllowsSomeoneTheReceiverFollows() {
        when(messageRepository.conversationExists(1L, 2L)).thenReturn(false);
        when(followRepository.isAcceptedFollower(2L, 1L)).thenReturn(true);
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

    // ── N-10: engel Konser Arkadaşı eşleşmesini iki yönde siler ──

    @Test
    void blockDeletesBuddySwipesBetweenThePairOnly() {
        User blocker = new User();
        ReflectionTestUtils.setField(blocker, "id", 1L);
        when(blockRepository.existsByBlockerIdAndBlockedId(1L, 2L)).thenReturn(false);
        when(userRepository.findById(1L)).thenReturn(Optional.of(blocker));
        when(userRepository.findById(2L)).thenReturn(Optional.of(receiver));

        service.block(1L, 2L);

        verify(blockRepository).save(any());
        verify(buddySwipeRepository).deleteBetween(1L, 2L); // iki yön tek sorguda, yalnızca bu çift
        verifyNoMoreInteractions(buddySwipeRepository);
    }

    @Test
    void buddySwipeRepositoryIsRequired() {
        assertThrows(NullPointerException.class, () -> new ModerationService(blockRepository,
                reportRepository, userRepository, followRepository, messageRepository, null));
    }

    @Test
    void alreadyBlockedDoesNothingElse() {
        when(blockRepository.existsByBlockerIdAndBlockedId(1L, 2L)).thenReturn(true);

        service.block(1L, 2L);

        verifyNoInteractions(buddySwipeRepository);
    }
}
