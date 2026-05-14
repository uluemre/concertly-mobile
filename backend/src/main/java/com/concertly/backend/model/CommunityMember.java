package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "community_members",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "community_id"})
)
public class CommunityMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "community_id", nullable = false)
    private Community community;

    private LocalDateTime joinedAt = LocalDateTime.now();

    public Long getId() { return id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Community getCommunity() { return community; }
    public void setCommunity(Community community) { this.community = community; }

    public LocalDateTime getJoinedAt() { return joinedAt; }
}
