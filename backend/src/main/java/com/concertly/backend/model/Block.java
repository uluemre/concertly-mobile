package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "blocks",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"blocker_id", "blocked_id"})
        }
)
public class Block {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "blocker_id")
    private User blocker;

    @ManyToOne
    @JoinColumn(name = "blocked_id")
    private User blocked;

    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() { this.createdAt = LocalDateTime.now(); }

    public Long getId() { return id; }

    public User getBlocker() { return blocker; }
    public void setBlocker(User blocker) { this.blocker = blocker; }

    public User getBlocked() { return blocked; }
    public void setBlocked(User blocked) { this.blocked = blocked; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
