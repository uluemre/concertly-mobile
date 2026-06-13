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

        // Önce tam adla dene, sonra temizlenmiş haliyle — başarılı olunca dur
        String cleaned = cleanForSearch(artistName);
        String[] queries = artistName.equals(cleaned)
            ? new String[]{ artistName }
            : new String[]{ artistName, cleaned };

        for (String query : queries) {
            if (query == null || query.isBlank()) continue;
            SpotifyArtistData result = doSearch(query);
            if (result != null) return result; // ilk başarılı sonuçta dur
            // Rate limit için kısa bekleme
            try { Thread.sleep(200); } catch (InterruptedException ignored) {}
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

            Integer popularity = (Integer) best.get("popularity");

            // Ham genre tag'leri (ilk 3, Spotify'ın sağladığı)
            List<String> rawGenres = spotifyGenres != null
                    ? spotifyGenres.stream().limit(3).toList()
                    : List.of();

            return new SpotifyArtistData(imageUrl, genre, spotifyId, name, followerCount, popularity, rawGenres);

        } catch (Exception e) {
            String msg = e.getMessage();
            if (msg != null && msg.contains("429")) {
                System.out.println("  ⏳ Spotify rate limit — 2sn bekleniyor...");
                try { Thread.sleep(2000); } catch (InterruptedException ignored) {}
            } else {
                System.out.println("  ❌ Spotify hata (" + query + "): " + msg);
            }
            return null;
        }
    }

    private String cleanForSearch(String name) {
        if (name == null) return null;
        return name.replaceAll("(?i)\\s*[-–—(|].*", "").trim();
    }

    public String mapSpotifyGenre(List<String> spotifyGenres) {
        if (spotifyGenres == null || spotifyGenres.isEmpty()) return null;

        // Türkçe özgün türler — önce kontrol et
        for (String g : spotifyGenres) {
            String lower = g.toLowerCase();
            if (lower.contains("arabesk") || lower.contains("fantezi") || lower.contains("türkü")) return "Arabesk";
            if (lower.contains("turk sanat") || lower.contains("turkish classical")) return "Türk Sanat Müziği";
            if (lower.contains("anadolu") || lower.contains("anatolian")) return "Rock";
            if (lower.contains("turk") && (lower.contains("rock") || lower.contains("metal") || lower.contains("punk"))) return "Rock";
            if (lower.contains("turk") && lower.contains("rap")) return "Rap";
            if (lower.contains("turk") && lower.contains("pop")) return "Pop";
            if (lower.contains("trap turk") || lower.contains("turkish hip hop")) return "Rap";
        }

        // Evrensel türler
        for (String g : spotifyGenres) {
            String lower = g.toLowerCase();
            if (lower.contains("metal") || lower.contains("punk")) return "Rock";
            if (lower.contains("rock")) return "Rock";
            if (lower.contains("rap") || lower.contains("hip hop") || lower.contains("trap")) return "Rap";
            if (lower.contains("techno") || lower.contains("house") || lower.contains("edm")
                    || lower.contains("electronic") || lower.contains("dubstep") || lower.contains("trance")) return "Elektronik";
            if (lower.contains("jazz")) return "Jazz";
            if (lower.contains("blues")) return "Jazz";
            if (lower.contains("classical") || lower.contains("orchestra")) return "Klasik";
            if (lower.contains("indie") || lower.contains("alternative")) return "Indie";
            if (lower.contains("folk") || lower.contains("acoustic")) return "Folk";
            if (lower.contains("r&b") || lower.contains("soul")) return "R&B";
            if (lower.contains("reggae")) return "Reggae";
            if (lower.contains("pop")) return "Pop";
        }
        return null;
    }

    public static class SpotifyArtistData {
        public final String  imageUrl;
        public final String  genre;
        public final String  spotifyId;
        public final String  name;
        public final Integer followerCount;
        public final Integer popularity;
        public final List<String> rawGenres;

        public SpotifyArtistData(String imageUrl, String genre, String spotifyId,
                                  String name, Integer followerCount,
                                  Integer popularity, List<String> rawGenres) {
            this.imageUrl      = imageUrl;
            this.genre         = genre;
            this.spotifyId     = spotifyId;
            this.name          = name;
            this.followerCount = followerCount;
            this.popularity    = popularity;
            this.rawGenres     = rawGenres != null ? rawGenres : List.of();
        }
    }
}
