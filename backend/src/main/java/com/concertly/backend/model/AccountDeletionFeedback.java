package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Hesabını silen kullanıcının verdiği "neden siliyorsun?" geri bildirimi.
 * Kullanıcıya FK ile BAĞLANMAZ — kullanıcı silindikten sonra da kayıt kalsın,
 * ayrıca anonim olsun diye. Yalnızca sebep + opsiyonel açıklama saklanır.
 */
@Entity
@Table(name = "account_deletion_feedback")
public class AccountDeletionFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String reason;

    @Column(length = 500)
    private String details;

    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() { this.createdAt = LocalDateTime.now(); }

    public AccountDeletionFeedback() {}

    public AccountDeletionFeedback(String reason, String details) {
        this.reason = reason;
        this.details = details;
    }

    public Long getId() { return id; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
