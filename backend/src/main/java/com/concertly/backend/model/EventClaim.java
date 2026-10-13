package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * "Bu etkinlik benim" talebi: bilet sitelerinden gelen (organizatörü olmayan) bir etkinliği
 * organizatör kendi paneline almak ister; admin onaylarsa events.organizer_id dolar.
 */
@Entity
@Table(name = "event_claims")
public class EventClaim {

    public enum Status { PENDING, APPROVED, REJECTED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false)
    private Long eventId;

    @Column(name = "organizer_id", nullable = false)
    private Long organizerId;

    @Column(length = 1000)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Column(name = "review_note", length = 500)
    private String reviewNote;

    @Column(name = "reviewed_by")
    private String reviewedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    public EventClaim() {}

    public EventClaim(Long eventId, Long organizerId, String message) {
        this.eventId = eventId;
        this.organizerId = organizerId;
        this.message = message;
    }

    public Long getId() { return id; }
    public Long getEventId() { return eventId; }
    public Long getOrganizerId() { return organizerId; }
    public String getMessage() { return message; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
    public String getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(String reviewedBy) { this.reviewedBy = reviewedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
}
