package com.concertly.backend.service;

import com.concertly.backend.controller.AdminMergeController;
import com.concertly.backend.dto.response.ArtistResponse;
import com.concertly.backend.dto.response.SearchResponse;
import com.concertly.backend.dto.response.VenueDetailResponse;
import com.concertly.backend.model.Artist;
import com.concertly.backend.model.ArtistFollow;
import com.concertly.backend.model.User;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.bind.annotation.RequestMapping;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * N-08 / N-09: birlestirilmis sanatci/mekan geri GELMEZ ve eski kimlikler calismaya devam eder.
 *  - ice aktarim / admin / oneri aramalari birlestirilmis kayitta ASIL kaydi dondurur
 *  - arama, populer, onboarding listesi birlestirilmis kaydi gizler
 *  - /api/artists/{eskiId}, /api/venues/{eskiId} (ve alt yollari) asil kaydi sunar
 */
class MergedRowsResolutionTest {

    private static Artist artist(long id, String name) {
        Artist a = new Artist();
        ReflectionTestUtils.setField(a, "id", id);
        a.setName(name);
        return a;
    }

    private static Venue venue(long id, String name, String city) {
        Venue v = new Venue();
        ReflectionTestUtils.setField(v, "id", id);
        v.setName(name);
        v.setCity(city);
        return v;
    }

    // ───────────── MergePointers ─────────────

    @Test
    void pointersAreFollowedToTheRootAndNeverLoop() {
        ArtistRepository repo = mock(ArtistRepository.class);
        Artist root = artist(1, "Root");
        Artist mid = artist(2, "Mid");
        mid.setMergedIntoArtistId(1L);
        Artist leaf = artist(3, "Leaf");
        leaf.setMergedIntoArtistId(2L);
        when(repo.findById(1L)).thenReturn(Optional.of(root));
        when(repo.findById(2L)).thenReturn(Optional.of(mid));

        assertSame(root, MergePointers.rootOf(leaf, repo));
        assertSame(root, MergePointers.rootOf(root, repo));       // isaretci yok: ek sorgu yok
        verify(repo, never()).findById(3L);

        // dongu (A -> B -> A) sonsuz donguye girmez
        Artist a = artist(10, "A");
        Artist b = artist(11, "B");
        a.setMergedIntoArtistId(11L);
        b.setMergedIntoArtistId(10L);
        when(repo.findById(10L)).thenReturn(Optional.of(a));
        when(repo.findById(11L)).thenReturn(Optional.of(b));
        assertNotNull(MergePointers.rootOf(a, repo));

        // kirik isaretci: ulasilabilen son kayit
        Artist dangling = artist(20, "D");
        dangling.setMergedIntoArtistId(999L);
        when(repo.findById(999L)).thenReturn(Optional.empty());
        assertSame(dangling, MergePointers.rootOf(dangling, repo));

        // mekan icin de ayni
        VenueRepository vr = mock(VenueRepository.class);
        Venue vroot = venue(1, "V", "Ankara");
        Venue vleaf = venue(2, "V2", "Ankara");
        vleaf.setMergedIntoVenueId(1L);
        when(vr.findById(1L)).thenReturn(Optional.of(vroot));
        assertSame(vroot, MergePointers.rootOf(vleaf, vr));
    }

    // ───────────── ice aktarim / admin / oneri aramalari ─────────────

