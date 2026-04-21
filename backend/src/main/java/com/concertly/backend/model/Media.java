package com.concertly.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "media")
public class Media {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String url;

    private String type; // image / video

    // 🔥 RELATION

    @ManyToOne
    @JoinColumn(name = "post_id")
    private Post post;

    public Long getId() { return id; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Post getPost() { return post; }
    public void setPost(Post post) { this.post = post; }
}