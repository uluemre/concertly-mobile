package com.concertly.backend.service;

import com.concertly.backend.dto.response.ArtistResponse;
import com.concertly.backend.model.Artist;
import com.concertly.backend.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Kayit sonrasi sanatci secimi: sanatci basina sorgu atilmamali (eskiden
 * ~430 sanatci icin ~860 sorgu). Takipci sayisi ve takip durumu toplu gelir.
 */
class RecommendedArtistsQueryTest {

    @Test
    void followerDataIsLoadedInTwoQueriesNotPerArtist() {
        ArtistRepository artists = mock(ArtistRepository.class);
        ArtistFollowRepository follows = mock(ArtistFollowRepository.class);
        EventRepository events = mock(EventRepository.class);
        ArtistService service = new ArtistService(artists, follows, mock(UserRepository.class), events,
                mock(PostRepository.class), mock(LikeRepository.class), mock(CommentRepository.class),
                mock(SpotifyService.class), mock(EventReviewRepository.class));

        List<Artist> list = new ArrayList<>();
        for (long i = 1; i <= 300; i++) {
            Artist a = new Artist();
            ReflectionTestUtils.setField(a, "id", i);
            a.setName("Sanatci " + i);
            a.setGenre("pop");
            list.add(a);
        }
        when(artists.findByGenreIn(anyList())).thenReturn(list);
        when(events.topArtistsByUpcomingEvents(any(), any()))
                .thenReturn(List.<Object[]>of(new Object[]{7L, 5L}));
        when(follows.countByArtistIds(anyCollection()))
                .thenReturn(List.<Object[]>of(new Object[]{7L, 12L}, new Object[]{9L, 3L}));
        when(follows.findArtistIdsByUserId(42L)).thenReturn(List.of(9L));

        List<ArtistResponse> result = service.getArtistsByGenres(List.of("Pop"), 42L);

        assertEquals(300, result.size());
        assertEquals(7L, result.get(0).getId(), "yaklasan konseri olan sanatci ustte");
        assertEquals(12L, result.get(0).getFollowerCount());
        ArtistResponse nine = result.stream().filter(r -> r.getId() == 9L).findFirst().orElseThrow();
        assertEquals(3L, nine.getFollowerCount());
        assertTrue(nine.isFollowedByCurrentUser());
        assertEquals(0L, result.stream().filter(r -> r.getId() == 1L).findFirst().orElseThrow().getFollowerCount());

        verify(follows, times(1)).countByArtistIds(anyCollection());
        verify(follows, times(1)).findArtistIdsByUserId(42L);
        verify(follows, never()).countByArtistId(any());
        verify(follows, never()).findByUserIdAndArtistId(any(), any());
    }
}
