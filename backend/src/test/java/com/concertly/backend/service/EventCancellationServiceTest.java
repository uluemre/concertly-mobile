package com.concertly.backend.service;

import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.model.Artist;
import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventAttendance;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.model.User;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.EventAttendanceRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.service.ingest.ConcertGrouping;
import com.concertly.backend.service.ingest.EventMatcher;
import com.concertly.backend.service.ingest.EventMergeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Iptal edilen konser: listelerden duser, katilimcilara bir kez haber verilir, geri alinabilir. */
class EventCancellationServiceTest {

    private EventRepository eventRepository;
    private EventAttendanceRepository attendanceRepository;
    private NotificationService notificationService;
    private EventCancellationService service;

    @BeforeEach
    void setUp() {
        eventRepository = mock(EventRepository.class);
        attendanceRepository = mock(EventAttendanceRepository.class);
        notificationService = mock(NotificationService.class);
        service = new EventCancellationService(eventRepository, attendanceRepository, notificationService);
        when(attendanceRepository.findByEventIdAndStatus(anyLong(), any())).thenReturn(List.of());
    }

    private static Event event(long id, String artist, String venue, LocalDateTime when, EventSource source) {
        Artist a = new Artist();
        a.setName(artist);
        Venue v = new Venue();
        v.setName(venue);
        v.setCity("Istanbul");
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", id);
        e.setName(artist);
        e.setArtist(a);
        e.setVenue(v);
        e.setEventDate(when);
        e.setSource(source);
        e.setIsApproved(true);
        return e;
    }

    private static EventAttendance attendance(long userId, AttendanceStatus status) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", userId);
        EventAttendance a = new EventAttendance();
        a.setUser(u);
        a.setStatus(status);
        return a;
    }

    @Test
    void cancelDelistsAndNotifiesGoingAndInterestedOnce() {
        Event e = event(1, "Hadise", "Harbiye", LocalDateTime.now().plusDays(10), EventSource.TICKETMASTER);
        when(attendanceRepository.findByEventIdAndStatus(1L, AttendanceStatus.GOING))
                .thenReturn(List.of(attendance(10, AttendanceStatus.GOING)));
        when(attendanceRepository.findByEventIdAndStatus(1L, AttendanceStatus.INTERESTED))
                .thenReturn(List.of(attendance(11, AttendanceStatus.INTERESTED), attendance(10, AttendanceStatus.INTERESTED)));

        assertTrue(service.cancel(e));
        assertFalse(service.cancel(e), "ikinci kez iptal edilmez, bildirim tekrar gitmez");

        assertEquals(EventCancellationService.REASON, e.getDelistedReason());
        assertFalse(e.getIsApproved());
        assertTrue(EventResponse.from(e).isCancelled());
        verify(notificationService).sendSystem(10L, "event_cancelled", "event", 1L, "Hadise");
        verify(notificationService).sendSystem(11L, "event_cancelled", "event", 1L, "Hadise");
        verifyNoMoreInteractions(notificationService);
    }

    @Test
    void pastConcertIsCancelledWithoutNotifications() {
        Event e = event(2, "Hadise", "Harbiye", LocalDateTime.now().minusDays(1), EventSource.TICKETMASTER);
        when(attendanceRepository.findByEventIdAndStatus(2L, AttendanceStatus.GOING))
                .thenReturn(List.of(attendance(10, AttendanceStatus.GOING)));

        assertTrue(service.cancel(e));
        verifyNoInteractions(notificationService);
    }

    @Test
    void adminCancelClosesListingCopiesAndUncancelRestoresThem() {
        ConcertGrouping grouping = new ConcertGrouping(new EventMatcher(120, 75), new EventMergeService(null, null));
        ReflectionTestUtils.setField(service, "grouping", grouping);
        LocalDateTime at = LocalDateTime.now().plusDays(20).withHour(21).withMinute(0).withSecond(0).withNano(0);
        Event tm = event(1, "Dan Patlansky", "IF Performance Hall", at, EventSource.TICKETMASTER);
        Event bi = event(2, "Dan Patlansky", "Jolly Joker", at, EventSource.BILETINIAL);
        Event other = event(3, "Mabel Matiz", "Zorlu PSM", at, EventSource.BUBILET);
        Event hidden = event(4, "Dan Patlansky", "Baska", at, EventSource.BUBILET);
        hidden.setDelistedReason("ADMIN_REMOVED");
        hidden.setIsApproved(false);
        when(eventRepository.findById(1L)).thenReturn(Optional.of(tm));
        when(eventRepository.findByEventDateBetween(any(), any())).thenReturn(List.of(tm, bi, other, hidden));

        assertEquals(2, service.cancelById(1L));
        assertTrue(EventCancellationService.isCancelled(bi));
        assertFalse(EventCancellationService.isCancelled(other));
        assertEquals("ADMIN_REMOVED", hidden.getDelistedReason(), "baska sebeple gizlenen kayda dokunulmaz");

        assertEquals(2, service.uncancelById(1L));
        assertNull(tm.getDelistedReason());
        assertTrue(bi.getIsApproved());
        assertEquals("ADMIN_REMOVED", hidden.getDelistedReason());
    }
}
