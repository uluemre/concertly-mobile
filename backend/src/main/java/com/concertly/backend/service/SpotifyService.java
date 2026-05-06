package com.concertly.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class SpotifyService {

    @Value("${spotify.client.id}")
    private String clientId;

    @Value("${spotify.client.secret}")
    private String clientSecret;

    private final RestTemplate restTemplate = new RestTemplate();

    // Token cache — her 55 dakikada yenile
    private String cachedToken;
    private long tokenExpiry = 0;

    // ── TOKEN AL ──────────────────────────────────────────────────────────
    private String getAccessToken() {
        if (cachedToken != null && System.currentTimeMillis() < tokenExpiry) {
            return cachedToken;
        }

        String credentials = Base64.getEncoder()
                .encodeToString((clientId + ":" + clientSecret).getBytes());

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Basic " + credentials);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "client_credentials");

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        Map response = restTemplate.postForObject(
                "https://accounts.spotify.com/api/token",
                request,
                Map.class);
        System.out.println("TOKEN RESPONSE: " + response);
        if (response == null)
            return null;

        cachedToken = (String) response.get("access_token");
        System.out.println("TOKEN: " + cachedToken);
        Integer expiresIn = (Integer) response.get("expires_in");
        tokenExpiry = System.currentTimeMillis() + (expiresIn - 60) * 1000L;

        return cachedToken;
    }

    // ── SANATÇI ARA ───────────────────────────────────────────────────────
    public SpotifyArtistData searchArtist(String artistName) {
        try {
            String token = getAccessToken();
            if (token == null)
                return null;

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + token);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            System.out.println("Searching artist: " + artistName);
            String url = "https://api.spotify.com/v1/search?q={query}&type=artist&limit=1&market=TR";

            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.GET, entity, Map.class, artistName);

            Map body = response.getBody();
            if (body == null)
                return null;

            Map artists = (Map) body.get("artists");
            List<Map> items = (List<Map>) artists.get("items");
            if (items == null || items.isEmpty())
                return null;

            Map artist = items.get(0);

            // Fotoğraf URL
            String imageUrl = null;
            List<Map> images = (List<Map>) artist.get("images");
            if (images != null && !images.isEmpty()) {
                // En büyük fotoğraf (index 0)
                imageUrl = (String) images.get(0).get("url");
            }

            // Genre
            String genre = null;
            List<String> genres = (List<String>) artist.get("genres");
            if (genres != null && !genres.isEmpty()) {
                genre = genres.get(0); // ilk genre
            }

            // Spotify ID
            String spotifyId = (String) artist.get("id");

            return new SpotifyArtistData(imageUrl, genre, spotifyId);

        } catch (Exception e) {
            e.printStackTrace();
            System.out.println("Spotify arama hatası (" + artistName + "): " + e.getMessage());
            return null;
        }
    }

    // ── DTO ───────────────────────────────────────────────────────────────
    public static class SpotifyArtistData {
        public final String imageUrl;
        public final String genre;
        public final String spotifyId;

        public SpotifyArtistData(String imageUrl, String genre, String spotifyId) {
            this.imageUrl = imageUrl;
            this.genre = genre;
            this.spotifyId = spotifyId;
        }
    }
}