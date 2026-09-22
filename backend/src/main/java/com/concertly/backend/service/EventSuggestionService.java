package com.concertly.backend.service;

import com.concertly.backend.config.LaunchCityConfig;
import com.concertly.backend.dto.request.SuggestEventRequest;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.model.User;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.repository.VenueRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Kullanıcı ve organizatör etkinlik önerileri.
 *
 * Ticketmaster Türkiye'deki konserlerin tamamını kapsamıyor; bu uç, veriyi
 * besleyen ikinci kanal. Sıradan kullanıcının önerisi onay kuyruğuna düşer,
 * doğrulanmış organizatörün önerisi doğrudan yayına girer.
 *
 * Mükerrer kontrolü ZORUNLU: aynı konser iki kez listelenirse katılım, sohbet
 * ve doğrulama kayıtları ikiye bölünür — bu, veri kalitesinden çok ürün hatası
 * gibi görünür.
 */
@Service
public class EventSuggestionService {

    /** Aynı gün + aynı mekan + bu orandan benzer isim = aynı etkinlik. */
    private static final double NAME_MATCH_THRESHOLD = 0.6;

    private final EventRepository eventRepository;
    private final ArtistRepository artistRepository;
    private final VenueRepository venueRepository;
    private final UserRepository userRepository;
    private final LaunchCityConfig launchCityConfig;

    public EventSuggestionService(EventRepository eventRepository,
            ArtistRepository artistRepository,
            VenueRepository venueRepository,
            UserRepository userRepository,
            LaunchCityConfig launchCityConfig) {
        this.eventRepository = eventRepository;
        this.artistRepository = artistRepository;
        this.venueRepository = venueRepository;
        this.userRepository = userRepository;
        this.launchCityConfig = launchCityConfig;
    }

