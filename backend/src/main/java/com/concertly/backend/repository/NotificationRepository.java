package com.concertly.backend.repository;

import com.concertly.backend.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    /** Kullanıcının görünen (silmediği) bildirimleri. */
    List<Notification> findByRecipientIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long recipientId);
    long countByRecipientIdAndIsReadFalseAndDeletedAtIsNull(Long recipientId);

    /** Toplu gizleme: yalnız alıcının kendi bildirimleri etkilenir. */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
            "UPDATE Notification n SET n.deletedAt = :at WHERE n.recipient.id = :uid AND n.id IN :ids AND n.deletedAt IS NULL")
    int softDeleteByIds(@org.springframework.data.repository.query.Param("uid") Long recipientId,
                        @org.springframework.data.repository.query.Param("ids") java.util.Collection<Long> ids,
                        @org.springframework.data.repository.query.Param("at") java.time.LocalDateTime at);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
            "UPDATE Notification n SET n.deletedAt = :at WHERE n.recipient.id = :uid AND n.deletedAt IS NULL")
    int softDeleteAll(@org.springframework.data.repository.query.Param("uid") Long recipientId,
                      @org.springframework.data.repository.query.Param("at") java.time.LocalDateTime at);
    boolean existsByRecipientIdAndTypeAndEntityId(Long recipientId, String type, Long entityId);
    boolean existsByRecipientIdAndActorIdAndTypeAndEntityIdAndCreatedAtAfter(
            Long recipientId, Long actorId, String type, Long entityId, java.time.LocalDateTime after);
    void deleteByRecipientIdAndActorIdAndType(Long recipientId, Long actorId, String type);
    void deleteByRecipientIdAndType(Long recipientId, String type);
    void deleteByEntityTypeAndEntityId(String entityType, Long entityId);
}