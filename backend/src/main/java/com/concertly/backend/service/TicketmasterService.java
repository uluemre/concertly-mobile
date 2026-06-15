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
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class TicketmasterService {

    @Value("${ticketmaster.api.key}")
    private String apiKey;

    private final EventRepository eventRepository;
    private final ArtistRepository artistRepository;
    private final VenueRepository venueRepository;
    private final SpotifyService spotifyService;
    private final DeezerService deezerService;
    private final com.concertly.backend.repository.ArtistFollowRepository artistFollowRepository;
    private final NotificationService notificationService;
    private final RestTemplate restTemplate;

    public TicketmasterService(EventRepository eventRepository,
            ArtistRepository artistRepository,
            VenueRepository venueRepository,
            SpotifyService spotifyService,
            DeezerService deezerService,
            com.concertly.backend.repository.ArtistFollowRepository artistFollowRepository,
            NotificationService notificationService) {
        this.eventRepository = eventRepository;
        this.artistRepository = artistRepository;
        this.venueRepository = venueRepository;
        this.spotifyService = spotifyService;
        this.deezerService = deezerService;
        this.artistFollowRepository = artistFollowRepository;
        this.notificationService = notificationService;
        this.restTemplate = new RestTemplate();
    }

    /** Her sabah 06:00'da yeni etkinlikleri otomatik çeker (cron override edilebilir). */
    @org.springframework.scheduling.annotation.Scheduled(cron = "${ticketmaster.sync.cron:0 0 6 * * *}")
    public void scheduledSync() {
        System.out.println("⏰ Günlük Ticketmaster senkronizasyonu başlıyor...");
        try {
            syncTurkeyEvents();
        } catch (Exception e) {
            System.out.println("⚠️ Zamanlanmış sync hatası: " + e.getMessage());
        }
    }

    public int syncTurkeyEvents() {
        String nowIso = LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'"));

        int total = syncFromApi("https://app.ticketmaster.com/discovery/v2/events.json",
                Map.of("countryCode", "TR", "classificationName", "music",
                       "sort", "date,asc", "size", "200",
                       "startDateTime", nowIso));

        System.out.println("✅ Ticketmaster sync tamamlandı! Toplam: " + total + " yeni etkinlik");
        return total;
    }

    @SuppressWarnings("unchecked")
    private int syncFromApi(String baseUrl, Map<String, Object> baseParams) {
        int count = 0;
        try {
            int page = 0;
            boolean hasMore = true;

            while (hasMore && page < 10) { // max 10 pages = 2000 events
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

                // Description
                String description = (String) e.get("info");
                if (isBlank(description)) description = (String) e.get("pleaseNote");
                if (isBlank(description)) description = (String) e.get("description");
                if (isBlank(description)) {
                    description = name + " etkinligi — " +
                            (artist.getName() != null ? artist.getName() : "") +
                            " performansi. Biletler satista!";
                }

                // Görsel: TM event → Spotify artist → TM attraction → null (sahte görsel yok)
                if (isBlank(eventImageUrl) && !isBlank(artist.getImageUrl())) {
                    eventImageUrl = artist.getImageUrl();
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

                // Turne duyurusu: bu sanatçıyı takip edenlere bildirim
                notifyArtistFollowers(event, artist);

            } catch (Exception ex) {
                String msg = ex.getMessage();
                if (msg != null && (msg.contains("unique") || msg.contains("duplicate") || msg.contains("Unique"))) {
                    // DB unique constraint — zaten var, atla
                } else {
                    System.out.println("  ⚠️  Event parse: " + msg);
                }
            }
        }
        return count;
    }

    /** Yeni etkinlik eklenince sanatçının takipçilerine "turne duyurusu" bildirimi düşer. */
    private void notifyArtistFollowers(Event event, Artist artist) {
        try {
            if (artist == null || artist.getId() == null) return;
            String city = event.getVenue() != null && event.getVenue().getCity() != null
                    ? " (" + event.getVenue().getCity() + ")" : "";
            String message = artist.getName() + " — " + event.getName() + city;
            artistFollowRepository.findAllByArtistId(artist.getId()).forEach(follow ->
                    notificationService.sendSystem(
                            follow.getUser().getId(), "new_event", "event", event.getId(), message));
        } catch (Exception e) {
            System.out.println("  ⚠️ Takipçi bildirimi hatası: " + e.getMessage());
        }
    }

    private String extractBestImage(List<Map<String, Object>> images) {
        if (images == null || images.isEmpty()) return null;

        // Telefon kartları için ~640px ideal: 1024-2048'lik varyantlar
        // 3-4 kat fazla bant genişliği harcıyor, görünür fark yok.
        Map<String, Object> best16x9 = null;
        Map<String, Object> bestAny = null;
        int best16x9Width = Integer.MAX_VALUE;
        int bestAnyWidth = 0;

        for (Map<String, Object> img : images) {
            String url = (String) img.get("url");
            if (isBlank(url)) continue;

            Object w = img.get("width");
            int width = (w instanceof Integer) ? (Integer) w : (w instanceof Number ? ((Number) w).intValue() : 0);
            String ratio = (String) img.get("ratio");
            boolean is16x9 = ratio != null && ratio.contains("16_9");

            // 16:9 + en az 500px olanlardan EN KÜÇÜĞÜNÜ seç (tipik: 640px)
            if (is16x9 && width >= 500 && width < best16x9Width) {
                best16x9Width = width;
                best16x9 = img;
            }
            if (width > bestAnyWidth) {
                bestAnyWidth = width;
                bestAny = img;
            }
        }

        Map<String, Object> chosen = best16x9 != null ? best16x9 : (bestAny != null ? bestAny : images.get(0));
        String url = (String) chosen.get("url");
        return isBlank(url) ? null : url;
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
        if (isBlank(tmGenre)) return null;
        String g = tmGenre.toLowerCase().trim();

        // "Undefined" ve anlamsız değerleri ele
        if (g.equals("undefined") || g.equals("music") || g.equals("other")
                || g.equals("miscellaneous") || g.length() < 3) return null;

        if (g.contains("metal") || g.contains("punk") || g.contains("hard rock")) return "Rock";
        if (g.contains("rock") || g.contains("alternative") || g.contains("grunge")) return "Rock";
        if (g.contains("rap") || g.contains("hip hop") || g.contains("hip-hop") || g.contains("trap")) return "Rap";
        if (g.contains("r&b") || g.contains("soul") || g.contains("funk")) return "R&B";
        if (g.contains("techno") || g.contains("house") || g.contains("edm") || g.contains("trance")
                || g.contains("electronic") || g.contains("dance") || g.contains("dubstep")) return "Elektronik";
        if (g.contains("jazz")) return "Jazz";
        if (g.contains("blues")) return "Jazz";
        if (g.contains("classical") || g.contains("orchestra") || g.contains("opera")) return "Klasik";
        if (g.contains("indie")) return "Indie";
        if (g.contains("folk") || g.contains("acoustic") || g.contains("country")) return "Folk";
        if (g.contains("reggae") || g.contains("ska")) return "Reggae";
        if (g.contains("latin") || g.contains("salsa")) return "Latin";
        if (g.contains("pop")) return "Pop";
        if (g.contains("world") || g.contains("turk") || g.contains("anadolu")) return "Rock";
        return null;
    }

    @SuppressWarnings("unchecked")
    private Artist extractOrCreateArtist(Map<String, Object> emb, String eventExternalId, String eventName) {
        String rawName = eventName;
        String externalId = eventExternalId + "_artist";
        String tmImageUrl = null;
        String tmGenre = null;

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

        // Spotify sync sırasında ÇAĞRILMIYOR — enrichMissingData() yavaş şekilde yapar.
        // Burada Spotify çağrısı rate limit'i mahveder.

        // Find or create artist
        Artist artist = artistRepository.findByExternalId(externalId)
                .orElseGet(() -> artistRepository.findByNameIgnoreCase(artistName)
                        .orElseGet(Artist::new));

        artist.setName(artistName);
        if (artist.getExternalId() == null) artist.setExternalId(externalId);

        // TM verilerini sadece eksikse kullan
        if (isBlank(artist.getImageUrl()) && !isBlank(tmImageUrl)) {
            artist.setImageUrl(tmImageUrl);
        }
        if (isBlank(artist.getGenre()) && !isBlank(tmGenre)) {
            artist.setGenre(tmGenre);
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

    public Map<String, Integer> enrichMissingData() {
        AtomicInteger enrichedImages = new AtomicInteger(0);
        AtomicInteger enrichedGenres = new AtomicInteger(0);

        // Sadece görseli veya türü eksik artist'leri sorgula
        List<Artist> allArtists = artistRepository.findAll();
        List<Artist> needsEnrich = allArtists.stream()
            .filter(a -> !isBlank(a.getName()) && (
                isBlank(a.getImageUrl()) ||
                (a.getImageUrl() != null && a.getImageUrl().contains("s1.ticketm.net")) ||
                isBlank(a.getGenre())
            ))
            .collect(java.util.stream.Collectors.toList());

        System.out.println("🎤 " + needsEnrich.size() + "/" + allArtists.size() + " artist Spotify'dan çekilecek...");

        int idx = 0;
        for (Artist artist : needsEnrich) {
            idx++;
            System.out.print("  [" + idx + "/" + needsEnrich.size() + "] " + artist.getName() + " → ");
            boolean changed = false;

            // Görsel: Deezer (API key yok, rate limit yok)
            boolean needsImage = isBlank(artist.getImageUrl()) || !isSpotifyImage(artist.getImageUrl());
            if (needsImage) {
                DeezerService.DeezerArtistData dd = deezerService.searchArtist(artist.getName());
                if (dd != null && dd.imageUrl != null) {
                    artist.setImageUrl(dd.imageUrl);
                    changed = true;
                    System.out.print("görsel✓ ");
                } else {
                    System.out.print("görsel✗ ");
                }
            } else {
                System.out.print("görsel-mevcut ");
            }

            // Tür: Spotify (rate limit varsa null döner, mevcut genre korunur)
            if (isBlank(artist.getGenre())) {
                SpotifyService.SpotifyArtistData sd = spotifyService.searchArtist(artist.getName());
                if (sd != null && sd.genre != null) {
                    artist.setGenre(sd.genre);
                    changed = true;
                    System.out.print("tür✓");
                } else {
                    System.out.print("tür✗");
                }
                try { Thread.sleep(500); } catch (InterruptedException ignored) {}
            } else {
                System.out.print("tür-mevcut");
            }

            System.out.println();
            if (changed) artistRepository.save(artist);
        }

        // Event'leri artist verisine göre güncelle
        List<Event> events = eventRepository.findAll();
        for (Event event : events) {
            Artist artist = event.getArtist();
            if (artist == null) continue;
            boolean changed = false;

            // TM görselini Spotify artist görseli ile değiştir
            if (!isBlank(artist.getImageUrl()) && isSpotifyImage(artist.getImageUrl())) {
                boolean needsImageUpdate = isBlank(event.getImageUrl()) || !isSpotifyImage(event.getImageUrl());
                if (needsImageUpdate) {
                    event.setImageUrl(artist.getImageUrl());
                    enrichedImages.incrementAndGet();
                    changed = true;
                }
            }

            // Türü güncelle — artist'te Spotify verisi varsa event'i de güncelle
            if (!isBlank(artist.getGenre())) {
                event.setGenre(artist.getGenre());
                enrichedGenres.incrementAndGet();
                changed = true;
            }

            if (changed) eventRepository.save(event);
        }

        System.out.println("✅ Enrichment tamamlandı — görsel: " + enrichedImages + ", tür: " + enrichedGenres);
        return Map.of("enrichedImages", enrichedImages.get(), "enrichedGenres", enrichedGenres.get(),
                      "artists", allArtists.size(), "events", events.size());
    }

    private String cleanArtistName(String rawName) {
        if (rawName == null) return "Bilinmeyen Sanatci";
        return rawName.replaceAll("(?i)\\s*( - | \\(| \\| |Konseri|Live|Tour|Turnesi|Festivali).*", "").trim();
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    // Deezer veya Spotify CDN → kaliteli görsel
    private boolean isSpotifyImage(String url) {
        return url != null && (url.contains("scdn.co") || url.contains("cdns-images.dzcdn.net"));
    }
}
