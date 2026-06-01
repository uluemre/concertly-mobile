package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "buddy_swipes",
    uniqueConstraints = @UniqueConstraint(columnNames = {"swiper_id", "target_id"})
)
public class BuddySwipe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "swiper_id", nullable = false)
    private Long swiperId;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    private boolean liked;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public Long getSwiperId() { return swiperId; }
    public void setSwiperId(Long swiperId) { this.swiperId = swiperId; }
    public Long getTargetId() { return targetId; }
    public void setTargetId(Long targetId) { this.targetId = targetId; }
    public boolean isLiked() { return liked; }
    public void setLiked(boolean liked) { this.liked = liked; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
