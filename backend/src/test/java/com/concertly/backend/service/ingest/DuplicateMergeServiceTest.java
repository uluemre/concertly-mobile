package com.concertly.backend.service.ingest;

import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.ArtistFollowRepository;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.EventSourceLinkRepository;
import com.concertly.backend.repository.VenueRepository;
import com.concertly.backend.service.ingest.DuplicateMergeReport.ApplyRequest;
import com.concertly.backend.service.ingest.DuplicateMergeReport.DuplicateReport;
import com.concertly.backend.service.ingest.DuplicateMergeReport.GroupReport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * N-08 / N-09: birlestirme servisi — dry-run yazmaz, apply tek seferde uygular,
 * haric tutma ve minConfidence'i dikkate alir, zincir/idempotency.
 */
class DuplicateMergeServiceTest {

    private ArtistRepository artists;
    private VenueRepository venues;
    private EventRepository events;
    private ArtistFollowRepository follows;
    private EventSourceLinkRepository links;
    private MergeStore store;
    private DuplicateMergeService service;

    private final List<Artist> artistRows = new ArrayList<>();
    private final List<Venue> venueRows = new ArrayList<>();
    private final List<Event> eventRows = new ArrayList<>();

    private static final LocalDateTime D = LocalDateTime.now().plusDays(30).withHour(20).withMinute(0).withSecond(0).withNano(0);

    @BeforeEach
    void setUp() {
        artists = mock(ArtistRepository.class);
        venues = mock(VenueRepository.class);
        events = mock(EventRepository.class);
        follows = mock(ArtistFollowRepository.class);
        links = mock(EventSourceLinkRepository.class);
        store = mock(MergeStore.class);

        when(artists.findAll()).thenAnswer(i -> new ArrayList<>(artistRows));
        when(venues.findAll()).thenAnswer(i -> new ArrayList<>(venueRows));
        when(events.findAll()).thenAnswer(i -> new ArrayList<>(eventRows));
        when(artists.findById(anyLong())).thenAnswer(i -> artistRows.stream().filter(a -> a.getId().equals(i.getArgument(0))).findFirst());
        when(venues.findById(anyLong())).thenAnswer(i -> venueRows.stream().filter(v -> v.getId().equals(i.getArgument(0))).findFirst());
        when(events.findById(anyLong())).thenAnswer(i -> eventRows.stream().filter(e -> e.getId().equals(i.getArgument(0))).findFirst());
        when(events.save(any(Event.class))).thenAnswer(i -> i.getArgument(0));
        when(links.findByEventId(anyLong())).thenReturn(List.of());
        when(follows.countByArtistIds(any())).thenReturn(List.of());

        when(store.previewArtist(anyLong(), anyLong())).thenAnswer(i -> counts("events", 2, "follows", 1, "reviews", 0, "conflictsDropped", 1));
        when(store.applyArtist(anyLong(), anyLong())).thenAnswer(i -> counts("events", 2, "follows", 1, "reviews", 0, "conflictsDropped", 1));
        when(store.previewVenue(anyLong(), anyLong())).thenAnswer(i -> counts("events", 3, "reviews", 1, "conflictsDropped", 0));
        when(store.applyVenue(anyLong(), anyLong())).thenAnswer(i -> counts("events", 3, "reviews", 1, "conflictsDropped", 0));
        when(store.previewEventChildren(anyLong(), anyLong())).thenAnswer(i -> counts("attendances", 4, "posts", 2, "conflictsDropped", 1));
        when(store.applyEventChildren(anyLong(), anyLong())).thenAnswer(i -> counts("attendances", 4, "posts", 2, "conflictsDropped", 1));

        service = new DuplicateMergeService(artists, venues, events, follows,
                new EventMergeService(events, links), store);
    }

