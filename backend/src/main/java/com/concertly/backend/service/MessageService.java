package com.concertly.backend.service;

import com.concertly.backend.dto.response.ConversationResponse;
import com.concertly.backend.dto.response.MessageResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Message;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.MessageRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class MessageService {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public MessageService(MessageRepository messageRepository,
                          UserRepository userRepository,
                          NotificationService notificationService) {
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public MessageResponse send(Long senderId, Long receiverId, String content) {
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("Mesaj boş olamaz");
        }
        if (senderId.equals(receiverId)) {
            throw new IllegalArgumentException("Kendine mesaj gönderemezsin");
        }
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + senderId));
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + receiverId));

        Message message = new Message();
        message.setSender(sender);
        message.setReceiver(receiver);
        message.setContent(content.trim());
        messageRepository.save(message);

        notificationService.send(receiverId, senderId, "message", "user", senderId);

        return MessageResponse.from(message);
    }

    /** Sohbeti döner ve karşı taraftan gelen okunmamış mesajları okundu işaretler. */
    @Transactional
    public List<MessageResponse> getConversation(Long myId, Long partnerId) {
        messageRepository.markConversationRead(myId, partnerId);
        return messageRepository.findConversation(myId, partnerId)
                .stream()
                .map(MessageResponse::from)
                .toList();
    }

    /** Konuştuğum her kullanıcı için son mesaj + okunmamış sayısı. */
    @Transactional(readOnly = true)
    public List<ConversationResponse> getConversations(Long myId) {
        List<Message> all = messageRepository.findAllInvolving(myId); // createdAt DESC

        Map<Long, Message> latestByPartner = new LinkedHashMap<>();
        Map<Long, Long> unreadByPartner = new LinkedHashMap<>();

        for (Message m : all) {
            boolean fromMe = m.getSender().getId().equals(myId);
            Long partnerId = fromMe ? m.getReceiver().getId() : m.getSender().getId();

            latestByPartner.putIfAbsent(partnerId, m);
            if (!fromMe && !Boolean.TRUE.equals(m.getIsRead())) {
                unreadByPartner.merge(partnerId, 1L, Long::sum);
            }
        }

        return latestByPartner.entrySet().stream()
                .map(e -> {
                    Message m = e.getValue();
                    boolean fromMe = m.getSender().getId().equals(myId);
                    User partner = fromMe ? m.getReceiver() : m.getSender();
                    return new ConversationResponse(
                            partner.getId(),
                            partner.getUsername(),
                            partner.getProfileImageUrl() != null ? partner.getProfileImageUrl() : "",
                            m.getContent(),
                            fromMe,
                            m.getCreatedAt(),
                            unreadByPartner.getOrDefault(e.getKey(), 0L)
                    );
                })
                .toList();
    }

    public long getUnreadCount(Long myId) {
        return messageRepository.countByReceiverIdAndIsReadFalse(myId);
    }
}
