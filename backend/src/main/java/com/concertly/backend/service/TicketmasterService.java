package com.concertly.backend.service;

import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class TicketmasterService {

    @Value("${ticketmaster.api.key}")
    private String apiKey;

    private final EventRepository eventRepository;
    private final ArtistRepository artistRepository;
    private final VenueRepository venueRepository;
    private final SpotifyService spotifyService;
    private final RestTemplate restTemplate;

    public TicketmasterService(EventRepository eventRepository,
            ArtistRepository artistRepository,
            VenueRepository venueRepository,
            SpotifyService spotifyService) {
        this.eventRepository = eventRepository;
        this.artistRepository = artistRepository;
        this.venueRepository = venueRepository;
        this.spotifyService = spotifyService;
        this.restTemplate = new RestTemplate();
    }

    public int syncTurkeyEvents() {
        try {
            int totalCount = 0;
            int page = 0;
            boolean hasMore = true;

            while (hasMore) {
                String url = UriComponentsBuilder
                        .fromHttpUrl("https://app.ticketmaster.com/discovery/v2/events.json")
                        .queryParam("apikey", apiKey)
                        .queryParam("countryCode", "TR")
                        .queryParam("classificationName", "music")
                        .queryParam("size", 50)
                        .queryParam("page", page)
                        .toUriString();

                Map response = restTemplate.getForObject(url, Map.class);
                if (response == null)
                    break;

                Map embedded = (Map) response.get("_embedded");
                if (embedded == null)
                    break;

                List<Map> events = (List<Map>) embedded.get("events");
                if (events == null || events.isEmpty())
                    break;

                totalCount += processEvents(events);

                // Check if there are more pages
                Map page_info = (Map) response.get("page");
                if (page_info != null) {
                    Integer totalPages = (Integer) page_info.get("totalPages");
                    hasMore = totalPages != null && page < totalPages - 1;
                    page++;
                } else {
                    hasMore = false;
                }
            }
            System.out.println("✅ Ticketmaster senkronizasyonu tamamlandı! Toplam: " + totalCount);
            return totalCount;
        } catch (Exception ex) {
            System.out.println("❌ Ticketmaster sync hatası: " + ex.getMessage());
            System.out.println("API Key: " + apiKey);
            ex.printStackTrace();
            return 0;
        }
    }

    private int processEvents(List<Map> events) {
        int count = 0;
        for (Map e : events) {
            try {
                String externalId = (String) e.get("id");
                if (eventRepository.findByExternalId(externalId).isPresent())
                    continue;

                // ── ETKİNLİK ADI ─────────────────────────────────────────
                String name = (String) e.get("name");

                // ── TARİH ────────────────────────────────────────────────
                Map dates = (Map) e.get("dates");
                Map start = (Map) dates.get("start");
                String dateStr = (String) start.get("localDate");
                String timeStr = start.get("localTime") != null
                        ? (String) start.get("localTime")
                        : "20:00:00";
                LocalDateTime eventDate = LocalDateTime.parse(dateStr + "T" + timeStr);

                // ── ETKİNLİK FOTOĞRAFI ───────────────────────────────────
                String eventImageUrl = extractBestImage((List<Map>) e.get("images"));

                // ── ETKİNLİK LİNKİ ──────────────────────────────────────
                String ticketUrl = (String) e.get("url");

                // ── KATEGORİ / GENRE ─────────────────────────────────────
                String genre = extractGenre(e);

                // ── SANATÇI ──────────────────────────────────────────────
                Map emb = (Map) e.get("_embedded");
                Artist artist = extractOrCreateArtist(emb, externalId, name);

                // ── MEKAN ────────────────────────────────────────────────
                Venue venue = extractOrCreateVenue(emb);

                // ── ETKİNLİĞİ KAYDET ─────────────────────────────────────
                Event event = new Event();
                event.setName(name);
                event.setDescription("Ticketmaster'dan alınan etkinlik");
                event.setEventDate(eventDate);
                event.setExternalId(externalId);
                event.setIsApproved(true);
                event.setArtist(artist);
                event.setVenue(venue);
                event.setImageUrl(eventImageUrl);
                event.setTicketUrl(ticketUrl);
                event.setGenre(genre);

                eventRepository.save(event);
                count++;

            } catch (Exception ex) {
                System.out.println("Event parse hatası: " + ex.getMessage());
            }
        }
        return count;
    }

    // ── EN İYİ FOTOĞRAFI SEÇ ─────────────────────────────────────────────
    private String extractBestImage(List<Map> images) {
        if (images == null || images.isEmpty())
            return "https://via.placeholder.com/400x200/7C3AED/FFFFFF?text=Concertly"; // Fallback image

        // "RETINA_PORTRAIT_16_9" veya en geniş olanı seç
        Map best = null;
        int bestWidth = 0;
        for (Map img : images) {
            Object w = img.get("width");
            int width = w instanceof Integer ? (Integer) w : 0;
            if (width > bestWidth) {
                bestWidth = width;
                best = img;
            }
        }
        String url = null;
        if (best != null) {
            url = (String) best.get("url");
        }
        if (url == null && !images.isEmpty()) {
            url = (String) images.get(0).get("url");
        }
        return url != null ? url : "https://via.placeholder.com/400x200/7C3AED/FFFFFF?text=Concertly";
    }

    // ── KATEGORİ ÇIKAR ───────────────────────────────────────────────────
    private String extractGenre(Map event) {
        try {
            List<Map> classifications = (List<Map>) event.get("classifications");
            if (classifications == null || classifications.isEmpty())
                return null;

            Map cls = classifications.get(0);
            Map genre = (Map) cls.get("genre");
            if (genre != null)
                return (String) genre.get("name");

            Map subGenre = (Map) cls.get("subGenre");
            if (subGenre != null)
                return (String) subGenre.get("name");
        } catch (Exception e) {
            // sessizce geç
        }
        return null;
    }

    // ── SANATÇI OLUŞTUR / BUL ────────────────────────────────────────────
    private Artist extractOrCreateArtist(Map emb, String eventExternalId, String eventName) {
        String artistName = eventName; // fallback
        String artistExternalId = eventExternalId + "_artist"; // fallback
        String artistImageUrl = null;
        String artistGenre = null;

        if (emb != null && emb.get("attractions") != null) {
            List<Map> attractions = (List<Map>) emb.get("attractions");
            Map attraction = attractions.get(0);

            artistName = (String) attraction.get("name");
            if (attraction.get("id") != null) {
                artistExternalId = (String) attraction.get("id");
            }

            String tmImageUrl = extractBestImage((List<Map>) attraction.get("images"));
            if (tmImageUrl != null)
                artistImageUrl = tmImageUrl;

            String tmGenre = extractGenre(attraction);
            if (tmGenre != null)
                artistGenre = tmGenre;
        }

        Artist artist = artistRepository.findByExternalId(artistExternalId)
                .orElseGet(Artist::new);

        artist.setName(artistName);
        artist.setExternalId(artistExternalId);

        if (artist.getImageUrl() == null && artistImageUrl != null) {
            artist.setImageUrl(artistImageUrl);
        }
        if (artist.getGenre() == null && artistGenre != null) {
            artist.setGenre(artistGenre);
        }

        // Spotify'dan zenginleştir (fotoğraf veya genre yoksa)
        if (artist.getImageUrl() == null || artist.getGenre() == null) {
            SpotifyService.SpotifyArtistData spotifyData = spotifyService.searchArtist(artistName);

            if (spotifyData != null) {
                if (artist.getImageUrl() == null && spotifyData.imageUrl != null) {
                    artist.setImageUrl(spotifyData.imageUrl);
                }
                if (artist.getGenre() == null && spotifyData.genre != null) {
                    artist.setGenre(spotifyData.genre);
                }
                if (spotifyData.spotifyId != null) {
                    artist.setSpotifyId(spotifyData.spotifyId);
                }
            }
        }

        return artistRepository.save(artist);
    }

    // ── MEKAN OLUŞTUR ─────────────────────────────────────────────────────
    private Venue extractOrCreateVenue(Map emb) {
        Venue venue = new Venue();

        if (emb != null && emb.get("venues") != null) {
            List<Map> venues = (List<Map>) emb.get("venues");
            Map v = venues.get(0);

            String venueExternalId = (String) v.get("id");
            if (venueExternalId != null) {
                venue = venueRepository.findByExternalId(venueExternalId).orElseGet(Venue::new);
                venue.setExternalId(venueExternalId);
            }

            venue.setName((String) v.get("name"));

            if (v.get("city") != null) {
                venue.setCity((String) ((Map) v.get("city")).get("name"));
            }

            if (v.get("country") != null) {
                Map country = (Map) v.get("country");
                venue.setCountry((String) country.get("name"));
            } else {
                venue.setCountry("Türkiye");
            }

            if (v.get("address") != null) {
                venue.setAddress((String) ((Map) v.get("address")).get("line1"));
            }

            if (v.get("location") != null) {
                Map loc = (Map) v.get("location");
                try {
                    venue.setLatitude(Double.parseDouble((String) loc.get("latitude")));
                    venue.setLongitude(Double.parseDouble((String) loc.get("longitude")));
                } catch (Exception ignored) {
                }
            }

            String venueImageUrl = extractBestImage((List<Map>) v.get("images"));
            if (venueImageUrl != null && venue.getImageUrl() == null) {
                venue.setImageUrl(venueImageUrl);
            }

        } else {
            venue.setName("Bilinmiyor");
            venue.setCity("TR");
            venue.setCountry("Türkiye");
        }

        return venueRepository.save(venue);
    }
}