package com.concertly.backend.service;

import com.concertly.backend.dto.response.CommunityResponse;
import com.concertly.backend.model.Community;
import com.concertly.backend.repository.*;
import com.concertly.backend.security.AuthRateLimiter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** A2: topluluk türü filtresi aynı türün tüm yazımlarını aynı sayar; veri değişmez. */
class CommunityTypeFilterTest {

    private final List<Community> all = new ArrayList<>();
    private CommunityRepository repo;
    private CommunityService service;

    private void community(long id, String name, String type) {
        Community c = new Community();
        ReflectionTestUtils.setField(c, "id", id);
        c.setName(name);
        c.setType(type);
        c.setVisibility("PUBLIC");
        c.setApprovalStatus("APPROVED");
        all.add(c);
    }

    @BeforeEach
    void setUp() {
        community(1, "Istanbul Rock Sahnesi", "Rock");
        community(2, "Festivalciler", "Festival");
        community(3, "Elektronik Gece", "Elektronik");
        community(4, "Ankara Konser Grubu", "Sehir");   // DataSeeder yazımı
        community(5, "Caz Severler", "Caz");
        community(6, "Kadıköy Konser", "Şehir");        // mobil yazımı
        community(7, "Karışık", "Diğer");               // mobil yazımı
        community(8, "Eski Kayıt", "Diger");            // sunucu varsayılanı
        community(9, "Pop Sever", "Pop");
        community(10, "Rap Sahnesi", "Rap");
        community(11, "Tuhaf Tür", "Opera Sanatı");     // bilinmeyen tür

        repo = mock(CommunityRepository.class);
        when(repo.findAll()).thenReturn(all);
        // Arama: adında "konser" geçenler (Sehir + Şehir kayıtları)
        when(repo.search("konser")).thenReturn(List.of(all.get(3), all.get(5)));

        CommunityMemberRepository members = mock(CommunityMemberRepository.class);
        when(members.countActiveByCommunityIdIn(any())).thenReturn(List.of());
        CommunityPostRepository posts = mock(CommunityPostRepository.class);
        when(posts.countByCommunityIdIn(any())).thenReturn(List.of());

        service = new CommunityService(repo, members, posts, mock(CommunityPostLikeRepository.class),
                mock(CommunityPostCommentRepository.class), mock(CommunityPostPollOptionRepository.class),
                mock(CommunityPostPollVoteRepository.class), mock(UserRepository.class),
                mock(NotificationService.class), mock(NotificationRepository.class),
                mock(ModerationService.class), mock(ContentLimitService.class), new AuthRateLimiter());
    }

    private List<Long> ids(String type, String q) {
        return service.getAllCommunities(type, q, null).stream().map(CommunityResponse::getId).toList();
    }

    @Test
    void cityFilterFindsTheSeededSehirRecord() {
        assertEquals(List.of(4L, 6L), ids("Şehir", null));
    }

    @Test
    void sehirAndSehirWithCedillaAndCityGiveTheSameResult() {
        assertEquals(ids("Şehir", null), ids("Sehir", null));
        assertEquals(ids("Şehir", null), ids("city", null));
    }

    @Test
    void otherSpellingsGiveTheSameResult() {
        assertEquals(List.of(7L, 8L), ids("Diğer", null));
        assertEquals(ids("Diğer", null), ids("Diger", null));
        assertEquals(ids("Diğer", null), ids("other", null));
    }

    @ParameterizedTest
    @CsvSource({ "rock,1", "ROCK,1", "festival,2", "FESTİVAL,-1", "electronic,3", "ELEKTRONIK,3", "jazz,5", "caz,5" })
    void caseAndLanguageVariantsWork(String filter, long expected) {
        List<Long> result = ids(filter, null);
        if (expected < 0) {
            // Türkçe büyük İ ile yazılmış İngilizce kelime bilinen bir yazım değil; boş döner ama hata vermez
            assertTrue(result.isEmpty());
        } else {
            assertEquals(List.of(expected), result);
        }
    }

    @Test
    void existingFiltersStillWork() {
        assertEquals(List.of(1L), ids("Rock", null));
        assertEquals(List.of(2L), ids("Festival", null));
        assertEquals(List.of(3L), ids("Elektronik", null));
        assertEquals(List.of(5L), ids("Caz", null));
    }

    @Test
    void newPopRapOtherFiltersWork() {
        assertEquals(List.of(9L), ids("Pop", null));
        assertEquals(List.of(10L), ids("Rap", null));
        assertEquals(List.of(7L, 8L), ids("Diğer", null));
    }

    @Test
    void filterWithSearchUsesTheSameRule() {
        // Eskiden arama+filtre equalsIgnoreCase kullanıyordu: "Şehir" ile "Sehir" kaydı kaçıyordu
        assertEquals(List.of(4L, 6L), ids("Şehir", "konser"));
        assertEquals(ids("Şehir", "konser"), ids("Sehir", "konser"));
        assertEquals(List.of(), ids("Rock", "konser"));
    }

    @Test
    void unknownTypeDoesNotBreakAndMatchesItselfCaseInsensitively() {
        assertEquals(List.of(11L), ids("opera sanatı", null));
        assertEquals(List.of(), ids("Hiç Olmayan", null));
    }

    @Test
    void noFilterReturnsEverything() {
        assertEquals(11, ids(null, null).size());
        assertEquals(11, ids("  ", null).size());
    }

    @Test
    void typeFilterNoLongerUsesTheExactMatchQuery() {
        ids("Şehir", null);
        verify(repo, never()).findByType(anyString());
    }
}
