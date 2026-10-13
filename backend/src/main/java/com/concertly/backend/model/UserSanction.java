package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Kullanıcının moderasyon geçmişi: uyarı, yasak (süreli/süresiz), yasak kaldırma ve adminlerin
 * iç notu. Kullanıcıya yalnız uyarı bildirimi gider; geçmiş yalnız adminlere görünür.
 */
@Entity
@Table(name = "user_sanctions")
public class UserSanction {

    public enum Type { WARN, BAN, UNBAN, NOTE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Type type;

    @Column(length = 500)
    private String reason;

    /** Yasakta bitiş (null = süresiz). */
    @Column(name = "until_at")
    private LocalDateTime untilAt;

    /** İşlemi yapan admin; otomatik yasak bitişinde "system". */
    @Column(name = "admin_name")
    private String adminName;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public UserSanction() {}

    public UserSanction(Long userId, Type type, String reason, LocalDateTime untilAt, String adminName) {
        this.userId = userId;
        this.type = type;
        this.reason = reason;
        this.untilAt = untilAt;
        this.adminName = adminName;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Type getType() { return type; }
    public String getReason() { return reason; }
    public LocalDateTime getUntilAt() { return untilAt; }
    public String getAdminName() { return adminName; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
