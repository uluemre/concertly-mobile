package com.concertly.backend.service.ingest;

import com.concertly.backend.config.LaunchCityConfig;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.repository.*;
import com.concertly.backend.service.DeezerService;
import com.concertly.backend.service.NotificationService;
import com.concertly.backend.service.SpotifyService;
import com.concertly.backend.service.TicketmasterService;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** N-16: konser olmayan etkinlikler adından tanınır; yalnızca YENİ içe aktarılan kayıt listelenmez. */
class NonMusicFilterTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "Haydaaa! Mehmet Mayda Stand Up Gecesi",
            "Cem Yılmaz Stand-Up",
            "Standup Gecesi",
            "Gırgıriye Müzikali",
            "Afara - Bir Arabesk Müzikal",
            "Şehir Tiyatroları: Hamlet",
            "Komedi Dükkanı",
            "Sihirbaz Gösterisi",
            "İllüzyon Şov",
            "Yazar Söyleşisi",
            "Seramik Atölyesi",
            "Fotoğraf Sergisi",
            "Eğlenceli Cinayetler Kumpanyası - Metres Gazino Gecesi",
            "Ortadaki Oyun",
            "ORTADAKİ OYUN",
    })
    void nonMusicEventsAreRecognised(String name) {
        assertTrue(NonMusicFilter.isNonMusic(name), name);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            // Kapsam dışı bırakılanlar: müzik içerikli
            "Kelly Lee Owens (DJ Set)",
            "The Blaze DJ Set",
            "DJ Fırat Canpolat ile 90lar 2000ler Türkçe Pop Partisi",
            "Flashback 90'lar Türkçe Pop Gecesi",
            "Fortuna Oktoberfest",
            "Oktoberfest X Antalya Müzik Festivali - 2.Gün (Hande Yener - Ozbi)",
            "Kamuran Akkor ile Gazino Gecesi",
            "Maximum Gençlik Festivali",
            "Sakarya Festivali - 1. Gün",
            // Gerçek konserler
            "Hayko Cepkin",
            "Şebnem Ferah",
            "90lar Türkçe Pop Fest: Rafet El Roman - Çelik - Ayna",
            // "oyun" yalnızca tam kelime: başka kelimenin parçası olarak geçmez
            "Oyuncak Kutusu Konseri",
            "Oyunbaz",
            "Koyun Kaçtı",
            "Kaan Tangöze Oyunlar Konseri",
            // Mekan adı etkinlik adında: tür kelimesi içerse de konser
            "Mabel Matiz - Harbiye Cemil Topuzlu Açıkhava Tiyatrosu",
            "Ezginin Günlüğü Bornova Açık Hava Tiyatrosu",
            "Sami Yusuf - ATO Congresium Kongre ve Sergi Merkezi",
            // Açık müzik kelimesi her şeyi geçersiz kılar
            "Tiyatro Müziği Konseri",
            "Cumhurbaşkanlığı Senfoni Orkestrası - Müzikal Gecesi",
            "",
    })
    void musicAndBorderlineEventsAreKept(String name) {
        assertFalse(NonMusicFilter.isNonMusic(name), name);
    }

    @Test
    void nullNameIsNotNonMusic() {
        assertFalse(NonMusicFilter.isNonMusic(null));
    }

    // ── Ticketmaster sync ────────────────────────────────────────────────────

    @Nested
    class TicketmasterSync {
        private final EventRepository events = mock(EventRepository.class);
        private final EventSourceLinkService sourceLinks = mock(EventSourceLinkService.class);
        private final TicketmasterService service;

        TicketmasterSync() {
            ArtistRepository artists = mock(ArtistRepository.class);
            VenueRepository venues = mock(VenueRepository.class);
            ArtistFollowRepository follows = mock(ArtistFollowRepository.class);
            service = new TicketmasterService(events, artists, venues, mock(SpotifyService.class),
                    mock(DeezerService.class), follows, mock(NotificationService.class),
                    mock(LaunchCityConfig.class), sourceLinks);
            when(artists.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(venues.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(events.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(follows.findAllByArtistId(any())).thenReturn(List.of());
        }

        private Map<String, Object> tmEvent(String id, String name) {
            return Map.of(
                    "id", id,
                    "name", name,
                    "url", "https://www.biletix.com/" + id,
                    "dates", Map.of("start", Map.of("localDate", LocalDate.now().plusDays(10).toString(),
                            "localTime", "21:00:00")),
                    "classifications", List.of(Map.of("segment", Map.of("name", "Music"),
                            "genre", Map.of("name", "Pop"))),
                    "_embedded", Map.of(
                            "attractions", List.of(Map.of("id", "ATT-" + id, "name", name)),
                            "venues", List.of(Map.of("id", "VEN-1", "name", "Test Sahne",
                                    "city", Map.of("name", "Istanbul")))));
        }

        private Event syncNew(String id, String name) {
            when(sourceLinks.find(EventSource.TICKETMASTER, id)).thenReturn(Optional.empty());
            when(events.findByExternalId(id)).thenReturn(Optional.empty());
            ReflectionTestUtils.invokeMethod(service, "processEvents", List.of(tmEvent(id, name)), "Istanbul");
            ArgumentCaptor<Event> saved = ArgumentCaptor.forClass(Event.class);
            verify(events, atLeastOnce()).save(saved.capture());
            return saved.getValue();
        }

        @Test
        void newMusicalInMusicSegmentIsNotListed() {
            Event e = syncNew("TM-MUZ", "Gırgıriye Müzikali");
            assertEquals(NonMusicFilter.REASON, e.getDelistedReason());
            assertFalse(e.getIsApproved());
        }

        @Test
        void newConcertIsListedAsBefore() {
            Event e = syncNew("TM-KON", "Test Grup Konseri");
            assertNull(e.getDelistedReason());
            assertTrue(e.getIsApproved());
        }

        @Test
        void existingRecordApprovedByAdminIsNotRelistedAsNonMusic() {
            // Admin daha önce onaylamış (delistedReason temizlenmiş): sync kararını bozmaz
            Event existing = new Event();
            ReflectionTestUtils.setField(existing, "id", 40L);
            existing.setExternalId("TM-OK");
            existing.setSource(EventSource.TICKETMASTER);
            existing.setIsApproved(true);
            when(sourceLinks.find(EventSource.TICKETMASTER, "TM-OK")).thenReturn(Optional.empty());
            when(events.findByExternalId("TM-OK")).thenReturn(Optional.of(existing));

            ReflectionTestUtils.invokeMethod(service, "processEvents", List.of(tmEvent("TM-OK", "Ortadaki Oyun")), "Istanbul");

            assertNull(existing.getDelistedReason());
            assertTrue(existing.getIsApproved());
        }
    }

    // ── Biletinial ───────────────────────────────────────────────────────────

    @Nested
    class BiletinialImport {
        private final EventRepository events = mock(EventRepository.class);
        private final EventSourceLinkService sourceLinks = mock(EventSourceLinkService.class);
        private final BiletinialRecordWriter writer;

        BiletinialImport() {
            ArtistRepository artists = mock(ArtistRepository.class);
            VenueRepository venues = mock(VenueRepository.class);
            writer = new BiletinialRecordWriter(events, artists, venues, sourceLinks);
            when(artists.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(venues.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(events.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(sourceLinks.find(eq(EventSource.BILETINIAL), anyString())).thenReturn(Optional.empty());
        }

        private static RawConcertData raw(String id, String name) {
            return new RawConcertData("BILETINIAL", id, name, name, LocalDateTime.now().plusDays(12),
                    "Test Sahne", null, "İstanbul", null, null, "https://biletinial.com/" + id, null);
        }

        private Event upsertNew(String id, String name) {
            when(events.findByExternalId(anyString())).thenReturn(Optional.empty());
            assertTrue(writer.upsert(raw(id, name)));
            ArgumentCaptor<Event> saved = ArgumentCaptor.forClass(Event.class);
            verify(events).save(saved.capture());
            return saved.getValue();
        }

        @Test
        void newStandUpIsNotListed() {
            Event e = upsertNew("mayda-1", "Haydaaa! Mehmet Mayda Stand Up Gecesi");
            assertEquals(NonMusicFilter.REASON, e.getDelistedReason());
            assertFalse(e.getIsApproved());
        }

        @Test
        void newConcertIsListedAsBefore() {
            Event e = upsertNew("teoman-1", "Teoman");
            assertNull(e.getDelistedReason());
            assertTrue(e.getIsApproved());
            assertTrue(e.getIsVerified());
        }

        @Test
        void existingDelistedRecordIsNotReopenedAndApprovedOneIsNotReflagged() {
            Event delisted = new Event();
            ReflectionTestUtils.setField(delisted, "id", 50L);
            delisted.setSource(EventSource.BILETINIAL);
            delisted.setDelistedReason(NonMusicFilter.REASON);
            Event approved = new Event();
            ReflectionTestUtils.setField(approved, "id", 51L);
            approved.setSource(EventSource.BILETINIAL);
            when(events.findByExternalId(BiletinialImportService.EXTERNAL_ID_PREFIX + "x-1")).thenReturn(Optional.of(delisted));
            when(events.findByExternalId(BiletinialImportService.EXTERNAL_ID_PREFIX + "y-1")).thenReturn(Optional.of(approved));

            writer.upsert(raw("x-1", "Teoman"));
            writer.upsert(raw("y-1", "Ortadaki Oyun"));

            assertFalse(delisted.getIsApproved(), "V5: listeden kaldırılmış kayıt sync ile açılmaz");
            assertNull(approved.getDelistedReason(), "admin onaylı mevcut kayıt yeniden işaretlenmez");
            assertTrue(approved.getIsApproved());
        }
    }
}
