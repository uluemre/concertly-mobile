package com.concertly.backend.service;

import com.concertly.backend.config.LaunchCityConfig;
import com.concertly.backend.dto.request.CreateEventRequest;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.repository.VenueRepository;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

@Service
public class EventService {

    private final EventRepository eventRepository;
    private final ArtistRepository artistRepository;
    private final VenueRepository venueRepository;
    private final UserRepository userRepository;
    private final LaunchCityConfig launchCityConfig;

    public EventService(EventRepository eventRepository,
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

    public EventResponse createEvent(CreateEventRequest request) {

        Artist artist;
        if (request.getArtistId() != null) {
            artist = artistRepository.findById(request.getArtistId())
                    .orElseThrow(() -> new ResourceNotFoundException("Artist bulunamadi: " + request.getArtistId()));
        } else {
            artist = new Artist();
            artist.setName(request.getArtistName() != null ? request.getArtistName() : "Bilinmeyen Sanatçı");
            artist.setGenre(request.getArtistGenre() != null ? request.getArtistGenre() : "Diger");
            artist = artistRepository.save(artist);
        }

        Venue venue;
        if (request.getVenueId() != null) {
            venue = venueRepository.findById(request.getVenueId())
                    .orElseThrow(() -> new ResourceNotFoundException("Venue bulunamadi: " + request.getVenueId()));
        } else {
            venue = new Venue();
            venue.setName(request.getVenueName() != null ? request.getVenueName() : "Bilinmeyen Mekan");
            venue.setCity(request.getVenueCity() != null ? request.getVenueCity() : "Ankara");
            venue.setCountry(request.getVenueCountry() != null ? request.getVenueCountry() : "Turkiye");
            venue.setAddress(request.getVenueAddress());
            venue.setLatitude(request.getVenueLatitude());
            venue.setLongitude(request.getVenueLongitude());
            venue = venueRepository.save(venue);
        }

        Event event = new Event();
        event.setName(request.getName());
        event.setDescription(request.getDescription());
        event.setEventDate(request.getEventDate());
        event.setArtist(artist);
        event.setVenue(venue);
        event.setIsApproved(true);
        event.setGenre(artist.getGenre());

        if (request.getCreatedByUserId() != null) {
            userRepository.findById(request.getCreatedByUserId()).ifPresent(event::setCreatedBy);
        }

        return EventResponse.from(eventRepository.save(event));
    }

    public List<EventResponse> getAllEvents(String city) {
        if (city != null && !city.isBlank() && !launchCityConfig.contains(city)) {
            return List.of();
        }
        List<Event> events = (city == null || city.isBlank())
                ? eventRepository.findByCitiesNormalized(launchCityConfig.getCities().stream()
                        .map(LaunchCityConfig::normalize).toList())
                : eventRepository.findByCityNormalized(city);

        return events.stream()
                .filter(Event::listedPublicly)
                .sorted(Comparator.comparing(Event::getEventDate))
                .map(EventResponse::from)
                .toList();
    }

    /**
     * Tür seçim ekranındaki adlar (Electronic, Classical, Techno, Metal…) etkinlik
     * kayıtlarındaki türlerle (elektronik, klasik, rock…) birebir aynı değil;
     * eşleşme olmayınca öneriler hiç gelmiyordu. Seçilen türe karşılık gelen
     * etkinlik türlerini de sorguya ekler.
     */
    static final java.util.Map<String, List<String>> GENRE_ALIASES = java.util.Map.ofEntries(
            java.util.Map.entry("electronic", List.of("elektronik")),
            java.util.Map.entry("techno", List.of("elektronik")),
            java.util.Map.entry("lo-fi", List.of("elektronik")),
            java.util.Map.entry("classical", List.of("klasik")),
            java.util.Map.entry("metal", List.of("rock")),
            java.util.Map.entry("indie", List.of("rock", "alternatif rock")),
            java.util.Map.entry("alternatif rock", List.of("rock")),
            java.util.Map.entry("türkçe rock", List.of("rock")),
            java.util.Map.entry("k-pop", List.of("pop")),
            java.util.Map.entry("arabesk", List.of("folk")));

    public static List<String> expandGenres(List<String> genres) {
        java.util.LinkedHashSet<String> out = new java.util.LinkedHashSet<>();
        for (String g : genres) {
            if (g == null || g.isBlank()) continue;
            String key = g.trim().toLowerCase(java.util.Locale.ROOT);   // tr kuralı "Indie"yi "ındie" yapardı
            out.add(key);
            out.addAll(GENRE_ALIASES.getOrDefault(key, List.of()));
        }
        return List.copyOf(out);
    }

    public List<EventResponse> getRecommendedEvents(String city, List<String> genres) {
        if (city != null && !city.isBlank() && !launchCityConfig.contains(city)) {
            return List.of();
        }
        if (genres == null || genres.isEmpty()) {
            return getAllEvents(city);
        }
        List<String> lowerGenres = expandGenres(genres);
        String queryCity = (city == null || city.isBlank()) ? launchCityConfig.firstCity() : city;

        List<Event> matching = new java.util.ArrayList<>(eventRepository.findByVenueCityAndGenreIn(queryCity, lowerGenres));
        matching.removeIf(e -> !e.listedPublicly());
        matching.sort(Comparator.comparing(Event::getEventDate));

        List<Event> all = (city == null || city.isBlank())
                ? eventRepository.findByCitiesNormalized(launchCityConfig.getCities().stream()
                        .map(LaunchCityConfig::normalize).toList())
                : eventRepository.findByCityNormalized(city);
        all = new java.util.ArrayList<>(all);
        all.removeIf(e -> !e.listedPublicly());
        all.sort(Comparator.comparing(Event::getEventDate));

        // Matching events first, then remaining ones
        java.util.Set<Long> matchingIds = matching.stream().map(Event::getId).collect(java.util.stream.Collectors.toSet());
        java.util.List<Event> sorted = new java.util.ArrayList<>(matching);
        for (Event e : all) {
            if (!matchingIds.contains(e.getId())) {
                sorted.add(e);
            }
        }

        return sorted.stream()
                .map(EventResponse::from)
                .toList();
    }

    public EventResponse getEventById(Long id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Etkinlik bulunamadi: " + id));
        return EventResponse.from(event);
    }

    public EventResponse approveEvent(Long id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Etkinlik bulunamadi: " + id));

        if (Boolean.TRUE.equals(event.getIsApproved())) {
            throw new IllegalArgumentException("Etkinlik zaten onaylanmis: " + id);
        }

        event.setIsApproved(true);
        event.setDelistedReason(null);   // admin geri açtıysa listelere döner
        // Admin incelemesinden geçen etkinlik artık doğrulanmış sayılır —
        // kullanıcı önerisiyle gelen kayıtlar da listede rozet kazanır.
        event.setIsVerified(true);
        return EventResponse.from(eventRepository.save(event));
    }
}
