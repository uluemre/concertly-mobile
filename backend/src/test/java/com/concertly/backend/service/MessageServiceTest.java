package com.concertly.backend.service;

import com.concertly.backend.dto.response.ConversationResponse;
import com.concertly.backend.dto.response.MessageResponse;
import com.concertly.backend.model.Message;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.MessageRepository;
import com.concertly.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageServiceTest {

    @Mock private MessageRepository messageRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;
    @Mock private ModerationService moderationService;

    private MessageService messageService;

    private User me;
    private User partner;

    @BeforeEach
    void setUp() {
        messageService = new MessageService(messageRepository, userRepository, notificationService, moderationService);
        me = userWithId(1L, "emre");
        partner = userWithId(2L, "ayse");
    }

    private static User userWithId(Long id, String username) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername(username);
        return u;
    }

    private static Message message(User sender, User receiver, String content, boolean read) {
        Message m = new Message();
        m.setSender(sender);
        m.setReceiver(receiver);
        m.setContent(content);
        m.setIsRead(read);
        return m;
    }

    @Test
    void sendRejectsEmptyContent() {
        assertThrows(IllegalArgumentException.class, () -> messageService.send(1L, 2L, "   "));
        assertThrows(IllegalArgumentException.class, () -> messageService.send(1L, 2L, null));
    }

    @Test
    void sendRejectsMessagingYourself() {
        assertThrows(IllegalArgumentException.class, () -> messageService.send(1L, 1L, "selam"));
    }

    @Test
    void sendSavesMessageAndNotifiesReceiver() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(me));
        when(userRepository.findById(2L)).thenReturn(Optional.of(partner));

        MessageResponse response = messageService.send(1L, 2L, "  Konserde görüşürüz!  ");

        assertEquals("Konserde görüşürüz!", response.getContent());
        assertEquals(1L, response.getSenderId());
        assertEquals(2L, response.getReceiverId());
        verify(messageRepository).save(any(Message.class));
        verify(notificationService).send(eq(2L), eq(1L), eq("message"), eq("user"), eq(1L));
    }

    @Test
    void getConversationsGroupsByPartnerAndCountsUnread() {
        // createdAt DESC sırası: en yeni mesaj partner'dan ve okunmamış
        Message newest = message(partner, me, "Bilet aldın mı?", false);
        Message older  = message(me, partner, "Selam!", true);
        when(messageRepository.findAllInvolving(1L)).thenReturn(List.of(newest, older));

        List<ConversationResponse> conversations = messageService.getConversations(1L);

        assertEquals(1, conversations.size());
        ConversationResponse c = conversations.get(0);
        assertEquals(2L, c.getUserId());
        assertEquals("ayse", c.getUsername());
        assertEquals("Bilet aldın mı?", c.getLastMessage());
        assertFalse(c.isLastFromMe());
        assertEquals(1L, c.getUnreadCount());
    }

    @Test
    void getConversationMarksIncomingAsRead() {
        when(messageRepository.findConversation(1L, 2L)).thenReturn(List.of());

        messageService.getConversation(1L, 2L);

        verify(messageRepository).markConversationRead(1L, 2L);
    }
}
