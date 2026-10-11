package com.concertly.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "poll_votes",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "post_id"}))
public class PollVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "poll_option_id", nullable = false)
    private PollOption pollOption;

    @Column(name = "post_id")
    private Long postId;

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public PollOption getPollOption() { return pollOption; }
    public void setPollOption(PollOption pollOption) { this.pollOption = pollOption; }
    public Long getPostId() { return postId; }
    public void setPostId(Long postId) { this.postId = postId; }
}
