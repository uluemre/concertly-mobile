package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Yüklenen her görselin kaydı. İki işe yarar: kullanıcı başına günlük yükleme
 * kotası ve hiçbir kayıtta kullanılmayan (yetim) görsellerin gece temizliği.
 *
 * userId bilerek düz kolon (User ilişkisi değil): hesap silinince satır kalır,
 * görsel artık hiçbir yerde geçmediği için gece temizliğinde depodan silinir.
 */
@Entity
@Table(name = "media_uploads",
        indexes = {
                @Index(name = "idx_media_uploads_user_created", columnList = "user_id, created_at"),
                @Index(name = "idx_media_uploads_created", columnList = "created_at")
        })
public class MediaUpload {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Depodaki anahtar: <uuid>.<uzantı> (istemciye /uploads/<anahtar> gider). */
    @Column(name = "storage_key", nullable = false, unique = true, length = 100)
    private String storageKey;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected MediaUpload() {}

    public MediaUpload(String storageKey, Long userId, long sizeBytes, LocalDateTime createdAt) {
        this.storageKey = storageKey;
        this.userId = userId;
        this.sizeBytes = sizeBytes;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getStorageKey() { return storageKey; }
    public Long getUserId() { return userId; }
    public long getSizeBytes() { return sizeBytes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