    private static Map<String, Integer> counts(Object... kv) {
        Map<String, Integer> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], (Integer) kv[i + 1]);
        return m;
    }

    private Artist artist(long id, String name) {
        Artist a = new Artist();
        ReflectionTestUtils.setField(a, "id", id);
        a.setName(name);
        artistRows.add(a);
        return a;
    }

    private Venue venue(long id, String name, String city) {
        Venue v = new Venue();
        ReflectionTestUtils.setField(v, "id", id);
        v.setName(name);
        v.setCity(city);
        venueRows.add(v);
        return v;
    }

    private Event event(long id, Artist a, Venue v, LocalDateTime date, EventSource source) {
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", id);
        e.setName("Konser " + id);
        e.setArtist(a);
        e.setVenue(v);
        e.setEventDate(date);
        e.setSource(source);
        e.setIsApproved(true);
        eventRows.add(e);
        return e;
    }

    private void verifyNothingWritten() {
        verify(artists, never()).save(any());
        verify(artists, never()).saveAll(any());
        verify(venues, never()).save(any());
        verify(venues, never()).saveAll(any());
        verify(events, never()).save(any());
        verify(store, never()).applyArtist(anyLong(), anyLong());
        verify(store, never()).applyVenue(anyLong(), anyLong());
        verify(store, never()).applyEventChildren(anyLong(), anyLong());
        verify(store, never()).flush();
        verify(store, never()).clear();
        verify(links, never()).save(any());
    }

    /** Hadise x3 + mekan çifti + onların etkinlikleri. */
    private void sampleData() {
        Artist h1 = artist(1, "Hadise");
        Artist h2 = artist(2, "HADİSE");
        artist(3, "Sezen Aksu");
        Venue v1 = venue(10, "Antalya Open Air", "Antalya");
        Venue v2 = venue(11, "Antalya Açıkhava Tiyatrosu", "Antalya");
        h1.setSpotifyId("spotify-hadise"); // Spotify kimligi olan asil olur (2 numarali kopyanin etkinligi daha cok olsa bile)
        h2.setImageUrl("/uploads/hadise.jpg");
        h2.setGenre("Pop");
        v1.setLatitude(36.9);
        v1.setLongitude(30.7);
        v2.setAddress("Konyaaltı");
        event(100, h1, v1, D, EventSource.TICKETMASTER);
        event(101, h2, v2, D.plusMinutes(10), EventSource.BILETINIAL);
        event(102, h2, v2, D.plusHours(4), EventSource.BILETINIAL); // aynı gün farklı saat: ayrı gösteri
        for (Event e : eventRows) e.setIsApproved(true);
    }

    // ───────────── dry-run ─────────────

    @Test
    void dryRunReportsEverythingAndWritesNothing() {
        sampleData();

        DuplicateMergeReport r = service.dryRun(null);

        assertTrue(r.dryRun());
        assertEquals("LOW", r.minConfidence());
        assertEquals(1, r.artistGroups().size());
        GroupReport ag = r.artistGroups().get(0);
        assertEquals(1L, ag.canonicalId());
        assertEquals("Hadise", ag.canonicalName());
        DuplicateReport ad = ag.duplicates().get(0);
        assertEquals(2L, ad.id());
        assertEquals("HIGH", ad.confidence());
        assertTrue(ad.reason().startsWith("NAME_KEY"));
        assertEquals(2, ad.counts().get("events"));
        assertEquals(1, ad.counts().get("conflictsDropped"));
        assertEquals(2, ad.counts().get("fieldsFilled")); // imageUrl + genre asil kayitta bos

        assertEquals(1, r.venueGroups().size());
        assertEquals(11L, r.venueGroups().get(0).canonicalId()); // etkinliği çok olan asıl (koordinat tek başına kazandırmaz)
        assertEquals(1, r.venueGroups().get(0).duplicates().get(0).counts().get("fieldsFilled")); // yalnizca koordinat (address asilda var)
        assertTrue(r.venueGroups().get(0).duplicates().get(0).autoApply());
        assertEquals("HIGH", r.venueGroups().get(0).duplicates().get(0).confidence());

        // 100 (TM, 20:00) ile 101 (20:10, HIGH) birleşir; 102 (+4 saat) ayrı gösteri
        assertEquals(1, r.eventGroups().size());
        assertEquals(100L, r.eventGroups().get(0).canonicalId());
        assertEquals(List.of(101L), r.eventGroups().get(0).duplicates().stream().map(DuplicateReport::id).toList());

        assertEquals(1, r.totals().get("artistsMerged"));
        assertEquals(1, r.totals().get("venuesMerged"));
        assertEquals(1, r.totals().get("eventsMerged"));
        assertEquals(2, r.totals().get("conflictsDropped")); // sanatci 1 + mekan 0 + etkinlik 1

        verifyNothingWritten();
        verify(events, never()).findById(anyLong());
        // Birlestirme isaretcileri degismedi
        assertNull(artistRows.get(1).getMergedIntoArtistId());
        assertNull(venueRows.get(1).getMergedIntoVenueId());
        assertNull(eventRows.get(1).getMergedIntoEventId());
        assertTrue(eventRows.get(1).getIsApproved());
    }

    @Test
    void dryRunRejectsInvalidMinConfidence() {
        assertThrows(IllegalArgumentException.class, () -> service.dryRun("ULTRA"));
    }

    // ───────────── apply ─────────────

    @Test
    void applyMergesInOneRunAndSetsPointersWithoutDeleting() {
        sampleData();

        DuplicateMergeReport r = service.apply(new ApplyRequest(null, null, null, null));

        assertFalse(r.dryRun());
        // Sanatçı: işaretçi + boş alanlar kopyalandı, dolu alan ezilmedi
        Artist canonical = artistRows.get(0);
        Artist dup = artistRows.get(1);
        assertEquals(1L, dup.getMergedIntoArtistId());
        assertNull(canonical.getMergedIntoArtistId());
        assertEquals("/uploads/hadise.jpg", canonical.getImageUrl());
        assertEquals("Pop", canonical.getGenre());
        verify(store).applyArtist(2L, 1L);
        verify(artists, never()).delete(any());
        verify(artists, never()).deleteById(any());

        // Mekan
        assertEquals(11L, venueRows.get(0).getMergedIntoVenueId());
        assertNull(venueRows.get(1).getMergedIntoVenueId());
        assertEquals("Konyaaltı", venueRows.get(1).getAddress());
        assertEquals(36.9, venueRows.get(1).getLatitude()); // eksik koordinat mükerrerden dolduruldu
        verify(store).applyVenue(10L, 11L);

        // Etkinlik: EventMergeService işaretçi + is_approved=false, çocuk satırlar taşındı
        Event mergedEvent = eventRows.get(1);
        assertEquals(100L, mergedEvent.getMergedIntoEventId());
        assertFalse(mergedEvent.getIsApproved());
        assertNull(eventRows.get(0).getMergedIntoEventId());
        assertNull(eventRows.get(2).getMergedIntoEventId());
        verify(store).applyEventChildren(101L, 100L);
        verify(events, never()).delete(any());
        verify(events, never()).deleteById(any());

        assertEquals(1, r.totals().get("artistsMerged"));
        assertEquals(1, r.totals().get("eventsMerged"));
        assertEquals(2, r.totals().get("conflictsDropped")); // artist 1 + event 1
        assertEquals(4, r.totals().get("attendances"));
        assertEquals(0, r.eventGroups().get(0).duplicates().get(0).counts().get("sourceLinks"));
    }

    @Test
    void applyRespectsExclusions() {
        sampleData();

        DuplicateMergeReport r = service.apply(new ApplyRequest(List.of(2L), List.of(11L), List.of(101L), "LOW"));

        // Hariç tutulanlara hiç dokunulmaz: ne mükerrer ne asıl olarak
        assertNull(artistRows.get(1).getMergedIntoArtistId());
        assertNull(venueRows.get(1).getMergedIntoVenueId());
        assertNull(eventRows.get(1).getMergedIntoEventId());
        verify(store, never()).applyArtist(anyLong(), anyLong());
        verify(store, never()).applyVenue(anyLong(), anyLong());
        verify(store, never()).applyEventChildren(anyLong(), anyLong());
        assertTrue(r.artistGroups().isEmpty());
        assertTrue(r.venueGroups().isEmpty());
        assertTrue(r.eventGroups().isEmpty());
        assertEquals(0, r.totals().get("artistsMerged"));
    }

    @Test
    void excludingOnlyTheCanonicalSideStillNeverTouchesIt() {
        sampleData();
        artist(4, "hadise"); // üçüncü kopya
        service.apply(new ApplyRequest(List.of(1L), null, null, null));

        // 1 hiç dokunulmadı; kalan 2 ve 4 kendi aralarında gruplandı
        assertNull(artistRows.get(0).getMergedIntoArtistId());
        verify(store, never()).applyArtist(anyLong(), eq(1L));
        verify(store, never()).applyArtist(eq(1L), anyLong());
        verify(store).applyArtist(4L, 2L);
    }

    @Test
    void applyHonorsMinConfidence() {
        Artist w1 = artist(1, "The Weeknd");
        artist(2, "Weeknd");                       // MEDIUM
        artist(3, "Hadise");
        artist(4, "HADISE");                       // HIGH
        venue(10, "Zorlu PSM", "İstanbul");
        venue(11, "Zorlu PSM Turkcell Sahnesi", "İstanbul"); // MEDIUM

        DuplicateMergeReport high = service.apply(new ApplyRequest(null, null, null, "HIGH"));

        assertEquals("HIGH", high.minConfidence());
        assertNull(artistRows.get(1).getMergedIntoArtistId());   // Weeknd dokunulmadı
        assertEquals(3L, artistRows.get(3).getMergedIntoArtistId()); // HADISE birleşti
        assertNull(venueRows.get(1).getMergedIntoVenueId());     // MEDIUM mekan dokunulmadı
        assertNotNull(w1);
    }

    @Test
    void bulkApplyIgnoresMediumAndLowEvenIfMinConfidenceLowIsSent() {
        artist(1, "The Weeknd");
        artist(2, "Weeknd");                                              // MEDIUM
        artist(3, "Hadise");
        artist(4, "HADISE");                                              // HIGH
        venue(10, "Zorlu PSM", "İstanbul");
        venue(11, "Zorlu PSM Turkcell Sahnesi", "İstanbul");              // MEDIUM
        Venue a = venue(12, "Alpha Hall", "Bursa");
        Venue b = venue(13, "Alpha Club", "Bursa");                       // LOW (yakin + ortak kelime)
        a.setLatitude(40.1000); a.setLongitude(29.0);
        b.setLatitude(40.1010); b.setLongitude(29.0);
        venue(14, "AKM Tiyatro Salonu", "İstanbul");
        venue(15, "AKM Opera Salonu", "İstanbul");

        for (String requested : new String[]{"LOW", "MEDIUM", "low", null}) {
            DuplicateMergeReport r = service.apply(new ApplyRequest(null, null, null, requested));
            assertEquals("HIGH", r.minConfidence());
        }

        assertNull(artistRows.get(1).getMergedIntoArtistId());
        assertEquals(3L, artistRows.get(3).getMergedIntoArtistId());
        for (Venue v : venueRows) assertNull(v.getMergedIntoVenueId(), "venue " + v.getId());
        verify(store, never()).applyVenue(anyLong(), anyLong());
        verify(store, times(1)).applyArtist(anyLong(), anyLong());
    }

    @Test
    void dryRunListsMediumAndLowOnlyAsSuggestionsNotAutoApply() {
        artist(1, "The Weeknd");
        artist(2, "Weeknd");
        artist(3, "Hadise");
        artist(4, "HADISE");
        venue(10, "Zorlu PSM", "İstanbul");
        venue(11, "Zorlu PSM Turkcell Sahnesi", "İstanbul");

        DuplicateMergeReport r = service.dryRun("LOW");

        assertEquals(1, r.artistGroups().size());
        assertTrue(r.artistGroups().get(0).duplicates().stream().allMatch(DuplicateReport::autoApply));
        assertTrue(r.venueGroups().isEmpty());
        assertEquals(1, r.artistSuggestions().size());
        assertEquals("MEDIUM", r.artistSuggestions().get(0).duplicates().get(0).confidence());
        assertFalse(r.artistSuggestions().get(0).duplicates().get(0).autoApply());
        assertEquals(1, r.venueSuggestions().size());
        assertFalse(r.venueSuggestions().get(0).duplicates().get(0).autoApply());
        assertEquals(1, r.totals().get("artistsMerged"));   // yalnizca HIGH sayilir
        assertEquals(0, r.totals().get("venuesMerged"));
        assertEquals(1, r.totals().get("venueSuggestionGroups"));
        assertEquals(1, r.totals().get("venueSuggestionDuplicates"));
        assertEquals("HIGH", r.applyConfidence());
        assertEquals("LOW", r.suggestionMinConfidence());
    }

    @Test
    void thirtyMinuteEventPairIsOnlyASuggestion() {
        Artist h = artist(1, "Hadise");
        Venue v = venue(10, "Zorlu PSM", "İstanbul");
        event(100, h, v, D, EventSource.ADMIN);
        event(101, h, v, D.plusMinutes(30), EventSource.ADMIN);

        DuplicateMergeReport dry = service.dryRun("LOW");
        assertTrue(dry.eventGroups().isEmpty());
        assertEquals(1, dry.eventSuggestions().size());

        service.apply(new ApplyRequest(null, null, null, "LOW"));
        assertNull(eventRows.get(1).getMergedIntoEventId());
        verify(store, never()).applyEventChildren(anyLong(), anyLong());
    }

    @Test
    void dryRunUsesTheSameMinConfidenceAsApply() {
        artist(1, "The Weeknd");
        artist(2, "Weeknd");
        assertEquals(1, service.dryRun("LOW").artistSuggestions().size());
        assertEquals(1, service.dryRun("MEDIUM").artistSuggestions().size());
        assertEquals(0, service.dryRun("HIGH").artistSuggestions().size());
        assertEquals(0, service.dryRun("LOW").artistGroups().size()); // MEDIUM asla otomatik grup olmaz
    }

    // ───────────── ad yazimi / bilet urunu / toplamlar ─────────────

    @Test
    void canonicalGetsBestSpelledNameInDryRunAndApply() {
        Artist s1 = artist(1, "Sebnem Ferah");
        s1.setSpotifyId("sp");                       // asil bu (Spotify kimligi)
        artist(2, "Şebnem Ferah");
        artist(3, "sila");
        artist(4, "Sıla");
        artist(5, "Fazil Say");                       // tek basina; grup yok

        DuplicateMergeReport dry = service.dryRun("HIGH");
        assertEquals("Şebnem Ferah", dry.artistGroups().stream().filter(g -> g.canonicalId() == 1L).findFirst().orElseThrow().renameTo());
        assertEquals("Sıla", dry.artistGroups().stream().filter(g -> g.canonicalId() != 1L).findFirst().orElseThrow().renameTo());
        assertEquals("Sebnem Ferah", artistRows.get(0).getName()); // dry-run yazmaz
        verify(artists, never()).save(any());

        DuplicateMergeReport applied = service.apply(new ApplyRequest(null, null, null, null));
        assertEquals("Şebnem Ferah", artistRows.get(0).getName());
        assertEquals(1L, artistRows.get(0).getId());                // asil kimlik degismedi
        assertEquals(1L, artistRows.get(1).getMergedIntoArtistId());
        assertEquals(dry.artistGroups().stream().map(GroupReport::renameTo).toList(),
                applied.artistGroups().stream().map(GroupReport::renameTo).toList());
        assertEquals("Sıla", artistRows.get(2).getName());
    }

    @Test
    void mediumWideKeyMatchNeverRenames() {
        artist(1, "weeknd");
        artist(2, "The Weeknd");                       // MEDIUM: ad anahtari farkli

        DuplicateMergeReport dry = service.dryRun("LOW");
        assertTrue(dry.artistGroups().isEmpty());
        assertTrue(dry.artistSuggestions().stream().allMatch(g -> g.renameTo() == null));
        service.apply(new ApplyRequest(null, null, null, null));
        assertEquals("weeknd", artistRows.get(0).getName());
        assertEquals("The Weeknd", artistRows.get(1).getName());
    }

    @Test
    void manualArtistMergeRenamesOnlyWhenNameKeysMatch() {
        artist(1, "Zeynep Bastik");
        artist(2, "Zeynep Bastık");
        artist(3, "mor ve ötesi");
        artist(4, "Mor ve Ötesi");
        artist(5, "The Mor ve Otesi");

        DuplicateMergeReport r = service.mergeArtistManually(2L, 1L);
        assertEquals("Zeynep Bastık", r.artistGroups().get(0).renameTo());
        assertEquals("Zeynep Bastık", artistRows.get(0).getName());

        service.mergeArtistManually(4L, 3L);
        assertEquals("Mor ve Ötesi", artistRows.get(2).getName());

        DuplicateMergeReport wide = service.mergeArtistManually(5L, 3L); // nameKey farkli: rename yok
        assertNull(wide.artistGroups().get(0).renameTo());
        assertEquals("Mor ve Ötesi", artistRows.get(2).getName());
    }

    @Test
    void ticketProductTitleIsNotHighMergedButIdenticalTitlesStillAre() {
        Artist a = artist(1, "Milyonfest");
        Venue v = venue(10, "Didim Arena", "Aydın");
        Event e1 = event(100, a, v, D, EventSource.ADMIN);
        Event e2 = event(101, a, v, D, EventSource.ADMIN);
        e1.setName("Milyonfest Didim 2026 - Perşembe");
        e2.setName("Milyonfest Didim 2026 - VIP Günlük Bilet - Dilediğin Bir Gün");

        DuplicateMergeReport dry = service.dryRun("MEDIUM");
        assertTrue(dry.eventGroups().isEmpty());
        assertEquals(1, dry.eventSuggestions().size());
        service.apply(new ApplyRequest(null, null, null, null));
        assertNull(eventRows.get(1).getMergedIntoEventId());

        e2.setName("Milyonfest Didim 2026 - Perşembe");
        assertEquals(1, service.dryRun("HIGH").eventGroups().size());
    }

    @Test
    void suggestionTotalsCountGroupsAndDuplicatesSeparately() {
        artist(1, "The Weeknd");
        artist(2, "Weeknd");
        artist(3, "The weeknd!");                     // ayni kovada 2 mukerrer -> 1 grup
        venue(10, "Zorlu PSM", "İstanbul");
        venue(11, "Zorlu PSM Turkcell Sahnesi", "İstanbul");

        DuplicateMergeReport r = service.dryRun("MEDIUM");
        assertEquals(r.artistSuggestions().size(), r.totals().get("artistSuggestionGroups"));
        assertEquals(r.artistSuggestions().stream().mapToInt(g -> g.duplicates().size()).sum(),
                r.totals().get("artistSuggestionDuplicates"));
        assertEquals(1, r.totals().get("venueSuggestionGroups"));
        assertEquals(0, r.totals().get("eventSuggestionGroups"));
        assertEquals("HIGH", r.applyConfidence());
        assertEquals("MEDIUM", r.suggestionMinConfidence());
        assertNull(service.apply(new ApplyRequest(null, null, null, "LOW")).suggestionMinConfidence());
    }

    // ───────────── zincir / idempotency ─────────────

    @Test
    void alreadyMergedRowsAreIgnoredSoSecondRunFindsNothing() {
        sampleData();
        service.apply(new ApplyRequest(null, null, null, null));
        reset(store);

        DuplicateMergeReport second = service.apply(new ApplyRequest(null, null, null, null));

        assertTrue(second.artistGroups().isEmpty());
        assertTrue(second.venueGroups().isEmpty());
        assertTrue(second.eventGroups().isEmpty());
        verifyNoInteractions(store);
    }

    @Test
    void manualMergeIntoAMergedCanonicalFollowsThePointerToTheRoot() {
        Artist root = artist(1, "Hadise");
        Artist middle = artist(2, "Hadise Acikhava");
        artist(3, "Hadise Copy");
        middle.setMergedIntoArtistId(1L);

        DuplicateMergeReport r = service.mergeArtistManually(3L, 2L);

        assertEquals(1L, artistRows.get(2).getMergedIntoArtistId()); // zincir yok: köke
        verify(store).applyArtist(3L, 1L);
        assertEquals(1L, r.artistGroups().get(0).canonicalId());
        assertNotNull(root);
    }

    @Test
    void manualMergeRejectsCyclesSelfAndAlreadyMerged() {
        Artist a = artist(1, "A");
        Artist b = artist(2, "B");
        b.setMergedIntoArtistId(1L);
        assertThrows(IllegalArgumentException.class, () -> service.mergeArtistManually(1L, 1L));
        // 1'i 2'ye birleştirmek: 2'nin kökü 1 -> döngü
        assertThrows(IllegalArgumentException.class, () -> service.mergeArtistManually(1L, 2L));
        // zaten birleştirilmiş kayıt
        artist(3, "C");
        assertThrows(ResponseStatusException.class, () -> service.mergeArtistManually(2L, 3L));
        verify(store, never()).applyArtist(anyLong(), anyLong());
        assertNotNull(a);
    }

    @Test
    void manualVenueMergeRejectsDifferentCities() {
        venue(1, "Zorlu PSM", "İstanbul");
        venue(2, "Zorlu PSM", "Ankara");
        assertThrows(IllegalArgumentException.class, () -> service.mergeVenueManually(2L, 1L));
        verify(store, never()).applyVenue(anyLong(), anyLong());

        venue(3, "Zorlu Performans", "istanbul");
        service.mergeVenueManually(3L, 1L);
        assertEquals(1L, venueRows.get(2).getMergedIntoVenueId());
        verify(store).applyVenue(3L, 1L);
    }

    @Test
    void applyStoresPointersBeforeBulkMoveSoStoreFlushSeesThem() {
        sampleData();
        service.apply(new ApplyRequest(null, null, null, null));
        ArgumentCaptor<Artist> saved = ArgumentCaptor.forClass(Artist.class);
        verify(artists, atLeastOnce()).save(saved.capture());
        assertTrue(saved.getAllValues().stream().anyMatch(a -> a.getId() == 2L && a.getMergedIntoArtistId() != null));
        assertEquals(Optional.of(1L), Optional.ofNullable(artistRows.get(1).getMergedIntoArtistId()));
    }
}
