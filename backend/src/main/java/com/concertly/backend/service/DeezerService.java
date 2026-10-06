package com.concertly.backend.service;

import com.concertly.backend.config.ExternalHttp;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DeezerService {

    private final RestTemplate restTemplate = ExternalHttp.restTemplate();

    public DeezerArtistData searchArtist(String artistName) {
        try {
            return searchArtistOrThrow(artistName);
        } catch (DeezerUnavailableException e) {
            return null;
        }
    }

    /** Deezer'a ulaşılamadı (ağ / sunucu hatası): "bulunamadı" ile karıştırılmasın diye ayrı. */
    public static class DeezerUnavailableException extends RuntimeException {
        public DeezerUnavailableException(String message) { super(message); }
    }

    /**
     * Birebir ad eşleşmesiyle arar. Bulunamazsa null; Deezer'a ulaşılamazsa
     * DeezerUnavailableException (fotoğraf görevi o sanatçıya o gece dokunmaz).
     */
    public DeezerArtistData searchArtistOrThrow(String artistName) {
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
                .queryParam("limit", "10")
                .toUriString();

            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null) return null;

            List<Map<String, Object>> data = (List<Map<String, Object>>) response.get("data");
            if (data == null || data.isEmpty()) {
                System.out.println("  🔍 Deezer sonuç yok: " + query);
                return null;
            }

            // Yalnız adı birebir tutan sonuç (Türkçe harf / büyük-küçük farkı yok sayılır).
            // Eskiden eşleşme yoksa ilk sonuç alınıyordu: kısa/genel adlı sanatçıya
            // başka birinin fotoğrafı geliyordu (Spotify'daki yanlış profil hatasıyla aynı).
            List<Map<String, Object>> exactMatches = new ArrayList<>();
            String wanted = nameKey(originalName);
            String wantedQuery = nameKey(query);
            for (Map<String, Object> item : data) {
                String key = nameKey((String) item.get("name"));
                if (!key.isEmpty() && (key.equals(wanted) || key.equals(wantedQuery))) exactMatches.add(item);
            }
            Map<String, Object> best = pickUnambiguous(exactMatches);
            if (best == null) {
                System.out.println("  🔍 Deezer'da birebir ve kesin eşleşme yok (" + exactMatches.size() + " aday): " + originalName);
                return null;
            }

            String imageUrl = (String) best.get("picture_xl");
            if (imageUrl == null) imageUrl = (String) best.get("picture_big");
            if (imageUrl == null) imageUrl = (String) best.get("picture_medium");

            // Deezer default/placeholder görseli atla
            if (com.concertly.backend.model.ImageUrls.isPlaceholder(imageUrl)) return null;

            String name = (String) best.get("name");
            System.out.println("  🎵 Deezer buldu: " + name + " | görsel var");
            return new DeezerArtistData(imageUrl, name);

        } catch (Exception e) {
            System.out.println("  ❌ Deezer hata (" + query + "): " + e.getMessage());
            if (e instanceof org.springframework.web.client.RestClientException) {
                throw new DeezerUnavailableException(e.getMessage());
            }
            return null;
        }
    }

    /** Aynı adlı adaylardan biri ancak açıkça baskınsa seçilir (takipçi ≥ 10 katı ve ≥ 1000). */
    static final int DOMINANCE_FACTOR = 10;
    static final long DOMINANCE_MIN_FANS = 1000;

    /**
     * Aynı adla birden çok sanatçı olabilir: gerçek Scorpions'ın milyonlarca takipçisi var,
     * aynı adlı tribute hesaplarının birkaç yüz. Takipçisi açıkça baskın olan seçilir; sayılar
     * yakınsa ("Manifest": 7.819 / 1.456 / 12) hangisi olduğu bilinemez, null döner.
     */
    static Map<String, Object> pickUnambiguous(List<Map<String, Object>> exactMatches) {
        if (exactMatches.isEmpty()) return null;
        if (exactMatches.size() == 1) return exactMatches.get(0);
        List<Map<String, Object>> sorted = new ArrayList<>(exactMatches);
        sorted.sort((x, y) -> Long.compare(fans(y), fans(x)));
        long top = fans(sorted.get(0));
        long second = fans(sorted.get(1));
        if (top >= DOMINANCE_MIN_FANS && top >= DOMINANCE_FACTOR * Math.max(second, 1)) return sorted.get(0);
        return null;
    }

    private static long fans(Map<String, Object> item) {
        Object v = item.get("nb_fan");
        return v instanceof Number n ? n.longValue() : 0L;
    }

    /** Karşılaştırma anahtarı: Türkçe harfler sadeleşir, harf/rakam dışı atılır. */
    static String nameKey(String name) {
        if (name == null) return "";
        String s = name.trim()
                .replace('İ', 'i').replace('I', 'i').replace('ı', 'i')
                .replace('Ş', 's').replace('ş', 's').replace('Ğ', 'g').replace('ğ', 'g')
                .replace('Ü', 'u').replace('ü', 'u').replace('Ö', 'o').replace('ö', 'o')
                .replace('Ç', 'c').replace('ç', 'c');
        s = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return s.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]", "");
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
                artist.put("imageUrl", com.concertly.backend.model.ImageUrls.isPlaceholder(img) ? "" : img);
                results.add(artist);
            }
        } catch (Exception e) {
            System.out.println("  ❌ Deezer sanatçı arama hatası: " + e.getMessage());
        }
        return results;
    }

    /** Deezer'ın "benzer sanatçılar" listesi — yalnızca adlar, Deezer'ın benzerlik sırasıyla. */
    @SuppressWarnings("unchecked")
    public List<String> getRelatedArtistNames(long artistId, int limit) {
        List<String> names = new ArrayList<>();
        try {
            String url = "https://api.deezer.com/artist/" + artistId + "/related?limit=" + limit;
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null) return names;

            List<Map<String, Object>> data = (List<Map<String, Object>>) response.get("data");
            if (data == null) return names;

            for (Map<String, Object> item : data) {
                Object name = item.get("name");
                if (name != null && !name.toString().isBlank()) names.add(name.toString().trim());
            }
        } catch (Exception e) {
            System.out.println("  ❌ Deezer benzer sanatçı hatası (artistId=" + artistId + "): " + e.getMessage());
        }
        return names;
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
                Track track = new Track(title.trim(), preview, cover, artist);
                if (item.get("id") instanceof Number n) track.deezerId = n.longValue();
                tracks.add(track);
            }
        } catch (Exception e) {
            System.out.println("  ❌ Deezer playlist hatası (" + playlistId + "): " + e.getMessage());
        }
        return tracks;
    }

    /**
     * Şarkının taze önizleme linki. Deezer linkleri imzalı ve ~15 dk geçerli; uzun süre
     * saklanan bir link 403 verir. Bulunamazsa null.
     */
    @SuppressWarnings("unchecked")
    public String getTrackPreview(long trackId) {
        try {
            Map<String, Object> response = restTemplate.getForObject("https://api.deezer.com/track/" + trackId, Map.class);
            Object preview = response == null ? null : response.get("preview");
            return preview instanceof String s && !s.isBlank() ? s : null;
        } catch (Exception e) {
            System.out.println("  ❌ Deezer şarkı önizleme hatası (" + trackId + "): " + e.getMessage());
            return null;
        }
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
        /** Deezer şarkı kimliği (biliniyorsa); taze önizleme linki almak için. */
        public Long deezerId;

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
