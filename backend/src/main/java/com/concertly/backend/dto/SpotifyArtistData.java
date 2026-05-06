package com.concertly.backend.dto;

public class SpotifyArtistData {
    public final String imageUrl;
    public final String genre;
    public final String spotifyId;

    public SpotifyArtistData(String imageUrl, String genre, String spotifyId) {
        this.imageUrl = imageUrl;
        this.genre = genre;
        this.spotifyId = spotifyId;
    }
}