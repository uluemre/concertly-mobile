package com.concertly.backend.service;

import com.concertly.backend.config.LaunchCityConfig;
import com.concertly.backend.dto.request.SuggestEventRequest;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.Organizer;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.VenueRepository;
import com.concertly.backend.repository.EventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Organizatör yalnız kendi etkinliğini değiştirir; bağlantılar doğrulanır. */
class OrganizerEventServiceTest {

    private final OrganizerService organizers = mock(OrganizerService.class);
    private final EventSuggestionService suggestions = mock(EventSuggestionService.class);
    private final EventCancellationService cancellation = mock(EventCancellationService.class);
    private final EventRepository events = mock(EventRepository.class);
    private final LaunchCityConfig cities = mock(LaunchCityConfig.class);
    private final VenueRepository venues = mock(VenueRepository.class);
    private final OrganizerEventService service = new OrganizerEventService(
            organizers, suggestions, cancellation, events, cities, mock(JdbcTemplate.class), venues,
            mock(AdminContentService.class));

    private Organizer org;
    private Event mine;
    private Event other;

    @BeforeEach
    void setUp() {
        org = new Organizer();
        ReflectionTestUtils.setField(org, "id", 5L);
        when(organizers.requireOrganizer(7L)).thenReturn(org);

        mine = new Event();
        ReflectionTestUtils.setField(mine, "id", 100L);
        mine.setOrganizerId(5L);
        mine.setName("Eski ad");
        mine.setEventDate(LocalDateTime.now().plusDays(10));
        other = new Event();
        ReflectionTestUtils.setField(other, "id", 200L);
        other.setOrganizerId(9L);
        other.setEventDate(LocalDateTime.now().plusDays(10));
        when(events.findById(100L)).thenReturn(Optional.of(mine));
        when(events.findById(200L)).thenReturn(Optional.of(other));

        Venue jj = new Venue();
        ReflectionTestUtils.setField(jj, "id", 40L);
        jj.setName("Jolly Joker Ankara");
        jj.setCity("Ankara");
        Venue van = new Venue();
        ReflectionTestUtils.setField(van, "id", 41L);
        van.setName("Bir Yer");
        van.setCity("Van");
        when(venues.findById(40L)).thenReturn(Optional.of(jj));
        when(venues.findById(41L)).thenReturn(Optional.of(van));
        when(cities.contains("Ankara")).thenReturn(true);
    }

    private static SuggestEventRequest valid() {
        SuggestEventRequest r = new SuggestEventRequest();
        r.setName("Konser");
        r.setTicketUrl("https://bilet.example.com/x");
        r.setVenueId(40L);
        return r;
    }

    private static String reason(Runnable r) {
        return assertThrows(ResponseStatusException.class, r::run).getReason();
    }

    @Test
    void cannotTouchAnotherOrganizersEvent() {
        assertEquals("NOT_YOUR_EVENT", reason(() -> service.update(7L, 200L, new SuggestEventRequest())));
        assertEquals("NOT_YOUR_EVENT", reason(() -> service.cancel(7L, 200L)));
        verifyNoInteractions(cancellation);
    }

    @Test
    void ticketSiteEventWithoutOrganizerIsNotEditable() {
        other.setOrganizerId(null);
        assertEquals("NOT_YOUR_EVENT", reason(() -> service.update(7L, 200L, new SuggestEventRequest())));
    }

    @Test
    void editsOwnEventFields() {
        SuggestEventRequest body = new SuggestEventRequest();
        body.setName("  Yeni ad ");
        body.setTicketUrl("https://bilet.example.com/x");
        body.setImageUrl("/uploads/afis.jpg");
        service.update(7L, 100L, body);
        assertEquals("Yeni ad", mine.getName());
        assertEquals("https://bilet.example.com/x", mine.getTicketUrl());
        assertEquals("/uploads/afis.jpg", mine.getImageUrl());
        verify(events).save(mine);
    }

    @Test
    void pastEventAndPastDateAreRejected() {
        SuggestEventRequest body = new SuggestEventRequest();
        body.setEventDate(LocalDateTime.now().minusDays(1));
        assertEquals("DATE_IN_PAST", reason(() -> service.update(7L, 100L, body)));

        mine.setEventDate(LocalDateTime.now().minusDays(2));
        assertEquals("EVENT_PAST", reason(() -> service.update(7L, 100L, new SuggestEventRequest())));
    }

    @Test
    void venueMustBePickedFromListAndCityOpen() {
        SuggestEventRequest body = new SuggestEventRequest();
        body.setVenueId(41L);
        assertEquals("CITY_NOT_SUPPORTED", reason(() -> service.update(7L, 100L, body)));
        body.setVenueId(999L);
        assertEquals("VENUE_NOT_FOUND", reason(() -> service.update(7L, 100L, body)));

        // Serbest yazılan mekân adı yok sayılır
        SuggestEventRequest typed = new SuggestEventRequest();
        typed.setVenueName("Uydurma Mekân");
        typed.setVenueCity("Ankara");
        service.update(7L, 100L, typed);
        assertNull(mine.getVenue());
        verify(suggestions, never()).findOrCreateVenue(any());
    }

    @Test
    void ticketLinkAndVenueAreRequiredOnCreate() {
        SuggestEventRequest noTicket = valid();
        noTicket.setTicketUrl(" ");
        assertEquals("TICKET_URL_REQUIRED", reason(() -> service.create(7L, noTicket)));
        SuggestEventRequest noVenue = valid();
        noVenue.setVenueId(null);
        assertEquals("VENUE_REQUIRED", reason(() -> service.create(7L, noVenue)));
        verifyNoInteractions(suggestions);
    }

    @Test
    void ticketLinkCannotBeClearedOnEdit() {
        SuggestEventRequest body = new SuggestEventRequest();
        body.setTicketUrl("");
        assertEquals("TICKET_URL_REQUIRED", reason(() -> service.update(7L, 100L, body)));
    }

    @Test
    void linksAreValidated() {
        SuggestEventRequest bad = new SuggestEventRequest();
        bad.setTicketUrl("javascript:alert(1)");
        assertEquals("INVALID_TICKET_URL", reason(() -> OrganizerEventService.normalizeLinks(bad)));
        SuggestEventRequest badImg = new SuggestEventRequest();
        badImg.setImageUrl("http://x/y.jpg");
        assertEquals("INVALID_IMAGE_URL", reason(() -> OrganizerEventService.normalizeLinks(badImg)));
    }

    @Test
    void createBindsEventToOrganizerAndPublishes() {
        Event created = new Event();
        ReflectionTestUtils.setField(created, "id", 300L);
        when(suggestions.create(eq(7L), any(), eq(true), eq(5L))).thenReturn(created);
        SuggestEventRequest req = valid();
        assertEquals(300L, service.create(7L, req).get("id"));
        // Seçilen mekânın adı ve şehri isteğe yazılır (kopya kontrolü bunlarla çalışır)
        assertEquals("Jolly Joker Ankara", req.getVenueName());
        assertEquals("Ankara", req.getVenueCity());
    }

    @Test
    void cancelGoesThroughCancellationService() {
        service.cancel(7L, 100L);
        verify(cancellation).cancel(mine);
    }
}
