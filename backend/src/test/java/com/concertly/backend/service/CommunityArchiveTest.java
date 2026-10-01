package com.concertly.backend.service;

import com.concertly.backend.dto.response.CommunityResponse;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import com.concertly.backend.security.AuthRateLimiter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** B1-bos: sahipsiz kalip arsivlenen toplulukta yeni uyelik girisi 409 COMMUNITY_ARCHIVED ile kapanir. */
class CommunityArchiveTest {

    private static final long ARCH = 10, LIVE = 20;

    private final Map<Long, Community> communities = new HashMap<>();
    private final Map<Long, User> users = new HashMap<>();
    private final Map<String, CommunityMember> members = new HashMap<>();

    private CommunityMemberRepository memberRepo;
    private NotificationService notifications;
    private CommunityService service;

    private static <T> T withId(T e, long id) {
        ReflectionTestUtils.setField(e, "id", id);
        return e;
    }

    private Community community(long id, String visibility, boolean archived) {
        Community c = withId(new Community(), id);
        c.setName("c" + id);
        c.setVisibility(visibility);
        c.setApprovalStatus("APPROVED");
        c.setInviteCode("CODE" + id);
        if (archived) c.setArchivedAt(LocalDateTime.now());
        communities.put(id, c);
        return c;
    }

    private CommunityMember member(long userId, long communityId, String role, String status) {
        CommunityMember m = new CommunityMember();
        m.setUser(users.get(userId));
        m.setCommunity(communities.get(communityId));
        m.setRole(role);
        m.setStatus(status);
        members.put(userId + ":" + communityId, m);
        return m;
    }

    private static void assertArchived(ResponseStatusException e) {
        assertEquals(HttpStatus.CONFLICT, e.getStatusCode());
        assertEquals("COMMUNITY_ARCHIVED", e.getReason());
    }

