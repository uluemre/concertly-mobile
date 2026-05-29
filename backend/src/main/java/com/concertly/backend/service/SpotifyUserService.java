package com.concertly.backend.service;

import com.concertly.backend.dto.response.SpotifyRecommendationDto;
import com.concertly.backend.model.Artist;
import com.concertly.backend.model.SpotifyConnection;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SpotifyUserService {

    @Value("${spotify.client.id}")
    private String clientId;

    @Value("${spotify.client.secret}")
    private String clientSecret;

    @Value("${spotify.redirect.uri}")
    private String configuredRedirectUri;

    private final SpotifyConnectionRepository connectionRepository;
    private final UserRepository userRepository;
    private final ArtistRepository artistRepository;
    private final ArtistFollowRepository artistFollowRepository;
    private final SpotifyService spotifyService;
    private final RestTemplate restTemplate = new RestTemplate();

    public SpotifyUserService(SpotifyConnectionRepository connectionRepository,
                               UserRepository userRepository,
                               ArtistRepository artistRepository,
                               ArtistFollowRepository artistFollowRepository,
                               SpotifyService spotifyService) {
        this.connectionRepository = connectionRepository;
        this.userRepository = userRepository;
        this.artistRepository = artistRepository;
        this.artistFollowRepository = artistFollowRepository;
        this.spotifyService = spotifyService;
    }

    public String getAuthUrl(Long userId) {
        String scope = "user-top-read";
        try {
            return "https://accounts.spotify.com/authorize"
                    + "?client_id=" + clientId
                    + "&response_type=code"
                    + "&redirect_uri=" + URLEncoder.encode(configuredRedirectUri, StandardCharsets.UTF_8)
                    + "&scope=" + URLEncoder.encode(scope, StandardCharsets.UTF_8)
                    + "&state=" + userId
                    + "&show_dialog=true";
        } catch (Exception e) {
            throw new RuntimeException("Auth URL oluşturulamadı", e);
        }
    }

    @SuppressWarnings("unchecked")
    public boolean handleCallback(String code, Long userId) {
        try {
            String credentials = Base64.getEncoder()
                    .encodeToString((clientId + ":" + clientSecret).getBytes());
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Basic " + credentials);
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("grant_type", "authorization_code");
            body.add("code", code);
            body.add("redirect_uri", configuredRedirectUri);

            Map<String, Object> tokenResponse = restTemplate.postForObject(
                    "https://accounts.spotify.com/api/token",
                    new HttpEntity<>(body, headers), Map.class);

            if (tokenResponse == null || tokenResponse.get("access_token") == null) return false;

            String accessToken = (String) tokenResponse.get("access_token");
            String refreshToken = (String) tokenResponse.get("refresh_token");
            Integer expiresIn = (Integer) tokenResponse.get("expires_in");

            // Spotify kullanıcı profili al
            HttpHeaders authHeaders = new HttpHeaders();
            authHeaders.set("Authorization", "Bearer " + accessToken);
            Map<String, Object> profile = restTemplate.exchange(
                    "https://api.spotify.com/v1/me",
                    HttpMethod.GET, new HttpEntity<>(authHeaders), Map.class).getBody();

            User user = userRepository.findById(userId).orElse(null);
            if (user == null) return false;

            SpotifyConnection conn = connectionRepository.findByUserId(userId)
                    .orElse(new SpotifyConnection());
            conn.setUser(user);
            conn.setAccessToken(accessToken);
            conn.setRefreshToken(refreshToken);
            conn.setExpiresAt(LocalDateTime.now().plusSeconds(expiresIn - 60));
            conn.setConnectedAt(LocalDateTime.now());
            if (profile != null) {
                conn.setSpotifyUserId((String) profile.get("id"));
                conn.setSpotifyDisplayName((String) profile.get("display_name"));
            }
            connectionRepository.save(conn);
            return true;
        } catch (Exception e) {
            System.out.println("Spotify callback hatası: " + e.getMessage());
            return false;
        }
    }

    public Map<String, Object> getStatus(Long userId) {
        return connectionRepository.findByUserId(userId)
                .map(c -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("connected", true);
                    m.put("spotifyDisplayName", c.getSpotifyDisplayName());
                    m.put("connectedAt", c.getConnectedAt());
                    return m;
                })
                .orElse(Map.of("connected", false));
    }

    @SuppressWarnings("unchecked")
    public List<SpotifyRecommendationDto> getRecommendations(Long userId) {
        SpotifyConnection conn = connectionRepository.findByUserId(userId).orElse(null);
        if (conn == null) return List.of();

        String token = getValidToken(conn);
        if (token == null) return List.of();

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + token);

            Map<String, Object> response = restTemplate.exchange(
                    "https://api.spotify.com/v1/me/top/artists?limit=20&time_range=medium_term",
                    HttpMethod.GET, new HttpEntity<>(headers), Map.class).getBody();

            if (response == null) return List.of();
            List<Map<String, Object>> items = (List<Map<String, Object>>) response.get("items");
            if (items == null) return List.of();

            return items.stream().map(item -> {
                String spotifyId = (String) item.get("id");
                String name = (String) item.get("name");
                List<Map<String, Object>> images = (List<Map<String, Object>>) item.get("images");
                String imageUrl = (images != null && !images.isEmpty())
                        ? (String) images.get(0).get("url") : null;
                List<String> genres = (List<String>) item.get("genres");
                String genre = spotifyService.mapSpotifyGenre(genres);
                Integer popularity = (Integer) item.get("popularity");

                Artist appArtist = artistRepository.findBySpotifyId(spotifyId)
                        .or(() -> artistRepository.findByNameIgnoreCase(name))
                        .orElse(null);

                Long appArtistId = appArtist != null ? appArtist.getId() : null;
                boolean isFollowed = appArtist != null &&
                        artistFollowRepository.findByUserIdAndArtistId(userId, appArtist.getId()).isPresent();

                return new SpotifyRecommendationDto(spotifyId, name, imageUrl, genre, popularity, appArtistId, isFollowed);
            }).collect(Collectors.toList());
        } catch (Exception e) {
            System.out.println("Spotify öneriler hatası: " + e.getMessage());
            return List.of();
        }
    }

    public void disconnect(Long userId) {
        connectionRepository.findByUserId(userId).ifPresent(connectionRepository::delete);
    }

    @SuppressWarnings("unchecked")
    private String getValidToken(SpotifyConnection conn) {
        if (conn.getExpiresAt() != null && LocalDateTime.now().isBefore(conn.getExpiresAt())) {
            return conn.getAccessToken();
        }
        // Token yenile
        try {
            String credentials = Base64.getEncoder()
                    .encodeToString((clientId + ":" + clientSecret).getBytes());
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Basic " + credentials);
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("grant_type", "refresh_token");
            body.add("refresh_token", conn.getRefreshToken());

            Map<String, Object> res = restTemplate.postForObject(
                    "https://accounts.spotify.com/api/token",
                    new HttpEntity<>(body, headers), Map.class);

            if (res == null) return null;
            String newToken = (String) res.get("access_token");
            Integer expiresIn = (Integer) res.get("expires_in");
            conn.setAccessToken(newToken);
            conn.setExpiresAt(LocalDateTime.now().plusSeconds(expiresIn - 60));
            if (res.containsKey("refresh_token")) conn.setRefreshToken((String) res.get("refresh_token"));
            connectionRepository.save(conn);
            return newToken;
        } catch (Exception e) {
            return null;
        }
    }
}
