package com.concertly.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "community_post_poll_options")
public class CommunityPostPollOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "community_post_id", nullable = false)
    private CommunityPost communityPost;

    private String optionText;

    public Long getId() { return id; }
    public CommunityPost getCommunityPost() { return communityPost; }
    public void setCommunityPost(CommunityPost communityPost) { this.communityPost = communityPost; }
    public String getOptionText() { return optionText; }
    public void setOptionText(String optionText) { this.optionText = optionText; }
}
