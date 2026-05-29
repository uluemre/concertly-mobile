package com.concertly.backend.dto.response;

public class SpotifyRecommendationDto {
    private String spotifyId;
    private String name;
    private String imageUrl;
    private String genre;
    private Integer popularity;
    private Long appArtistId;
    private boolean followed;

    public SpotifyRecommendationDto(String spotifyId, String name, String imageUrl,
                                    String genre, Integer popularity,
                                    Long appArtistId, boolean followed) {
        this.spotifyId = spotifyId;
        this.name = name;
        this.imageUrl = imageUrl;
        this.genre = genre;
        this.popularity = popularity;
        this.appArtistId = appArtistId;
        this.followed = followed;
    }

    public String getSpotifyId() { return spotifyId; }
    public String getName() { return name; }
    public String getImageUrl() { return imageUrl; }
    public String getGenre() { return genre; }
    public Integer getPopularity() { return popularity; }
    public Long getAppArtistId() { return appArtistId; }
    public boolean isFollowed() { return followed; }
    public void setFollowed(boolean followed) { this.followed = followed; }
}
