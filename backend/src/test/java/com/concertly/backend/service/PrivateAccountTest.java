package com.concertly.backend.service;

import com.concertly.backend.config.ShareLinkConfig;
import com.concertly.backend.controller.BadgeController;
import com.concertly.backend.controller.ShareController;
import com.concertly.backend.controller.UserController;
import com.concertly.backend.dto.request.CreateCommentRequest;
import com.concertly.backend.dto.request.PrivacySettingsRequest;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.dto.response.UserSummaryResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * SEC-05 "Özel Hesap": görüntüleyen x içerik matrisi, takip isteği akışı ve açık hesapların
 * eskisi gibi davrandığının regresyonu.
 *
 * Görüntüleyiciler: 2 yabancı, 3 bekleyen istek sahibi, 4 kabul edilmiş takipçi, 5 admin,
 * 6 engellenmiş, 1 hesabın sahibi (özel), anonim = null. 9 açık hesap.
 */
class PrivateAccountTest {

    static final long OWNER = 1, STRANGER = 2, PENDING = 3, FOLLOWER = 4, ADMIN = 5, BLOCKED = 6, PUBLIC_OWNER = 9;
    static final Long[] ALLOWED = {(long) OWNER, (long) FOLLOWER, (long) ADMIN};
    static final Long[] DENIED = {null, (long) STRANGER, (long) PENDING};

    FollowRepository follows;
    UserRepository users;
    BlockRepository blocks;
    NotificationService notifications;
    ModerationService moderation;
    PrivacyService privacy;
    User owner, publicOwner;

    @BeforeEach
    void setUp() {
        follows = mock(FollowRepository.class);
        users = mock(UserRepository.class);
        blocks = mock(BlockRepository.class);
        notifications = mock(NotificationService.class);
        moderation = new ModerationService(blocks, mock(ReportRepository.class), users, follows,
                mock(MessageRepository.class), mock(BuddySwipeRepository.class));
        privacy = new PrivacyService(follows, users);

        owner = user(OWNER, true);
        publicOwner = user(PUBLIC_OWNER, false);
        User admin = user(ADMIN, false);
        Role role = new Role();
        role.setName("ROLE_ADMIN");
        admin.getRoles().add(role);
        for (User u : List.of(owner, publicOwner, admin, user(STRANGER, false), user(PENDING, false),
                user(FOLLOWER, false), user(BLOCKED, false))) {
            when(users.findById(u.getId())).thenReturn(Optional.of(u));
        }

        // owner (1) hesabını yalnızca 4 kabul edilmiş olarak takip ediyor; 3 bekliyor
        when(follows.isAcceptedFollower(FOLLOWER, OWNER)).thenReturn(true);
        when(follows.findAcceptedFollowingIds(eq(FOLLOWER), any())).thenReturn(List.of(OWNER));
        when(follows.findByFollowerIdAndFollowingId(FOLLOWER, OWNER)).thenReturn(Optional.of(follow(user(FOLLOWER, false), owner, null)));
        when(follows.findByFollowerIdAndFollowingId(PENDING, OWNER))
                .thenReturn(Optional.of(follow(user(PENDING, false), owner, Follow.PENDING)));
        // 1, 6'yı engellemiş
        when(blocks.existsByBlockerIdAndBlockedId(OWNER, BLOCKED)).thenReturn(true);
        when(blocks.findBlockerIds(BLOCKED)).thenReturn(List.of(OWNER));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    // ── yardımcılar ──────────────────────────────────────────────────────────────

    static User user(long id, boolean isPrivate) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername("u" + id);
        u.setBio("bio" + id);
        u.setCity("Ankara");
        u.setFavoriteGenres("Rock,Pop");
        u.setEmail("u" + id + "@mail.com");
        u.setPrivateAccount(isPrivate);
        return u;
    }

    static Follow follow(User follower, User following, String status) {
        Follow f = new Follow();
        f.setFollower(follower);
        f.setFollowing(following);
        f.setStatus(status);
        return f;
    }

    static Post post(long id, User author) {
        Post p = new Post();
        ReflectionTestUtils.setField(p, "id", id);
        p.setUser(author);
        p.setContent("gizli icerik");
        p.setImageUrl("/uploads/x.jpg");
        return p;
    }

