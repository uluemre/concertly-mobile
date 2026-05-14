package com.concertly.backend.model;

import jakarta.persistence.*;

@Entity
@Table(
        name = "community_post_likes",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"user_id", "community_post_id"})
        }
)
public class CommunityPostLike {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne
    @JoinColumn(name = "community_post_id")
    private CommunityPost communityPost;

    public Long getId() { return id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public CommunityPost getCommunityPost() { return communityPost; }
    public void setCommunityPost(CommunityPost communityPost) { this.communityPost = communityPost; }
}
