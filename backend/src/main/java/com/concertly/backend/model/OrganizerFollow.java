package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Kullanıcının bir organizatörü takip etmesi: yeni etkinliğinde bildirim alır. */
@Entity
@Table(name = "organizer_follows",
        uniqueConstraints = @UniqueConstraint(name = "uq_organizer_follow", columnNames = {"organizer_id", "user_id"}))
public class OrganizerFollow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organizer_id", nullable = false)
    private Long organizerId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public OrganizerFollow() {}

    public OrganizerFollow(Long organizerId, Long userId) {
        this.organizerId = organizerId;
        this.userId = userId;
    }

    public Long getId() { return id; }
    public Long getOrganizerId() { return organizerId; }
    public Long getUserId() { return userId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
