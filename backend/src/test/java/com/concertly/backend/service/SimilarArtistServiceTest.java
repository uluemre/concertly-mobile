package com.concertly.backend.service;

import com.concertly.backend.dto.response.ArtistResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Artist;
import com.concertly.backend.repository.ArtistFollowRepository;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SimilarArtistServiceTest {

    @Mock private DeezerService deezerService;
    @Mock private ArtistRepository artistRepository;
    @Mock private ArtistFollowRepository artistFollowRepository;
    @Mock private EventRepository eventRepository;

    private SimilarArtistService service;

    @BeforeEach
    void setUp() {
        service = new SimilarArtistService(deezerService, artistRepository, artistFollowRepository, eventRepository);
        when(artistFollowRepository.findByUserIdAndArtistId(anyLong(), anyLong())).thenReturn(Optional.empty());
        when(eventRepository.countUpcomingListedByArtistIdIn(any(), any())).thenReturn(List.of());
    }

    private static Artist artist(long id, String name) {
        Artist a = new Artist();
        ReflectionTestUtils.setField(a, "id", id);
        a.setName(name);
        return a;
    }

    private void known(Artist... artists) {
        for (Artist a : artists) {
            when(artistRepository.findById(a.getId())).thenReturn(Optional.of(a));
            when(artistRepository.findExisting(isNull(), eq(a.getName()))).thenReturn(Optional.of(a));
        }
        when(artistRepository.findAllById(any())).thenReturn(List.of(artists));
    }

    private void deezer(String name, long deezerId, List<String> related) {
        when(deezerService.searchArtists(eq(name), anyInt()))
                .thenReturn(List.of(Map.of("artistId", deezerId, "name", name)));
        when(deezerService.getRelatedArtistNames(eq(deezerId), anyInt())).thenReturn(related);
    }

    private static List<String> names(List<ArtistResponse> list) {
        return list.stream().map(ArtistResponse::getName).toList();
    }

    @Test
    void returnsOnlyLocalArtistsWithUpcomingFirstAndExcludesSelf() {
        Artist hadise = artist(1, "Hadise"), hande = artist(2, "Hande Yener"),
               simge = artist(3, "Simge"), bengu = artist(4, "Bengü");
        known(hadise, hande, simge, bengu);
        // "Edis" bizde yok, "Hadise" kendisi — ikisi de elenir
        deezer("Hadise", 99L, List.of("Hande Yener", "Edis", "Simge", "Hadise", "Bengü"));
        when(eventRepository.countUpcomingListedByArtistIdIn(any(), any()))
                .thenReturn(List.<Object[]>of(new Object[]{4L, 2L}));

        List<ArtistResponse> result = service.getSimilar(1L, 7L);

        assertEquals(List.of("Bengü", "Hande Yener", "Simge"), names(result));
    }

    @Test
    void emptyWhenDeezerHasNoExactNameMatch() {
        Artist kibariye = artist(1, "Kibariye");
        known(kibariye);
        when(deezerService.searchArtists(eq("Kibariye"), anyInt()))
                .thenReturn(List.of(Map.of("artistId", 5L, "name", "Güllü")));

        assertTrue(service.getSimilar(1L, null).isEmpty());
        verify(deezerService, never()).getRelatedArtistNames(anyLong(), anyInt());
    }

    @Test
    void cachesDeezerLookupPerArtist() {
        Artist hadise = artist(1, "Hadise"), simge = artist(3, "Simge");
        known(hadise, simge);
        deezer("Hadise", 99L, List.of("Simge"));

        service.getSimilar(1L, null);
        service.getSimilar(1L, 7L);

        verify(deezerService, times(1)).getRelatedArtistNames(anyLong(), anyInt());
    }

    @Test
    void unknownArtistIs404() {
        when(artistRepository.findById(42L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> service.getSimilar(42L, null));
    }
}