    static void as(Long id) {
        SecurityContextHolder.clearContext();
        if (id != null) {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(id + ":x@test.local", null, List.of()));
        }
    }

    static void assert403PrivateAccount(Runnable r) {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, r::run);
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertEquals("PRIVATE_ACCOUNT", ex.getReason());
    }

    FollowService followService() {
        return new FollowService(follows, users, notifications, moderation, privacy, mock(ArtistFollowRepository.class));
    }

    PostService postService(PostRepository posts, LikeRepository likes, PollVoteRepository votes) {
        return new PostService(posts, users, mock(EventRepository.class), likes, mock(CommentRepository.class),
                notifications, mock(PollOptionRepository.class), votes, mock(BadgeService.class), moderation,
                mock(ContentLimitService.class), privacy);
    }

    // ── PrivacyService ───────────────────────────────────────────────────────────

    @Test
    void contentMatrixForPrivateOwner() {
        for (Long v : ALLOWED) assertTrue(privacy.canViewContent(v, owner), "allowed " + v);
        for (Long v : DENIED) assertFalse(privacy.canViewContent(v, owner), "denied " + v);
        for (Long v : DENIED) assert403PrivateAccount(() -> privacy.requireCanViewContent(v, owner));
        assertDoesNotThrow(() -> privacy.requireCanViewContent(FOLLOWER, (long) OWNER));
    }

    @Test
    void publicOwnerIsVisibleToEveryoneWithoutTouchingFollows() {
        FollowRepository untouched = mock(FollowRepository.class);
        PrivacyService p = new PrivacyService(untouched, users);
        for (Long v : new Long[] {null, 2L, 3L, 4L, 5L, 6L, 9L}) assertTrue(p.canViewContent(v, publicOwner));
        User legacy = user(20, false);
        legacy.setPrivateAccount(null); // eski satır: NULL = açık
        assertTrue(p.canViewContent(null, legacy));
        verifyNoInteractions(untouched);
    }

    @Test
    void bulkFilterReturnsOnlyPrivateOwnersTheViewerCannotSee() {
        List<User> owners = List.of(owner, publicOwner);
        assertEquals(Set.of((long) OWNER), privacy.restrictedOwnerIds(null, owners));
        assertEquals(Set.of((long) OWNER), privacy.restrictedOwnerIds(STRANGER, owners));
        assertEquals(Set.of((long) OWNER), privacy.restrictedOwnerIds(PENDING, owners));
        assertTrue(privacy.restrictedOwnerIds(FOLLOWER, owners).isEmpty());
        assertTrue(privacy.restrictedOwnerIds(OWNER, owners).isEmpty());
        assertTrue(privacy.restrictedOwnerIds(ADMIN, owners).isEmpty());
    }

    // ── Profil başlığı + takip durumu ────────────────────────────────────────────

    @Test
    void profileShowsOnlyHeaderToUnauthorizedViewers() {
        FollowService s = followService();
        when(follows.countAcceptedFollowers(OWNER)).thenReturn(3L);
        when(follows.countAcceptedFollowing(OWNER)).thenReturn(5L);

        for (Long v : DENIED) {
            UserSummaryResponse r = s.getUserProfile(OWNER, v);
            assertEquals("u1", r.getUsername());
            assertEquals("bio1", r.getBio());          // başlıkta kalır
            assertEquals(3L, r.getFollowerCount());     // yalnızca ACCEPTED sayısı
            assertEquals(5L, r.getFollowingCount());
            assertTrue(r.getIsPrivate());
            assertNull(r.getCity());
            assertNull(r.getFavoriteGenres());
            assertNull(r.getEmail());
        }
        assertEquals("NONE", s.getUserProfile(OWNER, (long) STRANGER).getFollowStatus());
        UserSummaryResponse pending = s.getUserProfile(OWNER, (long) PENDING);
        assertEquals("PENDING", pending.getFollowStatus());
        assertFalse(pending.isFollowedByCurrentUser());
    }

    @Test
    void profileShowsEverythingToFollowerSelfAndAdmin() {
        FollowService s = followService();
        UserSummaryResponse f = s.getUserProfile(OWNER, (long) FOLLOWER);
        assertEquals("ACCEPTED", f.getFollowStatus());
        assertTrue(f.isFollowedByCurrentUser());
        assertEquals("Ankara", f.getCity());
        assertEquals("Rock,Pop", f.getFavoriteGenres());
        assertNull(f.getEmail());

        UserSummaryResponse self = s.getUserProfile(OWNER, (long) OWNER);
        assertEquals("Ankara", self.getCity());
        assertEquals("u1@mail.com", self.getEmail());
        assertEquals("NONE", self.getFollowStatus());

        assertEquals("Ankara", s.getUserProfile(OWNER, (long) ADMIN).getCity());
    }

    @Test
    void blockedViewerStillGetsNotFoundForProfile() {
        assertThrows(ResourceNotFoundException.class, () -> followService().getUserProfile(OWNER, (long) BLOCKED));
    }

    @Test
    void publicProfileUnchanged() {
        UserSummaryResponse r = followService().getUserProfile(PUBLIC_OWNER, null);
        assertFalse(r.getIsPrivate());
        assertEquals("Ankara", r.getCity());
        assertEquals("Rock,Pop", r.getFavoriteGenres());
        assertEquals("NONE", r.getFollowStatus());
    }

    @Test
    void profileJsonKeepsOldFieldsAndAddsNewOnes() throws Exception {
        JsonNode j = new ObjectMapper().readTree(new ObjectMapper().writeValueAsString(
                followService().getUserProfile(OWNER, (long) PENDING)));
        for (String k : List.of("id", "username", "profileImageUrl", "followerCount", "followingCount", "city",
                "bio", "favoriteGenres", "isFollowedByCurrentUser", "isPrivate", "followStatus")) {
            assertTrue(j.has(k), "missing " + k);
        }
        assertTrue(j.get("isPrivate").asBoolean());
        assertEquals("PENDING", j.get("followStatus").asText());
    }

    // ── Arama: özel hesabın şehri ────────────────────────────────────────────────

    @Test
    void searchHidesCityOfPrivateUsersForOutsidersOnly() {
        UserRepository userRepo = mock(UserRepository.class);
        when(userRepo.search("us")).thenReturn(List.of(owner, publicOwner));
        SearchService search = new SearchService(mock(EventRepository.class), mock(ArtistRepository.class),
                userRepo, mock(ArtistFollowRepository.class), privacy);

        for (Long v : DENIED) {
            var users = search.search("us", v).getUsers();
            assertNull(users.stream().filter(u -> u.getId() == OWNER).findFirst().orElseThrow().getCity(), "viewer " + v);
            assertEquals("Ankara", users.stream().filter(u -> u.getId() == PUBLIC_OWNER).findFirst().orElseThrow().getCity());
        }
        for (Long v : ALLOWED) {
            var users = search.search("us", v).getUsers();
            assertEquals("Ankara", users.stream().filter(u -> u.getId() == OWNER).findFirst().orElseThrow().getCity(), "viewer " + v);
        }
    }

    // ── follow_request bildirimi: reddet/kabul sonrası yeniden bildirilir, iptal sonrası değil ──

    private NotificationService realNotifications(int[] saved) {
        Set<String> store = new HashSet<>();
        NotificationRepository repo = mock(NotificationRepository.class);
        when(repo.existsByRecipientIdAndActorIdAndTypeAndEntityIdAndCreatedAtAfter(any(), any(), any(), any(), any()))
                .thenAnswer(i -> store.contains(i.getArgument(0) + "|" + i.getArgument(1) + "|" + i.getArgument(2)));
        when(repo.save(any(Notification.class))).thenAnswer(i -> {
            Notification n = i.getArgument(0);
            store.add(n.getRecipient().getId() + "|" + n.getActor().getId() + "|" + n.getType());
            saved[0]++;
            return n;
        });
        doAnswer(i -> store.remove(i.getArgument(0) + "|" + i.getArgument(1) + "|" + i.getArgument(2)))
                .when(repo).deleteByRecipientIdAndActorIdAndType(any(), any(), any());
        return new NotificationService(repo, users, mock(ExpoPushService.class), mock(PushMessageFactory.class));
    }

    @Test
    void rejectThenReRequestNotifiesOwnerAgain() {
        int[] saved = {0};
        FollowService s = new FollowService(follows, users, realNotifications(saved), moderation, privacy, mock(ArtistFollowRepository.class));
        // STRANGER ilk kez ister
        when(follows.findByFollowerIdAndFollowingId(STRANGER, OWNER)).thenReturn(Optional.empty());
        s.follow(STRANGER, OWNER);
        assertEquals(1, saved[0]);
        // sahip reddeder; satır silinir
        when(follows.findByFollowerIdAndFollowingId(STRANGER, OWNER))
                .thenReturn(Optional.of(follow(user(STRANGER, false), owner, Follow.PENDING)));
        s.rejectRequest(OWNER, STRANGER);
        // yeniden ister -> bir bildirim daha
        when(follows.findByFollowerIdAndFollowingId(STRANGER, OWNER)).thenReturn(Optional.empty());
        s.follow(STRANGER, OWNER);
        assertEquals(2, saved[0]);
    }

    @Test
    void cancelThenReRequestDoesNotNotifyOwnerAgain() {
        int[] saved = {0};
        FollowService s = new FollowService(follows, users, realNotifications(saved), moderation, privacy, mock(ArtistFollowRepository.class));
        when(follows.findByFollowerIdAndFollowingId(STRANGER, OWNER)).thenReturn(Optional.empty());
        s.follow(STRANGER, OWNER);
        assertEquals(1, saved[0]);
        when(follows.findByFollowerIdAndFollowingId(STRANGER, OWNER))
                .thenReturn(Optional.of(follow(user(STRANGER, false), owner, Follow.PENDING)));
        s.unfollow(STRANGER, OWNER); // iptal
        when(follows.findByFollowerIdAndFollowingId(STRANGER, OWNER)).thenReturn(Optional.empty());
        s.follow(STRANGER, OWNER);
        assertEquals(1, saved[0]);
    }

    // ── Takipçi / takip listeleri ────────────────────────────────────────────────

    @Test
    void followerAndFollowingListsRequireAuthorizationAndExcludePending() {
        FollowService s = followService();
        for (Long v : DENIED) {
            assert403PrivateAccount(() -> s.getFollowers(OWNER, v));
            assert403PrivateAccount(() -> s.getFollowing(OWNER, v));
        }
        assertThrows(ResourceNotFoundException.class, () -> s.getFollowers(OWNER, (long) BLOCKED));

        User accepted = user(30, false);
        when(follows.findAcceptedFollowers(OWNER)).thenReturn(List.of(follow(accepted, owner, null)));
        for (Long v : ALLOWED) assertEquals(1, s.getFollowers(OWNER, v).size());
        // listeler yalnızca ACCEPTED sorgusundan beslenir; PENDING satırı hiç sorgulanmaz
        verify(follows, never()).findPendingRequests(any(), any());
    }

    @Test
    void privateUsersInsideListsLoseCityAndGenresForOutsiders() {
        User privateFollower = user(31, true);
        when(follows.findAcceptedFollowers(PUBLIC_OWNER)).thenReturn(List.of(follow(privateFollower, publicOwner, null)));
        UserSummaryResponse row = followService().getFollowers(PUBLIC_OWNER, (long) STRANGER).get(0);
        assertNull(row.getCity());
        assertNull(row.getFavoriteGenres());
        assertTrue(row.getIsPrivate());
    }

    // ── Profil alt kaynakları (UserController / BadgeController) ─────────────────

    @Test
    void userContentEndpointsReturn403ForOutsidersAndDelegateOtherwise() {
        UserService userService = mock(UserService.class);
        ArtistService artistService = mock(ArtistService.class);
        UserController c = new UserController(userService, mock(AuthService.class), artistService,
                mock(AccountDeletionService.class), moderation, privacy);

        for (Long v : DENIED) {
            as(v);
            assert403PrivateAccount(() -> c.getUserPosts(OWNER));
            assert403PrivateAccount(() -> c.getUserEvents(OWNER));
            assert403PrivateAccount(() -> c.getFollowedArtists(OWNER));
            assert403PrivateAccount(() -> c.getPassport(OWNER));
        }
        verifyNoInteractions(userService, artistService);

        for (Long v : ALLOWED) { // kendisi (Wrapped /passport), kabul edilmiş takipçi, admin
            as(v);
            c.getUserPosts(OWNER);
            c.getUserEvents(OWNER);
            c.getFollowedArtists(OWNER);
            c.getPassport(OWNER);
        }
        verify(userService, times(3)).getUserPassport(OWNER);

        as(BLOCKED);
        assertThrows(ResourceNotFoundException.class, () -> c.getUserPosts(OWNER));

        // açık hesap: herkes (anonim dahil) eskisi gibi görür
        as(null);
        c.getUserPosts(PUBLIC_OWNER);
        c.getPassport(PUBLIC_OWNER);
        verify(userService).getUserPassport(PUBLIC_OWNER);
    }

    @Test
    void badgeEndpointsAreGatedAndNowCheckBlocks() {
        BadgeService badges = mock(BadgeService.class);
        BadgeController c = new BadgeController(badges, moderation, privacy);
        for (Long v : DENIED) {
            as(v);
            assert403PrivateAccount(() -> c.getUserBadges(OWNER));
            assert403PrivateAccount(() -> c.getAllBadgesWithStatus(OWNER));
        }
        as(BLOCKED);
        assertThrows(ResourceNotFoundException.class, () -> c.getUserBadges(OWNER));
        verifyNoInteractions(badges);
        for (Long v : ALLOWED) {
            as(v);
            c.getUserBadges(OWNER);
            c.getAllBadgesWithStatus(OWNER);
        }
        verify(badges, times(3)).getUserBadges(OWNER);
        as(null);
        c.getUserBadges(PUBLIC_OWNER); // açık hesap, anonim
        verify(badges).getUserBadges(PUBLIC_OWNER);
    }

    // ── Tekil gönderi, beğeni, oy ────────────────────────────────────────────────

    @Test
    void getPostByIdIs404ForOutsidersAndBlockedAndOkForAuthorizedViewers() {
        PostRepository posts = mock(PostRepository.class);
        PostService s = postService(posts, mock(LikeRepository.class), mock(PollVoteRepository.class));
        when(posts.findById(100L)).thenReturn(Optional.of(post(100, owner)));
        when(posts.findById(101L)).thenReturn(Optional.of(post(101, publicOwner)));

        for (Long v : DENIED) assertThrows(ResourceNotFoundException.class, () -> s.getPost(100L, v));
        assertThrows(ResourceNotFoundException.class, () -> s.getPost(100L, (long) BLOCKED));
        for (Long v : ALLOWED) assertEquals(100L, s.getPost(100L, v).getId());
        // açık hesap: anonim dahil herkes
        assertEquals(101L, s.getPost(101L, null).getId());
        assertEquals(101L, s.getPost(101L, (long) STRANGER).getId());
    }

    @Test
    void likeUnlikeAndVoteAreRejectedWithoutSideEffectsForOutsiders() {
        PostRepository posts = mock(PostRepository.class);
        LikeRepository likes = mock(LikeRepository.class);
        PollVoteRepository votes = mock(PollVoteRepository.class);
        PostService s = postService(posts, likes, votes);
        when(posts.findById(100L)).thenReturn(Optional.of(post(100, owner)));
        PollOptionRepository options = mock(PollOptionRepository.class);
        PostService voting = new PostService(posts, users, mock(EventRepository.class), likes,
                mock(CommentRepository.class), notifications, options, votes, mock(BadgeService.class),
                moderation, mock(ContentLimitService.class), privacy);
        PollOption opt = new PollOption();
        ReflectionTestUtils.setField(opt, "id", 7L);
        when(options.findById(7L)).thenReturn(Optional.of(opt));

        for (long v : new long[] {STRANGER, PENDING, BLOCKED}) {
            assertThrows(ResourceNotFoundException.class, () -> s.likePost(v, 100L));
            assertThrows(ResourceNotFoundException.class, () -> s.unlikePost(v, 100L));
            assertThrows(ResourceNotFoundException.class, () -> voting.votePoll(v, 100L, 7L));
        }
        verify(likes, never()).save(any());
        verify(likes, never()).delete(any());
        verify(votes, never()).save(any());
        verify(votes, never()).delete(any());
        verify(notifications, never()).send(any(), any(), eq("like"), any(), any());

        s.likePost(FOLLOWER, 100L); // kabul edilmiş takipçi beğenebilir
        verify(likes).save(any(Like.class));
        verify(notifications).send(eq((long) OWNER), eq((long) FOLLOWER), eq("like"), eq("post"), eq(100L));
    }

    // ── Yorumlar ─────────────────────────────────────────────────────────────────

    @Test
    void commentsReadAndWriteFollowThePostVisibility() {
        CommentRepository comments = mock(CommentRepository.class);
        PostRepository posts = mock(PostRepository.class);
        when(posts.findById(100L)).thenReturn(Optional.of(post(100, owner)));
        CommentService s = new CommentService(comments, posts, users, notifications,
                mock(ContentLimitService.class), moderation, privacy);
        CreateCommentRequest req = new CreateCommentRequest();
        req.setContent("selam");

        for (Long v : DENIED) {
            assertThrows(ResourceNotFoundException.class, () -> s.getCommentsByPost(100L, v));
        }
        for (long v : new long[] {STRANGER, PENDING, BLOCKED}) {
            assertThrows(ResourceNotFoundException.class, () -> s.addComment(v, 100L, req));
        }
        verify(comments, never()).save(any());
        for (Long v : ALLOWED) assertDoesNotThrow(() -> s.getCommentsByPost(100L, v));
    }

    // ── Trend, takip akışı, etkinlik arkadaşları ─────────────────────────────────

    @Test
    void trendingExcludesPrivateOwnersAtQueryLevelForNonAdmins() {
        PostRepository posts = mock(PostRepository.class);
        PostService s = postService(posts, mock(LikeRepository.class), mock(PollVoteRepository.class));
        Post visible = post(101, publicOwner);
        when(posts.findVisibleToViewerOrderByCreatedAtDesc(eq((long) STRANGER), any())).thenReturn(List.of(visible));
        when(posts.findVisibleToViewerOrderByCreatedAtDesc(eq(-1L), any())).thenReturn(List.of(visible));
        when(posts.findVisibleToViewerOrderByCreatedAtDesc(eq((long) FOLLOWER), any()))
                .thenReturn(List.of(visible, post(100, owner)));
        when(posts.findByOrderByCreatedAtDesc(any())).thenReturn(List.of(visible, post(100, owner)));

        assertEquals(1, s.getTrendingFeed(STRANGER, 0, 20).size());
        assertEquals(1, s.getTrendingFeed(null, 0, 20).size());      // anonim: viewerId -1
        assertEquals(2, s.getTrendingFeed(FOLLOWER, 0, 20).size());  // kabul edilmiş takip edilen özel hesap görünür
        assertEquals(2, s.getTrendingFeed(ADMIN, 0, 20).size());     // admin: süzgeçsiz sorgu
        verify(posts, times(1)).findByOrderByCreatedAtDesc(any());
    }

    @Test
    void followQueriesCountOnlyAcceptedRows() throws Exception {
        String feed = PostRepository.class.getMethod("getFollowingFeed", Long.class, Collection.class,
                org.springframework.data.domain.Pageable.class)
                .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        assertTrue(feed.contains("f.status IS NULL OR f.status = 'ACCEPTED'"));
        String trend = PostRepository.class.getMethod("findVisibleToViewerOrderByCreatedAtDesc", Long.class,
                org.springframework.data.domain.Pageable.class)
                .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        assertTrue(trend.contains("p.user.privateAccount") && trend.contains("f.status = 'ACCEPTED'"));
        String friends = EventAttendanceRepository.class.getMethod("findFriendsAttending", Long.class, Long.class)
                .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        assertTrue(friends.contains("f.status = 'ACCEPTED'"));
        for (String m : List.of("isAcceptedFollower", "countAcceptedFollowers", "countAcceptedFollowing",
                "findAcceptedFollowers", "findAcceptedFollowing", "findAcceptedFollowingIds")) {
            String q = Arrays.stream(FollowRepository.class.getMethods()).filter(x -> x.getName().equals(m))
                    .findFirst().orElseThrow()
                    .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
            assertTrue(q.contains("f.status IS NULL OR f.status = 'ACCEPTED'"), m);
        }
    }

    @Test
    void dmFollowingGateUsesAcceptedFollowsOnly() {
        User receiver = user(40, false);
        receiver.setMessagePrivacy(MessagePrivacy.FOLLOWING);
        when(follows.isAcceptedFollower(40L, 3L)).thenReturn(false); // 40, 3'ü yalnızca PENDING takip ediyor
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> moderation.requireCanMessage(3L, receiver));
        assertEquals("DM_FOLLOWING_ONLY", ex.getReason());
        verify(follows, never()).findByFollowerIdAndFollowingId(40L, 3L);
    }

    // ── Sanatçı gönderileri ──────────────────────────────────────────────────────

    @Test
    void artistPostsFilterPrivateAndBlockedOwners() {
        PostRepository posts = mock(PostRepository.class);
        ArtistRepository artists = mock(ArtistRepository.class);
        when(artists.existsById(77L)).thenReturn(true);
        Post privatePost = post(100, owner), publicPost = post(101, publicOwner),
                blockedOwnerPost = post(102, user(6, false));
        when(posts.findByEventArtistIdOrderByCreatedAtDesc(77L))
                .thenReturn(List.of(privatePost, publicPost, blockedOwnerPost));
        ArtistService s = new ArtistService(artists, mock(ArtistFollowRepository.class), users,
                mock(EventRepository.class), posts, mock(LikeRepository.class), mock(CommentRepository.class),
                mock(SpotifyService.class), mock(EventReviewRepository.class), moderation, privacy);

        List<PostResponse> anon = s.getArtistPosts(77L, null);
        assertEquals(List.of(101L, 102L), anon.stream().map(PostResponse::getId).toList());
        assertEquals(List.of(101L, 102L), s.getArtistPosts(77L, (long) STRANGER).stream().map(PostResponse::getId).toList());
        assertEquals(List.of(100L, 101L, 102L), s.getArtistPosts(77L, (long) FOLLOWER).stream().map(PostResponse::getId).toList());
        assertEquals(3, s.getArtistPosts(77L, (long) ADMIN).size());
        // 1'in engellediği 6: engel yönü fark etmez, 1'in gönderisi görünmez
        assertEquals(List.of(101L, 102L), s.getArtistPosts(77L, (long) BLOCKED).stream().map(PostResponse::getId).toList());
    }

    // ── Paylaşım sayfaları ───────────────────────────────────────────────────────

    private ShareController share(ShareLinkService links, UserRepository ur, PostRepository pr) {
        return new ShareController(mock(EventRepository.class), mock(ArtistRepository.class), ur, pr,
                mock(CommunityRepository.class), mock(CommunityMemberRepository.class), links,
                mock(ShareLinkConfig.class));
    }

    @Test
    void shareUserPageHidesBioOfPrivateAccountsOnly() {
        ShareLinkService links = mock(ShareLinkService.class);
        UserRepository ur = mock(UserRepository.class);
        when(ur.findByUsernameNormalized("u1")).thenReturn(Optional.of(owner));
        when(ur.findByUsernameNormalized("u9")).thenReturn(Optional.of(publicOwner));
        ShareController c = share(links, ur, mock(PostRepository.class));

        c.user("u1");
        c.user("u9");
        ArgumentCaptor<String> subtitle = ArgumentCaptor.forClass(String.class);
        verify(links, times(2)).renderLandingPage(anyString(), anyString(), subtitle.capture(), any());
        assertFalse(subtitle.getAllValues().get(0).contains("bio1"));
        assertEquals("bio9", subtitle.getAllValues().get(1));
    }

    @Test
    void sharePostPageIsGenericForPrivateOrHiddenPostsAndUnchangedOtherwise() {
        ShareLinkService links = mock(ShareLinkService.class);
        PostRepository pr = mock(PostRepository.class);
        Post hidden = post(102, publicOwner);
        hidden.setIsHidden(true);
        when(pr.findById(100L)).thenReturn(Optional.of(post(100, owner)));
        when(pr.findById(101L)).thenReturn(Optional.of(post(101, publicOwner)));
        when(pr.findById(102L)).thenReturn(Optional.of(hidden));
        ShareController c = share(links, mock(UserRepository.class), pr);

        c.post(100L);
        c.post(102L);
        ArgumentCaptor<String> title = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> sub = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> img = ArgumentCaptor.forClass(String.class);
        verify(links, times(2)).renderLandingPage(anyString(), title.capture(), sub.capture(), img.capture());
        for (int i = 0; i < 2; i++) {
            assertEquals("Concertly", title.getAllValues().get(i));
            assertFalse(sub.getAllValues().get(i).contains("gizli icerik"));
            assertNull(img.getAllValues().get(i));
        }

        reset(links);
        c.post(101L);
        verify(links).renderLandingPage(eq("post/101"), eq("@u9"), eq("gizli icerik"), eq("/uploads/x.jpg"));
    }

    // Konser arkadaşı kartı (gizli aday yalnız başlık alanlarıyla): BuddyMatchServiceTest

    // ── Takip akışı ──────────────────────────────────────────────────────────────

    @Test
    void followingPrivateAccountCreatesPendingRequestAndRequestNotification() {
        FollowService s = followService();
        when(follows.findByFollowerIdAndFollowingId(STRANGER, OWNER)).thenReturn(Optional.empty());
        s.follow(STRANGER, OWNER);

        ArgumentCaptor<Follow> saved = ArgumentCaptor.forClass(Follow.class);
        verify(follows).save(saved.capture());
        assertEquals(Follow.PENDING, saved.getValue().getStatus());
        verify(notifications).send(eq((long) OWNER), eq((long) STRANGER), eq("follow_request"), eq("user"), eq((long) OWNER));
        verify(notifications, never()).send(any(), any(), eq("follow"), any(), any());
    }

    @Test
    void followingPublicAccountIsAcceptedImmediatelyWithOldNotification() {
        FollowService s = followService();
        when(follows.findByFollowerIdAndFollowingId(STRANGER, PUBLIC_OWNER)).thenReturn(Optional.empty());
        s.follow(STRANGER, PUBLIC_OWNER);

        ArgumentCaptor<Follow> saved = ArgumentCaptor.forClass(Follow.class);
        verify(follows).save(saved.capture());
        assertEquals(Follow.ACCEPTED, saved.getValue().getStatus());
        verify(notifications).send(eq((long) PUBLIC_OWNER), eq((long) STRANGER), eq("follow"), eq("user"), eq((long) PUBLIC_OWNER));
    }

    @Test
    void repeatedFollowRequestIsIdempotent() {
        FollowService s = followService();
        // 3 zaten bekliyor
        assertDoesNotThrow(() -> s.follow(PENDING, OWNER));
        verify(follows, never()).save(any());
        verifyNoInteractions(notifications);
    }

    @Test
    void blockedUserCannotRequestFollow() {
        assertThrows(ResponseStatusException.class, () -> followService().follow(BLOCKED, OWNER));
        verify(follows, never()).save(any());
    }

    @Test
    void requesterCanCancelPendingRequestAndFollowerCanUnfollow() {
        FollowService s = followService();
        Follow pending = follow(user(PENDING, false), owner, Follow.PENDING);
        when(follows.findByFollowerIdAndFollowingId(PENDING, OWNER)).thenReturn(Optional.of(pending));
        s.unfollow(PENDING, OWNER);
        verify(follows).delete(pending);
    }

    @Test
    void ownerAcceptsRequestAndRequesterIsNotified() {
        FollowService s = followService();
        Follow pending = follow(user(PENDING, false), owner, Follow.PENDING);
        when(follows.findByFollowerIdAndFollowingId(PENDING, OWNER)).thenReturn(Optional.of(pending));
        s.acceptRequest(OWNER, PENDING);

        assertEquals(Follow.ACCEPTED, pending.getStatus());
        verify(follows).save(pending);
        verify(notifications).send(eq((long) PENDING), eq((long) OWNER), eq("follow_accepted"), eq("user"), eq((long) OWNER));
    }

    @Test
    void ownerRejectsRequestOnlyWhenPending() {
        FollowService s = followService();
        Follow pending = follow(user(PENDING, false), owner, Follow.PENDING);
        when(follows.findByFollowerIdAndFollowingId(PENDING, OWNER)).thenReturn(Optional.of(pending));
        s.rejectRequest(OWNER, PENDING);
        verify(follows).delete(pending);
        verify(notifications).clearFollowRequest(OWNER, PENDING);
        verifyNoMoreInteractions(notifications);

        // kabul edilmiş takipçi reddet ucuyla silinemez
        assertThrows(ResourceNotFoundException.class, () -> s.rejectRequest(OWNER, FOLLOWER));
        verify(follows, never()).delete(argThat(f -> f != pending));
    }

    @Test
    void cannotActOnARequestNotAddressedToMe() {
        FollowService s = followService();
        // 3'ün isteği 1'e gitti; 9 (başkası) kabul/ret etmeye çalışıyor → 9'a gelen istek yok
        when(follows.findByFollowerIdAndFollowingId(PENDING, PUBLIC_OWNER)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> s.acceptRequest(PUBLIC_OWNER, PENDING));
        assertThrows(ResourceNotFoundException.class, () -> s.rejectRequest(PUBLIC_OWNER, PENDING));
        // sahibin kendisi olmayan biri, JWT kimliğiyle başka birinin bekleyen satırına ulaşamaz
        verify(follows, never()).save(any());
        verify(follows, never()).delete(any());
        verifyNoInteractions(notifications);
    }

    @Test
    void pendingRequestListShowsHeaderFieldsOnly() {
        FollowService s = followService();
        User requester = user(PENDING, true);
        when(follows.findPendingRequests(eq((long) OWNER), any()))
                .thenReturn(List.of(follow(requester, owner, Follow.PENDING)));
        List<UserSummaryResponse> list = s.getFollowRequests(OWNER);
        assertEquals(1, list.size());
        assertEquals("u3", list.get(0).getUsername());
        assertNull(list.get(0).getCity());
        assertNull(list.get(0).getFavoriteGenres());
        assertNull(list.get(0).getEmail());
    }

    // ── Hesap türü değişimi ──────────────────────────────────────────────────────

    private UserService userService(FollowRepository fr) {
        UserService s = new UserService(users, mock(PostRepository.class), mock(LikeRepository.class),
                mock(CommentRepository.class), mock(EventVerificationRepository.class),
                mock(BingoCardRepository.class), mock(BadgeService.class), mock(ConcertAttendanceService.class),
                new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(4), fr);
        ReflectionTestUtils.setField(s, "notificationRepository", mock(NotificationRepository.class));
        return s;
    }

    @Test
    void switchingToPublicDeletesStaleFollowRequestNotificationsOnly() {
        NotificationRepository nr = mock(NotificationRepository.class);
        UserService s = userService(follows);
        ReflectionTestUtils.setField(s, "notificationRepository", nr);
        PrivacySettingsRequest toPublic = new PrivacySettingsRequest();
        toPublic.setPrivateAccount(false);
        s.updatePrivacySettings(OWNER, toPublic);
        verify(nr).deleteByRecipientIdAndType(OWNER, "follow_request");

        PrivacySettingsRequest toPrivate = new PrivacySettingsRequest();
        toPrivate.setPrivateAccount(true);
        s.updatePrivacySettings(OWNER, toPrivate);
        verify(nr, times(1)).deleteByRecipientIdAndType(any(), any());
    }

    @Test
    void followAcceptedNotificationIsNotDeduplicated() {
        int[] saved = {0};
        NotificationService n = realNotifications(saved);
        n.send(STRANGER, OWNER, "follow_accepted", "user", OWNER);
        n.send(STRANGER, OWNER, "follow_accepted", "user", OWNER);
        assertEquals(2, saved[0]);
    }

    @Test
    void switchingToPublicAutoAcceptsPendingRequestsAndSwitchingToPrivateKeepsFollowers() {
        UserService s = userService(follows);
        PrivacySettingsRequest toPublic = new PrivacySettingsRequest();
        toPublic.setPrivateAccount(false);
        s.updatePrivacySettings(OWNER, toPublic);
        verify(follows).acceptAllPending(OWNER);
        assertFalse(owner.getPrivateAccount());

        PrivacySettingsRequest toPrivate = new PrivacySettingsRequest();
        toPrivate.setPrivateAccount(true);
        s.updatePrivacySettings(OWNER, toPrivate);
        verify(follows, times(1)).acceptAllPending(anyLong()); // yalnızca ilk geçişte
        verify(follows, never()).delete(any());
        verify(follows, never()).deleteAll();
        assertTrue(owner.getPrivateAccount());
    }

    // ── Push ─────────────────────────────────────────────────────────────────────

    @Test
    void followRequestNotificationsMapToSocialCategoryWithTrAndEnCopy() {
        assertEquals(PushCategory.SOCIAL, PushCategory.of("follow_request"));
        assertEquals(PushCategory.SOCIAL, PushCategory.of("follow_accepted"));

        Notification n = new Notification();
        n.setActor(user(STRANGER, false));
        PushMessageFactory f = new PushMessageFactory();
        n.setType("follow_request");
        assertEquals("Takip isteği", f.build(n, "tr")[0]);
        assertEquals("u2 seni takip etmek istiyor", f.build(n, "tr")[1]);
        assertEquals("u2 wants to follow you", f.build(n, "en")[1]);
        n.setType("follow_accepted");
        assertEquals("u2 takip isteğini kabul etti", f.build(n, "tr")[1]);
        assertEquals("u2 accepted your follow request", f.build(n, "en")[1]);
    }
}
