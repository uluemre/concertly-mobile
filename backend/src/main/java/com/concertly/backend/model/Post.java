package com.concertly.backend.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "posts")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String content;

    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt = LocalDateTime.now();

    private Integer likeCount = 0;

    private Integer commentCount = 0;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne
    @JoinColumn(name = "event_id")
    private Event event;

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL)
    private List<Media> mediaList;

    public Long getId()                          { return id; }

    public String getContent()                   { return content; }
    public void setContent(String content)       { this.content = content; }

    public LocalDateTime getCreatedAt()          { return createdAt; }
    public void setCreatedAt(LocalDateTime d)    { this.createdAt = d; }

    public LocalDateTime getUpdatedAt()          { return updatedAt; }
    public void setUpdatedAt(LocalDateTime d)    { this.updatedAt = d; }

    public Integer getLikeCount()                { return likeCount; }
    public void setLikeCount(Integer count)      { this.likeCount = count; }

    public Integer getCommentCount()             { return commentCount; }
    public void setCommentCount(Integer count)   { this.commentCount = count; }

    public User getUser()                        { return user; }
    public void setUser(User user)               { this.user = user; }

    public Event getEvent()                      { return event; }
    public void setEvent(Event event)            { this.event = event; }

    public List<Media> getMediaList()            { return mediaList; }
}