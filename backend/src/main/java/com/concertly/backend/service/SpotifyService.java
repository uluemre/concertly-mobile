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

    private String cachedToken;
    private long tokenExpiry = 0;

    @SuppressWarnings("unchecked")
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

        Map<String, Object> response = restTemplate.postForObject(
                "https://accounts.spotify.com/api/token", request, Map.class);
        if (response == null) return null;

        cachedToken = (String) response.get("access_token");
        Integer expiresIn = (Integer) response.get("expires_in");
        tokenExpiry = System.currentTimeMillis() + (expiresIn - 60) * 1000L;
        return cachedToken;
    }

    @SuppressWarnings("unchecked")
    public SpotifyArtistData searchArtist(String artistName) {
        if (artistName == null || artistName.isBlank()) return null;

        // Try exact name first, then cleaned variants
        String[] queries = {
            artistName,
            cleanForSearch(artistName),
            artistName.split(" ")[0]  // just first word
        };

        for (String query : queries) {
            if (query == null || query.isBlank()) continue;
            SpotifyArtistData result = doSearch(query);
            if (result != null && result.imageUrl != null) return result;
        }

        // Fallback: return first result with any data
        for (String query : queries) {
            if (query == null || query.isBlank()) continue;
            SpotifyArtistData result = doSearch(query);
            if (result != null) return result;
        }

        return null;
    }

    @SuppressWarnings("unchecked")
    private SpotifyArtistData doSearch(String query) {
        try {
            String token = getAccessToken();
            if (token == null) {
                System.out.println("  ⚠️  Spotify token alınamadı");
                return null;
            }

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + token);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            String url = "https://api.spotify.com/v1/search?q={query}&type=artist&limit=5&market=TR";

            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.GET, entity, Map.class, query);

            Map<String, Object> body = response.getBody();
            if (body == null) return null;

            Map<String, Object> artists = (Map<String, Object>) body.get("artists");
            List<Map<String, Object>> items = (List<Map<String, Object>>) artists.get("items");
            if (items == null || items.isEmpty()) {
                System.out.println("  🔍 Spotify sonuç yok: " + query);
                return null;
            }

            // Pick the best match — prefer exact name match
            Map<String, Object> best = items.get(0);
            for (Map<String, Object> item : items) {
                String itemName = (String) item.get("name");
                if (itemName != null && itemName.equalsIgnoreCase(query)) {
                    best = item;
                    break;
                }
            }

            // Best image (largest = index 0 from Spotify)
            String imageUrl = null;
            List<Map<String, Object>> images = (List<Map<String, Object>>) best.get("images");
            if (images != null && !images.isEmpty()) {
                imageUrl = (String) images.get(0).get("url");
                System.out.println("  🖼️  Spotify image: " + (imageUrl != null ? "var (" + images.size() + " adet)" : "yok"));
            } else {
                System.out.println("  📷 Spotify'da görsel yok: " + query);
            }

            // Genre — take top 2
            List<String> spotifyGenres = (List<String>) best.get("genres");
            String genre = mapSpotifyGenre(spotifyGenres);

            String spotifyId = (String) best.get("id");
            String name = (String) best.get("name");
            System.out.println("  ✅ Spotify buldu: " + name + " | genre: " + genre + " | id: " + spotifyId);

            Map<String, Object> followers = (Map<String, Object>) best.get("followers");
            Integer followerCount = followers != null ? (Integer) followers.get("total") : null;

            return new SpotifyArtistData(imageUrl, genre, spotifyId, name, followerCount);

        } catch (Exception e) {
            System.out.println("  ❌ Spotify hata (" + query + "): " + e.getMessage());
            return null;
        }
    }

    private String cleanForSearch(String name) {
        if (name == null) return null;
        return name.replaceAll("(?i)\\s*[-–—(|].*", "").trim();
    }

    private String mapSpotifyGenre(List<String> spotifyGenres) {
        if (spotifyGenres == null || spotifyGenres.isEmpty()) return null;

        for (String g : spotifyGenres) {
            String lower = g.toLowerCase();
            if (lower.contains("rock") || lower.contains("metal") || lower.contains("punk")) return "Rock";
            if (lower.contains("pop")) return "Pop";
            if (lower.contains("rap") || lower.contains("hip hop")) return "Rap";
            if (lower.contains("elektronik") || lower.contains("electronic") || lower.contains("techno")
                    || lower.contains("house") || lower.contains("edm") || lower.contains("dubstep")) return "Elektronik";
            if (lower.contains("jazz") || lower.contains("blues")) return "Jazz";
            if (lower.contains("indie") || lower.contains("alternative")) return "Indie";
            if (lower.contains("classical") || lower.contains("orkestra")) return "Classical";
            if (lower.contains("turk") || lower.contains("anadolu")) return "Türkçe Rock";
            if (lower.contains("arabesk") || lower.contains("fantezi")) return "Arabesk";
        }
        return null;
    }

    public static class SpotifyArtistData {
        public final String imageUrl;
        public final String genre;
        public final String spotifyId;
        public final String name;
        public final Integer followerCount;

        public SpotifyArtistData(String imageUrl, String genre, String spotifyId,
                                  String name, Integer followerCount) {
            this.imageUrl = imageUrl;
            this.genre = genre;
            this.spotifyId = spotifyId;
            this.name = name;
            this.followerCount = followerCount;
        }
    }
}
