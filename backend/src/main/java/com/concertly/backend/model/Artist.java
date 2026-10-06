package com.concertly.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "artists")
public class Artist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String genre;
    private String spotifyId;

    public String getGenre() {
        return genre;
    }

    public void setGenre(String genre) {
        this.genre = genre;
    }

    public String getSpotifyId() {
        return spotifyId;
    }

    public void setSpotifyId(String spotifyId) {
        this.spotifyId = spotifyId;
    }

    private String imageUrl;

    /** Fotoğrafın geldiği yer: DEEZER | EVENT (konser afişi) | SPOTIFY; null = eski kayıt. */
    @jakarta.persistence.Column(name = "image_source", length = 20)
    private String imageSource;

    /** Fotoğraf en son ne zaman arandı (gece görevi eskiyenleri yeniden arar). */
    @jakarta.persistence.Column(name = "image_checked_at")
    private java.time.LocalDateTime imageCheckedAt;

    public String getImageSource() { return imageSource; }
    public void setImageSource(String imageSource) { this.imageSource = imageSource; }
    public java.time.LocalDateTime getImageCheckedAt() { return imageCheckedAt; }
    public void setImageCheckedAt(java.time.LocalDateTime imageCheckedAt) { this.imageCheckedAt = imageCheckedAt; }

    private String externalId;

    private Integer popularity;
    private Long    spotifyFollowers;
    private String  genreTags;

    /** Yumusak birlestirme: doluysa bu kayit mukerrerdir ve bu kimlikli asil kayda tasinmistir (silinmez). */
    private Long mergedIntoArtistId;

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getExternalId() {
        return externalId;
    }

    public void setExternalId(String externalId) {
        this.externalId = externalId;
    }

    public Integer getPopularity()            { return popularity; }
    public void    setPopularity(Integer p)   { this.popularity = p; }

    public Long getSpotifyFollowers()         { return spotifyFollowers; }
    public void setSpotifyFollowers(Long f)   { this.spotifyFollowers = f; }

    public String getGenreTags()              { return genreTags; }
    public void   setGenreTags(String g)      { this.genreTags = g; }

    public Long getMergedIntoArtistId()          { return mergedIntoArtistId; }
    public void setMergedIntoArtistId(Long id)   { this.mergedIntoArtistId = id; }
}