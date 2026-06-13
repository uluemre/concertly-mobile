package com.concertly.backend.dto.response;

import com.concertly.backend.model.Artist;

public class ArtistResponse {

    private Long    id;
    private String  name;
    private String  genre;
    private String  genreTags;
    private String  imageUrl;
    private String  externalId;
    private String  spotifyId;
    private Integer popularity;
    private Long    spotifyFollowers;
    private long    followerCount;
    private boolean isFollowedByCurrentUser;

    public static ArtistResponse from(Artist artist,
                                      long followerCount,
                                      boolean isFollowedByCurrentUser) {
        ArtistResponse dto = new ArtistResponse();
        dto.id                      = artist.getId();
        dto.name                    = artist.getName();
        dto.genre                   = artist.getGenre();
        dto.genreTags               = artist.getGenreTags();
        dto.imageUrl                = artist.getImageUrl();
        dto.externalId              = artist.getExternalId();
        dto.spotifyId               = artist.getSpotifyId();
        dto.popularity              = artist.getPopularity();
        dto.spotifyFollowers        = artist.getSpotifyFollowers();
        dto.followerCount           = followerCount;
        dto.isFollowedByCurrentUser = isFollowedByCurrentUser;
        return dto;
    }

    public Long    getId()                      { return id; }
    public String  getName()                    { return name; }
    public String  getGenre()                   { return genre; }
    public String  getGenreTags()               { return genreTags; }
    public String  getImageUrl()                { return imageUrl; }
    public String  getExternalId()              { return externalId; }
    public String  getSpotifyId()               { return spotifyId; }
    public Integer getPopularity()              { return popularity; }
    public Long    getSpotifyFollowers()        { return spotifyFollowers; }
    public long    getFollowerCount()           { return followerCount; }
    public boolean isFollowedByCurrentUser()    { return isFollowedByCurrentUser; }
}