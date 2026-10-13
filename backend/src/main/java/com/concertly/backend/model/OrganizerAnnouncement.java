package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Organizatörün bir etkinliğin katılımcılarına gönderdiği duyuru (etkinlik başına günde bir). */
@Entity
@Table(name = "organizer_announcements")
public class OrganizerAnnouncement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organizer_id", nullable = false)
    private Long organizerId;

    @Column(name = "event_id", nullable = false)
    private Long eventId;

    @Column(nullable = false, length = 300)
    private String message;

    /** GOING | GOING_INTERESTED */
    @Column(nullable = false, length = 20)
    private String audience;

    @Column(nullable = false)
    private int recipients;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public OrganizerAnnouncement() {}

    public OrganizerAnnouncement(Long organizerId, Long eventId, String message, String audience, int recipients) {
        this.organizerId = organizerId;
        this.eventId = eventId;
        this.message = message;
        this.audience = audience;
        this.recipients = recipients;
    }

    public Long getId() { return id; }
    public Long getOrganizerId() { return organizerId; }
    public Long getEventId() { return eventId; }
    public String getMessage() { return message; }
    public String getAudience() { return audience; }
    public int getRecipients() { return recipients; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
