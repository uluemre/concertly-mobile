package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "recipient_id", nullable = false)
    private User recipient;

    @ManyToOne
    @JoinColumn(name = "actor_id")
    private User actor;

    @Column(nullable = false)
    private String type;        // like, comment, follow, new_event, event_reminder

    private String entityType;  // post, event, user
    private Long entityId;

    /** Sistem bildirimleri için özel metin (etkinlik/sanatçı adı vb.) */
    private String message;

    private Boolean isRead = false;

    private LocalDateTime createdAt = LocalDateTime.now();

    /**
     * Kullanıcı bildirimi sildiyse zamanı. Satır silinmez, yalnız listeden düşer:
     * "aynı bildirimi tekrar gönderme" kontrolleri bu satırlara bakıyor; gerçekten
     * silinse sildiğin hatırlatma ertesi gün yeniden gelebilirdi.
     */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    public Long getId() { return id; }
    public User getRecipient() { return recipient; }
    public void setRecipient(User recipient) { this.recipient = recipient; }
    public User getActor() { return actor; }
    public void setActor(User actor) { this.actor = actor; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public Long getEntityId() { return entityId; }
    public void setEntityId(Long entityId) { this.entityId = entityId; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public Boolean getIsRead() { return isRead; }
    public void setIsRead(Boolean isRead) { this.isRead = isRead; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }
}