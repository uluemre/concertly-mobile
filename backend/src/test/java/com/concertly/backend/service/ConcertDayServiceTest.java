package com.concertly.backend.service;

import com.concertly.backend.model.Artist;
import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventAttendance;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.EventAttendanceRepository;
import com.concertly.backend.repository.EventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Konser Günü: doğru konseri seçer, yanlış sanatçının şarkılarını çalmaz, dış servis çökse de kart gelir. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ConcertDayServiceTest {

    @Mock private EventAttendanceRepository attendanceRepository;
    @Mock private EventRepository eventRepository;
    @Mock private EventAttendanceService attendanceService;
    @Mock private WeatherService weatherService;
    @Mock private DeezerService deezerService;

    private ConcertDayService service;

    @BeforeEach
    void setUp() {
        service = new ConcertDayService(attendanceRepository, eventRepository, attendanceService,
                weatherService, deezerService);
        when(attendanceService.getFriendsAttending(anyLong(), anyLong())).thenReturn(List.of());
    }

    private Event event(String artistName, LocalDateTime when) {
        Artist artist = new Artist();
        artist.setName(artistName);
        Venue venue = new Venue();
        venue.setName("Harbiye");
        venue.setCity("İstanbul");
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", 42L);
        e.setName(artistName + " Konseri");
        e.setEventDate(when);
        e.setArtist(artist);
        e.setVenue(venue);
        return e;
    }

    private void attending(Event e) {
        EventAttendance ea = new EventAttendance();
        ea.setEvent(e);
        ea.setStatus(AttendanceStatus.GOING);
        when(attendanceRepository.findUpcomingGoing(eq(1L), any(), any())).thenReturn(List.of(ea));
    }

    private static LocalDateTime now() {
        return LocalDateTime.now(ZoneId.of("Europe/Istanbul"));
    }

    @Test
    void noUpcomingConcertReturnsNull() {
        when(attendanceRepository.findUpcomingGoing(eq(1L), any(), any())).thenReturn(List.of());
        assertNull(service.next(1L));
    }

    @Test
    void countsDownToTheNextConcert() {
        attending(event("Hadise", now().plusDays(3)));
        ConcertDayService.ConcertDayResponse r = service.next(1L);
        assertEquals(42L, r.eventId());
        assertEquals("GOING", r.attendanceStatus());
        assertFalse(r.happeningNow());
        long threeDays = 3 * 24 * 3600;
        assertTrue(Math.abs(r.secondsUntilStart() - threeDays) < 60, "geri sayım ~3 gün olmalı");
    }

    @Test
    void startedConcertIsHappeningNow() {
        attending(event("Hadise", now().minusHours(1)));
        ConcertDayService.ConcertDayResponse r = service.next(1L);
        assertTrue(r.happeningNow());
        assertEquals(0, r.secondsUntilStart());
    }

    @Test
    void warmupUsesOnlyExactArtistMatch() {
        when(deezerService.searchArtists(eq("Emir Can İğrek"), anyInt())).thenReturn(List.of(
                Map.of("artistId", 1L, "name", "Emir Can"),
                Map.of("artistId", 2L, "name", "Emir Can Igrek")));
        when(deezerService.getTopTracks(eq(2L), anyInt())).thenReturn(List.of(
                new DeezerService.Track("Nalan", "https://p/1.mp3", "c1")));

        List<ConcertDayService.WarmupTrack> tracks = service.warmupFor("Emir Can İğrek");
        assertEquals(1, tracks.size());
        assertEquals("Nalan", tracks.get(0).title());
        verify(deezerService, never()).getTopTracks(eq(1L), anyInt());
    }

    @Test
    void warmupIsEmptyWhenNoExactMatch() {
        when(deezerService.searchArtists(eq("Kibariye"), anyInt())).thenReturn(List.of(
                Map.of("artistId", 9L, "name", "Güllü")));
        assertTrue(service.warmupFor("Kibariye").isEmpty());
        verify(deezerService, never()).getTopTracks(anyLong(), anyInt());
    }

    @Test
    void failingExternalServicesStillReturnTheCard() {
        attending(event("Hadise", now().plusDays(2)));
        when(weatherService.forecastAt(any(), any(), any())).thenReturn(null);
        when(deezerService.searchArtists(anyString(), anyInt())).thenThrow(new RuntimeException("Deezer down"));
        ConcertDayService.ConcertDayResponse r = service.next(1L);
        assertNotNull(r);
        assertNull(r.weather());
        assertTrue(r.warmup().isEmpty());
    }

    @Test
    void forEventWorksWithoutAttendance() {
        Event e = event("Hadise", now().plusDays(5));
        when(eventRepository.findById(42L)).thenReturn(Optional.of(e));
        when(attendanceRepository.findByUserIdAndEventId(1L, 42L)).thenReturn(Optional.empty());
        ConcertDayService.ConcertDayResponse r = service.forEvent(1L, 42L);
        assertNull(r.attendanceStatus());
        assertEquals("Harbiye", r.venueName());
    }

    @Test
    void normalizeFoldsTurkish() {
        assertEquals(ConcertDayService.normalize("EMİR CAN İĞREK"), ConcertDayService.normalize("Emir Can Igrek"));
        assertEquals("sila", ConcertDayService.normalize("Sıla"));
    }

    @Test
    void weatherSkipsFarFutureAndMissingCoordinates() {
        WeatherService weather = new WeatherService();
        assertNull(weather.forecastAt(null, 29.0, now().plusDays(1)));
        assertNull(weather.forecastAt(41.0, 29.0, now().plusDays(WeatherService.FORECAST_DAYS + 1)));
        assertNull(weather.forecastAt(41.0, 29.0, now().minusDays(2)));
    }
}
