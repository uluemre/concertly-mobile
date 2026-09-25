package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "posts")
public class Post {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = ContentLimits.COLUMN_LENGTH)

    private String content;

    /** Moderasyon: admin gizlediğinde içerik akışlardan düşer ama silinmez
     *  (şikayet incelemesi ve denetim izi için kayıt korunur). */
    private Boolean isHidden = false;
    private String postType = "TEXT"; // TEXT, IMAGE, POLL
    private String imageUrl;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();

    // ❌ likeCount ve commentCount KALDIRILDI

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne
    @JoinColumn(name = "event_id")
    private Event event;

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Media> mediaList;

    // Boş liste ile başlar: createPost aynı transaction'da seçenekleri buraya ekler
    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PollOption> pollOptions = new ArrayList<>();

    // Getters/Setters...
    public Long getId() { return id; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime d) { this.updatedAt = d; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Event getEvent() { return event; }
    public void setEvent(Event event) { this.event = event; }
    public List<Media> getMediaList() { return mediaList; }
    public String getPostType() { return postType; }
    public void setPostType(String postType) { this.postType = postType; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public List<PollOption> getPollOptions() { return pollOptions; }

    public Boolean getIsHidden() { return isHidden != null && isHidden; }
    public void setIsHidden(Boolean isHidden) { this.isHidden = isHidden; }
}
