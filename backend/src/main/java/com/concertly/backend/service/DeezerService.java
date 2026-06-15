package com.concertly.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DeezerService {

    private final RestTemplate restTemplate = new RestTemplate();

    public DeezerArtistData searchArtist(String artistName) {
        if (artistName == null || artistName.isBlank()) return null;

        String[] queries = buildQueries(artistName);
        for (String query : queries) {
            DeezerArtistData result = doSearch(query, artistName);
            if (result != null) return result;
        }
        return null;
    }

    private String[] buildQueries(String name) {
        String cleaned = name.replaceAll("(?i)\\s*[-–—(|].*", "").trim();
        return name.equals(cleaned) ? new String[]{ name } : new String[]{ name, cleaned };
    }

    @SuppressWarnings("unchecked")
    private DeezerArtistData doSearch(String query, String originalName) {
        try {
            String url = UriComponentsBuilder
                .fromUriString("https://api.deezer.com/search/artist")
                .queryParam("q", query)
                .queryParam("limit", "5")
                .toUriString();

            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null) return null;

            List<Map<String, Object>> data = (List<Map<String, Object>>) response.get("data");
            if (data == null || data.isEmpty()) {
                System.out.println("  🔍 Deezer sonuç yok: " + query);
                return null;
            }

            Map<String, Object> best = data.get(0);
            for (Map<String, Object> item : data) {
                String name = (String) item.get("name");
                if (name != null && name.equalsIgnoreCase(originalName)) {
                    best = item;
                    break;
                }
            }

            String imageUrl = (String) best.get("picture_xl");
            if (imageUrl == null) imageUrl = (String) best.get("picture_big");
            if (imageUrl == null) imageUrl = (String) best.get("picture_medium");

            // Deezer default/placeholder görseli atla
            if (imageUrl == null || imageUrl.contains("default_avatar")) return null;

            String name = (String) best.get("name");
            System.out.println("  🎵 Deezer buldu: " + name + " | görsel var");
            return new DeezerArtistData(imageUrl, name);

        } catch (Exception e) {
            System.out.println("  ❌ Deezer hata (" + query + "): " + e.getMessage());
            return null;
        }
    }

    public static class DeezerArtistData {
        public final String imageUrl;
        public final String name;

        public DeezerArtistData(String imageUrl, String name) {
            this.imageUrl = imageUrl;
            this.name = name;
        }
    }

    // ── Şarkı testi (quiz) için ek metotlar ──────────────────────────────────

    /** Sanatçı arama — quiz ekranındaki seçim listesi için id'li sonuç döner. */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> searchArtists(String query, int limit) {
        List<Map<String, Object>> results = new ArrayList<>();
        if (query == null || query.isBlank()) return results;
        try {
            String url = UriComponentsBuilder
                .fromUriString("https://api.deezer.com/search/artist")
                .queryParam("q", query)
                .queryParam("limit", String.valueOf(limit))
                .toUriString();

            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null) return results;

            List<Map<String, Object>> data = (List<Map<String, Object>>) response.get("data");
            if (data == null) return results;

            for (Map<String, Object> item : data) {
                Map<String, Object> artist = new LinkedHashMap<>();
                artist.put("artistId", ((Number) item.get("id")).longValue());
                artist.put("name", item.get("name"));
                String img = (String) item.get("picture_medium");
                artist.put("imageUrl", img != null ? img : "");
                results.add(artist);
            }
        } catch (Exception e) {
            System.out.println("  ❌ Deezer sanatçı arama hatası: " + e.getMessage());
        }
        return results;
    }

    /** Sanatçının en popüler şarkıları — sadece önizlemesi olanlar, başlığa göre tekilleştirilmiş. */
    @SuppressWarnings("unchecked")
    public List<Track> getTopTracks(long artistId, int limit) {
        List<Track> tracks = new ArrayList<>();
        try {
            String url = "https://api.deezer.com/artist/" + artistId + "/top?limit=" + limit;
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null) return tracks;

            List<Map<String, Object>> data = (List<Map<String, Object>>) response.get("data");
            if (data == null) return tracks;

            java.util.Set<String> seenTitles = new java.util.HashSet<>();
            for (Map<String, Object> item : data) {
                String preview = (String) item.get("preview");
                if (preview == null || preview.isBlank()) continue;

                String title = (String) item.get("title_short");
                if (title == null) title = (String) item.get("title");
                if (title == null || !seenTitles.add(title.trim().toLowerCase())) continue;

                String cover = "";
                Map<String, Object> album = (Map<String, Object>) item.get("album");
                if (album != null && album.get("cover_medium") != null) {
                    cover = (String) album.get("cover_medium");
                }
                tracks.add(new Track(title.trim(), preview, cover));
            }
        } catch (Exception e) {
            System.out.println("  ❌ Deezer top şarkı hatası (artistId=" + artistId + "): " + e.getMessage());
        }
        return tracks;
    }

    /** Playlist şarkıları — günlük şarkı havuzu için. Önizlemesiz/tekrar eden parçalar elenir. */
    @SuppressWarnings("unchecked")
    public List<Track> getPlaylistTracks(long playlistId, int limit) {
        List<Track> tracks = new ArrayList<>();
        try {
            String url = "https://api.deezer.com/playlist/" + playlistId + "/tracks?limit=" + limit;
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null) return tracks;

            List<Map<String, Object>> data = (List<Map<String, Object>>) response.get("data");
            if (data == null) return tracks;

            java.util.Set<String> seenTitles = new java.util.HashSet<>();
            for (Map<String, Object> item : data) {
                String preview = (String) item.get("preview");
                if (preview == null || preview.isBlank()) continue;

                String title = (String) item.get("title_short");
                if (title == null) title = (String) item.get("title");
                if (title == null || !seenTitles.add(title.trim().toLowerCase())) continue;

                String artist = "";
                Map<String, Object> artistObj = (Map<String, Object>) item.get("artist");
                if (artistObj != null && artistObj.get("name") != null) {
                    artist = (String) artistObj.get("name");
                }

                String cover = "";
                Map<String, Object> album = (Map<String, Object>) item.get("album");
                if (album != null && album.get("cover_medium") != null) {
                    cover = (String) album.get("cover_medium");
                }
                tracks.add(new Track(title.trim(), preview, cover, artist));
            }
        } catch (Exception e) {
            System.out.println("  ❌ Deezer playlist hatası (" + playlistId + "): " + e.getMessage());
        }
        return tracks;
    }

    /** Şarkı arama — günlük şarkı tahmin kutusunun otomatik tamamlaması için. */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> searchTracks(String query, int limit) {
        List<Map<String, Object>> results = new ArrayList<>();
        if (query == null || query.isBlank()) return results;
        try {
            String url = UriComponentsBuilder
                .fromUriString("https://api.deezer.com/search/track")
                .queryParam("q", query)
                .queryParam("limit", String.valueOf(limit * 2))
                .toUriString();

            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null) return results;

            List<Map<String, Object>> data = (List<Map<String, Object>>) response.get("data");
            if (data == null) return results;

            java.util.Set<String> seen = new java.util.HashSet<>();
            for (Map<String, Object> item : data) {
                String title = (String) item.get("title_short");
                if (title == null) title = (String) item.get("title");
                if (title == null) continue;

                String artist = "";
                Map<String, Object> artistObj = (Map<String, Object>) item.get("artist");
                if (artistObj != null && artistObj.get("name") != null) {
                    artist = (String) artistObj.get("name");
                }

                if (!seen.add((title + "|" + artist).toLowerCase())) continue;

                Map<String, Object> row = new LinkedHashMap<>();
                row.put("title", title.trim());
                row.put("artist", artist);
                results.add(row);
                if (results.size() >= limit) break;
            }
        } catch (Exception e) {
            System.out.println("  ❌ Deezer şarkı arama hatası: " + e.getMessage());
        }
        return results;
    }

    public static class Track {
        public final String title;
        public final String previewUrl;
        public final String coverUrl;
        public final String artistName;

        public Track(String title, String previewUrl, String coverUrl) {
            this(title, previewUrl, coverUrl, "");
        }

        public Track(String title, String previewUrl, String coverUrl, String artistName) {
            this.title = title;
            this.previewUrl = previewUrl;
            this.coverUrl = coverUrl;
            this.artistName = artistName;
        }
    }
}
