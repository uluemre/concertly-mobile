package com.concertly.backend.service;

import com.concertly.backend.model.Artist;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Sanatçı fotoğrafı: önce bilet sitelerinin güncel konser görseli, yoksa tek ve birebir
 * Deezer eşleşmesi; doğrulanamayan fotoğraf kaldırılır.
 */
class ArtistPhotoServiceTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 6, 5, 30);

    private final ArtistRepository artists = mock(ArtistRepository.class);
    private final EventRepository events = mock(EventRepository.class);
    private final DeezerService deezer = mock(DeezerService.class);
    private final ArtistPhotoService service = new ArtistPhotoService(artists, events, deezer, 100, 0);

    private static Artist artist(long id, String name, String image, String source) {
        Artist a = new Artist();
        ReflectionTestUtils.setField(a, "id", id);
        a.setName(name);
        a.setImageUrl(image);
        a.setImageSource(source);
        return a;
    }

    private static Object[] row(String url, EventSource source, long id) {
        return new Object[] { url, source, id };
    }

    @Test
    void ticketSiteImageBeatsTicketmasterAndSharedStockImagesAreSkipped() {
        // Gerçek veri (6 Eki 2026): Ticketmaster Mustafa Sandal için genel "davul" görseli veriyor
        List<Object[]> rows = List.of(
                row("https://s1.ticketm.net/davul.jpg", EventSource.TICKETMASTER, 50),
                row("https://merlincdn/mustafa-sandal-2026.jpg", EventSource.BILETINIAL, 40),
                row("https://cdn.bubilet.com.tr/mustafa-sandal-konser.jpg", EventSource.BUBILET, 30));
        assertEquals("https://cdn.bubilet.com.tr/mustafa-sandal-konser.jpg",
                ArtistPhotoService.bestEventImage(rows, Set.of("https://s1.ticketm.net/davul.jpg")));
    }

    @Test
    void newestImageWinsWithinTheSameSiteAndPlaceholdersAreIgnored() {
        List<Object[]> rows = List.of(
                row("https://x/images/artist//ph.jpg", EventSource.BUBILET, 90),
                row("https://bubilet/yeni-turne.jpg", EventSource.BUBILET, 80),
                row("https://bubilet/eski-turne.jpg", EventSource.BUBILET, 10));
        assertEquals("https://bubilet/yeni-turne.jpg", ArtistPhotoService.bestEventImage(rows, Set.of()));
        assertNull(ArtistPhotoService.bestEventImage(List.of(), Set.of()));
    }

    @Test
    void refreshUsesTheConcertImageEvenWhenAnOldDeezerPhotoExists() {
        Artist goksel = artist(1, "Göksel", "https://dzcdn/yanlis-goksel.jpg", "DEEZER");
        when(events.findUpcomingListedArtists(any())).thenReturn(List.of(goksel));
        when(events.findSharedImages(any(), anyLong())).thenReturn(List.of());
        when(events.findUpcomingImageSourcesByArtist(eq(1L), any()))
                .thenReturn(List.<Object[]>of(row("https://bubilet/goksel-ruyalarin-ici.jpg", EventSource.BUBILET, 5)));

        ArtistPhotoService.Result r = service.refresh(10, false);
        assertEquals(1, r.fromEvent());
        assertEquals("https://bubilet/goksel-ruyalarin-ici.jpg", goksel.getImageUrl());
        assertEquals("EVENT", goksel.getImageSource());
        verifyNoInteractions(deezer);
    }

    @Test
    void withoutConcertImageAUniqueDeezerMatchIsUsed() {
        Artist a = artist(1, "Siren", null, null);
        when(deezer.searchArtistOrThrow("Siren")).thenReturn(new DeezerService.DeezerArtistData("https://dzcdn/siren.jpg", "Siren"));
        assertEquals("DEEZER", service.fromDeezer(a, NOW));
        assertEquals("https://dzcdn/siren.jpg", a.getImageUrl());
    }

    @Test
    void unverifiableOldPhotoIsRemovedRatherThanShowingTheWrongPerson() {
        // Manifest: Deezer'da aynı adla birden çok sanatçı → arama null döner
        Artist manifest = artist(1, "Manifest", "https://cdn-images.dzcdn.net/images/artist/yanlis/1000x1000.jpg", null);
        assertEquals("CLEARED", service.fromDeezer(manifest, NOW));
        assertNull(manifest.getImageUrl());
    }

    @Test
    void spotifyPhotoIsKeptWhenNothingElseIsFound() {
        Artist a = artist(1, "X", "https://i.scdn.co/image/abc", "SPOTIFY");
        assertEquals("UNCHANGED", service.fromDeezer(a, NOW));
        assertEquals("https://i.scdn.co/image/abc", a.getImageUrl());
    }

    @Test
    void deezerOutageChangesNothing() {
        Artist a = artist(1, "Duman", "https://dzcdn/duman.jpg", null);
        when(deezer.searchArtistOrThrow("Duman")).thenThrow(new DeezerService.DeezerUnavailableException("timeout"));
        assertEquals("SKIPPED", service.fromDeezer(a, NOW));
        assertEquals("https://dzcdn/duman.jpg", a.getImageUrl());
        verify(artists, never()).save(any());
    }

    @Test
    void deezerNameMatchingIgnoresTurkishLettersAndPunctuation() {
        assertEquals(DeezerService.nameKey("Göksel"), DeezerService.nameKey("GOKSEL"));
        assertEquals(DeezerService.nameKey("Şebnem Ferah"), DeezerService.nameKey("Sebnem ferah"));
        assertNotEquals(DeezerService.nameKey("Model"), DeezerService.nameKey("Models"));
    }

    private static java.util.Map<String, Object> candidate(String name, long fans) {
        return java.util.Map.of("name", name, "nb_fan", fans);
    }

    @Test
    void sameNameCandidatesArePickedOnlyWhenOneClearlyDominates() {
        // Gerçek Scorpions vs aynı adlı tribute hesabı: baskın olan seçilir
        assertEquals(2_000_000L, DeezerService.pickUnambiguous(List.of(
                candidate("Scorpions", 300), candidate("Scorpions", 2_000_000))).get("nb_fan"));
        // Manifest (6 Eki 2026): 7.819 / 1.456 / 12 → hangisi olduğu bilinemez
        assertNull(DeezerService.pickUnambiguous(List.of(
                candidate("Manifest", 1456), candidate("manifest", 7819), candidate("Manifest", 12))));
        // Tek aday her zaman kabul
        assertEquals("Siren", DeezerService.pickUnambiguous(List.of(candidate("Siren", 5))).get("name"));
        assertNull(DeezerService.pickUnambiguous(List.of()));
    }
}
