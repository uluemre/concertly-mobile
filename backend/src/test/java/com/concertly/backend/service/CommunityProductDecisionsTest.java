package com.concertly.backend.service;

import com.concertly.backend.config.ShareLinkConfig;
import com.concertly.backend.controller.ShareController;
import com.concertly.backend.dto.request.CreateCommunityRequest;
import com.concertly.backend.dto.response.CommunityMemberResponse;
import com.concertly.backend.dto.response.CommunityPostCommentResponse;
import com.concertly.backend.dto.response.CommunityPostResponse;
import com.concertly.backend.dto.response.CommunityResponse;
import com.concertly.backend.dto.response.ReportResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import com.concertly.backend.security.AuthRateLimiter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Toplu ürün kararları (Batch 1): B5, B6, B7, D7/SEC-C06, SEC-C02, SEC-C03, C2, C4, B11.
 *
 * Kullanıcılar: 1 sahip, 2 moderatör, 3 üye, 4 dışarıdan, 5 admin, 6/7 yardımcı.
 * Topluluklar bu dosyada test başına kurulur; varsayılan APP(10): PRIVATE + APPROVED, sahip 1,
 * üyeler 1 OWNER / 2 MODERATOR / 3 MEMBER.
 */
class CommunityProductDecisionsTest {

    private static final long APP = 10, PUBC = 20, PEN = 30;
    private static final long POST = 100, COMMENT = 500;

    private final Map<Long, Community> communities = new HashMap<>();
    private final Map<Long, CommunityPost> posts = new HashMap<>();
    private final Map<Long, CommunityPostComment> comments = new HashMap<>();
    private final Map<Long, User> users = new HashMap<>();
    private final Map<String, CommunityMember> members = new HashMap<>();

    private CommunityRepository communityRepo;
    private CommunityMemberRepository memberRepo;
    private CommunityPostRepository postRepo;
    private CommunityPostCommentRepository commentRepo;
    private NotificationService notifications;
    private CommunityService service;

    private static <T> T withId(T e, long id) {
        ReflectionTestUtils.setField(e, "id", id);
        return e;
    }

    private User user(long id, boolean admin) {
        User u = withId(new User(), id);
        u.setUsername("u" + id);
        if (admin) {
            Role r = new Role();
            r.setName("ROLE_ADMIN");
            u.setRoles(new HashSet<>(Set.of(r)));
        }
        users.put(id, u);
        return u;
    }

