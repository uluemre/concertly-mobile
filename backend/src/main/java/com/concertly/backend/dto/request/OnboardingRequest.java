package com.concertly.backend.dto.request;

import java.util.List;

public class OnboardingRequest {

    private List<String> genres;
    private List<Long> artistIds;
    private String city;

    public List<String> getGenres() { return genres; }
    public void setGenres(List<String> genres) { this.genres = genres; }

    public List<Long> getArtistIds() { return artistIds; }
    public void setArtistIds(List<Long> artistIds) { this.artistIds = artistIds; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
}