    @Transactional
    public EventResponse suggest(Long userId, SuggestEventRequest request, boolean trustedOrganizer) {
        validate(request);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));

        Event duplicate = findDuplicate(request);
        if (duplicate != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Bu etkinlik zaten kayıtlı (#" + duplicate.getId() + ").");
        }

        Artist artist = findOrCreateArtist(request);
        Venue venue = findOrCreateVenue(request);

        Event event = new Event();
        event.setName(request.getName().trim());
        event.setDescription(request.getDescription());
        event.setEventDate(request.getEventDate());
        event.setArtist(artist);
        event.setVenue(venue);
        event.setGenre(artist.getGenre());
        event.setTicketUrl(request.getTicketUrl());
        event.setImageUrl(request.getImageUrl() != null ? request.getImageUrl() : artist.getImageUrl());
        event.setSourceUrl(request.getSourceUrl());
        event.setCreatedBy(user);
        // Organizatör hesabı zaten doğrulanmış; sıradan öneri admin onayı bekler.
        event.setSource(trustedOrganizer ? EventSource.ORGANIZER : EventSource.USER);
        event.setIsApproved(trustedOrganizer);
        event.setIsVerified(trustedOrganizer);

        return EventResponse.from(eventRepository.save(event));
    }

    /** Öneriyi onaylayan admin, etkinliği yayına alır ve güven rozetini verir. */
    @Transactional
    public EventResponse approveSuggestion(Long eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Etkinlik bulunamadı: " + eventId));
        event.setIsApproved(true);
        event.setIsVerified(true);
        return EventResponse.from(eventRepository.save(event));
    }

    /** Kullanıcının kendi önerileri — durumunu takip edebilsin. */
    public List<EventResponse> mySuggestions(Long userId) {
        return eventRepository.findByCreatedByIdOrderByIdDesc(userId).stream()
                .map(EventResponse::from)
                .toList();
    }

    // ── Mükerrer tespiti ─────────────────────────────────────────────────────

    /**
     * Aynı gün içindeki etkinlikleri tarar; mekan adı ve etkinlik/sanatçı adı
     * yeterince benzerse mükerrer sayar. Saat farkı (ör. 20:00 / 21:00 girilmiş)
     * mükerreri kaçırmasın diye gün penceresi kullanılır.
     */
    public Event findDuplicate(SuggestEventRequest request) {
        LocalDateTime date = request.getEventDate();
        if (date == null) return null;
        LocalDateTime dayStart = date.toLocalDate().atStartOfDay();
        LocalDateTime dayEnd = dayStart.plusDays(1);

        String name = normalize(request.getName());
        String venueName = normalize(request.getVenueName());
        String city = normalize(request.getVenueCity());

        for (Event existing : eventRepository.findByEventDateBetween(dayStart, dayEnd)) {
            Venue venue = existing.getVenue();
            String existingVenue = venue != null ? normalize(venue.getName()) : "";
            String existingCity = venue != null ? normalize(venue.getCity()) : "";

            boolean sameVenue = !existingVenue.isBlank() && similarity(venueName, existingVenue) >= NAME_MATCH_THRESHOLD;
            boolean sameCity = existingCity.equals(city);
            if (!sameVenue && !sameCity) continue;

            if (similarity(name, normalize(existing.getName())) >= NAME_MATCH_THRESHOLD) return existing;

            String artistName = normalize(request.getArtistName());
            String existingArtist = existing.getArtist() != null ? normalize(existing.getArtist().getName()) : "";
            if (sameVenue && !artistName.isBlank()
                    && similarity(artistName, existingArtist) >= NAME_MATCH_THRESHOLD) {
                return existing;
            }
        }
        return null;
    }

    /** Ortak kelime oranı (Jaccard). Biri diğerini kapsıyorsa tam eşleşme sayılır. */
    static double similarity(String a, String b) {
        if (a == null || b == null || a.isBlank() || b.isBlank()) return 0;
        if (a.equals(b) || a.contains(b) || b.contains(a)) return 1;
        Set<String> tokensA = new HashSet<>(Arrays.asList(a.split(" ")));
        Set<String> tokensB = new HashSet<>(Arrays.asList(b.split(" ")));
        Set<String> intersection = new HashSet<>(tokensA);
        intersection.retainAll(tokensB);
        Set<String> union = new HashSet<>(tokensA);
        union.addAll(tokensB);
        return union.isEmpty() ? 0 : (double) intersection.size() / union.size();
    }

    /** Türkçe karakterleri katlar, noktalama ve fazla boşluğu atar. */
    static String normalize(String value) {
        if (value == null) return "";
        String folded = value
                .replace('İ', 'I').replace('ı', 'i')
                .replace('Ş', 'S').replace('ş', 's')
                .replace('Ğ', 'G').replace('ğ', 'g')
                .replace('Ü', 'U').replace('ü', 'u')
                .replace('Ö', 'O').replace('ö', 'o')
                .replace('Ç', 'C').replace('ç', 'c')
                .toLowerCase(Locale.ROOT);
        return folded.replaceAll("[^a-z0-9 ]", " ").replaceAll("\\s+", " ").trim();
    }

    // ── Yardımcılar ──────────────────────────────────────────────────────────

    private void validate(SuggestEventRequest request) {
        if (request == null || request.getName() == null || request.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Etkinlik adı gerekli.");
        }
        if (request.getEventDate() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Etkinlik tarihi gerekli.");
        }
        if (request.getEventDate().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Geçmiş tarihli etkinlik önerilemez.");
        }
        if (request.getVenueName() == null || request.getVenueName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mekan adı gerekli.");
        }
        if (request.getVenueCity() == null || !launchCityConfig.contains(request.getVenueCity())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Şu an yalnızca şu şehirler destekleniyor: " + String.join(", ", launchCityConfig.getCities()));
        }
    }

    private Artist findOrCreateArtist(SuggestEventRequest request) {
        String name = request.getArtistName() != null && !request.getArtistName().isBlank()
                ? request.getArtistName().trim()
                : request.getName().trim();
        // Once tam eslesme (indeksli), sonra Turkce/noktalama farklarini yakalamak
        // icin yalnizca ilk kelimeyi iceren adaylar taranir — tum tabloyu yuklemeyiz.
        Optional<Artist> exact = artistRepository.findFirstByNameIgnoreCase(name);
        if (exact.isPresent()) return exact.get();

        String normalized = normalize(name);
        String fragment = normalized.isBlank() ? name : normalized.split(" ")[0];
        return artistRepository.search(fragment).stream()
                .filter(a -> normalize(a.getName()).equals(normalized))
                .findFirst()
                .orElseGet(() -> {
                    Artist artist = new Artist();
                    artist.setName(name);
                    artist.setGenre(request.getArtistGenre() != null ? request.getArtistGenre() : "Diger");
                    return artistRepository.save(artist);
                });
    }

    private Venue findOrCreateVenue(SuggestEventRequest request) {
        Optional<Venue> exact = venueRepository.findFirstByNameAndCity(
                request.getVenueName().trim(), request.getVenueCity().trim());
        if (exact.isPresent()) return exact.get();

        String normalized = normalize(request.getVenueName());
        String city = normalize(request.getVenueCity());
        return venueRepository.findAll().stream()
                .filter(v -> normalize(v.getName()).equals(normalized) && normalize(v.getCity()).equals(city))
                .findFirst()
                .orElseGet(() -> {
                    Venue venue = new Venue();
                    venue.setName(request.getVenueName().trim());
                    venue.setCity(request.getVenueCity().trim());
                    venue.setCountry("Turkiye");
                    venue.setAddress(request.getVenueAddress());
                    venue.setLatitude(request.getVenueLatitude());
                    venue.setLongitude(request.getVenueLongitude());
                    return venueRepository.save(venue);
                });
    }
}
