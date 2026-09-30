package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Topluluk yetki açıkları D1–D5.
 *
 * Kurgu: PUBLIC topluluk (20), PRIVATE topluluk (10), SECRET topluluk (30).
 * Kullanıcılar: 1 sahip(10), 2 moderatör(10), 3 üye(10), 4 yalnızca PUBLIC'in üyesi,
 * 5 admin (hiçbir yerde üye değil), 6 PRIVATE'a katılma isteği bekliyor, 7 hiçbir yerde yok.
 */
class CommunityAuthorizationTest {

    private static final long PUB = 20, PRIV = 10, SECRET = 30;
    private static final long POST_PUB = 200, POST_PRIV = 100, POST_SECRET = 300;
    private static final long OPT_PRIV = 1001, OPT_PUB = 2001;

    private final Map<Long, Community> communities = new HashMap<>();
    private final Map<Long, CommunityPost> posts = new HashMap<>();
    private final Map<Long, CommunityPostPollOption> options = new HashMap<>();
    private final Map<Long, User> users = new HashMap<>();
    private final Map<String, CommunityMember> members = new HashMap<>();

    private CommunityPostCommentRepository commentRepo;
    private CommunityPostPollVoteRepository voteRepo;
    private CommunityPostLikeRepository likeRepo;
    private CommunityMemberRepository memberRepo;
    private NotificationService notifications;
    private CommunityService service;