    private Community community(long id, String visibility, String approval, long ownerId) {
        Community c = withId(new Community(), id);
        c.setName("Topluluk" + id);
        c.setType("Rock");
        c.setEmoji("🎸");
        c.setDescription("kisa aciklama " + id);
        c.setVisibility(visibility);
        c.setApprovalStatus(approval);
        c.setOwner(users.get(ownerId));
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

    private CommunityPost post(long id, long communityId, long authorId, String content) {
        CommunityPost p = withId(new CommunityPost(), id);
        p.setCommunity(communities.get(communityId));
        p.setUser(users.get(authorId));
        p.setContent(content);
        posts.put(id, p);
        return p;
    }

    private CommunityPostComment comment(long id, long postId, long authorId, String content) {
        CommunityPostComment c = withId(new CommunityPostComment(), id);
        c.setCommunityPost(posts.get(postId));
        c.setUser(users.get(authorId));
        c.setContent(content);
        comments.put(id, c);
        return c;
    }

    private static int statusOf(ResponseStatusException e) {
        return e.getStatusCode().value();
    }

    private static CreateCommunityRequest req(String name, String description, String visibility) {
        CreateCommunityRequest r = new CreateCommunityRequest();
        r.setName(name);
        r.setDescription(description);
        r.setVisibility(visibility);
        return r;
    }

    @BeforeEach
    void setUp() {
        user(1, false);
        user(2, false);
        user(3, false);
        user(4, false);
        user(5, true);
        user(6, false);
        user(7, false);

        community(APP, "PRIVATE", "APPROVED", 1);
        member(1, (int) APP, "OWNER", "ACTIVE");
        member(2, (int) APP, "MODERATOR", "ACTIVE");
        member(3, (int) APP, "MEMBER", "ACTIVE");

        communityRepo = mock(CommunityRepository.class);
        memberRepo = mock(CommunityMemberRepository.class);
        postRepo = mock(CommunityPostRepository.class);
        commentRepo = mock(CommunityPostCommentRepository.class);
        notifications = mock(NotificationService.class);
        UserRepository userRepo = mock(UserRepository.class);

        when(communityRepo.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(communities.get(i.<Long>getArgument(0))));
        when(communityRepo.findAll()).thenAnswer(i -> new ArrayList<>(communities.values()));
        when(communityRepo.search(anyString())).thenAnswer(i -> new ArrayList<>(communities.values()));
        when(communityRepo.findByTypeIn(anyList())).thenAnswer(i -> List.of());
        when(communityRepo.findByInviteCode(anyString())).thenAnswer(i -> communities.values().stream()
                .filter(c -> i.getArgument(0).equals(c.getInviteCode())).findFirst());
        when(communityRepo.findByApprovalStatusOrderByCreatedAtAsc(anyString())).thenAnswer(i -> communities.values().stream()
                .filter(c -> i.getArgument(0).equals(c.getApprovalStatus())).toList());
        when(communityRepo.save(any())).thenAnswer(i -> i.getArgument(0));

        when(userRepo.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(users.get(i.<Long>getArgument(0))));
        when(memberRepo.findByUserIdAndCommunityId(anyLong(), anyLong()))
                .thenAnswer(i -> Optional.ofNullable(members.get(i.<Long>getArgument(0) + ":" + i.<Long>getArgument(1))));
        when(memberRepo.findByUserId(anyLong())).thenAnswer(i -> members.values().stream()
                .filter(m -> m.getUser().getId().equals(i.getArgument(0))).toList());
        when(memberRepo.existsByUserIdAndCommunityIdAndStatus(anyLong(), anyLong(), anyString()))
                .thenAnswer(i -> {
                    CommunityMember m = members.get(i.<Long>getArgument(0) + ":" + i.<Long>getArgument(1));
                    return m != null && m.getStatus().equals(i.getArgument(2));
                });
        when(memberRepo.findByCommunityIdAndStatusOrderByJoinedAtDesc(anyLong(), anyString()))
                .thenAnswer(i -> members.values().stream()
                        .filter(m -> m.getCommunity().getId().equals(i.getArgument(0)) && m.getStatus().equals(i.getArgument(1)))
                        .toList());
        when(memberRepo.countByCommunityIdAndStatus(anyLong(), anyString())).thenAnswer(i -> (long) members.values().stream()
                .filter(m -> m.getCommunity().getId().equals(i.getArgument(0)) && m.getStatus().equals(i.getArgument(1)))
                .count());
        when(memberRepo.save(any())).thenAnswer(i -> {
            CommunityMember m = i.getArgument(0);
            members.put(m.getUser().getId() + ":" + m.getCommunity().getId(), m);
            return m;
        });
        doAnswer(i -> {
            CommunityMember m = i.getArgument(0);
            members.remove(m.getUser().getId() + ":" + m.getCommunity().getId());
            return null;
        }).when(memberRepo).delete(any());

        when(postRepo.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(posts.get(i.<Long>getArgument(0))));
        when(postRepo.findByCommunityIdOrderByCreatedAtDesc(anyLong())).thenAnswer(i -> posts.values().stream()
                .filter(p -> p.getCommunity().getId().equals(i.getArgument(0))).toList());
        when(postRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(commentRepo.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(comments.get(i.<Long>getArgument(0))));
        when(commentRepo.findByCommunityPostIdOrderByCreatedAtAsc(anyLong())).thenAnswer(i -> comments.values().stream()
                .filter(c -> c.getCommunityPost().getId().equals(i.getArgument(0))).toList());
        when(commentRepo.save(any())).thenAnswer(i -> i.getArgument(0));

        service = new CommunityService(communityRepo, memberRepo, postRepo, mock(CommunityPostLikeRepository.class),
                commentRepo, mock(CommunityPostPollOptionRepository.class), mock(CommunityPostPollVoteRepository.class),
                userRepo, notifications, mock(NotificationRepository.class), mock(ModerationService.class),
                mock(ContentLimitService.class), new AuthRateLimiter());
    }

    private Community pending(long id, long hoursAgo) {
        Community c = community(id, "PUBLIC", "PENDING", 1);
        c.setReviewRequestedAt(LocalDateTime.now().minusHours(hoursAgo));
        member(1, (int) id, "OWNER", "ACTIVE");
        member(3, (int) id, "MEMBER", "ACTIVE");
        return c;
    }

    private static void assertCode(int status, String reason, ResponseStatusException e) {
        assertEquals(status, e.getStatusCode().value());
        assertEquals(reason, e.getReason());
    }

    private boolean listed(long communityId, Long viewer) {
        return service.getAllCommunities(null, null, viewer).stream().anyMatch(c -> c.getId() == communityId);
    }

    // ── B5: inceleme süreleri ────────────────────────────────────────────────────

    @Test
    void b5_pendingYoungerThan24hIsHiddenFromDiscoveryExceptOwnerAndAdmin() {
        pending(PEN, 1);
        assertFalse(listed(PEN, 4L));
        assertFalse(listed(PEN, null));
        assertFalse(listed(PEN, 3L), "üye bile keşifte görmez");
        assertTrue(listed(PEN, 1L), "sahip görür");
        assertTrue(listed(PEN, 5L), "admin görür");
        // arama ve öneri aynı kuralı izler
        assertTrue(service.getAllCommunities(null, "Topluluk", 4L).stream().noneMatch(c -> c.getId() == PEN));
        assertTrue(service.getRecommendedCommunities(List.of("rock"), 4L).stream().noneMatch(c -> c.getId() == PEN));
        assertTrue(service.getAllCommunities("Rock", null, 4L).stream().noneMatch(c -> c.getId() == PEN));
    }

    @Test
    void b5_pendingOlderThan24hIsListedButStillPending() {
        pending(PEN, 25);
        List<CommunityResponse> list = service.getAllCommunities(null, null, 4L);
        CommunityResponse r = list.stream().filter(c -> c.getId() == PEN).findFirst().orElseThrow();
        assertEquals("PENDING", r.getApprovalStatus());
        assertNotNull(r.getReviewRequestedAt());
    }

    @Test
    void b5_nullReviewRequestedAtFallsBackToCreatedAt() {
        Community c = pending(PEN, 1);
        c.setReviewRequestedAt(null); // createdAt = şimdi → <24 sa
        assertFalse(listed(PEN, 4L));
        assertEquals(c.getCreatedAt(), c.getReviewStart());
    }

    @Test
    void b5_pendingClosesEveryNewMembershipEntryWith409() {
        Community c = pending(PEN, 30);
        c.setInviteCode("PENCODE1");
        member(6, (int) PEN, "MEMBER", "INVITED");
        member(7, (int) PEN, "MEMBER", "PENDING");

        assertCode(409, "COMMUNITY_PENDING_REVIEW", assertThrows(ResponseStatusException.class, () -> service.joinCommunity(4L, PEN)));
        assertCode(409, "COMMUNITY_PENDING_REVIEW", assertThrows(ResponseStatusException.class, () -> service.joinByInviteCode(4L, "PENCODE1")));
        assertCode(409, "COMMUNITY_PENDING_REVIEW", assertThrows(ResponseStatusException.class, () -> service.inviteUser(1L, PEN, 4L)));
        assertCode(409, "COMMUNITY_PENDING_REVIEW", assertThrows(ResponseStatusException.class, () -> service.acceptInvite(6L, PEN)));
        assertCode(409, "COMMUNITY_PENDING_REVIEW", assertThrows(ResponseStatusException.class, () -> service.approveRequest(1L, PEN, 7L)));
        assertFalse(members.containsKey("4:" + PEN));
        assertEquals("PENDING", members.get("7:" + PEN).getStatus());
        assertEquals("INVITED", members.get("6:" + PEN).getStatus());
    }

    @Test
    void b5_alreadyActiveMemberKeepsAccessWhilePending() {
        pending(PEN, 2);
        assertDoesNotThrow(() -> service.joinCommunity(3L, PEN), "ACTIVE üyeye idempotent yanıt");
        assertDoesNotThrow(() -> service.getCommunityPosts(PEN, 3L));
        assertDoesNotThrow(() -> service.getMembers(PEN, 3L));
        assertDoesNotThrow(() -> service.getCommunityPosts(PEN, 1L), "sahip");
        assertDoesNotThrow(() -> service.getCommunityPosts(PEN, 5L), "admin");
    }

    @Test
    void b5_outsiderCannotReadPostsOrMembersWhilePending() {
        pending(PEN, 30);
        assertCode(403, "COMMUNITY_PENDING_REVIEW", assertThrows(ResponseStatusException.class, () -> service.getCommunityPosts(PEN, 4L)));
        assertCode(403, "COMMUNITY_PENDING_REVIEW", assertThrows(ResponseStatusException.class, () -> service.getCommunityPosts(PEN, null)));
        assertCode(403, "COMMUNITY_PENDING_REVIEW", assertThrows(ResponseStatusException.class, () -> service.getMembers(PEN, 4L)));
        posts.put(POST, post(POST, PEN, 1, "x"));
        assertCode(403, "COMMUNITY_PENDING_REVIEW", assertThrows(ResponseStatusException.class, () -> service.getPostComments(PEN, POST, 4L)));
    }

    @Test
    void b5_olderThan7DaysIsAutoRejectedByScheduler() {
        Community stale = pending(PEN, 24 * 7 + 1);
        Community fresh = community(31, "PUBLIC", "PENDING", 1);
        fresh.setReviewRequestedAt(LocalDateTime.now().minusDays(6));
        Community approved = community(32, "PUBLIC", "APPROVED", 1);
        approved.setReviewRequestedAt(LocalDateTime.now().minusDays(30)); // onaylı olana dokunulmaz

        assertEquals(1, service.autoRejectStaleReviews());

        assertEquals("REJECTED", stale.getApprovalStatus());
        assertNotNull(stale.getReviewedAt());
        verify(notifications).sendSystem(eq(1L), eq("community_rejected"), eq("community"), eq(PEN), anyString());
        assertEquals("PENDING", fresh.getApprovalStatus());
        assertEquals("APPROVED", approved.getApprovalStatus());
        verify(communityRepo, times(1)).save(stale);
    }

    @Test
    void b5_staleIsRejectedLazilyBeforeSchedulerRuns() {
        Community stale = pending(PEN, 24 * 8);
        assertFalse(listed(PEN, 4L));
        assertFalse(listed(PEN, 1L), "REJECTED kuralı: sahip bile keşifte görmez");
        assertThrows(ResourceNotFoundException.class, () -> service.getCommunityById(PEN, 4L));
        assertThrows(ResourceNotFoundException.class, () -> service.joinCommunity(4L, PEN));
        assertEquals("REJECTED", service.getCommunityById(PEN, 1L).getApprovalStatus(), "sahip durumu REJECTED görür");
        assertTrue(service.getPendingForReview().isEmpty(), "admin kuyruğunda yok");
        assertEquals("PENDING", stale.getApprovalStatus(), "DB'ye yazma zamanlanmış görevde");
    }

    @Test
    void b5_approveReturnsToNormalAndRejectRemovesFromDiscovery() {
        pending(PEN, 1);
        service.approveCommunity(PEN);
        assertEquals("APPROVED", communities.get(PEN).getApprovalStatus());
        assertTrue(listed(PEN, 4L), "onay sonrası 24 sa beklemeden listelenir");
        assertDoesNotThrow(() -> service.joinCommunity(4L, PEN));
        assertEquals("ACTIVE", members.get("4:" + PEN).getStatus());

        Community c2 = pending(31, 30);
        service.rejectCommunity(31L);
        assertEquals("REJECTED", c2.getApprovalStatus());
        assertFalse(listed(31, 4L));
        assertThrows(ResourceNotFoundException.class, () -> service.joinCommunity(4L, 31L));
        verify(notifications).sendSystem(eq(1L), eq("community_rejected"), eq("community"), eq(31L), anyString());
    }

    // ── B6: PUBLIC'e geçiş bekleyen istekleri kabul eder ─────────────────────────

    @Test
    void b6_switchingToPublicAcceptsAllPendingRequests() {
        member(6, (int) APP, "MEMBER", "PENDING");
        member(7, (int) APP, "MEMBER", "PENDING");
        member(4, (int) APP, "MEMBER", "BANNED");

        service.updateCommunity(5L, APP, req(null, null, "PUBLIC")); // admin: yeniden incelemeye girmez

        assertEquals("ACTIVE", members.get("6:" + APP).getStatus());
        assertEquals("ACTIVE", members.get("7:" + APP).getStatus());
        assertEquals("BANNED", members.get("4:" + APP).getStatus(), "yasaklı kabul edilmez");
        verify(notifications).sendSystem(eq(6L), eq("community_request_approved"), eq("community"), eq(APP), anyString());
        verify(notifications).sendSystem(eq(7L), eq("community_request_approved"), eq("community"), eq(APP), anyString());
    }

    @Test
    void b6b5_moderatorPublicSwitchOnApprovedRePendsAndKeepsRequestsPending() {
        member(6, (int) APP, "MEMBER", "PENDING");
        service.updateCommunity(2L, APP, req(null, null, "PUBLIC"));
        assertEquals("PENDING", communities.get(APP).getApprovalStatus());
        assertEquals("PENDING", members.get("6:" + APP).getStatus());
        verify(notifications, never()).sendSystem(anyLong(), eq("community_request_approved"), anyString(), anyLong(), anyString());
    }

    @Test
    void b6b5_publicSwitchWhileAlreadyPendingKeepsRequestsPending() {
        Community c = community(PEN, "PRIVATE", "PENDING", 1);
        c.setReviewRequestedAt(LocalDateTime.now().minusHours(1));
        member(1, (int) PEN, "OWNER", "ACTIVE");
        member(6, (int) PEN, "MEMBER", "PENDING");
        service.updateCommunity(1L, PEN, req(null, null, "PUBLIC"));
        assertEquals("PENDING", members.get("6:" + PEN).getStatus());
        verify(notifications, never()).sendSystem(anyLong(), eq("community_request_approved"), anyString(), anyLong(), anyString());
    }

    @Test
    void b6b5_approvingPublicCommunityAcceptsPendingRequests() {
        pending(PEN, 1);
        member(6, (int) PEN, "MEMBER", "PENDING");
        service.approveCommunity(PEN);
        assertEquals("ACTIVE", members.get("6:" + PEN).getStatus());
        verify(notifications).sendSystem(eq(6L), eq("community_request_approved"), eq("community"), eq(PEN), anyString());
    }

    @Test
    void b6b5_approvingPrivateOrArchivedCommunityLeavesRequestsPending() {
        Community priv = community(PEN, "PRIVATE", "PENDING", 1);
        priv.setReviewRequestedAt(LocalDateTime.now().minusHours(1));
        member(6, (int) PEN, "MEMBER", "PENDING");
        service.approveCommunity(PEN);
        assertEquals("PENDING", members.get("6:" + PEN).getStatus());

        Community arch = community(31, "PUBLIC", "PENDING", 1);
        arch.setReviewRequestedAt(LocalDateTime.now().minusHours(1));
        arch.setArchivedAt(LocalDateTime.now());
        member(7, 31, "MEMBER", "PENDING");
        service.approveCommunity(31L);
        assertEquals("PENDING", members.get("7:31").getStatus());
    }

    @Test
    void bannedMemberGets403CommunityBannedOnJoinInviteCodeAndInvite() {
        Community pub = community(PUBC, "PUBLIC", "APPROVED", 1);
        pub.setInviteCode("BANCODE1");
        member(1, (int) PUBC, "OWNER", "ACTIVE");
        member(6, (int) PUBC, "MEMBER", "BANNED");
        assertCode(403, "COMMUNITY_BANNED", assertThrows(ResponseStatusException.class, () -> service.joinCommunity(6L, PUBC)));
        assertCode(403, "COMMUNITY_BANNED", assertThrows(ResponseStatusException.class, () -> service.joinByInviteCode(6L, "BANCODE1")));
        assertCode(403, "COMMUNITY_BANNED", assertThrows(ResponseStatusException.class, () -> service.inviteUser(1L, PUBC, 6L)));
        assertEquals("BANNED", members.get("6:" + PUBC).getStatus());
    }

    @Test
    void reportTargetTypeIsTrimmedUppercasedOnceForValidationAndSaving() {
        contentFixture();
        ModerationService moderation = mock(ModerationService.class);
        com.concertly.backend.controller.ModerationController controller =
                new com.concertly.backend.controller.ModerationController(moderation, service);
        com.concertly.backend.dto.request.ReportRequest r = new com.concertly.backend.dto.request.ReportRequest();
        r.setTargetType("  community_post ");
        r.setTargetId(POST);
        r.setReason("spam");
        try {
            // outsider (4) PRIVATE topluluğu göremez: dolgulu/küçük harf doğrulamayı atlatamaz
            org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                    new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("4:u4@test.local", null, List.of()));
            assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> controller.report(r))));
            verify(moderation, never()).report(anyLong(), anyString(), anyLong(), anyString());