    @Test
    void artistIngestLookupsReturnTheCanonicalRowForMergedDuplicates() {
        ArtistRepository repo = mock(ArtistRepository.class);
        when(repo.findExisting(any(), any())).thenCallRealMethod();
        when(repo.findByNameIgnoreCase(any())).thenCallRealMethod();
        when(repo.findFirstByNameIgnoreCase(any())).thenCallRealMethod();
        when(repo.findBySpotifyId(any())).thenCallRealMethod();
        Artist canonical = artist(1, "Hadise");
        Artist dup = artist(2, "HADİSE");
        dup.setMergedIntoArtistId(1L);
        when(repo.findById(1L)).thenReturn(Optional.of(canonical));

        // ad anahtariyla: birlestirilmis kayit bulunur ama ASIL doner (yeni mukerrer acilmaz)
        when(repo.search("HADİSE")).thenReturn(List.of(dup));
        assertEquals(1L, repo.findExisting(null, "HADİSE").orElseThrow().getId());
        // kaynak kimligiyle
        when(repo.findFirstByExternalIdOrderByIdAsc("TM-DUP")).thenReturn(Optional.of(dup));
        assertEquals(1L, repo.findExisting("TM-DUP", "Baska Ad").orElseThrow().getId());
        // oneri / Spotify / ad aramalari
        when(repo.findFirstByNameIgnoreCaseOrderByIdAsc("HADİSE")).thenReturn(Optional.of(dup));
        when(repo.findFirstBySpotifyIdOrderByIdAsc("sp")).thenReturn(Optional.of(dup));
        assertEquals(1L, repo.findByNameIgnoreCase("HADİSE").orElseThrow().getId());
        assertEquals(1L, repo.findFirstByNameIgnoreCase("HADİSE").orElseThrow().getId());
        assertEquals(1L, repo.findBySpotifyId("sp").orElseThrow().getId());
    }

    @Test
    void venueIngestLookupsReturnTheCanonicalRowForMergedDuplicates() {
        VenueRepository repo = mock(VenueRepository.class);
        when(repo.findByExternalId(any())).thenCallRealMethod();
        when(repo.findFirstByNameAndCity(any(), any())).thenCallRealMethod();
        Venue canonical = venue(10, "Antalya Açıkhava Tiyatrosu", "Antalya");
        Venue dup = venue(11, "Antalya Open Air", "Antalya");
        dup.setMergedIntoVenueId(10L);
        when(repo.findById(10L)).thenReturn(Optional.of(canonical));
        when(repo.findFirstByExternalIdOrderByIdAsc("tm-venue")).thenReturn(Optional.of(dup));
        when(repo.findFirstByNameAndCityOrderByIdAsc("Antalya Open Air", "Antalya")).thenReturn(Optional.of(dup));

        assertEquals(10L, repo.findByExternalId("tm-venue").orElseThrow().getId());
        assertEquals(10L, repo.findFirstByNameAndCity("Antalya Open Air", "Antalya").orElseThrow().getId());
        // aktif kayit aynen doner, ek sorgu yok
        when(repo.findFirstByNameAndCityOrderByIdAsc("Antalya Açıkhava Tiyatrosu", "Antalya")).thenReturn(Optional.of(canonical));
        assertSame(canonical, repo.findFirstByNameAndCity("Antalya Açıkhava Tiyatrosu", "Antalya").orElseThrow());
    }

    @Test
    void mergedArtistsAreFilteredOutOfTheGenreQueryUsedByOnboarding() throws Exception {
        Query q = ArtistRepository.class.getMethod("findByGenreIn", List.class).getAnnotation(Query.class);
        assertTrue(q.value().contains("a.mergedIntoArtistId IS NULL"), q.value());
    }

    // ───────────── okuma yollari ─────────────

    private ArtistService artistService(ArtistRepository artists, ArtistFollowRepository follows,
                                        EventRepository events, UserRepository users) {
        return new ArtistService(artists, follows, users, events, mock(PostRepository.class),
                mock(LikeRepository.class), mock(CommentRepository.class), mock(SpotifyService.class),
                mock(EventReviewRepository.class), mock(ModerationService.class), mock(PrivacyService.class));
    }

