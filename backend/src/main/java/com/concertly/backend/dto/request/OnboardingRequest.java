package com.concertly.backend.dto.request;

import java.util.List;

public class OnboardingRequest {

    private List<String> genres;
    private List<Long> artistIds;

    public List<String> getGenres() { return genres; }
    public void setGenres(List<String> genres) { this.genres = genres; }

    public List<Long> getArtistIds() { return artistIds; }
    public void setArtistIds(List<Long> artistIds) { this.artistIds = artistIds; }
}
