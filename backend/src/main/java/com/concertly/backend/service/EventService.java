package com.concertly.backend.service;

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

    public EventService(EventRepository eventRepository,
            ArtistRepository artistRepository,
            VenueRepository venueRepository,
            UserRepository userRepository) {
        this.eventRepository = eventRepository;
        this.artistRepository = artistRepository;
        this.venueRepository = venueRepository;
        this.userRepository = userRepository;
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
        List<Event> events = (city == null || city.isBlank())
                ? eventRepository.findAll()
                : eventRepository.findByCityNormalized(city);

        return events.stream()
                .sorted(Comparator.comparing(Event::getEventDate))
                .map(EventResponse::from)
                .toList();
    }

    public List<EventResponse> getRecommendedEvents(String city, List<String> genres) {
        if (genres == null || genres.isEmpty()) {
            return getAllEvents(city);
        }
        List<String> lowerGenres = genres.stream()
                .map(String::toLowerCase)
                .toList();
        String queryCity = (city == null || city.isBlank()) ? "İstanbul" : city;

        List<Event> matching = eventRepository.findByVenueCityAndGenreIn(queryCity, lowerGenres);
        matching.sort(Comparator.comparing(Event::getEventDate));

        List<Event> all = (city == null || city.isBlank())
                ? eventRepository.findAll()
                : eventRepository.findByCityNormalized(city);
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
        return EventResponse.from(eventRepository.save(event));
    }
}
