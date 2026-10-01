package com.concertly.backend.service;

import com.concertly.backend.controller.ShareController;
import com.concertly.backend.dto.request.CreateCommunityPostRequest;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import com.concertly.backend.security.AuthRateLimiter;
import com.concertly.backend.config.ShareLinkConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Topluluk sertleştirme turu: B8, D8, D9, D6, SEC-C03, SEC-C04, SEC-C05, B10, B11, C4, B3, B9.
 *
 * Topluluklar: PUB(20, sahip 4), PRIV(10, sahip 1), SECRET(30, sahip 1), REJ(40, PUBLIC ama REJECTED, sahip 1).
 * Kullanıcılar: 1 sahip, 3 PRIV üyesi, 4 PUB sahibi, 7 dışarıdan biri, 8 SECRET'ta BANNED.
 */
class CommunityHardeningTest {

    private static final long PUB = 20, PRIV = 10, SECRET = 30, REJ = 40;

    private final Map<Long, Community> communities = new HashMap<>();
    private final Map<Long, CommunityPost> posts = new HashMap<>();
    private final Map<Long, User> users = new HashMap<>();
    private final Map<String, CommunityMember> members = new HashMap<>();
    private final List<CommunityPostComment> comments = new ArrayList<>();

    private CommunityRepository communityRepo;
    private CommunityPostRepository postRepo;
    private CommunityMemberRepository memberRepo;
    private CommunityPostCommentRepository commentRepo;
    private CommunityPostLikeRepository likeRepo;
    private NotificationService notifications;
    private NotificationRepository notificationRepo;
    private ModerationService moderation;
    private ContentLimitService contentLimits;
    private CommunityService service;

    private static <T> T withId(T e, long id) {
        ReflectionTestUtils.setField(e, "id", id);
        return e;
    }

    private User user(long id) {
        User u = withId(new User(), id);
        u.setUsername("u" + id);
        users.put(id, u);
        return u;
    }

    private Community community(long id, String visibility, String approval, long ownerId) {
        Community c = withId(new Community(), id);
        c.setName("c" + id);
        c.setVisibility(visibility);
        c.setApprovalStatus(approval);
        c.setOwner(users.get(ownerId));
        communities.put(id, c);
        return c;
    }

