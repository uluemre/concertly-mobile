package com.concertly.backend.dto.response;

import java.util.List;

public class SearchResponse {
    private List<EventResponse> events;
    private List<ArtistResponse> artists;
    private List<UserResponse> users;

    public SearchResponse(List<EventResponse> events,
            List<ArtistResponse> artists,
            List<UserResponse> users) {
        this.events = events;
        this.artists = artists;
        this.users = users;
    }

    public List<EventResponse> getEvents() {
        return events;
    }

    public List<ArtistResponse> getArtists() {
        return artists;
    }

    public List<UserResponse> getUsers() {
        return users;
    }
}