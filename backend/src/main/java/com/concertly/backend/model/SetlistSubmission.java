package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Setlist Tahmin Ligi kaydı.
 * kind = PREDICTION → konser öncesi tahmin, CONFIRMATION → konser sonrası "bunlar çalındı" bildirimi.
 */
@Entity
@Table(name = "setlist_submissions", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "event_id", "kind"})
})
public class SetlistSubmission {

    public static final String KIND_PREDICTION = "PREDICTION";
    public static final String KIND_CONFIRMATION = "CONFIRMATION";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @Column(nullable = false)
    private String kind;

    /** Şarkı adları "|" ile ayrılmış tek alan (User.favoriteGenres deseni) */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String titles;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Event getEvent() { return event; }
    public void setEvent(Event event) { this.event = event; }
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public String getTitles() { return titles; }
    public void setTitles(String titles) { this.titles = titles; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