    @BeforeEach
    void setUp() {
        for (long id = 1; id <= 9; id++) {
            User u = withId(new User(), id);
            u.setUsername("u" + id);
            users.put(id, u);
        }
        // Arsivli: sahipsiz. Uye 2 = ACTIVE MODERATOR, 3 = PENDING, 4 = INVITED, 5 = ACTIVE MEMBER
        community(ARCH, "PUBLIC", true).setOwner(null);
        community(LIVE, "PUBLIC", false);
        for (long cid : new long[]{ARCH, LIVE}) {
            member(2, cid, "MODERATOR", "ACTIVE");
            member(3, cid, "MEMBER", "PENDING");
            member(4, cid, "MEMBER", "INVITED");
            member(5, cid, "MEMBER", "ACTIVE");
        }

        CommunityRepository communityRepo = mock(CommunityRepository.class);
        memberRepo = mock(CommunityMemberRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        notifications = mock(NotificationService.class);

        when(communityRepo.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(communities.get(i.<Long>getArgument(0))));
        when(communityRepo.findByInviteCode(anyString())).thenAnswer(i -> communities.values().stream()
                .filter(c -> i.getArgument(0).equals(c.getInviteCode())).findFirst());
        when(userRepo.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(users.get(i.<Long>getArgument(0))));
        when(memberRepo.findByUserIdAndCommunityId(anyLong(), anyLong()))
                .thenAnswer(i -> Optional.ofNullable(members.get(i.<Long>getArgument(0) + ":" + i.<Long>getArgument(1))));
        when(memberRepo.existsByUserIdAndCommunityIdAndStatus(anyLong(), anyLong(), anyString()))
                .thenAnswer(i -> {
                    CommunityMember m = members.get(i.<Long>getArgument(0) + ":" + i.<Long>getArgument(1));
                    return m != null && m.getStatus().equals(i.getArgument(2));
                });
        when(memberRepo.save(any())).thenAnswer(i -> {
            CommunityMember m = i.getArgument(0);
            members.put(m.getUser().getId() + ":" + m.getCommunity().getId(), m);
            return m;
        });

        service = new CommunityService(communityRepo, memberRepo, mock(CommunityPostRepository.class),
                mock(CommunityPostLikeRepository.class), mock(CommunityPostCommentRepository.class),
                mock(CommunityPostPollOptionRepository.class), mock(CommunityPostPollVoteRepository.class),
                userRepo, notifications, mock(NotificationRepository.class), mock(ModerationService.class),
                mock(ContentLimitService.class), new AuthRateLimiter());
    }

    @Test
    void joinArchivedCommunityByNewUserIs409AndSavesNothing() {
        assertArchived(assertThrows(ResponseStatusException.class, () -> service.joinCommunity(7L, ARCH)));
        verify(memberRepo, never()).save(any());
        verifyNoInteractions(notifications);
    }

    @Test
    void joinArchivedPrivateCommunityDoesNotCreatePendingRequestOrNotifyManagers() {
        communities.get(ARCH).setVisibility("PRIVATE");
        assertArchived(assertThrows(ResponseStatusException.class, () -> service.joinCommunity(7L, ARCH)));
        verify(memberRepo, never()).save(any());
        verifyNoInteractions(notifications);
    }

    @Test
    void joinArchivedWithPendingOrInvitedRowDoesNotActivateIt() {
        assertArchived(assertThrows(ResponseStatusException.class, () -> service.joinCommunity(3L, ARCH)));
        assertArchived(assertThrows(ResponseStatusException.class, () -> service.joinCommunity(4L, ARCH)));
        assertEquals("PENDING", members.get("3:" + ARCH).getStatus());
        assertEquals("INVITED", members.get("4:" + ARCH).getStatus());
        verify(memberRepo, never()).save(any());
    }

    @Test
    void alreadyActiveMemberRejoinStaysIdempotentOnArchived() {
        assertDoesNotThrow(() -> service.joinCommunity(5L, ARCH));
        verify(memberRepo, never()).save(any());
    }

    @Test
    void joinByInviteCodeOnArchivedIs409ForNewPendingAndInvited() {
        assertArchived(assertThrows(ResponseStatusException.class, () -> service.joinByInviteCode(7L, "CODE" + ARCH)));
        assertArchived(assertThrows(ResponseStatusException.class, () -> service.joinByInviteCode(3L, "CODE" + ARCH)));
        assertArchived(assertThrows(ResponseStatusException.class, () -> service.joinByInviteCode(4L, "CODE" + ARCH)));
        assertEquals("PENDING", members.get("3:" + ARCH).getStatus());
        assertNull(members.get("7:" + ARCH));
        verify(memberRepo, never()).save(any());
    }

    @Test
    void joinByInviteCodeAlreadyActiveOnArchivedIsIdempotent() {
        assertDoesNotThrow(() -> service.joinByInviteCode(5L, "CODE" + ARCH));
        verify(memberRepo, never()).save(any());
    }

    @Test
    void inviteUserToArchivedIs409NoRowNoNotification() {
        assertArchived(assertThrows(ResponseStatusException.class, () -> service.inviteUser(2L, ARCH, 7L)));
        assertNull(members.get("7:" + ARCH));
        verify(memberRepo, never()).save(any());
        verifyNoInteractions(notifications);
    }

    @Test
    void inviteUserCannotPromoteArchivedPendingRequest() {
        assertArchived(assertThrows(ResponseStatusException.class, () -> service.inviteUser(2L, ARCH, 3L)));
        assertEquals("PENDING", members.get("3:" + ARCH).getStatus());
    }

    @Test
    void approveRequestOnArchivedIs409AndRequestStaysPending() {
        assertArchived(assertThrows(ResponseStatusException.class, () -> service.approveRequest(2L, ARCH, 3L)));
        assertEquals("PENDING", members.get("3:" + ARCH).getStatus());
        verify(memberRepo, never()).save(any());
        verifyNoInteractions(notifications);
    }

    @Test
    void acceptInviteOnArchivedIs409() {
        assertArchived(assertThrows(ResponseStatusException.class, () -> service.acceptInvite(4L, ARCH)));
        assertEquals("INVITED", members.get("4:" + ARCH).getStatus());
    }

    @Test
    void adminCannotBypassArchiveForApproveOrJoin() {
        Role adminRole = new Role();
        adminRole.setName("ROLE_ADMIN");
        users.get(9L).setRoles(new HashSet<>(Set.of(adminRole)));
        assertArchived(assertThrows(ResponseStatusException.class, () -> service.approveRequest(9L, ARCH, 3L)));
        assertArchived(assertThrows(ResponseStatusException.class, () -> service.joinCommunity(9L, ARCH)));
    }

    @Test
    void nonArchivedCommunityBehavesAsBefore() {
        assertDoesNotThrow(() -> service.joinCommunity(7L, LIVE));
        assertEquals("ACTIVE", members.get("7:" + LIVE).getStatus());

        assertDoesNotThrow(() -> service.joinByInviteCode(8L, "CODE" + LIVE));
        assertEquals("ACTIVE", members.get("8:" + LIVE).getStatus());

        assertDoesNotThrow(() -> service.approveRequest(2L, LIVE, 3L));
        assertEquals("ACTIVE", members.get("3:" + LIVE).getStatus());
        verify(notifications).sendSystem(eq(3L), eq("community_request_approved"), eq("community"), eq(LIVE), anyString());

        assertDoesNotThrow(() -> service.inviteUser(2L, LIVE, 6L));
        assertEquals("INVITED", members.get("6:" + LIVE).getStatus());
        verify(notifications).send(eq(6L), eq(2L), eq("community_invite"), eq("community"), eq(LIVE));

        assertDoesNotThrow(() -> service.acceptInvite(4L, LIVE));
        assertEquals("ACTIVE", members.get("4:" + LIVE).getStatus());
    }

    @Test
    void responseArchivedFlagReflectsArchivedAt() {
        CommunityResponse archived = CommunityResponse.from(communities.get(ARCH), 1, 0, null, null, null);
        CommunityResponse live = CommunityResponse.from(communities.get(LIVE), 1, 0, null, null, null);
        assertTrue(archived.isArchived());
        assertFalse(live.isArchived());
        assertNull(communities.get(LIVE).getArchivedAt(), "mevcut topluluklar (null) arsivli sayilmaz");
    }

    @Test
    void archivedCommunityStaysReadableAndCannotBeTransferred() {
        CommunityResponse r = service.getCommunityById(ARCH, 5L);
        assertTrue(r.isArchived());
        assertNull(r.getOwnerId());
        // sahipsiz topluluk: kimse sahip olarak devredemez
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.transferOwnership(2L, ARCH, 5L));
        assertEquals(HttpStatus.FORBIDDEN, e.getStatusCode());
    }
}