    private CommunityPost post(long id, long communityId, long authorId) {
        CommunityPost p = withId(new CommunityPost(), id);
        p.setCommunity(communities.get(communityId));
        p.setUser(users.get(authorId));
        p.setPostType("TEXT");
        posts.put(id, p);
        return p;
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

    private static int statusOf(ResponseStatusException e) {
        return e.getStatusCode().value();
    }

    @BeforeEach
    void setUp() {
        for (long id = 1; id <= 9; id++) user(id);
        community(PUB, "PUBLIC", "APPROVED", 4);
        community(PRIV, "PRIVATE", "APPROVED", 1);
        community(SECRET, "SECRET", "APPROVED", 1);
        community(REJ, "PUBLIC", "REJECTED", 1);
        communities.get(REJ).setInviteCode("REJCODE1");
        post(200, PUB, 4);
        post(100, PRIV, 1);

        member(4, PUB, "OWNER", "ACTIVE");
        member(1, PRIV, "OWNER", "ACTIVE");
        member(3, PRIV, "MEMBER", "ACTIVE");
        member(1, SECRET, "OWNER", "ACTIVE");
        member(8, SECRET, "MEMBER", "BANNED");
        member(1, REJ, "OWNER", "ACTIVE");
        member(3, REJ, "MEMBER", "ACTIVE");

        communityRepo = mock(CommunityRepository.class);
        postRepo = mock(CommunityPostRepository.class);
        memberRepo = mock(CommunityMemberRepository.class);
        commentRepo = mock(CommunityPostCommentRepository.class);
        likeRepo = mock(CommunityPostLikeRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        notifications = mock(NotificationService.class);
        notificationRepo = mock(NotificationRepository.class);
        moderation = mock(ModerationService.class);
        contentLimits = mock(ContentLimitService.class);

        when(communityRepo.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(communities.get(i.<Long>getArgument(0))));
        when(communityRepo.findAll()).thenAnswer(i -> new ArrayList<>(communities.values()));
        when(communityRepo.findByInviteCode(anyString())).thenAnswer(i -> communities.values().stream()
                .filter(c -> i.getArgument(0).equals(c.getInviteCode())).findFirst());
        when(postRepo.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(posts.get(i.<Long>getArgument(0))));
        when(postRepo.save(any())).thenAnswer(i -> withId((CommunityPost) i.getArgument(0), 999));
        CommunityPostPollOptionRepository optRepo = mock(CommunityPostPollOptionRepository.class);
        when(optRepo.save(any())).thenAnswer(i -> withId((CommunityPostPollOption) i.getArgument(0), 5000));
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
        when(memberRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(commentRepo.findByCommunityPostIdOrderByCreatedAtAsc(anyLong())).thenAnswer(i -> comments);
        when(commentRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(likeRepo.findByUserIdAndCommunityPostId(anyLong(), anyLong())).thenReturn(Optional.empty());

        service = new CommunityService(communityRepo, memberRepo, postRepo, likeRepo, commentRepo,
                optRepo, mock(CommunityPostPollVoteRepository.class),
                userRepo, notifications, notificationRepo, moderation, contentLimits, new AuthRateLimiter());
    }

    private static CreateCommunityPostRequest postRequest(String type, String content) {
        CreateCommunityPostRequest r = new CreateCommunityPostRequest();
        r.setPostType(type);
        r.setContent(content);
        return r;
    }

    // ── B8: REJECTED / SECRET dışarıdan 404 ──────────────────────────────────────

    @Test
    void b8_rejectedCommunityIsInvisibleForReadJoinPostCommentVote() {
        assertThrows(ResourceNotFoundException.class, () -> service.getCommunityPosts(REJ, 7L));
        assertThrows(ResourceNotFoundException.class, () -> service.getCommunityPosts(REJ, null));
        assertThrows(ResourceNotFoundException.class, () -> service.getPostComments(REJ, 1L, 7L));
        assertThrows(ResourceNotFoundException.class, () -> service.joinCommunity(7L, REJ));
        assertThrows(ResourceNotFoundException.class, () -> service.createCommunityPost(3L, REJ, postRequest("TEXT", "x")),
                "üye olsa bile reddedilen topluluğa gönderi yok");
        assertThrows(ResourceNotFoundException.class, () -> service.addPostComment(3L, REJ, 1L, "x"));
        assertThrows(ResourceNotFoundException.class, () -> service.votePoll(3L, REJ, 1L, 1L));
        assertThrows(ResourceNotFoundException.class, () -> service.joinByInviteCode(7L, "REJCODE1"));
        verify(memberRepo, never()).save(any());
    }

    @Test
    void b8_secretCommunityCannotBeJoinedByIdByOutsiders() {
        assertThrows(ResourceNotFoundException.class, () -> service.joinCommunity(7L, SECRET));
        assertThrows(ResourceNotFoundException.class, () -> service.getCommunityPosts(SECRET, 7L));
        assertThrows(ResourceNotFoundException.class, () -> service.createCommunityPost(7L, SECRET, postRequest("TEXT", "x")));
    }

    @Test
    void b8_inviteCodeStillOpensSecretCommunityForOutsiders() {
        communities.get(SECRET).setInviteCode("SECRET01");
        assertDoesNotThrow(() -> service.joinByInviteCode(7L, "SECRET01"));
    }

    @Test
    void b8_ownerAndAdminAccessIsUnchanged() {
        assertDoesNotThrow(() -> service.getCommunityPosts(REJ, 1L));
        assertDoesNotThrow(() -> service.getCommunityPosts(SECRET, 1L));
    }

    // ── D8: BANNED üyelik değildir ve kendi kendine silinemez ─────────────────────

    @Test
    void d8_bannedMemberCannotSeeSecretCommunityNorListIt() {
        assertThrows(ResourceNotFoundException.class, () -> service.getCommunityById(SECRET, 8L));
        assertTrue(service.getAllCommunities(null, null, 8L).stream().noneMatch(c -> c.getId() == SECRET));
        assertTrue(service.getAllCommunities(null, null, 1L).stream().anyMatch(c -> c.getId() == SECRET));
    }

    @Test
    void d8_bannedMemberCannotLeaveAndRemoveTheBan() {
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> service.leaveCommunity(8L, SECRET));
        assertEquals(403, statusOf(e));
        assertEquals("COMMUNITY_BANNED", e.getReason());
        verify(memberRepo, never()).delete(any());
    }

    // ── D9: yetki hataları 403 ───────────────────────────────────────────────────

    @Test
    void d9_permissionDenialsAre403() {
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.getJoinRequests(3L, PRIV))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.getCommunityPosts(PRIV, 7L))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.deleteCommunity(3L, PRIV))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.setMemberRole(3L, PRIV, 1L, "MEMBER"))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.transferOwnership(3L, PRIV, 1L))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.addPostComment(7L, PUB, 200L, "x"))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.createCommunityPost(7L, PUB, postRequest("TEXT", "x")))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.votePoll(7L, PUB, 200L, 1L))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.inviteUser(7L, PUB, 9L))));
    }

    // ── D6 + SEC-C03: davet ──────────────────────────────────────────────────────

    @Test
    void d6_blockedInviteIsASilentNoOp() {
        when(moderation.isBlockedEitherWay(1L, 7L)).thenReturn(true);
        assertDoesNotThrow(() -> service.inviteUser(1L, PRIV, 7L)); // SEC-C03: davet eden artık sahip/mod
        verify(memberRepo, never()).save(any());
        verifyNoInteractions(notifications);
    }

    @Test
    void secC03_repeatInviteDoesNotNotifyAgain() {
        service.inviteUser(1L, PRIV, 7L); // ilk davet: satır + bildirim (SEC-C03: davet eden sahip)
        verify(memberRepo, times(1)).save(any());
        verify(notifications, times(1)).send(eq(7L), eq(1L), eq("community_invite"), eq("community"), eq(PRIV));

        member(7, PRIV, "MEMBER", "INVITED");
        service.inviteUser(1L, PRIV, 7L); // ikinci davet: hiçbir şey
        verify(memberRepo, times(1)).save(any());
        verify(notifications, times(1)).send(anyLong(), anyLong(), anyString(), anyString(), anyLong());
    }

    // ── SEC-C04: davet kodu hız sınırı ───────────────────────────────────────────

    @Test
    void secC04_inviteCodeAttemptsAreRateLimitedTo429() {
        for (int i = 0; i < 10; i++) {
            assertThrows(ResourceNotFoundException.class, () -> service.joinByInviteCode(7L, "NOPE"));
        }
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> service.joinByInviteCode(7L, "NOPE"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS.value(), statusOf(e));
        // başka kullanıcı etkilenmez
        assertThrows(ResourceNotFoundException.class, () -> service.joinByInviteCode(9L, "NOPE"));
    }

    // ── SEC-C05 / B10 / B11 ──────────────────────────────────────────────────────

    @Test
    void secC05_pollAndImageLimits() {
        CreateCommunityPostRequest many = postRequest("POLL", "soru");
        many.setPollOptions(List.of("a", "b", "c", "d", "e"));
        assertEquals("POLL_TOO_MANY_OPTIONS",
                assertThrows(ResponseStatusException.class, () -> service.createCommunityPost(3L, PRIV, many)).getReason());

        CreateCommunityPostRequest longOpt = postRequest("POLL", "soru");
        longOpt.setPollOptions(List.of("a", "x".repeat(61)));
        assertEquals("POLL_OPTION_TOO_LONG",
                assertThrows(ResponseStatusException.class, () -> service.createCommunityPost(3L, PRIV, longOpt)).getReason());

        CreateCommunityPostRequest okPoll = postRequest("POLL", "soru");
        okPoll.setPollOptions(List.of("a", "x".repeat(60), "c", "d"));
        assertDoesNotThrow(() -> service.createCommunityPost(3L, PRIV, okPoll));

        CreateCommunityPostRequest extImg = postRequest("IMAGE", "");
        extImg.setImageUrl("https://evil.example/x.png");
        assertEquals("INVALID_IMAGE_URL",
                assertThrows(ResponseStatusException.class, () -> service.createCommunityPost(3L, PRIV, extImg)).getReason());

        CreateCommunityPostRequest okImg = postRequest("IMAGE", "");
        okImg.setImageUrl("/uploads/abc.jpg");
        assertDoesNotThrow(() -> service.createCommunityPost(3L, PRIV, okImg));
    }

    @Test
    void b10_tooLongCommentIsRejectedWithCode() {
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.addPostComment(3L, PRIV, 100L, "x".repeat(ContentLimits.COMMENT_MAX + 1)));
        assertEquals(400, statusOf(e));
        assertEquals("CONTENT_TOO_LONG", e.getReason());
        verify(commentRepo, never()).save(any());
        assertDoesNotThrow(() -> service.addPostComment(3L, PRIV, 100L, "x".repeat(ContentLimits.COMMENT_MAX)));
    }

    @Test
    void b11_contentLimitServiceIsConsultedAndBlocksWhenExceeded() {
        service.createCommunityPost(3L, PRIV, postRequest("TEXT", "merhaba"));
        verify(contentLimits).checkPost(3L);
        service.addPostComment(3L, PRIV, 100L, "selam");
        verify(contentLimits).checkComment(3L);

        doThrow(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "POST_LIMIT"))
                .when(contentLimits).checkPost(3L);
        reset(postRepo);
        assertEquals(429, statusOf(assertThrows(ResponseStatusException.class,
                () -> service.createCommunityPost(3L, PRIV, postRequest("TEXT", "fazla")))));
        verify(postRepo, never()).save(any());
    }

    @Test
    void b11_blockedAuthorsAreFilteredFromPostsAndComments() {
        post(101, PRIV, 3);
        when(postRepo.findByCommunityIdOrderByCreatedAtDesc(PRIV))
                .thenReturn(List.of(posts.get(100L), posts.get(101L)));
        when(moderation.getHiddenUserIds(3L)).thenReturn(Set.of(1L));

        List<?> visible = service.getCommunityPosts(PRIV, 3L);
        assertEquals(1, visible.size(), "engellenen yazarın (1) gönderisi gizlenir");

        CommunityPostComment byBlocked = new CommunityPostComment();
        byBlocked.setUser(users.get(1L));
        byBlocked.setContent("gizli");
        CommunityPostComment byOther = new CommunityPostComment();
        byOther.setUser(users.get(3L));
        byOther.setContent("görünür");
        comments.addAll(List.of(byBlocked, byOther));
        assertEquals(1, service.getPostComments(PRIV, 100L, 3L).size());
    }

    // ── B3: idempotent beğeni / katılma ──────────────────────────────────────────

    @Test
    void b3_likeAndUnlikeAreIdempotent() {
        assertDoesNotThrow(() -> service.unlikeCommunityPost(3L, PRIV, 100L)); // beğenilmemiş
        service.likeCommunityPost(3L, PRIV, 100L);
        verify(likeRepo, times(1)).save(any(CommunityPostLike.class));

        when(likeRepo.findByUserIdAndCommunityPostId(3L, 100L)).thenReturn(Optional.of(new CommunityPostLike()));
        assertDoesNotThrow(() -> service.likeCommunityPost(3L, PRIV, 100L)); // zaten beğenilmiş
        verify(likeRepo, times(1)).save(any(CommunityPostLike.class));
    }

    @Test
    void b3_joiningWhenAlreadyActiveReturnsCurrentState() {
        assertDoesNotThrow(() -> service.joinCommunity(4L, PUB));
        verify(memberRepo, never()).save(any());
    }

    // ── B9: silinen topluluğun bildirimleri ──────────────────────────────────────

    @Test
    void b9_deleteCommunityRemovesItsNotifications() {
        service.deleteCommunity(1L, PRIV);
        verify(notificationRepo).deleteByEntityTypeAndEntityId("community", PRIV);
        verify(communityRepo).delete(communities.get(PRIV));
    }

    // ── C4: paylaşım sayfası ─────────────────────────────────────────────────────

    private ShareController shareController() {
        return new ShareController(mock(EventRepository.class), mock(ArtistRepository.class),
                mock(UserRepository.class), mock(PostRepository.class), communityRepo,
                mock(CommunityMemberRepository.class),
                mock(ShareLinkService.class), mock(ShareLinkConfig.class));
    }

    @Test
    void c4_shareLandingTreatsNullVisibilityAsPublicAndHidesRejected() {
        ShareController share = shareController();
        communities.get(PUB).setVisibility(null);
        assertEquals(200, share.community(PUB).getStatusCode().value(), "null görünürlük = PUBLIC");
        assertEquals(404, share.community(REJ).getStatusCode().value(), "reddedilen topluluk");
        // C4 (karar değişti): PRIVATE artık ad/temel bilgi/özel etiketiyle açılır; SECRET 404 kalır
        assertEquals(200, share.community(PRIV).getStatusCode().value(), "PRIVATE landing açılır");
        assertEquals(404, share.community(SECRET).getStatusCode().value(), "SECRET 404");
        assertEquals(404, share.community(12345L).getStatusCode().value());
    }

    // ── QA: ek uç durumlar ───────────────────────────────────────────────────────

    private void makeAdmin(long id) {
        Role r = new Role();
        r.setName("ROLE_ADMIN");
        users.get(id).setRoles(new HashSet<>(Set.of(r)));
    }

    @Test
    void qa_privateNonMemberAndAnonymousGet403ButSecretOutsiderGets404() {
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.getCommunityPosts(PRIV, 7L))));
        assertEquals(403, statusOf(assertThrows(ResponseStatusException.class, () -> service.getCommunityPosts(PRIV, null))));
        assertThrows(ResourceNotFoundException.class, () -> service.getCommunityPosts(SECRET, 7L));
        assertThrows(ResourceNotFoundException.class, () -> service.getCommunityPosts(SECRET, null));
        // PRIVATE topluluk metadata'sı üye olmayana görünür (katıl butonu için)
        assertDoesNotThrow(() -> service.getCommunityById(PRIV, 7L));
    }

    @Test
    void qa_rejectedInviteCodeIs404ForOutsiderButOwnerAndAdminStillWork() {
        makeAdmin(9);
        assertThrows(ResourceNotFoundException.class, () -> service.joinByInviteCode(7L, "REJCODE1"));
        assertDoesNotThrow(() -> service.joinByInviteCode(1L, "REJCODE1"));
        assertDoesNotThrow(() -> service.joinByInviteCode(9L, "REJCODE1"));
    }

    @Test
    void qa_ownerAndAdminCanReadAndPostInRejectedCommunity() {
        makeAdmin(9);
        assertDoesNotThrow(() -> service.getCommunityById(REJ, 1L));
        assertDoesNotThrow(() -> service.getCommunityById(REJ, 9L));
        assertDoesNotThrow(() -> service.getCommunityPosts(REJ, 9L));
        assertDoesNotThrow(() -> service.createCommunityPost(1L, REJ, postRequest("TEXT", "sahip")));
        assertThrows(ResourceNotFoundException.class, () -> service.getCommunityById(REJ, 7L));
        assertThrows(ResourceNotFoundException.class, () -> service.getCommunityById(REJ, null));
    }

    @Test
    void qa_adminBypassesSecretAndPrivateReadWithoutMembership() {
        makeAdmin(9);
        assertDoesNotThrow(() -> service.getCommunityPosts(SECRET, 9L));
        assertDoesNotThrow(() -> service.getCommunityPosts(PRIV, 9L));
    }

    @Test
    void qa_pendingRequestCanBeCancelledByLeaving() {
        member(7, PRIV, "MEMBER", "PENDING");
        assertDoesNotThrow(() -> service.leaveCommunity(7L, PRIV));
        verify(memberRepo).delete(members.get("7:" + PRIV));
    }

    @Test
    void qa_leaveWithoutMembershipIs404AndOwnerCannotLeave() {
        assertThrows(ResourceNotFoundException.class, () -> service.leaveCommunity(7L, PRIV));
        assertThrows(IllegalArgumentException.class, () -> service.leaveCommunity(1L, PRIV));
    }

    @Test
    void qa_bannedMemberCannotPostOrJoinPublic() {
        member(8, PUB, "MEMBER", "BANNED");
        assertThrows(RuntimeException.class, () -> service.createCommunityPost(8L, PUB, postRequest("TEXT", "x")));
        assertThrows(RuntimeException.class, () -> service.joinCommunity(8L, PUB));
        verify(memberRepo, never()).save(any());
    }

    @Test
    void qa_deleteCommunityWithZeroNotificationsStillDeletes() {
        // deleteByEntityTypeAndEntityId void/no-op: silme akışı bozulmaz
        service.deleteCommunity(1L, SECRET);
        verify(notificationRepo).deleteByEntityTypeAndEntityId("community", SECRET);
        verify(communityRepo).delete(communities.get(SECRET));
    }

    @Test
    void qa_anonymousReadOfPublicCommunityStillWorks() {
        assertDoesNotThrow(() -> service.getCommunityPosts(PUB, null));
        assertDoesNotThrow(() -> service.getCommunityById(PUB, null));
    }
}
