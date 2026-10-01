package com.concertly.backend.model;

import jakarta.persistence.*;

@Entity
@Table(
        name = "follows",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"follower_id", "following_id"})
        }
)
public class Follow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 🔥 SELF RELATION
    @ManyToOne
    @JoinColumn(name = "follower_id")
    private User follower;

    @ManyToOne
    @JoinColumn(name = "following_id")
    private User following;

    // NULL = ACCEPTED (bu özellikten önceki satırlar); özel hesaba istek PENDING başlar
    @Column(length = 20)
    private String status;

    public static final String ACCEPTED = "ACCEPTED";
    public static final String PENDING = "PENDING";

    public Long getId() { return id; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    /** NULL kabul edilmiş sayılır (eski satırlar). */
    public boolean isAccepted() { return status == null || ACCEPTED.equals(status); }

    public User getFollower() { return follower; }
    public void setFollower(User follower) { this.follower = follower; }

    public User getFollowing() { return following; }
    public void setFollowing(User following) { this.following = following; }
}