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

    @SuppressWarnings("unchecked")
    public int syncTurkeyEvents() {
        int total = 0;

        // 1. Turkey music events
        total += syncFromApi("https://app.ticketmaster.com/discovery/v2/events.json",
                Map.of("countryCode", "TR", "classificationName", "music", "size", "50"));

        // 2. Search by major Turkish cities to catch more events
        for (String city : List.of("Istanbul", "Ankara", "Izmir")) {
            total += syncFromApi("https://app.ticketmaster.com/discovery/v2/events.json",
                    Map.of("city", city, "size", "30"));
        }

        // 3. Global popular music events (Turkey market)
        total += syncFromApi("https://app.ticketmaster.com/discovery/v2/events.json",
                Map.of("countryCode", "TR", "classificationName", "music", "sort", "date,asc", "size", "30"));

        System.out.println("✅ Ticketmaster sync tamamlandi! Toplam: " + total + " yeni etkinlik");
        return total;
    }

    @SuppressWarnings("unchecked")
    private int syncFromApi(String baseUrl, Map<String, Object> baseParams) {
        int count = 0;
        try {
            int page = 0;
            boolean hasMore = true;

            while (hasMore && page < 5) { // max 5 pages per query
                UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(baseUrl)
                        .queryParam("apikey", apiKey)
                        .queryParam("page", page);

                for (var entry : baseParams.entrySet()) {
                    builder.queryParam(entry.getKey(), entry.getValue());
                }

                String url = builder.toUriString();
                Map<String, Object> response = restTemplate.getForObject(url, Map.class);
                if (response == null) break;

                Map<String, Object> embedded = (Map<String, Object>) response.get("_embedded");
                if (embedded == null) break;

                List<Map<String, Object>> events = (List<Map<String, Object>>) embedded.get("events");
                if (events == null || events.isEmpty()) break;

                count += processEvents(events);

                Map<String, Object> pageInfo = (Map<String, Object>) response.get("page");
                if (pageInfo != null) {
                    Integer totalPages = (Integer) pageInfo.get("totalPages");
                    hasMore = totalPages != null && page < totalPages - 1;
                    page++;
                } else {
                    hasMore = false;
                }
            }
        } catch (Exception ex) {
            System.out.println("⚠️  Sync hatasi (" + baseParams + "): " + ex.getMessage());
        }
        return count;
    }

    @SuppressWarnings("unchecked")
    private int processEvents(List<Map<String, Object>> events) {
        int count = 0;
        for (Map<String, Object> e : events) {
            try {
                String externalId = (String) e.get("id");
                if (externalId == null || eventRepository.findByExternalId(externalId).isPresent())
                    continue;

                String name = (String) e.get("name");
                if (name == null) continue;

                // Date
                Map<String, Object> dates = (Map<String, Object>) e.get("dates");
                if (dates == null) continue;
                Map<String, Object> start = (Map<String, Object>) dates.get("start");
                if (start == null) continue;
                String dateStr = (String) start.get("localDate");
                if (dateStr == null) continue;
                String timeStr = start.get("localTime") != null ? (String) start.get("localTime") : "20:00:00";
                LocalDateTime eventDate = LocalDateTime.parse(dateStr + "T" + timeStr);

                // Skip past events
                if (eventDate.isBefore(LocalDateTime.now())) continue;

                // Images — try multiple sources
                String eventImageUrl = null;
                List<Map<String, Object>> tmImages = (List<Map<String, Object>>) e.get("images");
                eventImageUrl = extractBestImage(tmImages);

                String ticketUrl = (String) e.get("url");
                String genre = extractGenre(e);

                // Artist
                Map<String, Object> emb = (Map<String, Object>) e.get("_embedded");
                Artist artist = extractOrCreateArtist(emb, externalId, name);

                // Venue
                Venue venue = extractOrCreateVenue(emb);

                // Description with better fallbacks
                String description = (String) e.get("info");
                if (isBlank(description)) description = (String) e.get("pleaseNote");
                if (isBlank(description)) description = (String) e.get("description");
                if (isBlank(description)) {
                    description = name + " etkinligi — " +
                            (artist.getName() != null ? artist.getName() : "") +
                            " performansi. Biletler satista!";
                }

                // If still no image, generate from event name
                if (isBlank(eventImageUrl)) {
                    String encoded = name.replace(" ", "+").replace("&", "and");
                    eventImageUrl = "https://picsum.photos/seed/" + encoded + "/400/200";
                }

                Event event = new Event();
                event.setName(name);
                event.setDescription(description);
                event.setEventDate(eventDate);
                event.setExternalId(externalId);
                event.setIsApproved(true);
                event.setArtist(artist);
                event.setVenue(venue);
                event.setImageUrl(eventImageUrl);
                event.setTicketUrl(ticketUrl);
                event.setGenre(genre != null ? genre : artist.getGenre());

                eventRepository.save(event);
                count++;
                System.out.println("  ✅ " + name + " | " + artist.getName() + " | " + eventDate.toLocalDate());

            } catch (Exception ex) {
                System.out.println("  ⚠️  Event parse: " + ex.getMessage());
            }
        }
        return count;
    }

    private String extractBestImage(List<Map<String, Object>> images) {
        if (images == null || images.isEmpty()) return null;

        Map<String, Object> best = null;
        int bestWidth = 0;
        for (Map<String, Object> img : images) {
            Object w = img.get("width");
            int width = w instanceof Integer ? (Integer) w : 0;
            // Prefer RETINA_PORTRAIT_16_9 or similar ratio
            String ratio = (String) img.get("ratio");
            boolean isGoodRatio = ratio != null &&
                    (ratio.contains("16_9") || ratio.contains("4_3") || ratio.contains("3_2"));

            if (isGoodRatio && width > bestWidth) {
                bestWidth = width;
                best = img;
            } else if (best == null && width > bestWidth) {
                bestWidth = width;
                best = img;
            }
        }
        if (best == null) best = images.get(0);
        return (String) best.get("url");
    }

    @SuppressWarnings("unchecked")
    private String extractGenre(Map<String, Object> event) {
        try {
            List<Map<String, Object>> classifications = (List<Map<String, Object>>) event.get("classifications");
            if (classifications == null || classifications.isEmpty()) return null;

            Map<String, Object> cls = classifications.get(0);

            // Try subGenre first (more specific), then genre, then segment
            String[] keys = {"subGenre", "genre", "segment"};
            for (String key : keys) {
                Map<String, Object> g = (Map<String, Object>) cls.get(key);
                if (g != null) {
                    String name = (String) g.get("name");
                    if (name != null && !name.isBlank()) {
                        return mapTmGenre(name);
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private String mapTmGenre(String tmGenre) {
        if (tmGenre == null) return null;
        String g = tmGenre.toLowerCase();
        if (g.contains("rock") || g.contains("metal")) return "Rock";
        if (g.contains("pop")) return "Pop";
        if (g.contains("rap") || g.contains("hip hop")) return "Rap";
        if (g.contains("electronic") || g.contains("dance") || g.contains("techno")
                || g.contains("house") || g.contains("edm")) return "Elektronik";
        if (g.contains("jazz") || g.contains("blues")) return "Jazz";
        if (g.contains("indie") || g.contains("alternative")) return "Indie";
        if (g.contains("classical")) return "Classical";
        if (g.contains("folk") || g.contains("world")) return "Türkçe Rock";
        return null;
    }

    @SuppressWarnings("unchecked")
    private Artist extractOrCreateArtist(Map<String, Object> emb, String eventExternalId, String eventName) {
        String rawName = eventName;
        String externalId = eventExternalId + "_artist";
        String tmImageUrl = null;
        String tmGenre = null;
        String spotifyImage = null;
        String spotifyGenre = null;
        String spotifyName = null;

        if (emb != null && emb.get("attractions") != null) {
            List<Map<String, Object>> attractions = (List<Map<String, Object>>) emb.get("attractions");
            if (!attractions.isEmpty()) {
                Map<String, Object> attraction = attractions.get(0);
                rawName = (String) attraction.get("name");
                if (attraction.get("id") != null) externalId = (String) attraction.get("id");
                List<Map<String, Object>> attrImages = (List<Map<String, Object>>) attraction.get("images");
                tmImageUrl = extractBestImage(attrImages);
                tmGenre = extractGenre(attraction);
            }
        }

        String artistName = cleanArtistName(rawName);

        // Enrich with Spotify
        if (spotifyService != null) {
            SpotifyService.SpotifyArtistData sd = spotifyService.searchArtist(artistName);
            if (sd != null) {
                if (sd.imageUrl != null) spotifyImage = sd.imageUrl;
                if (sd.genre != null) spotifyGenre = sd.genre;
                if (sd.name != null) spotifyName = sd.name;
            }
        }

        // Find or create artist
        Artist artist = artistRepository.findByExternalId(externalId)
                .orElseGet(() -> artistRepository.findByNameIgnoreCase(artistName)
                        .orElseGet(Artist::new));

        // Prefer Spotify name
        if (spotifyName != null && !spotifyName.equalsIgnoreCase(artistName)) {
            artist.setName(spotifyName);
        } else {
            artist.setName(artistName);
        }

        if (artist.getExternalId() == null) artist.setExternalId(externalId);

        // Image: prefer Spotify > Ticketmaster > none (will use fallback)
        if (artist.getImageUrl() == null) {
            if (spotifyImage != null) artist.setImageUrl(spotifyImage);
            else if (tmImageUrl != null) artist.setImageUrl(tmImageUrl);
        }

        // Genre: prefer Spotify mapping > Ticketmaster > null
        if (artist.getGenre() == null) {
            if (spotifyGenre != null) artist.setGenre(spotifyGenre);
            else if (tmGenre != null) artist.setGenre(tmGenre);
        }

        return artistRepository.save(artist);
    }

    @SuppressWarnings("unchecked")
    private Venue extractOrCreateVenue(Map<String, Object> emb) {
        Venue venue = new Venue();

        if (emb != null && emb.get("venues") != null) {
            List<Map<String, Object>> venues = (List<Map<String, Object>>) emb.get("venues");
            if (!venues.isEmpty()) {
                Map<String, Object> v = venues.get(0);

                String venueExternalId = (String) v.get("id");
                if (venueExternalId != null) {
                    venue = venueRepository.findByExternalId(venueExternalId).orElseGet(Venue::new);
                    venue.setExternalId(venueExternalId);
                }

                venue.setName((String) v.get("name"));

                if (v.get("city") != null) {
                    Map<String, Object> cityMap = (Map<String, Object>) v.get("city");
                    venue.setCity((String) cityMap.get("name"));
                }
                if (v.get("country") != null) {
                    Map<String, Object> country = (Map<String, Object>) v.get("country");
                    venue.setCountry((String) country.get("name"));
                } else {
                    venue.setCountry("Türkiye");
                }
                if (v.get("address") != null) {
                    Map<String, Object> addressMap = (Map<String, Object>) v.get("address");
                    venue.setAddress((String) addressMap.get("line1"));
                }
                if (v.get("location") != null) {
                    Map<String, Object> loc = (Map<String, Object>) v.get("location");
                    try {
                        venue.setLatitude(Double.parseDouble((String) loc.get("latitude")));
                        venue.setLongitude(Double.parseDouble((String) loc.get("longitude")));
                    } catch (Exception ignored) {}
                }

                List<Map<String, Object>> venueImages = (List<Map<String, Object>>) v.get("images");
                String venueImageUrl = extractBestImage(venueImages);
                if (venueImageUrl != null && venue.getImageUrl() == null) {
                    venue.setImageUrl(venueImageUrl);
                }

                return venueRepository.save(venue);
            }
        }

        venue.setName("Bilinmiyor");
        venue.setCity("TR");
        venue.setCountry("Türkiye");
        return venueRepository.save(venue);
    }

    private String cleanArtistName(String rawName) {
        if (rawName == null) return "Bilinmeyen Sanatci";
        return rawName.replaceAll("(?i)\\s*( - | \\(| \\| |Konseri|Live|Tour|Turnesi|Festivali).*", "").trim();
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
