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

    // ✅ ETKİNLİK OLUŞTUR
    public EventResponse createEvent(CreateEventRequest request) {

        Artist artist = artistRepository.findById(request.getArtistId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Artist bulunamadı: " + request.getArtistId()));

        Venue venue = venueRepository.findById(request.getVenueId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Venue bulunamadı: " + request.getVenueId()));

        User createdBy = userRepository.findById(request.getCreatedByUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + request.getCreatedByUserId()));

        Event event = new Event();
        event.setName(request.getName());
        event.setDescription(request.getDescription());
        event.setEventDate(request.getEventDate());
        event.setArtist(artist);
        event.setVenue(venue);
        event.setCreatedBy(createdBy);
        // isApproved varsayılan olarak false — admin onayı gerekir

        return EventResponse.from(eventRepository.save(event));
    }

    // ✅ TÜM ETKİNLİKLERİ LİSTELE
    public List<EventResponse> getAllEvents(String city) {
        List<Event> events = (city == null || city.isBlank())
                ? eventRepository.findAll()
                : eventRepository.findByVenue_CityIgnoreCase(city);

        return events.stream()
                .map(EventResponse::from)
                .toList();
    }

    // ✅ ID İLE ETKİNLİK GETİR
    public EventResponse getEventById(Long id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Etkinlik bulunamadı: " + id));
        return EventResponse.from(event);
    }

    // ✅ ETKİNLİK ONAYLA (admin işlemi — Faz 2'de role kontrolü eklenecek)
    public EventResponse approveEvent(Long id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Etkinlik bulunamadı: " + id));

        if (Boolean.TRUE.equals(event.getIsApproved())) {
            throw new IllegalArgumentException("Etkinlik zaten onaylanmış: " + id);
        }

        event.setIsApproved(true);
        return EventResponse.from(eventRepository.save(event));
    }
}