    @Test
    void artistDeepLinkWithMergedIdServesTheCanonicalArtistAndItsEvents() {
        ArtistRepository artists = mock(ArtistRepository.class);
        ArtistFollowRepository follows = mock(ArtistFollowRepository.class);
        EventRepository events = mock(EventRepository.class);
        Artist canonical = artist(1, "Hadise");
        Artist dup = artist(2, "HADİSE");
        dup.setMergedIntoArtistId(1L);
        when(artists.findById(1L)).thenReturn(Optional.of(canonical));
        when(artists.findById(2L)).thenReturn(Optional.of(dup));
        when(follows.countByArtistId(1L)).thenReturn(7L);
        when(follows.findByUserIdAndArtistId(5L, 1L)).thenReturn(Optional.of(new ArtistFollow()));
        when(events.findByArtistIdOrderByEventDateDesc(1L)).thenReturn(List.of());
        ArtistService s = artistService(artists, follows, events, mock(UserRepository.class));

        ArtistResponse r = s.getArtist(2L, 5L);

        assertEquals(1L, r.getId(), "yanitta ASIL kimlik");
        assertEquals("Hadise", r.getName());
        assertEquals(7L, r.getFollowerCount());
        assertTrue(r.isFollowedByCurrentUser());

        assertTrue(s.getArtistEvents(2L).isEmpty());
        verify(events).findByArtistIdOrderByEventDateDesc(1L);
        verify(events, never()).findByArtistIdOrderByEventDateDesc(2L);
        assertTrue(s.getArtistPastEvents(2L).isEmpty());
        s.getArtistPosts(2L, null);
        // bilinmeyen kimlik hala 404
        assertThrows(com.concertly.backend.exception.ResourceNotFoundException.class, () -> s.getArtistEvents(404L));
    }

    @Test
    void followAndUnfollowWithMergedIdTargetTheCanonicalArtist() {
        ArtistRepository artists = mock(ArtistRepository.class);
        ArtistFollowRepository follows = mock(ArtistFollowRepository.class);
        UserRepository users = mock(UserRepository.class);
        Artist canonical = artist(1, "Hadise");
        Artist dup = artist(2, "HADİSE");
        dup.setMergedIntoArtistId(1L);
        when(artists.findById(1L)).thenReturn(Optional.of(canonical));
        when(artists.findById(2L)).thenReturn(Optional.of(dup));
        User u = new User();
        ReflectionTestUtils.setField(u, "id", 5L);
        when(users.findById(5L)).thenReturn(Optional.of(u));
        when(follows.findByUserIdAndArtistId(5L, 1L)).thenReturn(Optional.empty());
        ArtistService s = artistService(artists, follows, mock(EventRepository.class), users);

        s.follow(5L, 2L);
        org.mockito.ArgumentCaptor<ArtistFollow> cap = org.mockito.ArgumentCaptor.forClass(ArtistFollow.class);
        verify(follows).save(cap.capture());
        assertEquals(1L, cap.getValue().getArtist().getId(), "yeni takip birlestirilmis kayda DEGIL asila yazilir");

        ArtistFollow existing = new ArtistFollow();
        when(follows.findByUserIdAndArtistId(5L, 1L)).thenReturn(Optional.of(existing));
        s.unfollow(5L, 2L);
        verify(follows).delete(existing);
    }

    @Test
    void popularArtistsHideMergedRows() {
        ArtistRepository artists = mock(ArtistRepository.class);
        EventRepository events = mock(EventRepository.class);
        Artist ok = artist(1, "Hadise");
        ok.setImageUrl("/uploads/a.jpg");
        Artist merged = artist(2, "HADİSE");
        merged.setImageUrl("/uploads/b.jpg");
        merged.setMergedIntoArtistId(1L);
        when(events.topArtistsByUpcomingEvents(any(), any()))
                .thenReturn(List.<Object[]>of(new Object[]{2L, 9L}, new Object[]{1L, 5L}));
        when(artists.findAllById(any())).thenReturn(List.of(ok, merged));
        ArtistService s = artistService(artists, mock(ArtistFollowRepository.class), events, mock(UserRepository.class));

        assertEquals(List.of(1L), s.getPopularArtists(10, null).stream().map(ArtistResponse::getId).toList());
    }