            org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                    new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("3:u3@test.local", null, List.of()));
            controller.report(r);
            verify(moderation).report(3L, "COMMUNITY_POST", POST, "spam");
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    @Test
    void b6_otherVisibilityChangesDoNotAcceptRequests() {
        member(6, (int) APP, "MEMBER", "PENDING");
        service.updateCommunity(1L, APP, req(null, null, "SECRET"));
        assertEquals("PENDING", members.get("6:" + APP).getStatus());
        service.updateCommunity(1L, APP, req(null, null, "PRIVATE"));
        assertEquals("PENDING", members.get("6:" + APP).getStatus());
    }

    // ── B7: çıkarma = BANNED ──────────────────────────────────────────────────────

    @Test
    void b7_kickKeepsRowAsBannedAndBlocksEveryEntryPath() {
        community(PUBC, "PUBLIC", "APPROVED", 1);
        member(1, (int) PUBC, "OWNER", "ACTIVE");
        member(3, (int) PUBC, "MEMBER", "ACTIVE");
        communities.get(PUBC).setInviteCode("PUBCODE1");

        service.removeMember(1L, PUBC, 3L);

        CommunityMember row = members.get("3:" + PUBC);
        assertNotNull(row, "satır silinmez");
        assertEquals("BANNED", row.getStatus());
        verify(memberRepo, never()).delete(any());

        assertThrows(ResponseStatusException.class, () -> service.joinCommunity(3L, PUBC));
        assertThrows(ResponseStatusException.class, () -> service.joinByInviteCode(3L, "PUBCODE1"));
        assertThrows(ResponseStatusException.class, () -> service.inviteUser(1L, PUBC, 3L));
        assertThrows(IllegalArgumentException.class, () -> service.acceptInvite(3L, PUBC));
        assertEquals("BANNED", members.get("3:" + PUBC).getStatus());
    }

    @Test
    void b7_unbanDeletesRowAndUserCanJoinAgain() {
        community(PUBC, "PUBLIC", "APPROVED", 1);
        member(1, (int) PUBC, "OWNER", "ACTIVE");
        member(3, (int) PUBC, "MEMBER", "BANNED");

        List<CommunityMemberResponse> bans = service.getBannedMembers(1L, PUBC);
        assertEquals(1, bans.size());
        assertEquals(3L, bans.get(0).getUserId());
        assertEquals("BANNED", bans.get(0).getStatus());

        service.unbanMember(1L, PUBC, 3L);
        assertFalse(members.containsKey("3:" + PUBC));
        assertDoesNotThrow(() -> service.joinCommunity(3L, PUBC));
        assertEquals("ACTIVE", members.get("3:" + PUBC).getStatus());
        assertTrue(service.getBannedMembers(1L, PUBC).isEmpty());
    }

    @Test
    void b7_banListAndUnbanAreManagerOnly() {
        member(6, (int) APP, "MEMBER", "BANNED");
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.getBannedMembers(3L, APP))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.getBannedMembers(4L, APP))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.unbanMember(3L, APP, 6L))));
        assertEquals(1, service.getBannedMembers(2L, APP).size(), "moderatör");
        assertEquals(1, service.getBannedMembers(5L, APP).size(), "admin");
        assertThrows(ResourceNotFoundException.class, () -> service.unbanMember(1L, APP, 3L), "yasaklı olmayan");
        service.unbanMember(2L, APP, 6L);
        assertFalse(members.containsKey("6:" + APP));
    }

    @Test
    void b7_selfLeaveDeletesRowAndAllowsRejoin_bannedIsNotLeft() {
        community(PUBC, "PUBLIC", "APPROVED", 1);
        member(1, (int) PUBC, "OWNER", "ACTIVE");
        member(3, (int) PUBC, "MEMBER", "ACTIVE");
        member(6, (int) PUBC, "MEMBER", "BANNED");

        service.leaveCommunity(3L, PUBC);
        assertFalse(members.containsKey("3:" + PUBC));
        assertDoesNotThrow(() -> service.joinCommunity(3L, PUBC));

        // yasaklı kendi satırını silerek yasağı kaldıramaz
        assertCode(403, "COMMUNITY_BANNED", assertThrows(ResponseStatusException.class, () -> service.leaveCommunity(6L, PUBC)));
        assertEquals("BANNED", members.get("6:" + PUBC).getStatus());
    }

    @Test
    void b7_kickAuthorizationRulesStay() {
        // moderatör üyeyi yasaklayabilir; sahibi ve başka moderatörü yasaklayamaz; üye hiçbirini
        member(6, (int) APP, "MODERATOR", "ACTIVE");
        service.removeMember(2L, APP, 3L);
        assertEquals("BANNED", members.get("3:" + APP).getStatus());
        assertThrows(IllegalArgumentException.class, () -> service.removeMember(2L, APP, 1L), "sahip");
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.removeMember(2L, APP, 6L))));
        member(7, (int) APP, "MEMBER", "ACTIVE");
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.removeMember(7L, APP, 6L))));
        // sahip moderatörü yasaklayabilir
        service.removeMember(1L, APP, 6L);
        assertEquals("BANNED", members.get("6:" + APP).getStatus());
    }

    // ── D7 / SEC-C06 ──────────────────────────────────────────────────────────────

    @Test
    void d7_moderatorCanUpdateAndRegenerateButMemberCannot() {
        communities.get(APP).setInviteCode("OLDCODE1");
        CommunityResponse r = service.updateCommunity(2L, APP, req("Yeni Ad", "yeni acik", "SECRET"));
        assertEquals("Yeni Ad", communities.get(APP).getName());
        assertEquals("SECRET", communities.get(APP).getVisibility());
        assertEquals("yeni acik", communities.get(APP).getDescription());
        assertNotNull(r);

        String code = service.regenerateInviteCode(2L, APP);
        assertNotEquals("OLDCODE1", code);

        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.updateCommunity(3L, APP, req("X", null, null)))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.regenerateInviteCode(3L, APP))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.updateCommunity(4L, APP, req("X", null, null)))));
    }

    // ── SEC-C02: onaylı toplulukta değişiklik yeniden inceleme ───────────────────

    @Test
    void secC02_nameDescriptionOrVisibilityChangeByNonAdminReturnsToPending() {
        for (String field : List.of("name", "description", "visibility")) {
            for (long actor : new long[]{1L, 2L}) {
                Community c = communities.get(APP);
                c.setApprovalStatus("APPROVED");
                c.setReviewRequestedAt(null);
                c.setName("Eski");
                c.setDescription("eski");
                c.setVisibility("PRIVATE");
                CreateCommunityRequest r = switch (field) {
                    case "name" -> req("Baska Ad", null, null);
                    case "description" -> req(null, "baska aciklama", null);
                    default -> req(null, null, "SECRET");
                };
                LocalDateTime before = LocalDateTime.now();
                service.updateCommunity(actor, APP, r);
                assertEquals("PENDING", c.getApprovalStatus(), field + " / " + actor);
                assertNotNull(c.getReviewRequestedAt());
                assertFalse(c.getReviewRequestedAt().isBefore(before.minusSeconds(1)));
            }
        }
    }

    @Test
    void secC02_unchangedValuesCosmeticEditsAndAdminEditsDoNotRePend() {
        Community c = communities.get(APP);
        c.setName("Ad");
        c.setDescription("aciklama");
        // aynı değerler + yalnızca emoji/şehir: yeniden incelemeye girmez
        CreateCommunityRequest same = req("Ad", "aciklama", "PRIVATE");
        same.setEmoji("🔥");
        same.setCity("Ankara");
        service.updateCommunity(1L, APP, same);
        assertEquals("APPROVED", c.getApprovalStatus());
        assertNull(c.getReviewRequestedAt());

        // admin düzenlemesi tetiklemez
        service.updateCommunity(5L, APP, req("Admin Adi", "admin aciklama", "SECRET"));
        assertEquals("APPROVED", c.getApprovalStatus());
        assertEquals("Admin Adi", c.getName());
        assertNull(c.getReviewRequestedAt());
    }

    @Test
    void secC02_unauthorizedStillForbiddenAndNothingChanges() {
        Community c = communities.get(APP);
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class,
                () -> service.updateCommunity(3L, APP, req("Hack", null, null)))));
        assertEquals("APPROVED", c.getApprovalStatus());
        assertNotEquals("Hack", c.getName());
    }

    // ── SEC-C03: davet yalnız yönetici ────────────────────────────────────────────

    @Test
    void secC03_onlyOwnerModeratorAdminCanInvite() {
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.inviteUser(3L, APP, 7L))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.inviteUser(4L, APP, 7L))));
        assertFalse(members.containsKey("7:" + APP));

        service.inviteUser(1L, APP, 7L);
        assertEquals("INVITED", members.get("7:" + APP).getStatus());
        service.inviteUser(2L, APP, 6L);
        assertEquals("INVITED", members.get("6:" + APP).getStatus());
        service.inviteUser(5L, APP, 4L);
        assertEquals("INVITED", members.get("4:" + APP).getStatus());
    }

    // ── C2: sahipliği devret ──────────────────────────────────────────────────────

    @Test
    void c2_transferMakesTargetOwnerAndPreviousOwnerModerator() {
        service.transferOwnership(1L, APP, 3L);
        assertEquals(3L, communities.get(APP).getOwner().getId());
        assertEquals("OWNER", members.get("3:" + APP).getRole());
        assertEquals("MODERATOR", members.get("1:" + APP).getRole());
        verify(notifications).sendSystem(eq(3L), eq("community_ownership"), eq("community"), eq(APP), anyString());
    }

    @Test
    void c2_transferAllowedWhileReviewPending() {
        Community c = communities.get(APP);
        c.setApprovalStatus("PENDING");
        c.setReviewRequestedAt(LocalDateTime.now());
        assertDoesNotThrow(() -> service.transferOwnership(1L, APP, 3L));
        assertEquals(3L, c.getOwner().getId());
    }

    @Test
    void c2_invalidTargetsAndCallersAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.transferOwnership(1L, APP, 1L), "kendine");
        assertThrows(ResourceNotFoundException.class, () -> service.transferOwnership(1L, APP, 4L), "üye değil");
        member(6, (int) APP, "MEMBER", "PENDING");
        member(7, (int) APP, "MEMBER", "INVITED");
        member(4, (int) APP, "MEMBER", "BANNED");
        assertThrows(IllegalArgumentException.class, () -> service.transferOwnership(1L, APP, 6L), "PENDING");
        assertThrows(IllegalArgumentException.class, () -> service.transferOwnership(1L, APP, 7L), "INVITED");
        assertThrows(IllegalArgumentException.class, () -> service.transferOwnership(1L, APP, 4L), "BANNED");
        // başka topluluktaki ACTIVE üye bu toplulukta üye değildir
        community(PUBC, "PUBLIC", "APPROVED", 1);
        member(6, (int) PUBC, "MEMBER", "ACTIVE");
        member(6, (int) APP, "MEMBER", "PENDING");
        assertThrows(IllegalArgumentException.class, () -> service.transferOwnership(1L, APP, 6L));
        // sahip olmayan (moderatör dahil) devredemez
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.transferOwnership(2L, APP, 3L))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.transferOwnership(3L, APP, 2L))));
        assertEquals(1L, communities.get(APP).getOwner().getId());
        assertEquals("OWNER", members.get("1:" + APP).getRole());
    }

    @Test
    void c2_archivedCommunityCannotBeTransferred() {
        communities.get(APP).setArchivedAt(LocalDateTime.now());
        assertCode(409, "COMMUNITY_ARCHIVED", assertThrows(ResponseStatusException.class, () -> service.transferOwnership(1L, APP, 3L)));
    }

    @Test
    void c2_transferIsTransactional() throws Exception {
        assertTrue(CommunityService.class.getMethod("transferOwnership", Long.class, Long.class, Long.class)
                .isAnnotationPresent(Transactional.class));
        assertTrue(CommunityService.class.getMethod("autoRejectStaleReviews")
                .isAnnotationPresent(Transactional.class));
    }

    // ── C4: paylaşım sayfası ──────────────────────────────────────────────────────

    private ShareController share() {
        return new ShareController(mock(EventRepository.class), mock(ArtistRepository.class),
                mock(UserRepository.class), mock(PostRepository.class), communityRepo, memberRepo,
                new ShareLinkService(mock(ShareLinkConfig.class)), mock(ShareLinkConfig.class));
    }

    @Test
    void c4_privateLandingShowsBasicInfoAndPrivateLabelButNoContent() {
        post(POST, APP, 3, "GIZLI-GONDERI-METNI");
        post(101, APP, 3, "BASKA-GONDERI");
        comment(COMMENT, POST, 3, "GIZLI-YORUM-METNI");
        ResponseEntity<String> res = share().community(APP);
        assertEquals(200, res.getStatusCode().value());
        String html = res.getBody();
        assertTrue(html.contains("Topluluk" + APP));
        assertTrue(html.contains("Özel topluluk"));
        assertTrue(html.contains("3 üye"), "ACTIVE üye sayısı");
        assertTrue(html.contains("Rock"));
        assertFalse(html.contains("GIZLI-GONDERI-METNI"));
        assertFalse(html.contains("GIZLI-YORUM-METNI"));
        assertFalse(html.contains("BASKA-GONDERI"));
        assertFalse(html.contains("@u3"), "üye adları yok");
    }

    @Test
    void c4_privateLandingEscapesHtml() {
        communities.get(APP).setName("<script>x</script>");
        String html = share().community(APP).getBody();
        assertFalse(html.contains("<script>x</script>"));
        assertTrue(html.contains("&lt;script&gt;"));
    }

    @Test
    void c4_secretRejectedYoungPendingAndStaleAre404() {
        community(PUBC, "SECRET", "APPROVED", 1);
        assertEquals(404, share().community(PUBC).getStatusCode().value(), "SECRET");
        community(31, "PUBLIC", "REJECTED", 1);
        assertEquals(404, share().community(31L).getStatusCode().value(), "REJECTED");
        pending(PEN, 2);
        assertEquals(404, share().community(PEN).getStatusCode().value(), "PENDING <24s");
        pending(32, 24 * 8);
        assertEquals(404, share().community(32L).getStatusCode().value(), "7 günü aşmış PENDING");
        assertEquals(404, share().community(99999L).getStatusCode().value());
    }

    @Test
    void c4_pendingOlderThan24hAndPublicStillOpen() {
        pending(PEN, 26);
        assertEquals(200, share().community(PEN).getStatusCode().value());
        community(PUBC, "PUBLIC", "APPROVED", 1);
        String html = share().community(PUBC).getBody();
        assertFalse(html.contains("Özel topluluk"));
    }

    // ── B11: topluluk içeriği gizleme / şikayet ───────────────────────────────────

    private void contentFixture() {
        post(POST, APP, 3, "gonderi");
        comment(COMMENT, POST, 3, "yorum");
    }

    @Test
    void b11_managersHideAndUnhidePostAndComment() {
        contentFixture();
        service.setPostHidden(2L, APP, POST, true);
        assertTrue(posts.get(POST).getIsHidden());
        service.setPostHidden(1L, APP, POST, false);
        assertFalse(posts.get(POST).getIsHidden());
        service.setPostHidden(5L, APP, POST, true);
        assertTrue(posts.get(POST).getIsHidden(), "admin");

        service.setCommentHidden(2L, APP, POST, COMMENT, true);
        assertTrue(comments.get(COMMENT).getIsHidden());
        service.setCommentHidden(1L, APP, POST, COMMENT, false);
        assertFalse(comments.get(COMMENT).getIsHidden());
    }

    @Test
    void b11_memberOrOutsiderCannotHide() {
        contentFixture();
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.setPostHidden(3L, APP, POST, true))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.setPostHidden(4L, APP, POST, true))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.setCommentHidden(3L, APP, POST, COMMENT, true))));
        assertFalse(posts.get(POST).getIsHidden());
        assertFalse(comments.get(COMMENT).getIsHidden());
    }

    @Test
    void b11_postMustBelongToCommunityAndCommentToPost() {
        contentFixture();
        community(PUBC, "PUBLIC", "APPROVED", 1);
        member(1, (int) PUBC, "OWNER", "ACTIVE");
        post(101, APP, 3, "baska");
        assertThrows(ResourceNotFoundException.class, () -> service.setPostHidden(1L, PUBC, POST, true), "başka topluluğun postu");
        assertThrows(ResourceNotFoundException.class, () -> service.setCommentHidden(1L, APP, 101L, COMMENT, true), "yorum bu posta ait değil");
        assertThrows(ResourceNotFoundException.class, () -> service.setCommentHidden(1L, APP, POST, 9999L, true));
    }

    @Test
    void b11_hiddenPostIsExcludedForMembersButFlaggedForManagers() {
        contentFixture();
        post(101, APP, 3, "gorunur");
        posts.get(POST).setIsHidden(true);

        List<CommunityPostResponse> forMember = service.getCommunityPosts(APP, 3L);
        assertEquals(List.of(101L), forMember.stream().map(CommunityPostResponse::getId).toList());
        assertTrue(forMember.stream().noneMatch(CommunityPostResponse::isHidden));

        for (long manager : new long[]{1L, 2L, 5L}) {
            List<CommunityPostResponse> forManager = service.getCommunityPosts(APP, manager);
            assertEquals(2, forManager.size(), "yönetici " + manager);
            assertTrue(forManager.stream().filter(p -> p.getId() == POST).findFirst().orElseThrow().isHidden());
            assertFalse(forManager.stream().filter(p -> p.getId() == 101L).findFirst().orElseThrow().isHidden());
        }
    }

    @Test
    void b11_hiddenPostCommentsLikesVotesAreInaccessibleToNonManagers() {
        contentFixture();
        posts.get(POST).setIsHidden(true);
        assertThrows(ResourceNotFoundException.class, () -> service.getPostComments(APP, POST, 3L));
        assertThrows(ResourceNotFoundException.class, () -> service.addPostComment(3L, APP, POST, "yeni"));
        assertThrows(ResourceNotFoundException.class, () -> service.likeCommunityPost(3L, APP, POST));
        assertThrows(ResourceNotFoundException.class, () -> service.unlikeCommunityPost(3L, APP, POST));
        assertThrows(ResourceNotFoundException.class, () -> service.votePoll(3L, APP, POST, 1L));
        assertEquals(1, service.getPostComments(APP, POST, 2L).size(), "yönetici hâlâ görür");
    }

    @Test
    void b11_hiddenCommentIsExcludedForMembersButFlaggedForManagers() {
        contentFixture();
        comment(501, POST, 3, "gorunur yorum");
        comments.get(COMMENT).setIsHidden(true);

        List<CommunityPostCommentResponse> forMember = service.getPostComments(APP, POST, 3L);
        assertEquals(List.of(501L), forMember.stream().map(CommunityPostCommentResponse::getId).toList());

        List<CommunityPostCommentResponse> forManager = service.getPostComments(APP, POST, 1L);
        assertEquals(2, forManager.size());
        assertTrue(forManager.stream().filter(c -> c.getId() == COMMENT).findFirst().orElseThrow().isHidden());
        // yorum sayısı: üyeler gizli yorumsuz, yöneticiler tümünü sayan sorguyu kullanır
        service.getCommunityPosts(APP, 3L);
        verify(commentRepo).countVisibleByCommunityPostIdIn(anyCollection());
        service.getCommunityPosts(APP, 1L);
        verify(commentRepo).countByCommunityPostIdIn(anyCollection());
    }

    @Test
    void b11_reportRequiresTargetAndVisibility() {
        contentFixture();
        // görebilen üye
        assertDoesNotThrow(() -> service.requireCanReportCommunityContent(3L, "COMMUNITY_POST", POST));
        assertDoesNotThrow(() -> service.requireCanReportCommunityContent(2L, "COMMUNITY_COMMENT", COMMENT));
        assertDoesNotThrow(() -> service.requireCanReportCommunityContent(3L, "community_post", POST), "küçük harf");
        // PRIVATE topluluk: dışarıdan biri göremez
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class,
                () -> service.requireCanReportCommunityContent(4L, "COMMUNITY_POST", POST))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class,
                () -> service.requireCanReportCommunityContent(4L, "COMMUNITY_COMMENT", COMMENT))));
        assertThrows(ResponseStatusException.class,
                () -> service.requireCanReportCommunityContent(null, "COMMUNITY_POST", POST), "oturumsuz");
        // SECRET topluluk: üye olmayana yok gibi
        communities.get(APP).setVisibility("SECRET");
        assertThrows(ResourceNotFoundException.class, () -> service.requireCanReportCommunityContent(4L, "COMMUNITY_POST", POST));
        // olmayan hedef
        assertThrows(ResourceNotFoundException.class, () -> service.requireCanReportCommunityContent(3L, "COMMUNITY_POST", 9999L));
        assertThrows(ResourceNotFoundException.class, () -> service.requireCanReportCommunityContent(3L, "COMMUNITY_COMMENT", 9999L));
        // başka tür: bu doğrulama karışmaz
        assertDoesNotThrow(() -> service.requireCanReportCommunityContent(4L, "POST", 1L));
    }

    @Test
    void b11_hiddenContentCannotBeReportedByNonManagersAndPendingOutsiderCannot() {
        contentFixture();
        posts.get(POST).setIsHidden(true);
        assertThrows(ResourceNotFoundException.class, () -> service.requireCanReportCommunityContent(3L, "COMMUNITY_POST", POST));
        assertThrows(ResourceNotFoundException.class, () -> service.requireCanReportCommunityContent(3L, "COMMUNITY_COMMENT", COMMENT));
        assertDoesNotThrow(() -> service.requireCanReportCommunityContent(2L, "COMMUNITY_POST", POST), "yönetici");

        // incelemedeki PUBLIC toplulukta dışarıdan biri raporlayamaz (içeriği göremez)
        pending(PEN, 30);
        post(110, PEN, 3, "pending post");
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class,
                () -> service.requireCanReportCommunityContent(4L, "COMMUNITY_POST", 110L))));
    }

    @Test
    void b11_adminQueueShowsPreviewAndAdminCanHideCommunityContent() {
        contentFixture();
        ReportRepository reports = mock(ReportRepository.class);
        AdminModerationService admin = new AdminModerationService(reports, mock(PostRepository.class),
                mock(CommentRepository.class), mock(MessageRepository.class), mock(UserRepository.class),
                postRepo, commentRepo);

        Report rp = new Report();
        rp.setReporter(users.get(4L));
        rp.setTargetType("COMMUNITY_POST");
        rp.setTargetId(POST);
        Report rc = new Report();
        rc.setReporter(users.get(4L));
        rc.setTargetType("COMMUNITY_COMMENT");
        rc.setTargetId(COMMENT);
        Report missing = new Report();
        missing.setReporter(users.get(4L));
        missing.setTargetType("COMMUNITY_POST");
        missing.setTargetId(404L);
        when(reports.findByResolvedFalseOrderByCreatedAtDesc()).thenReturn(List.of(rp, rc, missing));

        List<ReportResponse> queue = admin.getReports(false);
        assertEquals("gonderi", queue.get(0).getTargetPreview());
        assertEquals(3L, queue.get(0).getTargetOwnerId());
        assertFalse(queue.get(0).isTargetHidden());
        assertEquals("yorum", queue.get(1).getTargetPreview());
        assertTrue(queue.get(2).getTargetPreview().contains("silinmiş"));

        admin.setContentHidden("COMMUNITY_POST", POST, true);
        admin.setContentHidden("COMMUNITY_COMMENT", COMMENT, true);
        assertTrue(posts.get(POST).getIsHidden());
        assertTrue(comments.get(COMMENT).getIsHidden());
        assertTrue(admin.getReports(false).get(0).isTargetHidden());
        admin.setContentHidden("COMMUNITY_POST", POST, false);
        assertFalse(posts.get(POST).getIsHidden());
        assertThrows(ResourceNotFoundException.class, () -> admin.setContentHidden("COMMUNITY_POST", 404L, true));
        assertThrows(ResponseStatusException.class, () -> admin.setContentHidden("MESSAGE", 1L, true));
    }

    // ── QA ek senaryolar ──────────────────────────────────────────────────────────

    @Test
    void qa_secC02_rePendingKeepsExistingMembersButClosesNewEntries() {
        post(POST, APP, 3, "gonderi");
        service.updateCommunity(1L, APP, req("Yeni Ad", null, null));
        assertEquals("PENDING", communities.get(APP).getApprovalStatus());
        // mevcut ACTIVE üye erişimini korur
        assertDoesNotThrow(() -> service.getCommunityPosts(APP, 3L));
        assertDoesNotThrow(() -> service.getMembers(APP, 3L));
        assertDoesNotThrow(() -> service.getPostComments(APP, POST, 3L));
        assertEquals("ACTIVE", members.get("3:" + APP).getStatus());
        // dışarıdan yeni giriş kapalı, içerik okunamaz
        assertCode(409, "COMMUNITY_PENDING_REVIEW", assertThrows(ResponseStatusException.class, () -> service.joinCommunity(4L, APP)));
        assertCode(403, "COMMUNITY_PENDING_REVIEW", assertThrows(ResponseStatusException.class, () -> service.getCommunityPosts(APP, 4L)));
        // yeni inceleme penceresi: ilk 24 sa keşifte yok
        assertFalse(listed(APP, 4L));
    }

    @Test
    void qa_anonymousCallersAreForbiddenOnManagerOperations() {
        contentFixture();
        member(6, (int) APP, "MEMBER", "BANNED");
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.getBannedMembers(null, APP))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.getJoinRequests(null, APP))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.unbanMember(null, APP, 6L))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.setPostHidden(null, APP, POST, true))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.regenerateInviteCode(null, APP))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.updateCommunity(null, APP, req("X", null, null)))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.inviteUser(null, APP, 7L))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.transferOwnership(null, APP, 3L))));
        assertFalse(posts.get(POST).getIsHidden());
    }

    @Test
    void qa_bannedMemberIsNotListedAndCannotParticipateInPrivateCommunity() {
        member(6, (int) APP, "MEMBER", "BANNED");
        post(POST, APP, 3, "gonderi");
        assertTrue(service.getMembers(APP, 3L).stream().noneMatch(m -> m.getUserId() == 6L), "GET /members BANNED döndürmez");
        assertTrue(service.getMembers(APP, 3L).stream().allMatch(m -> "ACTIVE".equals(m.getStatus())));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.getCommunityPosts(APP, 6L))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.addPostComment(6L, APP, POST, "x"))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.votePoll(6L, APP, POST, 1L))));
    }

    @Test
    void qa_secretCommunityIsInvisibleToBannedAndInviteCodeDoesNotBypassBan() {
        Community s = community(PUBC, "SECRET", "APPROVED", 1);
        s.setInviteCode("SECCODE1");
        member(1, (int) PUBC, "OWNER", "ACTIVE");
        member(6, (int) PUBC, "MEMBER", "BANNED");
        assertThrows(ResourceNotFoundException.class, () -> service.getCommunityById(PUBC, 6L));
        assertFalse(listed(PUBC, 6L));
        assertThrows(ResponseStatusException.class, () -> service.joinByInviteCode(6L, "SECCODE1"));
        assertEquals("BANNED", members.get("6:" + PUBC).getStatus());
    }
}
