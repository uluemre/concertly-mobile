package com.concertly.backend.service;

import com.concertly.backend.dto.request.CreateEventRequest;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.User;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.repository.VenueRepository;
import org.springframework.stereotype.Service;

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

        Artist artist = artistRepository.findById(request.getArtistId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Artist bulunamadi: " + request.getArtistId()));

        Venue venue = venueRepository.findById(request.getVenueId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Venue bulunamadi: " + request.getVenueId()));

        User createdBy = userRepository.findById(request.getCreatedByUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanici bulunamadi: " + request.getCreatedByUserId()));

        Event event = new Event();
        event.setName(request.getName());
        event.setDescription(request.getDescription());
        event.setEventDate(request.getEventDate());
        event.setArtist(artist);
        event.setVenue(venue);
        event.setCreatedBy(createdBy);

        return EventResponse.from(eventRepository.save(event));
    }

    public List<EventResponse> getAllEvents(String city) {
        List<Event> events = (city == null || city.isBlank())
                ? eventRepository.findAll()
                : eventRepository.findByVenue_CityIgnoreCase(city);

        return events.stream()
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
        String queryCity = (city == null || city.isBlank()) ? "Istanbul" : city;

        List<Event> matching = eventRepository.findByVenueCityAndGenreIn(queryCity, lowerGenres);
        List<Event> all = (city == null || city.isBlank())
                ? eventRepository.findAll()
                : eventRepository.findByVenue_CityIgnoreCase(city);

        // Matching events first, then remaining ones — so feed never feels empty
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