    @Test
    void venueDeepLinkWithMergedIdServesTheCanonicalVenue() {
        VenueRepository venues = mock(VenueRepository.class);
        VenueReviewRepository reviews = mock(VenueReviewRepository.class);
        EventRepository events = mock(EventRepository.class);
        Venue canonical = venue(10, "Antalya Açıkhava Tiyatrosu", "Antalya");
        Venue dup = venue(11, "Antalya Open Air", "Antalya");
        dup.setMergedIntoVenueId(10L);
        when(venues.findById(10L)).thenReturn(Optional.of(canonical));
        when(venues.findById(11L)).thenReturn(Optional.of(dup));
        when(reviews.avgRatingByVenueId(10L)).thenReturn(4.0);
        when(reviews.countByVenueId(10L)).thenReturn(3L);
        when(events.findByVenueIdOrderByEventDateAsc(10L)).thenReturn(List.of());
        when(reviews.findByVenueIdOrderByCreatedAtDesc(10L)).thenReturn(List.of());
        VenueService s = new VenueService(venues, reviews, events, mock(UserRepository.class));

        VenueDetailResponse r = s.getVenue(11L, null);
        assertEquals(10L, r.getId());
        assertEquals(3L, r.getReviewCount());
        assertTrue(s.getVenueEvents(11L).isEmpty());
        assertTrue(s.getReviews(11L).isEmpty());
        verify(events, times(2)).findByVenueIdOrderByEventDateAsc(10L); // getVenue (sayim) + getVenueEvents
        verify(events, never()).findByVenueIdOrderByEventDateAsc(11L);
        verify(reviews).findByVenueIdOrderByCreatedAtDesc(10L);
        assertThrows(com.concertly.backend.exception.ResourceNotFoundException.class, () -> s.getVenue(404L, null));
    }

    @Test
    void searchHidesMergedArtistsAndVenues() {
        ArtistRepository artists = mock(ArtistRepository.class);
        VenueRepository venues = mock(VenueRepository.class);
        EventRepository events = mock(EventRepository.class);
        Artist ok = artist(1, "Hadise");
        Artist merged = artist(2, "HADİSE");
        merged.setMergedIntoArtistId(1L);
        Venue vok = venue(10, "Zorlu PSM", "İstanbul");
        Venue vmerged = venue(11, "Zorlu PSM Turkcell", "İstanbul");
        vmerged.setMergedIntoVenueId(10L);
        when(artists.search("hadise")).thenReturn(List.of(ok, merged));
        when(venues.search("hadise")).thenReturn(List.of(vok, vmerged));
        when(events.countUpcomingListedByVenueIdIn(anyCollection(), any())).thenReturn(List.of());
        SearchService s = new SearchService(events, artists, mock(UserRepository.class),
                mock(ArtistFollowRepository.class), mock(PrivacyService.class));
        ReflectionTestUtils.setField(s, "venueRepository", venues);

        SearchResponse r = s.search("hadise", null);

        assertEquals(List.of(1L), r.getArtists().stream().map(a -> a.getId()).toList());
        assertEquals(List.of(10L), r.getVenues().stream().map(v -> v.getId()).toList());
    }

    // ───────────── admin uc noktalari ─────────────

    @Test
    void mergeEndpointsLiveUnderApiAdminWhichSecurityConfigRestrictsToAdmins() throws Exception {
        RequestMapping base = AdminMergeController.class.getAnnotation(RequestMapping.class);
        assertNotNull(base);
        for (String p : base.value()) assertTrue(p.startsWith("/api/admin/"), p);
        String sec = Files.readString(Path.of("src/main/java/com/concertly/backend/security/SecurityConfig.java"));
        assertTrue(sec.contains(".requestMatchers(\"/api/admin/**\").hasRole(\"ADMIN\")"));
        // Mekan ve sanatci okuma uclari public kalir; birlestirme ucu public listeye eklenmemis olmali
        for (String l : sec.split("\n")) {
            if (l.trim().startsWith("//") || !l.contains("permitAll")) continue;
            assertFalse(l.contains("/api/admin"), l);
        }
    }
}
