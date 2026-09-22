package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Bir cihazın Expo push adresi. Aynı kullanıcı birden çok cihaza sahip
 * olabileceği için token başına bir satır tutulur; token benzersizdir —
 * cihaz el değiştirirse kayıt yeni kullanıcıya taşınır.
 */
@Entity
@Table(name = "push_tokens", indexes = @Index(name = "idx_push_tokens_user", columnList = "user_id"))
public class PushToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** ExponentPushToken[...] biçimindeki adres. */
    @Column(nullable = false, unique = true, length = 255)
    private String token;

    /** ios | android — teşhis ve platforma özel alan (badge/channel) için. */
    @Column(length = 20)
    private String platform;

    /** Cihazın uygulama dili (tr/en); bildirim metni buna göre seçilir. */
    @Column(length = 5)
    private String language = "tr";

    private LocalDateTime createdAt = LocalDateTime.now();

    /** Son kayıt/yenileme zamanı — ölü cihazları ayıklamak için. */
    private LocalDateTime lastSeenAt = LocalDateTime.now();

    public Long getId() { return id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }

    public String getLanguage() { return language == null ? "tr" : language; }
    public void setLanguage(String language) { this.language = language; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public LocalDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }
}
