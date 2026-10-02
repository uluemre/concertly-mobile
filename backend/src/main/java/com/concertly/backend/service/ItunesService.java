package com.concertly.backend.service;

import com.concertly.backend.config.ExternalHttp;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * iTunes Search API — Deezer yeterli önizleme bulamadığında yedek şarkı kaynağı.
 *
 * Anahtar istemez; dakikada ~20 istek sınırı olduğu için yalnızca Deezer
 * eksik kaldığında çağrılır. Yanıt {@code text/javascript} döndüğünden
 * Map'e otomatik çevrilmez, String alınıp elle ayrıştırılır.
 *
 * Sanatçı adı birebir (Türkçe harfler düzleştirilerek) eşleşmeyen parçalar
 * atılır: başka bir sanatçının şarkısını çalmaktansa boş dönmek daha iyi.
 */
@Service
public class ItunesService {

    private static final String SEARCH_URL = "https://itunes.apple.com/search";
    private static final int FETCH_LIMIT = 50;

    private final RestTemplate restTemplate = ExternalHttp.restTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Sanatçının önizlemesi olan şarkıları — başlığa göre tekilleştirilmiş. */
    public List<DeezerService.Track> getTopTracks(String artistName, int limit) {
        if (artistName == null || artistName.isBlank()) return List.of();
        try {
            // URI nesnesi: RestTemplate'in Türkçe karakterleri ikinci kez kodlamasını önler
            URI uri = UriComponentsBuilder.fromUriString(SEARCH_URL)
                    .queryParam("term", artistName)
                    .queryParam("entity", "song")
                    .queryParam("attribute", "artistTerm")
                    .queryParam("country", "TR")
                    .queryParam("limit", FETCH_LIMIT)
                    .build()
                    .encode()
                    .toUri();
            String body = restTemplate.getForObject(uri, String.class);
            return parseTracks(body, artistName, limit);
        } catch (Exception e) {
            System.out.println("  ❌ iTunes şarkı hatası (" + artistName + "): " + e.getMessage());
            return List.of();
        }
    }

    List<DeezerService.Track> parseTracks(String body, String artistName, int limit) throws Exception {
        List<DeezerService.Track> tracks = new ArrayList<>();
        if (body == null || body.isBlank()) return tracks;

        JsonNode results = objectMapper.readTree(body).path("results");
        String wanted = ConcertDayService.normalize(artistName);
        Set<String> seenTitles = new HashSet<>();
        for (JsonNode item : results) {
            if (!wanted.equals(ConcertDayService.normalize(item.path("artistName").asText("")))) continue;

            String preview = item.path("previewUrl").asText("");
            String title = item.path("trackName").asText("").trim();
            if (preview.isBlank() || title.isEmpty()) continue;
            if (!seenTitles.add(title.toLowerCase())) continue;

            // 100x100 küçük; Deezer'ın cover_medium'una (250px) yakın boyuta çek
            String cover = item.path("artworkUrl100").asText("").replace("100x100bb", "250x250bb");
            tracks.add(new DeezerService.Track(title, preview, cover, item.path("artistName").asText("")));
            if (tracks.size() >= limit) break;
        }
        return tracks;
    }
}
