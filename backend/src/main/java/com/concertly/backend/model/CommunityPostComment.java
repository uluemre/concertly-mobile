package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "community_post_comments")
public class CommunityPostComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 1000)
    private String content;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne
    @JoinColumn(name = "community_post_id")
    private CommunityPost communityPost;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public CommunityPost getCommunityPost() { return communityPost; }
    public void setCommunityPost(CommunityPost communityPost) { this.communityPost = communityPost; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
