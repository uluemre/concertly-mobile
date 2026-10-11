package com.concertly.backend.service;

import com.concertly.backend.dto.response.ConversationResponse;
import com.concertly.backend.dto.response.MessageResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.ContentLimits;
import com.concertly.backend.model.Message;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.MessageRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class MessageService {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ModerationService moderationService;
    private final ContentLimitService contentLimitService;

    public MessageService(MessageRepository messageRepository,
                          UserRepository userRepository,
                          NotificationService notificationService,
                          ModerationService moderationService,
                          ContentLimitService contentLimitService) {
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.moderationService = moderationService;
        this.contentLimitService = contentLimitService;
    }

    @Transactional
    public MessageResponse send(Long senderId, Long receiverId, String content) {
        if (receiverId == null) {
            throw new IllegalArgumentException("receiverId zorunlu.");
        }
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("CONTENT_EMPTY");
        }
        ContentLimits.check(content.trim(), ContentLimits.MESSAGE_MAX);
        if (senderId.equals(receiverId)) {
            throw new IllegalArgumentException("Kendine mesaj gönderemezsin");
        }
        if (moderationService.getHiddenUserIds(senderId).contains(receiverId)) {
            throw new IllegalArgumentException("Bu kullanıcıyla mesajlaşamazsın");
        }
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + senderId));
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + receiverId));
        // Alıcının DM tercihi + yeni hesap spam tavanı
        moderationService.requireCanMessage(senderId, receiver);
        contentLimitService.checkMessage(senderId);

        Message message = new Message();
        message.setSender(sender);
        message.setReceiver(receiver);
        message.setContent(content.trim());
        messageRepository.save(message);

        notificationService.send(receiverId, senderId, "message", "user", senderId);

        return MessageResponse.from(message);
    }

    /** Bu kişiye yeni mesaj yazılabilir mi? { canMessage, reason } — kural gönderme ile aynı. */
    @Transactional(readOnly = true)
    public Map<String, Object> status(Long myId, Long otherId) {
        User other = userRepository.findById(otherId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + otherId));
        String reason = moderationService.messageBlockReason(myId, other);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("canMessage", reason == null);
        m.put("reason", reason);
        return m;
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
        Set<Long> hidden = moderationService.getHiddenUserIds(myId);

        Map<Long, Message> latestByPartner = new LinkedHashMap<>();
        Map<Long, Long> unreadByPartner = new LinkedHashMap<>();

        for (Message m : all) {
            boolean fromMe = m.getSender().getId().equals(myId);
            Long partnerId = fromMe ? m.getReceiver().getId() : m.getSender().getId();
            if (hidden.contains(partnerId)) continue; // engellenen/engelleyen sohbetleri gizle

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
