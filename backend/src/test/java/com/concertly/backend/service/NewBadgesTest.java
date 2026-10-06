package com.concertly.backend.service;

import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Yeni rozet serileri: şehirler, sadakat, keşif, günlük şarkı, topluluk. */
class NewBadgesTest {

    private static final long UID = 7L;

    private final BadgeRepository badges = mock(BadgeRepository.class);
    private final UserBadgeRepository userBadges = mock(UserBadgeRepository.class);
    private final ConcertAttendanceService attendance = mock(ConcertAttendanceService.class);
    private final ArtistFollowRepository follows = mock(ArtistFollowRepository.class);
    private final DailySongPlayRepository daily = mock(DailySongPlayRepository.class);
    private final CommunityMemberRepository members = mock(CommunityMemberRepository.class);
    private final CommunityRepository communities = mock(CommunityRepository.class);
    private BadgeService service;

    @BeforeEach
    void setUp() {
        UserRepository users = mock(UserRepository.class);
        when(users.findById(UID)).thenReturn(Optional.of(new User()));
        service = new BadgeService(badges, userBadges, users, attendance, mock(PostRepository.class),
                mock(NotificationService.class));
        ReflectionTestUtils.setField(service, "artistFollowRepository", follows);
        ReflectionTestUtils.setField(service, "dailySongPlayRepository", daily);
        ReflectionTestUtils.setField(service, "communityMemberRepository", members);
        ReflectionTestUtils.setField(service, "communityRepository", communities);
        when(badges.findByCode(anyString())).thenAnswer(i -> {
            Badge b = new Badge();
            ReflectionTestUtils.setField(b, "id", (long) Math.abs(i.<String>getArgument(0).hashCode()));
            b.setCode(i.getArgument(0));
            return Optional.of(b);
        });
        when(userBadges.insertIfAbsent(eq(UID), anyLong(), any())).thenReturn(1);
    }

    private static Event attended(String city, long artistId) {
        Artist a = new Artist();
        ReflectionTestUtils.setField(a, "id", artistId);
        Venue v = new Venue();
        v.setCity(city);
        Event e = new Event();
        e.setArtist(a);
        e.setVenue(v);
        e.setEventDate(LocalDateTime.now().minusDays(10));
        return e;
    }

    @Test
    void citiesAndLoyaltyComeFromAttendedConcerts() {
        // İstanbul ile Istanbul aynı şehir; 3 farklı şehir; aynı sanatçı 3 kez
        when(attendance.attended(UID)).thenReturn(List.of(
                attended("İstanbul", 1), attended("Istanbul", 1), attended("Ankara", 1), attended("Eskişehir", 2)));
        when(attendance.attendedCount(UID)).thenReturn(4L);
        BadgeService.Stats st = service.stats(UID);
        assertEquals(3, st.cities());
        assertEquals(3, st.sameArtist());

        service.checkAndAwardBadges(UID);
        // Eşikler (Emre, 6 Eki): şehir 2/5/10, aynı sanatçı 3/5
        verify(userBadges).insertIfAbsent(eq(UID), eq((long) Math.abs("yola_cikan".hashCode())), any());
        verify(userBadges, never()).insertIfAbsent(eq(UID), eq((long) Math.abs("sehir_gezgini".hashCode())), any());
        verify(userBadges).insertIfAbsent(eq(UID), eq((long) Math.abs("sadik_hayran".hashCode())), any());
        verify(userBadges, never()).insertIfAbsent(eq(UID), eq((long) Math.abs("gercek_fan".hashCode())), any());
    }

    @Test
    void followsDailySongAndCommunities() {
        when(attendance.attended(UID)).thenReturn(List.of());
        when(follows.countByUserId(UID)).thenReturn(5L);
        when(daily.countByUserIdAndSolvedTrue(UID)).thenReturn(7L);
        when(members.countByUserIdAndStatus(UID, "ACTIVE")).thenReturn(1L);
        when(communities.countByOwnerId(UID)).thenReturn(0L);

        service.checkAndAwardBadges(UID);
        for (String code : List.of("muzik_kasifi", "kulak_misafiri", "kulagi_delik", "topluluk_ruhu")) {
            verify(userBadges).insertIfAbsent(eq(UID), eq((long) Math.abs(code.hashCode())), any());
        }
        // Keşif 5/10/20: 5 takip yalnız ilkini verir
        for (String code : List.of("kesif_tutkunu", "koleksiyoncu", "muzik_dahisi", "kurucu")) {
            verify(userBadges, never()).insertIfAbsent(eq(UID), eq((long) Math.abs(code.hashCode())), any());
        }
    }

    @Test
    void missingDataSourcesCountAsZero() {
        BadgeService bare = new BadgeService(badges, userBadges, mock(UserRepository.class), attendance,
                mock(PostRepository.class), mock(NotificationService.class));
        when(attendance.attended(UID)).thenReturn(List.of());
        assertEquals(new BadgeService.Stats(0, 0, 0, 0, 0, 0), bare.stats(UID));
    }

    @Test
    void badgeCheckFailureNeverBreaksTheCaller() {
        when(attendance.attendedCount(UID)).thenThrow(new RuntimeException("db yok"));
        assertDoesNotThrow(() -> service.checkQuietly(UID));
    }
}
