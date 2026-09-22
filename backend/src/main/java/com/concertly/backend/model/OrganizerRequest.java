package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Organizatör/mekan/sanatçı-menajer hesabı başvurusu.
 *
 * Onaylanan kullanıcı ROLE_ORGANIZER alır ve önerdiği etkinlikler onay
 * kuyruğuna girmeden yayına çıkar. Tek bir mekanizma üç kanalı birden karşılar
 * (organizatör, mekan, menajer) — tip alanı hangisi olduğunu söyler.
 */
@Entity
@Table(name = "organizer_requests")
public class OrganizerRequest {

    public enum Type { ORGANIZER, VENUE, ARTIST_MANAGER }

    public enum Status { PENDING, APPROVED, REJECTED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String organizationName;

    @Enumerated(EnumType.STRING)
    @Column(length = 20, nullable = false)
    private Type type = Type.ORGANIZER;

    /** Resmî site ya da Instagram — moderatörün kimliği doğrulayacağı bağlantı. */
    @Column(length = 500)
    private String website;

    @Column(length = 500)
    private String instagram;

    @Column(length = 1000)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(length = 20, nullable = false)
    private Status status = Status.PENDING;

    /** Reddedilme gerekçesi — başvuran neyi düzelteceğini bilsin. */
    @Column(length = 500)
    private String reviewNote;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime reviewedAt;

    public Long getId() { return id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getOrganizationName() { return organizationName; }
    public void setOrganizationName(String organizationName) { this.organizationName = organizationName; }

    public Type getType() { return type == null ? Type.ORGANIZER : type; }
    public void setType(Type type) { this.type = type; }

    public String getWebsite() { return website; }
    public void setWebsite(String website) { this.website = website; }

    public String getInstagram() { return instagram; }
    public void setInstagram(String instagram) { this.instagram = instagram; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Status getStatus() { return status == null ? Status.PENDING : status; }
    public void setStatus(Status status) { this.status = status; }

    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
}
