package com.concertly.backend.service;

import com.concertly.backend.config.LaunchCityConfig;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.model.EventSourceLink;
import com.concertly.backend.repository.ArtistFollowRepository;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.VenueRepository;
import com.concertly.backend.service.ingest.EventSourceLinkService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Regresyon: birleştirilip gizlenen Ticketmaster kopyası gece senkronizasyonunda
 * yeniden onaylanıp listeye geri dönmemeli; merge'de taşınan kaynak satırı asıl
 * kaydın alanlarını ezmemeli.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TicketmasterMergedEventRegressionTest {

    @Mock private EventRepository eventRepository;
    @Mock private ArtistRepository artistRepository;
    @Mock private VenueRepository venueRepository;
    @Mock private SpotifyService spotifyService;
    @Mock private DeezerService deezerService;
    @Mock private ArtistFollowRepository artistFollowRepository;
    @Mock private NotificationService notificationService;
    @Mock private LaunchCityConfig launchCityConfig;
    @Mock private EventSourceLinkService sourceLinks;

    private TicketmasterService service;

    @BeforeEach
    void setUp() {
        service = new TicketmasterService(eventRepository, artistRepository, venueRepository, spotifyService,
                deezerService, artistFollowRepository, notificationService, launchCityConfig, sourceLinks);
        when(artistRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(venueRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(eventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(artistFollowRepository.findAllByArtistId(any())).thenReturn(List.of());
    }

    private static Map<String, Object> tmEvent(String id) {
        return Map.of(
                "id", id,
                "name", "Test Konseri",
                "url", "https://www.biletix.com/" + id,
                "dates", Map.of("start", Map.of("localDate", LocalDate.now().plusDays(10).toString(),
                        "localTime", "21:00:00")),
                "classifications", List.of(Map.of("segment", Map.of("name", "Music"),
                        "genre", Map.of("name", "Rock"))),
                "_embedded", Map.of(
                        "attractions", List.of(Map.of("id", "ATT-1", "name", "Test Grup")),
                        "venues", List.of(Map.of("id", "VEN-1", "name", "Test Sahne",
                                "city", Map.of("name", "Istanbul")))));
    }

    private int sync(Map<String, Object> event) {
        return (Integer) ReflectionTestUtils.invokeMethod(service, "processEvents", List.of(event), "Istanbul");
    }

    private static Event event(long id, String externalId, EventSource source) {
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", id);
        e.setExternalId(externalId);
        e.setSource(source);
        e.setName("Eski ad");
        e.setIsApproved(true);
        return e;
    }

    @Test
    void mergedDuplicateFoundByExternalIdStaysHidden() {
        Event merged = event(20L, "TM-DUP", EventSource.TICKETMASTER);
        merged.setIsApproved(false);
        merged.setMergedIntoEventId(10L);
        when(sourceLinks.find(EventSource.TICKETMASTER, "TM-DUP")).thenReturn(Optional.empty());
        when(eventRepository.findByExternalId("TM-DUP")).thenReturn(Optional.of(merged));

        assertEquals(0, sync(tmEvent("TM-DUP")));

        assertFalse(merged.getIsApproved(), "birleştirilmiş kopya yeniden onaylanmamalı");
        assertEquals("Eski ad", merged.getName(), "gizli kopya güncellenmemeli");
        verify(eventRepository, never()).save(any());
    }

    @Test
    void mergedLinkUpdatesOnlyTheSourceRowNotTheCanonicalFields() {
        // Merge sonrası TM-DUP'un kaynak satırı asıl kayda (#10, Biletinial) taşındı
        Event canonical = event(10L, "BI-1", EventSource.BILETINIAL);
        EventSourceLink link = new EventSourceLink();
        link.setEvent(canonical);
        when(sourceLinks.find(EventSource.TICKETMASTER, "TM-DUP")).thenReturn(Optional.of(link));

        sync(tmEvent("TM-DUP"));

        verify(sourceLinks).upsert(eq(canonical), eq(EventSource.TICKETMASTER), eq("TM-DUP"),
                anyString(), anyString(), eq(false));
        assertEquals("Eski ad", canonical.getName(), "asıl kaydın alanları ezilmemeli");
        assertEquals(EventSource.BILETINIAL, canonical.getSource());
        verify(eventRepository, never()).save(any());
    }

    @Test
    void secondNightSyncOfMergedDuplicateNeverReapproves() {
        Event merged = event(20L, "TM-DUP", EventSource.TICKETMASTER);
        merged.setIsApproved(false);
        merged.setMergedIntoEventId(10L);
        when(sourceLinks.find(EventSource.TICKETMASTER, "TM-DUP")).thenReturn(Optional.empty());
        when(eventRepository.findByExternalId("TM-DUP")).thenReturn(Optional.of(merged));

        sync(tmEvent("TM-DUP"));
        sync(tmEvent("TM-DUP"));

        assertFalse(merged.getIsApproved());
        assertNotNull(merged.getMergedIntoEventId());
    }

    @Test
    void newTicketmasterEventIsLabelledAndLinked() {
        when(sourceLinks.find(EventSource.TICKETMASTER, "TM-NEW")).thenReturn(Optional.empty());
        when(eventRepository.findByExternalId("TM-NEW")).thenReturn(Optional.empty());

        assertEquals(1, sync(tmEvent("TM-NEW")));

        ArgumentCaptor<Event> saved = ArgumentCaptor.forClass(Event.class);
        verify(eventRepository).save(saved.capture());
        assertEquals(EventSource.TICKETMASTER, saved.getValue().getSource(), "eskiden ADMIN kalıyordu");
        assertTrue(saved.getValue().getIsApproved());
        verify(sourceLinks).upsert(eq(saved.getValue()), eq(EventSource.TICKETMASTER), eq("TM-NEW"),
                anyString(), anyString(), eq(true));
    }

    @Test
    void mislabelledAdminEventIsCorrectedAndDelistedStaysHidden() {
        Event legacy = event(30L, "TM-OLD", EventSource.ADMIN);
        legacy.setDelistedReason("NOT_MUSIC");
        legacy.setIsApproved(false);
        when(sourceLinks.find(EventSource.TICKETMASTER, "TM-OLD")).thenReturn(Optional.empty());
        when(eventRepository.findByExternalId("TM-OLD")).thenReturn(Optional.of(legacy));

        sync(tmEvent("TM-OLD"));

        assertEquals(EventSource.TICKETMASTER, legacy.getSource());
        assertFalse(legacy.getIsApproved(), "listeden kaldırılmış kayıt geri açılmamalı");
    }
}
