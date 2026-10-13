package com.concertly.backend.service;

import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.VenueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Admin sanatçı/mekân düzenleme: fotoğraf kilidi, ad değişince eski adın yönlendirme kaydı. */
class AdminContentServiceTest {

    private final ArtistRepository artists = mock(ArtistRepository.class);
    private final VenueRepository venues = mock(VenueRepository.class);
    private final AdminContentService service = new AdminContentService(artists, venues, mock(JdbcTemplate.class));

    private Artist hadise;
    private Venue venue;

    @BeforeEach
    void setUp() {
        hadise = new Artist();
        ReflectionTestUtils.setField(hadise, "id", 2899L);
        hadise.setName("Hadise");
        hadise.setGenre("Pop");
        hadise.setImageUrl("https://dzcdn/hadise.jpg");
        hadise.setImageSource("DEEZER");
        when(artists.findById(2899L)).thenReturn(Optional.of(hadise));
        when(artists.findExisting(isNull(), anyString())).thenReturn(Optional.empty());
        when(artists.save(any())).thenAnswer(inv -> inv.getArgument(0));

        venue = new Venue();
        ReflectionTestUtils.setField(venue, "id", 10L);
        venue.setName("CSO Ada");
        venue.setCity("Ankara");
        venue.setCountry("Türkiye");
        when(venues.findById(10L)).thenReturn(Optional.of(venue));
        when(venues.findFirstByNameAndCity(anyString(), anyString())).thenReturn(Optional.empty());
        when(venues.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private static Map<String, Object> body(Object... kv) {
        Map<String, Object> m = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    @Test
    void uploadedPhotoIsLockedAsAdmin() {
        List<String> diff = service.updateArtist(2899L, body("imageUrl", "/uploads/abc-123.jpg"));
        assertEquals("/uploads/abc-123.jpg", hadise.getImageUrl());
        assertEquals(ArtistPhotoService.SOURCE_ADMIN, hadise.getImageSource());
        assertNotNull(hadise.getImageCheckedAt());
        assertEquals(1, diff.size());
    }

    @Test
    void resettingPhotoUnlocksAutomaticSearch() {
        hadise.setImageSource("ADMIN");
        service.updateArtist(2899L, body("imageUrl", ""));
        assertNull(hadise.getImageUrl());
        assertNull(hadise.getImageSource());
        assertNull(hadise.getImageCheckedAt());
    }

    @Test
    void imageUrlMustBeOurUploadOrHttps() {
        assertThrows(IllegalArgumentException.class, () -> service.updateArtist(2899L, body("imageUrl", "http://x/y.jpg")));
        assertThrows(IllegalArgumentException.class, () -> service.updateArtist(2899L, body("imageUrl", "javascript:alert(1)")));
        assertThrows(IllegalArgumentException.class, () -> service.updateArtist(2899L, body("imageUrl", "/uploads/../secret")));
        service.updateArtist(2899L, body("imageUrl", "https://cdn.example.com/hadise.jpg"));
        assertEquals("https://cdn.example.com/hadise.jpg", hadise.getImageUrl());
    }

    @Test
    void renameKeepsOldNameAsHiddenAliasSoSyncsDoNotDuplicate() {
        List<String> diff = service.updateArtist(2899L, body("name", "Hadise Açıkgöz"));
        assertEquals("Hadise Açıkgöz", hadise.getName());
        ArgumentCaptor<Artist> saved = ArgumentCaptor.forClass(Artist.class);
        verify(artists, times(2)).save(saved.capture());
        Artist alias = saved.getAllValues().stream().filter(a -> a != hadise).findFirst().orElseThrow();
        assertEquals("Hadise", alias.getName());
        assertEquals(2899L, alias.getMergedIntoArtistId());
        assertTrue(diff.get(0).contains("Hadise → Hadise Açıkgöz"));
    }

    @Test
    void spellingOnlyRenameNeedsNoAlias() {
        service.updateArtist(2899L, body("name", "HADİSE"));
        verify(artists, times(1)).save(hadise);
        verify(artists, times(1)).save(any());
    }

    @Test
    void renameToAnotherArtistsNameIsRejected() {
        Artist other = new Artist();
        ReflectionTestUtils.setField(other, "id", 5L);
        when(artists.findExisting(null, "Tarkan")).thenReturn(Optional.of(other));
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.updateArtist(2899L, body("name", "Tarkan")));
        assertEquals("ARTIST_NAME_TAKEN", ex.getMessage());
        assertEquals("Hadise", hadise.getName());
    }

    @Test
    void mergedArtistCannotBeEdited() {
        hadise.setMergedIntoArtistId(1L);
        assertThrows(IllegalArgumentException.class, () -> service.updateArtist(2899L, body("genre", "Rock")));
    }

    @Test
    void venueEditMarksAdminEditedAndKeepsAlias() {
        List<String> diff = service.updateVenue(10L, body("name", "CSO Ada Ankara", "latitude", "39.93", "longitude", "32.85"));
        assertTrue(venue.isAdminEdited());
        assertEquals(39.93, venue.getLatitude());
        assertEquals(2, diff.size());
        ArgumentCaptor<Venue> saved = ArgumentCaptor.forClass(Venue.class);
        verify(venues, times(2)).save(saved.capture());
        Venue alias = saved.getAllValues().stream().filter(v -> v != venue).findFirst().orElseThrow();
        assertEquals("CSO Ada", alias.getName());
        assertEquals("Ankara", alias.getCity());
        assertEquals(10L, alias.getMergedIntoVenueId());
    }

    @Test
    void venueValidation() {
        assertThrows(IllegalArgumentException.class, () -> service.updateVenue(10L, body("latitude", "95", "longitude", "30")));
        assertThrows(IllegalArgumentException.class, () -> service.updateVenue(10L, body("latitude", "39.9")));
        assertThrows(IllegalArgumentException.class, () -> service.updateVenue(10L, body("name", " ")));
        Venue other = new Venue();
        ReflectionTestUtils.setField(other, "id", 11L);
        when(venues.findFirstByNameAndCity("Jolly Joker", "Ankara")).thenReturn(Optional.of(other));
        assertEquals("VENUE_EXISTS",
                assertThrows(IllegalArgumentException.class, () -> service.updateVenue(10L, body("name", "Jolly Joker"))).getMessage());
    }

    @Test
    void noChangeLeavesVenueUnmarked() {
        List<String> diff = service.updateVenue(10L, body("name", "CSO Ada", "city", "Ankara"));
        assertTrue(diff.isEmpty());
        assertFalse(venue.isAdminEdited());
    }
}
