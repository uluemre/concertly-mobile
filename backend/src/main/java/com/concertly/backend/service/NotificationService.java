package com.concertly.backend.service;

import com.concertly.backend.dto.response.NotificationResponse;
import com.concertly.backend.model.Notification;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.NotificationRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public NotificationService(NotificationRepository notificationRepository,
                                UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    public void send(Long recipientId, Long actorId, String type, String entityType, Long entityId) {
        try {
            if (recipientId.equals(actorId)) return;
            User recipient = userRepository.findById(recipientId).orElseThrow();
            User actor     = userRepository.findById(actorId).orElseThrow();
            Notification n = new Notification();
            n.setRecipient(recipient);
            n.setActor(actor);
            n.setType(type);
            n.setEntityType(entityType);
            n.setEntityId(entityId);
            notificationRepository.save(n);
        } catch (Exception ignored) {}
    }

    /** Aktörsüz sistem bildirimi (turne duyurusu, konser hatırlatması vb.). Aynı bildirimi tekrar göndermez. */
    public void sendSystem(Long recipientId, String type, String entityType, Long entityId, String message) {
        try {
            if (notificationRepository.existsByRecipientIdAndTypeAndEntityId(recipientId, type, entityId)) return;
            User recipient = userRepository.findById(recipientId).orElseThrow();
            Notification n = new Notification();
            n.setRecipient(recipient);
            n.setType(type);
            n.setEntityType(entityType);
            n.setEntityId(entityId);
            n.setMessage(message);
            notificationRepository.save(n);
        } catch (Exception ignored) {}
    }

    public List<NotificationResponse> getForUser(Long userId) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(NotificationResponse::from)
                .toList();
    }

    public long getUnreadCount(Long userId) {
        return notificationRepository.countByRecipientIdAndIsReadFalse(userId);
    }

    @Transactional
    public void markRead(Long notificationId, Long userId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            if (n.getRecipient().getId().equals(userId)) {
                n.setIsRead(true);
                notificationRepository.save(n);
            }
        });
    }

    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId)
                .forEach(n -> {
                    if (!n.getIsRead()) {
                        n.setIsRead(true);
                        notificationRepository.save(n);
                    }
                });
    }
}
