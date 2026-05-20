package com.concertly.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;

@Service
public class DeezerService {

    private final RestTemplate restTemplate = new RestTemplate();

    @SuppressWarnings("unchecked")
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
}
