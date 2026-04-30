package com.concertly.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "media")
public class Media {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String url;
    private String type;        // image / video

    // ✅ YENİ: hangi entity'e ait
    private String entityType;  // post, profile, artist

    // ✅ post_id artık nullable (profil fotoğrafı için)
    @ManyToOne
    @JoinColumn(name = "post_id", nullable = true)
    private Post post;

    public Long getId() { return id; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public Post getPost() { return post; }
    public void setPost(Post post) { this.post = post; }
}