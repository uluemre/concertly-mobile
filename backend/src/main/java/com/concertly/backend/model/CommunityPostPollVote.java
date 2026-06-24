package com.concertly.backend.model;

import jakarta.persistence.*;

@Entity
@Table(
        name = "community_post_poll_votes",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "community_post_id"})
)
public class CommunityPostPollVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "poll_option_id", nullable = false)
    private CommunityPostPollOption pollOption;

    @Column(name = "community_post_id")
    private Long communityPostId;

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public CommunityPostPollOption getPollOption() { return pollOption; }
    public void setPollOption(CommunityPostPollOption pollOption) { this.pollOption = pollOption; }
    public Long getCommunityPostId() { return communityPostId; }
    public void setCommunityPostId(Long communityPostId) { this.communityPostId = communityPostId; }
}
