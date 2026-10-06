package com.concertly.backend.service.ingest;

import com.concertly.backend.model.*;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.VenueRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Saat dilimi kayması: Biletinial aynı seansı 21:00 ve ertesi gün 00:00 olarak iki kez verdi
 * (gerçek veri, 6 Eki 2026). Kayık kopya birleştirilir ve bir daha açılmaz.
 */
class TimeShiftDuplicateTest {

    private static long nextId = 1;

    private static Event event(String externalId, String when, EventSource source) {
        Artist a = new Artist();
        ReflectionTestUtils.setField(a, "id", 7L);
        a.setName("Derya Bedavacı");
        Venue v = new Venue();
        ReflectionTestUtils.setField(v, "id", 3L);
        v.setName("Jolly Joker");
        v.setCity("İstanbul");
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", nextId++);
        e.setArtist(a);
        e.setVenue(v);
        e.setName("Derya Bedavacı");
        e.setEventDate(LocalDateTime.parse(when));
        e.setSource(source);
        e.setExternalId(externalId);
        return e;
    }

    @Test
    void shiftedTwinFromTheSamePageIsRecognised() {
        Event right = event("biletinial:derya-bedavaci-jj@2026-11-14T21:00", "2026-11-14T21:00", EventSource.BILETINIAL);
        Event shifted = event("biletinial:derya-bedavaci-jj@2026-11-15T00:00", "2026-11-15T00:00", EventSource.BILETINIAL);
        assertTrue(DuplicateDetector.timeShiftTwin(right, shifted));
    }

    @Test
    void realMatineeAndEveningShowsStaySeparate() {
        // Aynı sayfa, 3 saat ara ama akşam seansı 20:00: gerçek ikinci gösteri
        Event matinee = event("biletinial:cocuk-konseri@2026-11-14T17:00", "2026-11-14T17:00", EventSource.BILETINIAL);
        Event evening = event("biletinial:cocuk-konseri@2026-11-14T20:00", "2026-11-14T20:00", EventSource.BILETINIAL);
        assertFalse(DuplicateDetector.timeShiftTwin(matinee, evening));
        // Farklı sayfa ya da farklı site: dokunulmaz
        Event otherPage = event("biletinial:baska-sayfa@2026-11-15T00:00", "2026-11-15T00:00", EventSource.BILETINIAL);
        Event right = event("biletinial:derya-bedavaci-jj@2026-11-14T21:00", "2026-11-14T21:00", EventSource.BILETINIAL);
        assertFalse(DuplicateDetector.timeShiftTwin(right, otherPage));
        Event bubilet = event("bubilet:derya@seans1", "2026-11-15T00:00", EventSource.BUBILET);
        assertFalse(DuplicateDetector.timeShiftTwin(right, bubilet));
    }

    @Test
    void clusteringMergesTheShiftedCopyIntoTheEarlierRecord() {
        Event right = event("biletinial:synthony@2026-10-10T20:00", "2026-10-10T20:00", EventSource.BILETINIAL);
        Event shifted = event("biletinial:synthony@2026-10-10T23:00", "2026-10-10T23:00", EventSource.BILETINIAL);
        List<DuplicateDetector.EventCluster> clusters = DuplicateDetector.clusterEvents(List.of(shifted, right),
                Function.identity(), Function.identity(), Map.of(), Map.of(), MergeConfidence.HIGH, (a, b) -> a);
        assertEquals(1, clusters.size());
        assertEquals(right.getId(), clusters.get(0).canonical().getId(), "doğru saat erken olan");
        assertEquals(shifted.getId(), clusters.get(0).duplicates().get(0).duplicate().getId());
        assertTrue(clusters.get(0).duplicates().get(0).reason().startsWith("TIME_SHIFT"));
    }

    @Test
    void importerDoesNotOpenAShiftedCopyAgain() {
        EventRepository events = mock(EventRepository.class);
        EventSourceLinkService links = mock(EventSourceLinkService.class);
        when(links.find(any(), any())).thenReturn(Optional.empty());
        when(events.findByExternalId(any())).thenReturn(Optional.empty());
        when(events.findByExternalId("biletinial:derya-bedavaci-jj@2026-11-14T21:00"))
                .thenReturn(Optional.of(new Event()));
        BiletinialRecordWriter writer = new BiletinialRecordWriter(events, mock(ArtistRepository.class),
                mock(VenueRepository.class), links);

        assertTrue(writer.isTimeShiftedCopy(EventSource.BILETINIAL,
                "biletinial:derya-bedavaci-jj@2026-11-15T00:00", LocalDateTime.parse("2026-11-15T00:00")));
        // 3 saat öncesi yoksa gerçek bir gece seansıdır
        assertFalse(writer.isTimeShiftedCopy(EventSource.BILETINIAL,
                "biletinial:baska@2026-11-15T00:00", LocalDateTime.parse("2026-11-15T00:00")));
        // Akşam saati kayma imzası taşımaz
        assertFalse(writer.isTimeShiftedCopy(EventSource.BILETINIAL,
                "biletinial:derya-bedavaci-jj@2026-11-14T21:00", LocalDateTime.parse("2026-11-14T21:00")));
        // Kimliği saat içermeyen kaynak (Bubilet seans no) etkilenmez
        assertFalse(writer.isTimeShiftedCopy(EventSource.BUBILET,
                "bubilet:derya@seans1", LocalDateTime.parse("2026-11-15T00:00")));
        verify(links, never()).find(eq(EventSource.BUBILET), any());
    }

    @Test
    void shiftedCopyWhoseTwinWasAlreadyMergedGoesToTheTwinsRoot() {
        // Gerçek veri: Derya Bedavacı 14.11 21:00 (Biletinial) önceden Biletix kaydına birleştirilmiş;
        // kayık 15.11 00:00 kopyası tek başına listede kalmış
        Event biletix = event("Z1HyzZyMZkfxk7vve", "2026-11-14T21:00", EventSource.TICKETMASTER);
        biletix.setIsApproved(true);
        Event twin = event("biletinial:derya-bedavaci-jj@2026-11-14T21:00", "2026-11-14T21:00", EventSource.BILETINIAL);
        twin.setMergedIntoEventId(biletix.getId());
        Event shifted = event("biletinial:derya-bedavaci-jj@2026-11-15T00:00", "2026-11-15T00:00", EventSource.BILETINIAL);
        shifted.setIsApproved(true);

        List<DuplicateDetector.EventCluster> out = DuplicateDetector.timeShiftOrphans(
                List.of(biletix, twin, shifted), List.of(biletix, shifted), java.util.Set.of(), MergeConfidence.HIGH);
        assertEquals(1, out.size());
        assertEquals(biletix.getId(), out.get(0).canonical().getId());
        assertEquals(shifted.getId(), out.get(0).duplicates().get(0).duplicate().getId());
    }
}
