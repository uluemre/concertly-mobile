package com.concertly.backend.controller;

import com.concertly.backend.dto.request.CreateEventRequest;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.dto.response.UserResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository userRepository;
    private final EventRepository eventRepository;
    private final ArtistRepository artistRepository;
    private final VenueRepository venueRepository;
    private final RoleRepository roleRepository;
    private final EventAttendanceRepository eventAttendanceRepository;

    public AdminController(UserRepository userRepository,
                           EventRepository eventRepository,
                           ArtistRepository artistRepository,
                           VenueRepository venueRepository,
                           RoleRepository roleRepository,
                           EventAttendanceRepository eventAttendanceRepository) {
        this.userRepository = userRepository;
        this.eventRepository = eventRepository;
        this.artistRepository = artistRepository;
        this.venueRepository = venueRepository;
        this.roleRepository = roleRepository;
        this.eventAttendanceRepository = eventAttendanceRepository;
    }

    @GetMapping("/stats")
    public Map<String, Long> getStats() {
        long pendingEvents = eventRepository.findByIsApproved(false).size();
        return Map.of(
            "totalUsers", userRepository.count(),
            "totalEvents", eventRepository.count(),
            "pendingEvents", pendingEvents,
            "totalAttendance", eventAttendanceRepository.count()
        );
    }

    @GetMapping("/events")
    public List<EventResponse> getEvents(@RequestParam(required = false) Boolean approved) {
        List<Event> events = approved != null
            ? eventRepository.findByIsApproved(approved)
            : eventRepository.findAll();
        events.sort(Comparator.comparing(Event::getEventDate));
        return events.stream().map(EventResponse::from).toList();
    }

    @PostMapping("/events")
    @ResponseStatus(HttpStatus.CREATED)
    public EventResponse createEvent(@RequestBody CreateEventRequest req) {
        Artist artist;
        if (req.getArtistId() != null) {
            artist = artistRepository.findById(req.getArtistId())
                .orElseThrow(() -> new ResourceNotFoundException("Artist bulunamadi: " + req.getArtistId()));
        } else {
            artist = new Artist();
            artist.setName(req.getArtistName() != null ? req.getArtistName() : "Bilinmeyen Sanatci");
            artist.setGenre(req.getArtistGenre() != null ? req.getArtistGenre() : "Diger");
            artist = artistRepository.save(artist);
        }

        Venue venue;
        if (req.getVenueId() != null) {
            venue = venueRepository.findById(req.getVenueId())
                .orElseThrow(() -> new ResourceNotFoundException("Venue bulunamadi: " + req.getVenueId()));
        } else {
            venue = new Venue();
            venue.setName(req.getVenueName() != null ? req.getVenueName() : "Bilinmeyen Mekan");
            venue.setCity(req.getVenueCity() != null ? req.getVenueCity() : "Ankara");
            venue.setCountry(req.getVenueCountry() != null ? req.getVenueCountry() : "Turkiye");
            venue.setAddress(req.getVenueAddress());
            venue.setLatitude(req.getVenueLatitude());
            venue.setLongitude(req.getVenueLongitude());
            venue = venueRepository.save(venue);
        }

        Event event = new Event();
        event.setName(req.getName());
        event.setDescription(req.getDescription());
        event.setEventDate(req.getEventDate());
        event.setArtist(artist);
        event.setVenue(venue);
        event.setGenre(artist.getGenre());
        event.setIsApproved(true);
        return EventResponse.from(eventRepository.save(event));
    }

    @PutMapping("/events/{id}")
    public EventResponse updateEvent(@PathVariable Long id, @RequestBody CreateEventRequest req) {
        Event event = eventRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Etkinlik bulunamadi: " + id));

        if (req.getName() != null) event.setName(req.getName());
        if (req.getDescription() != null) event.setDescription(req.getDescription());
        if (req.getEventDate() != null) event.setEventDate(req.getEventDate());

        if (req.getArtistId() != null) {
            artistRepository.findById(req.getArtistId()).ifPresent(event::setArtist);
        } else if (req.getArtistName() != null) {
            Artist artist = new Artist();
            artist.setName(req.getArtistName());
            artist.setGenre(req.getArtistGenre() != null ? req.getArtistGenre() : "Diger");
            event.setArtist(artistRepository.save(artist));
            event.setGenre(artist.getGenre());
        }

        if (req.getVenueId() != null) {
            venueRepository.findById(req.getVenueId()).ifPresent(event::setVenue);
        } else if (req.getVenueName() != null) {
            Venue venue = event.getVenue() != null ? event.getVenue() : new Venue();
            venue.setName(req.getVenueName());
            if (req.getVenueCity() != null) venue.setCity(req.getVenueCity());
            if (req.getVenueCountry() != null) venue.setCountry(req.getVenueCountry());
            if (req.getVenueAddress() != null) venue.setAddress(req.getVenueAddress());
            if (req.getVenueLatitude() != null) venue.setLatitude(req.getVenueLatitude());
            if (req.getVenueLongitude() != null) venue.setLongitude(req.getVenueLongitude());
            event.setVenue(venueRepository.save(venue));
        }

        return EventResponse.from(eventRepository.save(event));
    }

    @DeleteMapping("/events/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEvent(@PathVariable Long id) {
        if (!eventRepository.existsById(id)) {
            throw new ResourceNotFoundException("Etkinlik bulunamadi: " + id);
        }
        eventRepository.deleteById(id);
    }

    @GetMapping("/users")
    public List<UserResponse> getAdminUsers() {
        return userRepository.findAll().stream()
            .map(u -> {
                UserResponse resp = new UserResponse(u.getId(), u.getUsername(), u.getEmail(), u.getCity());
                resp.setIsActive(u.getIsActive());
                boolean isAdmin = u.getRoles() != null && u.getRoles().stream()
                    .anyMatch(r -> "ROLE_ADMIN".equals(r.getName()));
                resp.setIsAdmin(isAdmin);
                return resp;
            })
            .toList();
    }

    @PatchMapping("/users/{id}/ban")
    public UserResponse banUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + id));
        user.setIsActive(false);
        User saved = userRepository.save(user);
        return buildUserResponse(saved);
    }

    @PatchMapping("/users/{id}/unban")
    public UserResponse unbanUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + id));
        user.setIsActive(true);
        User saved = userRepository.save(user);
        return buildUserResponse(saved);
    }

    @PatchMapping("/users/{id}/make-admin")
    public UserResponse makeAdmin(@PathVariable Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + id));
        Role adminRole = roleRepository.findByName("ROLE_ADMIN")
            .orElseThrow(() -> new ResourceNotFoundException("ROLE_ADMIN rolu bulunamadi"));
        user.getRoles().add(adminRole);
        User saved = userRepository.save(user);
        UserResponse resp = buildUserResponse(saved);
        resp.setIsAdmin(true);
        return resp;
    }

    private UserResponse buildUserResponse(User u) {
        UserResponse resp = new UserResponse(u.getId(), u.getUsername(), u.getEmail(), u.getCity());
        resp.setIsActive(u.getIsActive());
        boolean isAdmin = u.getRoles() != null && u.getRoles().stream()
            .anyMatch(r -> "ROLE_ADMIN".equals(r.getName()));
        resp.setIsAdmin(isAdmin);
        return resp;
    }
}
