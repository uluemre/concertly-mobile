package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "artist_reviews",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "artist_id"})
)
public class ArtistReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "artist_id", nullable = false)
    private Artist artist;

    @Column(nullable = false)
    private Integer rating; // 1-5

    @Column(length = 500)
    private String comment;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Artist getArtist() { return artist; }
    public void setArtist(Artist artist) { this.artist = artist; }
    public Integer getRating() { return rating; }
    public void setRating(Integer rating) { this.rating = rating; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
