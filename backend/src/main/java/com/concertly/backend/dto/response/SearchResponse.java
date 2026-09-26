package com.concertly.backend.dto.response;

import java.util.List;

public class SearchResponse {
    private List<EventResponse> events;
    private List<ArtistResponse> artists;
    private List<UserResponse> users;
    private List<VenueSummaryResponse> venues;

    public SearchResponse(List<EventResponse> events,
            List<ArtistResponse> artists,
            List<UserResponse> users) {
        this(events, artists, users, List.of());
    }

    public SearchResponse(List<EventResponse> events,
            List<ArtistResponse> artists,
            List<UserResponse> users,
            List<VenueSummaryResponse> venues) {
        this.events = events;
        this.artists = artists;
        this.users = users;
        this.venues = venues;
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

    public List<VenueSummaryResponse> getVenues() {
        return venues;
    }
}