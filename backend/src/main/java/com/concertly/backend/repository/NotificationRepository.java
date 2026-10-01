package com.concertly.backend.repository;

import com.concertly.backend.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByRecipientIdOrderByCreatedAtDesc(Long recipientId);
    long countByRecipientIdAndIsReadFalse(Long recipientId);
    boolean existsByRecipientIdAndTypeAndEntityId(Long recipientId, String type, Long entityId);
    boolean existsByRecipientIdAndActorIdAndTypeAndEntityId(Long recipientId, Long actorId, String type, Long entityId);
    void deleteByRecipientIdAndActorIdAndType(Long recipientId, Long actorId, String type);
    void deleteByRecipientIdAndType(Long recipientId, String type);
    void deleteByEntityTypeAndEntityId(String entityType, Long entityId);
}