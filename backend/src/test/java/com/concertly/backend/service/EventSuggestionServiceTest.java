package com.concertly.backend.service;

import com.concertly.backend.config.LaunchCityConfig;
import com.concertly.backend.dto.request.SuggestEventRequest;
import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.repository.VenueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Etkinlik önerisi: mükerrer kayıt ürünün en pahalı veri hatası — aynı konser
 * iki kez listelenirse katılım ve doğrulama kayıtları ikiye bölünür.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EventSuggestionServiceTest {

    @Mock private EventRepository eventRepository;
    @Mock private ArtistRepository artistRepository;
    @Mock private VenueRepository venueRepository;
    @Mock private UserRepository userRepository;

    private EventSuggestionService service;

    @BeforeEach
    void setUp() {
        LaunchCityConfig cities = new LaunchCityConfig("İstanbul,Ankara,İzmir,Antalya");
        service = new EventSuggestionService(eventRepository, artistRepository, venueRepository,
                userRepository, cities);
    }

    private SuggestEventRequest request(String name, String venue, String city, LocalDateTime date) {
        SuggestEventRequest r = new SuggestEventRequest();
        r.setName(name);
        r.setVenueName(venue);
        r.setVenueCity(city);
        r.setEventDate(date);
        return r;
    }

    private Event existing(String name, String venueName, String city, LocalDateTime date) {
        Venue venue = new Venue();
        venue.setName(venueName);
        venue.setCity(city);
        Artist artist = new Artist();
        artist.setName(name);
        Event e = new Event();
        e.setName(name);
        e.setVenue(venue);
        e.setArtist(artist);
        e.setEventDate(date);
        return e;
    }

    @Test
    void detectsSameEventWithDifferentHour() {
        LocalDateTime date = LocalDateTime.now().plusDays(10).withHour(20).withMinute(0);
        when(eventRepository.findByEventDateBetween(any(), any()))
                .thenReturn(List.of(existing("Hadise Konseri", "Volkswagen Arena", "İstanbul",
                        date.withHour(21))));

        assertNotNull(service.findDuplicate(
                request("Hadise Konseri", "Volkswagen Arena", "İstanbul", date)));
    }

    /** Türkçe karakter ve noktalama farkı mükerreri kaçırmamalı. */
    @Test
    void detectsDuplicateAcrossTurkishSpellingDifferences() {
        LocalDateTime date = LocalDateTime.now().plusDays(5).withHour(21);
        when(eventRepository.findByEventDateBetween(any(), any()))
                .thenReturn(List.of(existing("Sıla Konseri", "Zorlu PSM", "İstanbul", date)));

        assertNotNull(service.findDuplicate(
                request("SILA KONSERI!", "Zorlu PSM", "İstanbul", date)));
    }

    @Test
    void differentEventAtSameVenueIsNotDuplicate() {
        LocalDateTime date = LocalDateTime.now().plusDays(7).withHour(20);
        when(eventRepository.findByEventDateBetween(any(), any()))
                .thenReturn(List.of(existing("Duman Konseri", "Zorlu PSM", "İstanbul", date)));

        assertNull(service.findDuplicate(
                request("Mor ve Ötesi", "Zorlu PSM", "İstanbul", date)));
    }

    @Test
    void rejectsPastEvent() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.suggest(1L, request("Konser", "Mekan", "Ankara",
                        LocalDateTime.now().minusDays(1)), false));
        assertTrue(ex.getMessage().contains("Geçmiş"));
    }

    @Test
    void rejectsCityOutsideLaunchScope() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.suggest(1L, request("Konser", "Mekan", "Trabzon",
                        LocalDateTime.now().plusDays(3)), false));
        assertTrue(ex.getMessage().contains("şehir"));
    }

    @Test
    void rejectsMissingVenue() {
        SuggestEventRequest r = request("Konser", null, "Ankara", LocalDateTime.now().plusDays(3));
        assertThrows(ResponseStatusException.class, () -> service.suggest(1L, r, false));
    }

    @Test
    void similarityTreatsContainmentAsMatch() {
        assertEquals(1.0, EventSuggestionService.similarity(
                EventSuggestionService.normalize("Hadise"),
                EventSuggestionService.normalize("Hadise Konseri")));
    }

    @Test
    void normalizeFoldsTurkishCharacters() {
        assertEquals("sila gunes", EventSuggestionService.normalize("Sıla & Güneş"));
    }
}
