package com.concertly.backend.service;

import com.concertly.backend.config.LaunchCityConfig;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.repository.VenueRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

/**
 * Şehir seçilmemişken ("Tüm Türkiye") tür eşleşmesi tüm açılış şehirlerinde aranmalı.
 * Eskiden yalnız ilk şehre (İstanbul) bakılıyordu; Ankara'daki pop konseri öneride öne çıkmıyordu.
 */
class RecommendedEventsCityTest {

    private static final LocalDateTime BASE = LocalDateTime.of(2026, 11, 1, 21, 0);
    private long nextId = 1;

    private Event event(String city, String genre, int dayOffset) {
        Venue venue = new Venue();
        venue.setName(city + " Sahne");
        venue.setCity(city);
        Artist artist = new Artist();
        ReflectionTestUtils.setField(artist, "id", nextId);
        artist.setName("Sanatçı " + nextId);
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", nextId++);
        e.setName(city + " " + genre);
        e.setGenre(genre);
        e.setEventDate(BASE.plusDays(dayOffset));
        e.setIsApproved(true);
        e.setArtist(artist);
        e.setVenue(venue);
        return e;
    }

    private EventService service(List<Event> events) {
        EventRepository repo = mock(EventRepository.class);
        when(repo.findByCitiesNormalized(anyList())).thenReturn(events);
        when(repo.findByCityNormalized(any())).thenAnswer(i -> events.stream()
                .filter(e -> LaunchCityConfig.normalize(e.getVenue().getCity())
                        .equals(LaunchCityConfig.normalize(i.getArgument(0))))
                .toList());
        return new EventService(repo, mock(ArtistRepository.class), mock(VenueRepository.class),
                mock(UserRepository.class), new LaunchCityConfig("İstanbul,Ankara,İzmir"));
    }

    @Test
    void allTurkeyMatchesGenreInEveryLaunchCity() {
        Event istanbulRock = event("İstanbul", "Rock", 1);
        Event ankaraPop = event("Ankara", "Pop", 2);
        Event izmirPop = event("İzmir", "Pop", 3);
        Event istanbulPop = event("İstanbul", "Pop", 4);

        List<String> names = service(List.of(istanbulRock, ankaraPop, izmirPop, istanbulPop))
                .getRecommendedEvents(null, List.of("Pop")).stream().map(EventResponse::getName).toList();

        // Üç şehrin pop konserleri tarih sırasıyla önde, tür tutmayan en sonda
        assertEquals(List.of("Ankara Pop", "İzmir Pop", "İstanbul Pop", "İstanbul Rock"), names);
    }

    @Test
    void selectedCityStillOnlyReturnsThatCity() {
        List<String> names = service(List.of(event("İstanbul", "Pop", 1), event("Ankara", "Rock", 2),
                event("Ankara", "Pop", 3)))
                .getRecommendedEvents("Ankara", List.of("Pop")).stream().map(EventResponse::getName).toList();

        assertEquals(List.of("Ankara Pop", "Ankara Rock"), names);
    }

    @Test
    void delistedEventsAreNotRecommended() {
        Event hidden = event("Ankara", "Pop", 1);
        hidden.setDelistedReason("NOT_MUSIC");
        List<String> names = service(List.of(hidden, event("İzmir", "Pop", 2)))
                .getRecommendedEvents(null, List.of("Pop")).stream().map(EventResponse::getName).toList();

        assertEquals(List.of("İzmir Pop"), names);
    }
}
