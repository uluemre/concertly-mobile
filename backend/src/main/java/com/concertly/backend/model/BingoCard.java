package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "bingo_cards", indexes = {
        @Index(name = "idx_bingo_user_event", columnList = "user_id,eventId")
})
public class BingoCard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private Long eventId;
    private String eventName;

    // comma-separated indices of marked squares, e.g. "0,3,12,24"
    @Column(length = 200)
    private String markedSquares = "";

    private boolean hasBingo = false;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Long getEventId() { return eventId; }
    public void setEventId(Long eventId) { this.eventId = eventId; }
    public String getEventName() { return eventName; }
    public void setEventName(String eventName) { this.eventName = eventName; }
    public String getMarkedSquares() { return markedSquares; }
    public void setMarkedSquares(String markedSquares) { this.markedSquares = markedSquares; }
    public boolean isHasBingo() { return hasBingo; }
    public void setHasBingo(boolean hasBingo) { this.hasBingo = hasBingo; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