    private static <T> T withId(T entity, long id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
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

    private Community community(long id, String visibility, User owner) {
        Community c = withId(new Community(), id);
        c.setName("c" + id);
        c.setVisibility(visibility);
        c.setApprovalStatus("APPROVED");
        c.setOwner(owner);
        communities.put(id, c);
        return c;
    }

    private CommunityPost post(long id, long communityId) {
        CommunityPost p = withId(new CommunityPost(), id);
        p.setCommunity(communities.get(communityId));
        p.setPostType("POLL");
        p.setUser(users.get(1L));
        posts.put(id, p);
        return p;
    }

    private void option(long id, long postId) {
        CommunityPostPollOption o = withId(new CommunityPostPollOption(), id);
        o.setCommunityPost(posts.get(postId));
        o.setOptionText("o" + id);
        options.put(id, o);
    }

    private void member(long userId, long communityId, String role, String status) {
        CommunityMember m = new CommunityMember();
        m.setUser(users.get(userId));
        m.setCommunity(communities.get(communityId));
        m.setRole(role);
        m.setStatus(status);
        members.put(userId + ":" + communityId, m);
    }

    private CommunityMember membership(long userId, long communityId) {
        return members.get(userId + ":" + communityId);
    }

    @BeforeEach
    void setUp() {
        for (long id = 1; id <= 7; id++) user(id, id == 5);
        community(PUB, "PUBLIC", users.get(4L));
        community(PRIV, "PRIVATE", users.get(1L));
        community(SECRET, "SECRET", users.get(1L));
        post(POST_PUB, PUB);
        post(POST_PRIV, PRIV);
        post(POST_SECRET, SECRET);
        option(OPT_PRIV, POST_PRIV);
        option(OPT_PUB, POST_PUB);

        member(4, PUB, "OWNER", "ACTIVE");
        member(1, PRIV, "OWNER", "ACTIVE");
        member(2, PRIV, "MODERATOR", "ACTIVE");
        member(3, PRIV, "MEMBER", "ACTIVE");
        member(6, PRIV, "MEMBER", "PENDING");
        member(1, SECRET, "OWNER", "ACTIVE");

        CommunityRepository communityRepo = mock(CommunityRepository.class);
        CommunityPostRepository postRepo = mock(CommunityPostRepository.class);
        CommunityPostPollOptionRepository optionRepo = mock(CommunityPostPollOptionRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        memberRepo = mock(CommunityMemberRepository.class);
        commentRepo = mock(CommunityPostCommentRepository.class);
        voteRepo = mock(CommunityPostPollVoteRepository.class);
        likeRepo = mock(CommunityPostLikeRepository.class);
        notifications = mock(NotificationService.class);

        when(communityRepo.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(communities.get(i.<Long>getArgument(0))));
        when(postRepo.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(posts.get(i.<Long>getArgument(0))));
        when(optionRepo.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(options.get(i.<Long>getArgument(0))));
        when(userRepo.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(users.get(i.<Long>getArgument(0))));
        when(memberRepo.findByUserIdAndCommunityId(anyLong(), anyLong()))
                .thenAnswer(i -> Optional.ofNullable(membership(i.getArgument(0), i.getArgument(1))));
        when(memberRepo.existsByUserIdAndCommunityIdAndStatus(anyLong(), anyLong(), anyString()))
                .thenAnswer(i -> {
                    CommunityMember m = membership(i.getArgument(0), i.getArgument(1));
                    return m != null && m.getStatus().equals(i.getArgument(2));
                });
        when(memberRepo.findByCommunityIdAndStatusOrderByJoinedAtDesc(anyLong(), anyString()))
                .thenAnswer(i -> members.values().stream()
                        .filter(m -> m.getCommunity().getId().equals(i.getArgument(0))
                                && m.getStatus().equals(i.getArgument(1)))
                        .toList());
        when(memberRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(commentRepo.findByCommunityPostIdOrderByCreatedAtAsc(anyLong())).thenReturn(List.of());
        when(commentRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(likeRepo.findByUserIdAndCommunityPostId(anyLong(), anyLong())).thenReturn(Optional.empty());

        service = new CommunityService(communityRepo, memberRepo, postRepo, likeRepo, commentRepo,
                optionRepo, voteRepo, userRepo, notifications);
    }

    // ── D1: başka topluluğun gönderisinin yorumları okunamaz ─────────────────────

    @Test
    void d1_readingCommentsOfAnotherCommunitysPostIsRejected() {
        assertThrows(ResourceNotFoundException.class, () -> service.getPostComments(PUB, POST_PRIV, 4L));
        assertThrows(ResourceNotFoundException.class, () -> service.getPostComments(PUB, POST_PRIV, null), "oturumsuz");
        verify(commentRepo, never()).findByCommunityPostIdOrderByCreatedAtAsc(POST_PRIV);
    }

    @Test
    void d1_membersStillReadTheirOwnCommunitysComments() {
        assertDoesNotThrow(() -> service.getPostComments(PRIV, POST_PRIV, 3L));
        assertDoesNotThrow(() -> service.getPostComments(PUB, POST_PUB, null), "PUBLIC herkese açık");
    }

    // ── D2: başka topluluğa yorum / oy yazılamaz ─────────────────────────────────

    @Test
    void d2_commentingOnAnotherCommunitysPostIsRejected() {
        assertThrows(ResourceNotFoundException.class, () -> service.addPostComment(4L, PUB, POST_PRIV, "sızma"));
        verify(commentRepo, never()).save(any());
        verifyNoInteractions(notifications);
    }

    @Test
    void d2_memberCanStillCommentInOwnCommunity() {
        assertDoesNotThrow(() -> service.addPostComment(3L, PRIV, POST_PRIV, "merhaba"));
        verify(commentRepo).save(any());
    }

    @Test
    void d2_votingOnAnotherCommunitysPollIsRejected() {
        assertThrows(ResourceNotFoundException.class, () -> service.votePoll(4L, PUB, POST_PRIV, OPT_PRIV));
        verify(voteRepo, never()).save(any());
        verify(voteRepo, never()).delete(any());
    }

    @Test
    void d2_votingWithAnOptionOfAnotherPollIsRejected() {
        // Gönderi doğru toplulukta, seçenek başka topluluğun anketinden
        assertThrows(ResourceNotFoundException.class, () -> service.votePoll(4L, PUB, POST_PUB, OPT_PRIV));
        verify(voteRepo, never()).save(any());
    }

    @Test
    void d2_validVoteStillWorks() {
        assertDoesNotThrow(() -> service.votePoll(4L, PUB, POST_PUB, OPT_PUB));
        verify(voteRepo).save(any());
    }

    // ── D3: yetkisiz beğeni ──────────────────────────────────────────────────────

    @Test
    void d3_outsiderCannotLikeOrUnlikePrivateOrSecretPosts() {
        assertThrows(IllegalArgumentException.class, () -> service.likeCommunityPost(4L, PRIV, POST_PRIV));
        assertThrows(ResourceNotFoundException.class, () -> service.likeCommunityPost(4L, SECRET, POST_SECRET));
        assertThrows(IllegalArgumentException.class, () -> service.unlikeCommunityPost(4L, PRIV, POST_PRIV));
        assertThrows(ResourceNotFoundException.class, () -> service.unlikeCommunityPost(4L, SECRET, POST_SECRET));
        verify(likeRepo, never()).save(any());
        verify(likeRepo, never()).delete(any());
    }

    @Test
    void d3_likeThroughAnotherCommunitysUrlIsRejected() {
        // PUBLIC topluluk adresi üzerinden PRIVATE gönderi
        assertThrows(ResourceNotFoundException.class, () -> service.likeCommunityPost(4L, PUB, POST_PRIV));
        verify(likeRepo, never()).save(any());
    }

    @Test
    void d3_existingLikeRulesAreKept() {
        assertDoesNotThrow(() -> service.likeCommunityPost(3L, PRIV, POST_PRIV), "aktif üye");
        assertDoesNotThrow(() -> service.likeCommunityPost(3L, PUB, POST_PUB), "PUBLIC gönderiyi üye olmayan da beğenir");
        assertDoesNotThrow(() -> service.likeCommunityPost(5L, PRIV, POST_PRIV), "admin");
        verify(likeRepo, times(3)).save(any());
    }

    // ── D4: üye listesi ──────────────────────────────────────────────────────────

    @Test
    void d4_privateAndSecretMemberListsAreHiddenFromOutsiders() {
        assertThrows(IllegalArgumentException.class, () -> service.getMembers(PRIV, 4L));
        assertThrows(IllegalArgumentException.class, () -> service.getMembers(PRIV, null), "oturumsuz");
        assertThrows(IllegalArgumentException.class, () -> service.getMembers(PRIV, 6L), "isteği bekleyen");
        assertThrows(ResourceNotFoundException.class, () -> service.getMembers(SECRET, 4L));
        assertThrows(ResourceNotFoundException.class, () -> service.getMembers(SECRET, null));
    }

    @Test
    void d4_authorisedUsersStillSeeMemberLists() {
        assertEquals(3, service.getMembers(PRIV, 3L).size(), "aktif üye");
        assertEquals(3, service.getMembers(PRIV, 5L).size(), "admin");
        assertEquals(1, service.getMembers(SECRET, 1L).size(), "gizli topluluğun sahibi");
        assertEquals(1, service.getMembers(PUB, null).size(), "PUBLIC oturumsuz da açık");
    }

    // ── D5: sıradan üye bekleyen isteği davetle onaylayamaz ──────────────────────

    @Test
    void d5_normalMemberCannotApprovePendingRequestViaInvite() {
        assertThrows(IllegalArgumentException.class, () -> service.inviteUser(3L, PRIV, 6L));
        assertEquals("PENDING", membership(6, PRIV).getStatus());
        verifyNoInteractions(notifications);
    }

    @Test
    void d5_normalMemberCannotApproveDirectly() {
        assertThrows(IllegalArgumentException.class, () -> service.approveRequest(3L, PRIV, 6L));
        assertEquals("PENDING", membership(6, PRIV).getStatus());
    }

    @Test
    void d5_moderatorCanStillApproveViaInvite() {
        service.inviteUser(2L, PRIV, 6L);
        assertEquals("ACTIVE", membership(6, PRIV).getStatus());
        verify(notifications).sendSystem(eq(6L), eq("community_request_approved"), eq("community"), eq(PRIV), anyString());
    }

    @Test
    void d5_moderatorAndAdminCanApproveRequests() {
        service.approveRequest(2L, PRIV, 6L);
        assertEquals("ACTIVE", membership(6, PRIV).getStatus());

        membership(6, PRIV).setStatus("PENDING");
        service.approveRequest(5L, PRIV, 6L);
        assertEquals("ACTIVE", membership(6, PRIV).getStatus(), "admin üye olmasa da onaylar");
    }

    @Test
    void d5_regularInviteFlowIsUnchanged() {
        // Sıradan üye, hiç ilişkisi olmayan birini davet edebilir (INVITED)
        service.inviteUser(3L, PRIV, 7L);
        verify(memberRepo).save(argThat(m -> m.getUser().getId().equals(7L) && "INVITED".equals(m.getStatus())));
        verify(notifications).send(7L, 3L, "community_invite", "community", PRIV);
    }
}
