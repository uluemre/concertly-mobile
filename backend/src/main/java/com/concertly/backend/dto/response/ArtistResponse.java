package com.concertly.backend.dto.response;

import com.concertly.backend.model.Artist;

public class ArtistResponse {

    private Long id;
    private String name;
    private String imageUrl;
    private String externalId;
    private long followerCount;
    private boolean isFollowedByCurrentUser;

    public static ArtistResponse from(Artist artist,
                                      long followerCount,
                                      boolean isFollowedByCurrentUser) {
        ArtistResponse dto = new ArtistResponse();
        dto.id                      = artist.getId();
        dto.name                    = artist.getName();
        dto.imageUrl                = artist.getImageUrl();
        dto.externalId              = artist.getExternalId();
        dto.followerCount           = followerCount;
        dto.isFollowedByCurrentUser = isFollowedByCurrentUser;
        return dto;
    }

    public Long getId()                        { return id; }
    public String getName()                    { return name; }
    public String getImageUrl()                { return imageUrl; }
    public String getExternalId()              { return externalId; }
    public long getFollowerCount()             { return followerCount; }
    public boolean isFollowedByCurrentUser()   { return isFollowedByCurrentUser; }
}