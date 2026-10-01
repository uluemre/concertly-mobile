package com.concertly.backend.service;

import com.concertly.backend.dto.request.CreateCommunityRequest;
import com.concertly.backend.model.Community;
import com.concertly.backend.model.CommunityMember;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.*;
import com.concertly.backend.security.AuthRateLimiter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** A1: topluluk açıklaması en fazla 255 karakter; fazlası DB hatası yerine 400 + kod. */
class CommunityDescriptionLimitTest {

    private CommunityRepository communities;
    private CommunityService service;
    private Community existing;

    @BeforeEach
    void setUp() {
        communities = mock(CommunityRepository.class);
        CommunityMemberRepository members = mock(CommunityMemberRepository.class);
        UserRepository users = mock(UserRepository.class);

        User owner = new User();
        ReflectionTestUtils.setField(owner, "id", 1L);
        when(users.findById(1L)).thenReturn(Optional.of(owner));

        existing = new Community();
        ReflectionTestUtils.setField(existing, "id", 10L);
        existing.setName("Eski");
        existing.setDescription("eski açıklama");
        existing.setOwner(owner);
        when(communities.findById(10L)).thenReturn(Optional.of(existing));
        when(communities.save(any(Community.class))).thenAnswer(i -> {
            Community c = i.getArgument(0);
            if (c.getId() == null) ReflectionTestUtils.setField(c, "id", 11L);
            return c;
        });

        CommunityMember ownerMember = new CommunityMember();
        ownerMember.setUser(owner);
        ownerMember.setCommunity(existing);
        ownerMember.setRole("OWNER");
        ownerMember.setStatus("ACTIVE");
        when(members.findByUserIdAndCommunityId(1L, 10L)).thenReturn(Optional.of(ownerMember));

        service = new CommunityService(communities, members, mock(CommunityPostRepository.class),
                mock(CommunityPostLikeRepository.class), mock(CommunityPostCommentRepository.class),
                mock(CommunityPostPollOptionRepository.class), mock(CommunityPostPollVoteRepository.class),
                users, mock(NotificationService.class), mock(NotificationRepository.class),
                mock(ModerationService.class), mock(ContentLimitService.class), new AuthRateLimiter());
    }

    private static CreateCommunityRequest request(String description) {
        CreateCommunityRequest r = new CreateCommunityRequest();
        r.setName("Rock Sahnesi");
        r.setDescription(description);
        return r;
    }

    private static String reason(Runnable call) {
        return assertThrows(ResponseStatusException.class, call::run).getReason();
    }

    @Test
    void create_acceptsExactly255Characters() {
        String desc = "a".repeat(255);
        assertEquals(desc, service.createCommunity(1L, request(desc)).getDescription());
    }

    @Test
    void create_rejects256CharactersWithoutSaving() {
        assertEquals("COMMUNITY_DESCRIPTION_TOO_LONG", reason(() -> service.createCommunity(1L, request("a".repeat(256)))));
        verify(communities, never()).save(any());
    }

    @Test
    void create_countsEmojiAsOneCharacterLikeTheDatabase() {
        // 255 emoji: Java'da 510 birim, Postgres'te 255 karakter → kabul
        String desc = "🎸".repeat(255);
        assertDoesNotThrow(() -> service.createCommunity(1L, request(desc)));
    }

    @Test
    void update_acceptsExactly255Characters() {
        String desc = "b".repeat(255);
        service.updateCommunity(1L, 10L, request(desc));
        assertEquals(desc, existing.getDescription());
    }

    @Test
    void update_rejects256CharactersAndKeepsTheOldDescription() {
        assertEquals("COMMUNITY_DESCRIPTION_TOO_LONG",
                reason(() -> service.updateCommunity(1L, 10L, request("b".repeat(256)))));
        assertEquals("eski açıklama", existing.getDescription());
        assertEquals("Eski", existing.getName(), "hiçbir alan değişmez");
        verify(communities, never()).save(any());
    }

    @Test
    void emptyOrMissingDescriptionStillWorks() {
        assertDoesNotThrow(() -> service.createCommunity(1L, request(null)));
        assertDoesNotThrow(() -> service.createCommunity(1L, request("")));
    }
}
