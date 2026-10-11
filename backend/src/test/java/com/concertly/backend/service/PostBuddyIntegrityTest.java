package com.concertly.backend.service;

import com.concertly.backend.controller.ConcertBuddyController;
import com.concertly.backend.dto.request.CreatePostRequest;
import com.concertly.backend.dto.response.CommentResponse;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Pageable;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.ReentrantLock;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Post ve Konser Arkadaşı bütünlük düzeltmeleri (11 Eki 2026): anket oyu aitliği, idempotent beğeni,
 * gönderi doğrulaması, yorum silme yetkisi, şikâyet doğrulaması, kalıcı unmatch, mesaj kuralları,
 * eşzamanlı karşılıklı beğeni, pasif/engelli/gizli hesap süzgeçleri, katılım kuralları.
 */
class PostBuddyIntegrityTest {

    // ── ortak yardımcılar ────────────────────────────────────────────────────

    private static User user(long id) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername("u" + id);
        return u;
    }

    private static Post post(long id, User owner, String type) {
        Post p = new Post();
        ReflectionTestUtils.setField(p, "id", id);
        p.setUser(owner);
        p.setPostType(type);
        p.setContent("icerik");
        return p;
    }

    private static PollOption option(long id, Post p, String text) {
        PollOption o = new PollOption();
        ReflectionTestUtils.setField(o, "id", id);
        o.setPost(p);
        o.setOptionText(text);
        return o;
    }

    private static void login(Long id) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(id + ":x@test.local", null, List.of()));
    }

    @AfterEach
    void clearLogin() {
        SecurityContextHolder.clearContext();
    }

    private static int status(ResponseStatusException e) {
        return e.getStatusCode().value();
    }

    // ── PostService ──────────────────────────────────────────────────────────

    private PostRepository posts;
    private UserRepository users;
    private LikeRepository likes;
    private CommentRepository comments;
    private PollOptionRepository options;
    private PollVoteRepository votes;
    private NotificationService notifications;
    private ModerationService moderation;
    private PrivacyService privacy;
    private PostService postService;

    @BeforeEach
    void setUp() {
        posts = mock(PostRepository.class);
        users = mock(UserRepository.class);
        likes = mock(LikeRepository.class);
        comments = mock(CommentRepository.class);
        options = mock(PollOptionRepository.class);
        votes = mock(PollVoteRepository.class);
        notifications = mock(NotificationService.class);
        moderation = mock(ModerationService.class);
        privacy = mock(PrivacyService.class);
        when(privacy.canViewContent(any(), any(User.class))).thenReturn(true);
        when(moderation.getHiddenUserIds(any())).thenReturn(Set.of());
        when(users.findById(7L)).thenReturn(Optional.of(user(7)));
        when(posts.save(any(Post.class))).thenAnswer(i -> {
            Post p = i.getArgument(0);
            if (p.getId() == null) ReflectionTestUtils.setField(p, "id", 500L);
            return p;
        });
        java.util.concurrent.atomic.AtomicLong optionIds = new java.util.concurrent.atomic.AtomicLong(1000);
        when(options.save(any(PollOption.class))).thenAnswer(i -> {
            PollOption o = i.getArgument(0);
            ReflectionTestUtils.setField(o, "id", optionIds.incrementAndGet());
            return o;
        });
        postService = new PostService(posts, users, mock(EventRepository.class), likes, comments, notifications,
                options, votes, mock(BadgeService.class), moderation, mock(ContentLimitService.class), privacy);
    }

    private static CreatePostRequest req(String type, String content, String imageUrl, String... opts) {
        CreatePostRequest r = new CreatePostRequest();
        r.setPostType(type);
        r.setContent(content);
        r.setImageUrl(imageUrl);
        if (opts.length > 0) r.setPollOptions(Arrays.asList(opts));
        return r;
    }

    private void assertBadRequest(String code, Runnable r) {
        ResponseStatusException e = assertThrows(ResponseStatusException.class, r::run);
        assertEquals(400, status(e));
        assertEquals(code, e.getReason());
    }

    @Test
    void pollVoteWithOptionOfAnotherPostIsRejected() {
        Post poll1 = post(1, user(2), "POLL");
        Post poll2 = post(2, user(3), "POLL");
        PollOption foreign = option(20, poll2, "baska");
        when(posts.findById(1L)).thenReturn(Optional.of(poll1));
        when(options.findById(20L)).thenReturn(Optional.of(foreign));

        assertBadRequest("POLL_OPTION_INVALID", () -> postService.votePoll(7L, 1L, 20L));
        verify(votes, never()).save(any());
    }

    @Test
    void pollVoteOnNonPollPostIsRejected() {
        Post text = post(1, user(2), "TEXT");
        when(posts.findById(1L)).thenReturn(Optional.of(text));
        when(options.findById(20L)).thenReturn(Optional.of(option(20, text, "x")));

        assertBadRequest("POLL_OPTION_INVALID", () -> postService.votePoll(7L, 1L, 20L));
        verify(votes, never()).save(any());
    }

    @Test
    void pollVoteIsAnUpsertNotDeleteAndInsert() {
        Post poll = post(1, user(2), "POLL");
        PollOption a = option(10, poll, "A"), b = option(11, poll, "B");
        poll.getPollOptions().addAll(List.of(a, b));
        PollVote existing = new PollVote();
        existing.setPollOption(a);
        existing.setPostId(1L);
        when(posts.findById(1L)).thenReturn(Optional.of(poll));
        when(options.findById(11L)).thenReturn(Optional.of(b));
        when(votes.findByUserIdAndPostId(7L, 1L)).thenReturn(Optional.of(existing));

        var result = postService.votePoll(7L, 1L, 11L);

        assertSame(b, existing.getPollOption());
        verify(votes).save(existing);
        verify(votes, never()).delete(any());
        assertEquals(2, result.size());
    }

    @Test
    void likeIsIdempotentWhenAlreadyLikedOrRaceLost() {
        Post p = post(1, user(2), "TEXT");
        when(posts.findById(1L)).thenReturn(Optional.of(p));
        when(likes.findByUserIdAndPostId(7L, 1L)).thenReturn(Optional.of(new Like()));

        assertDoesNotThrow(() -> postService.likePost(7L, 1L)); // zaten beğenilmiş -> hata yok (204)
        verify(likes, never()).insertIfAbsent(anyLong(), anyLong());

        // Yarış: bakarken yoktu, eklerken başkası ekledi (0 satır) -> sessiz, bildirim yok
        when(likes.findByUserIdAndPostId(7L, 1L)).thenReturn(Optional.empty());
        when(likes.insertIfAbsent(7L, 1L)).thenReturn(0);
        assertDoesNotThrow(() -> postService.likePost(7L, 1L));
        verifyNoInteractions(notifications);

        // Gerçek yeni beğeni -> bildirim bir kez
        when(likes.insertIfAbsent(7L, 1L)).thenReturn(1);
        postService.likePost(7L, 1L);
        verify(notifications, times(1)).send(2L, 7L, "like", "post", 1L);
    }

    @Test
    void unlikeWithoutExistingLikeIsNoop() {
        Post p = post(1, user(2), "TEXT");
        when(posts.findById(1L)).thenReturn(Optional.of(p));
        when(likes.findByUserIdAndPostId(7L, 1L)).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> postService.unlikePost(7L, 1L));
        verify(likes, never()).delete(any());
    }

    @Test
    void createPostRejectsUnknownTypeAndEmptyTextOrPoll() {
        assertBadRequest("POST_TYPE_INVALID", () -> postService.createPost(7L, req("VIDEO", "x", null)));
        assertBadRequest("CONTENT_EMPTY", () -> postService.createPost(7L, req("TEXT", "   ", null)));
        assertBadRequest("CONTENT_EMPTY", () -> postService.createPost(7L, req("POLL", "", null, "a", "b")));
        verify(posts, never()).save(any());
    }

    @Test
    void createPollValidatesOptionCountAndLength() {
        assertBadRequest("POLL_TOO_FEW_OPTIONS", () -> postService.createPost(7L, req("POLL", "soru", null, "a", " ")));
        assertBadRequest("POLL_TOO_MANY_OPTIONS",
                () -> postService.createPost(7L, req("POLL", "soru", null, "a", "b", "c", "d", "e")));
        assertBadRequest("POLL_OPTION_TOO_LONG",
                () -> postService.createPost(7L, req("POLL", "soru", null, "a", "x".repeat(61))));
        verify(posts, never()).save(any());

        PostResponse ok = postService.createPost(7L, req("POLL", "soru", null, "a", "b", "c", "d"));
        assertEquals(4, ok.getPollOptions().size());
    }

    @Test
    void createImagePostAcceptsOnlyUploadPathOrConfiguredR2AndAllowsEmptyCaption() {
        assertBadRequest("INVALID_IMAGE_URL", () -> postService.createPost(7L, req("IMAGE", "", "https://evil.example/a.jpg")));
        assertBadRequest("INVALID_IMAGE_URL", () -> postService.createPost(7L, req("IMAGE", "", "/uploads/../etc")));
        assertBadRequest("INVALID_IMAGE_URL", () -> postService.createPost(7L, req("IMAGE", "", null)));

        // Yazısız görsel gönderisi geçerli (mobil content: '' gönderir)
        PostResponse ok = postService.createPost(7L, req("IMAGE", "", "/uploads/abc.jpg"));
        assertEquals("/uploads/abc.jpg", ok.getImageUrl());

        // R2 yapılandırılmadıysa dış adres reddedilir; yapılandırılınca yalnız o önek kabul edilir
        ReflectionTestUtils.setField(postService, "r2PublicUrl", "https://cdn.concertly.app");
        assertDoesNotThrow(() -> postService.createPost(7L, req("IMAGE", "", "https://cdn.concertly.app/k.jpg")));
        assertBadRequest("INVALID_IMAGE_URL",
                () -> postService.createPost(7L, req("IMAGE", "", "https://cdn.concertly.app.evil.io/k.jpg")));
    }

    @Test
    void patchRejectsMissingContentAndBlankForTextButAllowsBlankForImage() {
        User owner = user(7);
        Post text = post(1, owner, "TEXT");
        Post image = post(2, owner, "IMAGE");
        when(posts.findById(1L)).thenReturn(Optional.of(text));
        when(posts.findById(2L)).thenReturn(Optional.of(image));

        assertBadRequest("CONTENT_EMPTY", () -> postService.updatePost(7L, 1L, null));
        assertBadRequest("CONTENT_EMPTY", () -> postService.updatePost(7L, 1L, "   "));
        assertBadRequest("CONTENT_EMPTY", () -> postService.updatePost(7L, 2L, null));

        // Yazısız görsel gönderisinde metin boşaltılabilir
        PostResponse r = postService.updatePost(7L, 2L, "");
        assertEquals("", r.getContent());
    }

    @Test
    void patchRefreshesUpdatedAtAndResponseExposesIt() {
        Post text = post(1, user(7), "TEXT");
        LocalDateTime old = LocalDateTime.now().minusDays(1);
        text.setUpdatedAt(old);
        when(posts.findById(1L)).thenReturn(Optional.of(text));

        PostResponse r = postService.updatePost(7L, 1L, "yeni metin");
        assertNotNull(r.getUpdatedAt());
        assertTrue(r.getUpdatedAt().isAfter(old));
    }

    @Test
    void feedSizeIsCappedAt50() {
        when(users.existsById(7L)).thenReturn(true);
        when(posts.getFollowingFeed(eq(7L), anyCollection(), any(Pageable.class))).thenReturn(List.of());
        postService.getFollowingFeed(7L, 0, 1000);
        ArgumentCaptor<Pageable> cap = ArgumentCaptor.forClass(Pageable.class);
        verify(posts).getFollowingFeed(eq(7L), anyCollection(), cap.capture());
        assertEquals(50, cap.getValue().getPageSize());

        when(posts.findVisibleToViewerOrderByCreatedAtDesc(eq(7L), any(Pageable.class))).thenReturn(List.of());
        assertTrue(postService.getTrendingFeed(7L, 0, 1000).isEmpty()); // 500'lük aday penceresi bozulmaz
    }

    @Test
    void followingFeedQueryIncludesOwnPostsAndCommentCountSkipsHidden() throws Exception {
        String feed = PostRepository.class.getMethod("getFollowingFeed", Long.class,
                java.util.Collection.class, Pageable.class)
                .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        assertTrue(feed.contains("p.user.id = :userId"), "kendi gönderileri dahil olmalı");

        String count = CommentRepository.class.getMethod("countByPostIdIn", java.util.Collection.class)
                .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        assertTrue(count.contains("isHidden"), "gizli yorum sayılmamalı");
    }

    @Test
    void bannedAuthorsAreDroppedFromTrendingAndQueriesFilterThemInFollowingAndTrending() throws Exception {
        User banned = user(3), fine = user(4);
        banned.setIsActive(false);
        Post pb = post(1, banned, "TEXT"), pf = post(2, fine, "TEXT");
        when(posts.findByOrderByCreatedAtDesc(any(Pageable.class))).thenReturn(List.of(pb, pf));
        when(privacy.isAdmin(7L)).thenReturn(true); // admin yolu: Java süzgeci
        List<PostResponse> res = postService.getTrendingFeed(7L, 0, 20);
        assertEquals(1, res.size());
        assertEquals(2L, res.get(0).getId());

        String following = PostRepository.class.getMethod("getFollowingFeed", Long.class,
                java.util.Collection.class, Pageable.class)
                .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        String trending = PostRepository.class.getMethod("findVisibleToViewerOrderByCreatedAtDesc", Long.class,
                Pageable.class).getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        assertTrue(following.contains("p.user.isActive"));
        assertTrue(trending.contains("p.user.isActive"));
    }

    // ── CommentService ───────────────────────────────────────────────────────

    private CommentService commentService() {
        return new CommentService(comments, posts, users, notifications, mock(ContentLimitService.class),
                moderation, privacy);
    }

    private Comment comment(long id, Post p, User author) {
        Comment c = new Comment();
        ReflectionTestUtils.setField(c, "id", id);
        c.setPost(p);
        c.setUser(author);
        c.setContent("yorum");
        return c;
    }

    @Test
    void commentCanBeDeletedByCommentOwnerOrPostOwnerOnly() {
        User postOwner = user(2), commenter = user(3);
        Post p = post(1, postOwner, "TEXT");
        Comment c = comment(50, p, commenter);
        when(comments.findById(50L)).thenReturn(Optional.of(c));
        CommentService svc = commentService();

        svc.deleteComment(1L, 50L, 3L); // yorum sahibi
        svc.deleteComment(1L, 50L, 2L); // gönderi sahibi
        verify(comments, times(2)).delete(c);

        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> svc.deleteComment(1L, 50L, 99L));
        assertEquals(403, status(e));
        assertEquals("COMMENT_DELETE_FORBIDDEN", e.getReason());
        verify(comments, times(2)).delete(c); // üçüncü kişi silemedi
    }

    @Test
    void deletingCommentThroughWrongPostIdIs404() {
        Post p = post(1, user(2), "TEXT");
        when(comments.findById(50L)).thenReturn(Optional.of(comment(50, p, user(3))));
        assertThrows(ResourceNotFoundException.class, () -> commentService().deleteComment(999L, 50L, 3L));
        verify(comments, never()).delete(any());
    }

    @Test
    void commentsAreReadOldestFirstAndCarryAuthorPhoto() {
        Post p = post(1, user(2), "TEXT");
        when(posts.findById(1L)).thenReturn(Optional.of(p));
        User author = user(3);
        author.setProfileImageUrl("/uploads/me.jpg");
        when(comments.findByPostIdOrderByCreatedAtAscIdAsc(1L)).thenReturn(List.of(comment(1, p, author)));

        List<CommentResponse> res = commentService().getCommentsByPost(1L, 7L);
        assertEquals("/uploads/me.jpg", res.get(0).getUserProfileImageUrl());
        verify(comments, never()).findByPostIdOrderByCreatedAtDesc(anyLong());
    }

    // ── Şikâyet doğrulaması ──────────────────────────────────────────────────

    @Test
    void reportValidatorChecksTypeTargetAndReasonLength() {
        PostRepository p = mock(PostRepository.class);
        UserRepository u = mock(UserRepository.class);
        ReportTargetValidator v = new ReportTargetValidator(p, mock(CommentRepository.class), u,
                mock(MessageRepository.class));

        assertBadRequest("REPORT_TYPE_INVALID", () -> v.validate("BANANA", 1L, "x"));
        assertBadRequest("REPORT_TYPE_INVALID", () -> v.validate(null, 1L, "x"));
        assertBadRequest("REASON_TOO_LONG", () -> v.validate("POST", 1L, "x".repeat(501)));
        assertThrows(ResourceNotFoundException.class, () -> v.validate("POST", 1L, "SPAM"));

        when(p.existsById(1L)).thenReturn(true);
        when(u.existsById(5L)).thenReturn(true);
        assertDoesNotThrow(() -> v.validate("POST", 1L, "x".repeat(500)));
        assertDoesNotThrow(() -> v.validate("USER", 5L, null));
        assertDoesNotThrow(() -> v.validate("COMMUNITY_POST", 9L, "SPAM")); // topluluk kontrolü CommunityService'te
    }

    // ── Mesaj kuralları ──────────────────────────────────────────────────────

    private MessageService messageService(ModerationService mod, MessageRepository msgs, UserRepository usr) {
        return new MessageService(msgs, usr, notifications, mod, mock(ContentLimitService.class));
    }

    @Test
    void messageValidationCodes() {
        UserRepository usr = mock(UserRepository.class);
        MessageService svc = messageService(mock(ModerationService.class), mock(MessageRepository.class), usr);

        assertThrows(IllegalArgumentException.class, () -> svc.send(1L, null, "selam"));
        IllegalArgumentException empty = assertThrows(IllegalArgumentException.class, () -> svc.send(1L, 2L, "  "));
        assertEquals("CONTENT_EMPTY", empty.getMessage());
        assertBadRequest("CONTENT_TOO_LONG", () -> svc.send(1L, 2L, "x".repeat(1001)));
    }

    private ModerationService realModeration(BuddySwipeRepository swipes, MessageRepository msgs, BlockRepository blocks) {
        return new ModerationService(blocks, mock(ReportRepository.class), mock(UserRepository.class),
                mock(FollowRepository.class), msgs, swipes);
    }

    @Test
    void unmatchedPairCannotMessageEvenWithExistingConversation() {
        BuddySwipeRepository swipes = mock(BuddySwipeRepository.class);
        MessageRepository msgs = mock(MessageRepository.class);
        when(msgs.conversationExists(anyLong(), anyLong())).thenReturn(true); // geçmiş sohbet var
        when(swipes.existsUnmatchedBetween(anyLong(), anyLong())).thenReturn(true);
        ModerationService mod = realModeration(swipes, msgs, mock(BlockRepository.class));

        // İki yönde de 403 BUDDY_UNMATCHED (sorgu çifti simetrik; burada iki yön de çağrılır)
        for (long[] pair : new long[][] {{1, 2}, {2, 1}}) {
            ResponseStatusException e = assertThrows(ResponseStatusException.class,
                    () -> mod.requireCanMessage(pair[0], user(pair[1])));
            assertEquals(403, status(e));
            assertEquals("BUDDY_UNMATCHED", e.getReason());
        }
    }

    @Test
    void messageStatusReportsReasonAndReusesSendRule() {
        BuddySwipeRepository swipes = mock(BuddySwipeRepository.class);
        MessageRepository msgs = mock(MessageRepository.class);
        BlockRepository blocks = mock(BlockRepository.class);
        UserRepository usr = mock(UserRepository.class);
        ModerationService mod = realModeration(swipes, msgs, blocks);
        User other = user(2);
        when(usr.findById(2L)).thenReturn(Optional.of(other));
        MessageService svc = messageService(mod, msgs, usr);

        assertEquals(true, svc.status(1L, 2L).get("canMessage"));
        assertNull(svc.status(1L, 2L).get("reason"));

        other.setMessagePrivacy(MessagePrivacy.NOBODY);
        assertEquals("PRIVACY", svc.status(1L, 2L).get("reason"));
        other.setMessagePrivacy(MessagePrivacy.EVERYONE);

        when(swipes.existsUnmatchedBetween(1L, 2L)).thenReturn(true);
        Map<String, Object> st = svc.status(1L, 2L);
        assertEquals(false, st.get("canMessage"));
        assertEquals("BUDDY_UNMATCHED", st.get("reason"));

        when(blocks.existsByBlockerIdAndBlockedId(2L, 1L)).thenReturn(true);
        assertEquals("BLOCKED", svc.status(1L, 2L).get("reason"));
    }

    // ── Konser Arkadaşı ──────────────────────────────────────────────────────

    private ConcertBuddyRepository buddies;
    private BuddySwipeRepository swipes;
    private MessageRepository messages;
    private BuddyMatchService buddyService;
    private final Event concert = event(100L);

    private static Event event(long id) {
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", id);
        e.setName("Konser");
        e.setEventDate(LocalDateTime.now().plusDays(3));
        e.setIsApproved(true);
        return e;
    }

    private static ConcertBuddy looking(User u, Event e) {
        ConcertBuddy b = new ConcertBuddy();
        b.setUser(u);
        b.setEvent(e);
        return b;
    }

    private void buddySetUp() {
        buddies = mock(ConcertBuddyRepository.class);
        swipes = mock(BuddySwipeRepository.class);
        messages = mock(MessageRepository.class);
        buddyService = new BuddyMatchService(buddies, mock(EventAttendanceRepository.class), swipes, users,
                mock(ArtistFollowRepository.class), messages, moderation, notifications);
    }

    @SuppressWarnings("unchecked")
    @Test
    void inactiveUsersAreNotInDeckOrMatches() {
        buddySetUp();
        User me = user(7), active = user(8), banned = user(9);
        banned.setIsActive(false);
        when(buddies.findUpcomingForUser(eq(7L), any())).thenReturn(List.of(looking(me, concert)));
        when(buddies.findForEvents(any())).thenReturn(List.of(looking(active, concert), looking(banned, concert)));
        when(users.findById(7L)).thenReturn(Optional.of(me));

        List<Map<String, Object>> cards = (List<Map<String, Object>>) buddyService.discover(7L, null).get("cards");
        assertEquals(1, cards.size());
        assertEquals(8L, cards.get(0).get("userId"));

        // Eşleşmeler: karşılıklı beğeni olsa da pasif hesap listelenmez
        BuddySwipe mine = new BuddySwipe(); mine.setSwiperId(7L); mine.setTargetId(9L); mine.setLiked(true);
        BuddySwipe theirs = new BuddySwipe(); theirs.setSwiperId(9L); theirs.setTargetId(7L); theirs.setLiked(true);
        when(swipes.findBySwiperId(7L)).thenReturn(List.of(mine));
        when(swipes.findByTargetIdAndLikedTrue(7L)).thenReturn(List.of(theirs));
        when(users.findById(9L)).thenReturn(Optional.of(banned));
        assertTrue(buddyService.matches(7L).isEmpty());
    }

    @Test
    void unmatchMarksPairPermanentlyAndOnlyWhenActuallyMatched() {
        buddySetUp();
        BuddySwipe mine = new BuddySwipe(); mine.setSwiperId(7L); mine.setTargetId(8L); mine.setLiked(true);
        when(swipes.findBySwiperIdAndTargetId(7L, 8L)).thenReturn(Optional.of(mine));
        when(swipes.existsBySwiperIdAndTargetIdAndLikedTrue(8L, 7L)).thenReturn(true);

        buddyService.unmatch(7L, 8L);
        assertNotNull(mine.getUnmatchedAt());
        assertFalse(mine.isLiked());

        // Hiç eşleşmemiş (karşı taraf beğenmemiş) kişi için işaret konmaz
        BuddySwipe lone = new BuddySwipe(); lone.setSwiperId(7L); lone.setTargetId(9L); lone.setLiked(true);
        when(swipes.findBySwiperIdAndTargetId(7L, 9L)).thenReturn(Optional.of(lone));
        buddyService.unmatch(7L, 9L);
        assertNull(lone.getUnmatchedAt());
    }

    @Test
    void undoIsRefusedAfterUnmatchOrAfterTenMinutes() {
        buddySetUp();
        BuddySwipe unmatched = new BuddySwipe(); unmatched.setSwiperId(7L); unmatched.setTargetId(8L);
        unmatched.setUnmatchedAt(LocalDateTime.now());
        when(swipes.findBySwiperIdAndTargetId(7L, 8L)).thenReturn(Optional.of(unmatched));
        assertBadRequest("UNDO_EXPIRED", () -> buddyService.undo(7L, 8L));

        BuddySwipe old = new BuddySwipe(); old.setSwiperId(7L); old.setTargetId(9L);
        ReflectionTestUtils.setField(old, "createdAt", LocalDateTime.now().minusMinutes(11));
        when(swipes.findBySwiperIdAndTargetId(7L, 9L)).thenReturn(Optional.of(old));
        assertBadRequest("UNDO_EXPIRED", () -> buddyService.undo(7L, 9L));

        BuddySwipe fresh = new BuddySwipe(); fresh.setSwiperId(7L); fresh.setTargetId(10L);
        when(swipes.findBySwiperIdAndTargetId(7L, 10L)).thenReturn(Optional.of(fresh));
        buddyService.undo(7L, 10L);
        verify(swipes).delete(fresh);
        verify(swipes, never()).delete(unmatched);
        verify(swipes, never()).delete(old);
    }

    @Test
    void likingAnUnmatchedPairIsRefused() {
        buddySetUp();
        when(users.existsById(8L)).thenReturn(true);
        when(swipes.existsUnmatchedBetween(7L, 8L)).thenReturn(true);
        when(buddies.findUpcomingForUser(anyLong(), any())).thenReturn(List.of(looking(user(7), concert)));
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> buddyService.swipe(7L, 8L, true));
        assertEquals(403, status(e));
        assertEquals("BUDDY_UNMATCHED", e.getReason());
        verify(swipes, never()).save(any());
    }

    @Test
    void repeatedSwipeTakesPairLockAndDoesNotNotifyTwice() {
        buddySetUp();
        User me = user(7), other = user(8);
        when(users.existsById(8L)).thenReturn(true);
        when(users.findById(8L)).thenReturn(Optional.of(other));
        when(buddies.findUpcomingForUser(eq(7L), any())).thenReturn(List.of(looking(me, concert)));
        when(buddies.findUpcomingForUser(eq(8L), any())).thenReturn(List.of(looking(other, concert)));
        when(swipes.existsBySwiperIdAndTargetIdAndLikedTrue(8L, 7L)).thenReturn(true);
        BuddySwipe first = new BuddySwipe();
        when(swipes.findBySwiperIdAndTargetId(7L, 8L)).thenReturn(Optional.empty(), Optional.of(first));

        assertEquals(true, buddyService.swipe(7L, 8L, true).get("matched"));
        first.setSwiperId(7L); first.setTargetId(8L); first.setLiked(true);
        assertEquals(true, buddyService.swipe(7L, 8L, true).get("matched")); // tekrar: 200, hata yok

        verify(notifications, times(1)).send(8L, 7L, "buddy_match", "buddy", 7L);
        verify(swipes, times(2)).lockPair(BuddyMatchService.pairLockKey(7L, 8L));
        assertEquals(BuddyMatchService.pairLockKey(7L, 8L), BuddyMatchService.pairLockKey(8L, 7L));
    }

    /**
     * Eşzamanlı karşılıklı beğeni. pg_advisory_xact_lock bu ortamda (Mockito, DB yok) çalışmaz; kilit
     * lockPair arkasında olduğundan burada transaction'ı taklit eden bir ReentrantLock ile değiştirilir:
     * lockPair kilidi alır, kilit swipe() dönünce (commit) bırakılır. Doğrulanan servis mantığı:
     * kilit altında ikinci istek birincinin kaydını görür; tam bir yanıt matched=true, tek bildirim.
     * SINIR: gerçek PostgreSQL kilidinin davranışı bu testle kanıtlanmaz.
     */
    @Test
    void concurrentMutualLikesYieldExactlyOneMatchAndOneNotification() throws Exception {
        for (int round = 0; round < 25; round++) {
            buddySetUp();
            notifications = mock(NotificationService.class);
            buddyService = new BuddyMatchService(buddies, mock(EventAttendanceRepository.class), swipes, users,
                    mock(ArtistFollowRepository.class), messages, moderation, notifications);
            User u7 = user(7), u8 = user(8);
            when(users.existsById(anyLong())).thenReturn(true);
            when(users.findById(7L)).thenReturn(Optional.of(u7));
            when(users.findById(8L)).thenReturn(Optional.of(u8));
            when(buddies.findUpcomingForUser(eq(7L), any())).thenReturn(List.of(looking(u7, concert)));
            when(buddies.findUpcomingForUser(eq(8L), any())).thenReturn(List.of(looking(u8, concert)));

            // "Veritabanı": yalnız commit edilmiş (kilit bırakılmış) kayıtlar diğer işleme görünür
            Map<String, BuddySwipe> committed = new ConcurrentHashMap<>();
            ThreadLocal<Map<String, BuddySwipe>> pending = ThreadLocal.withInitial(HashMap::new);
            ReentrantLock pairLock = new ReentrantLock();
            when(swipes.lockPair(anyLong())).thenAnswer(i -> { pairLock.lock(); return 1; });
            when(swipes.findBySwiperIdAndTargetId(anyLong(), anyLong())).thenAnswer(i ->
                    Optional.ofNullable(committed.get(i.getArgument(0) + ":" + i.getArgument(1))));
            when(swipes.save(any(BuddySwipe.class))).thenAnswer(i -> {
                BuddySwipe s = i.getArgument(0);
                pending.get().put(s.getSwiperId() + ":" + s.getTargetId(), s);
                return s;
            });
            when(swipes.existsBySwiperIdAndTargetIdAndLikedTrue(anyLong(), anyLong())).thenAnswer(i -> {
                BuddySwipe s = committed.get(i.getArgument(0) + ":" + i.getArgument(1));
                return s != null && s.isLiked();
            });

            ExecutorService pool = Executors.newFixedThreadPool(2);
            CountDownLatch go = new CountDownLatch(1);
            List<Future<Object>> results = new ArrayList<>();
            for (long[] ids : new long[][] {{7, 8}, {8, 7}}) {
                results.add(pool.submit(() -> {
                    go.await();
                    try {
                        return buddyService.swipe(ids[0], ids[1], true).get("matched");
                    } finally {
                        committed.putAll(pending.get()); // commit
                        pending.get().clear();
                        if (pairLock.isHeldByCurrentThread()) pairLock.unlock();
                    }
                }));
            }
            go.countDown();
            int matched = 0;
            for (Future<Object> f : results) if (Boolean.TRUE.equals(f.get(5, TimeUnit.SECONDS))) matched++;
            pool.shutdownNow();

            assertEquals(1, matched, "round " + round);
            verify(notifications, times(1)).send(anyLong(), anyLong(), eq("buddy_match"), eq("buddy"), anyLong());
        }
    }

    // ── Konser arkadaşı listesi / katılım ────────────────────────────────────

    private ConcertBuddyController buddyController(ConcertBuddyRepository repo, EventRepository events,
                                                   PrivacyService priv) {
        return new ConcertBuddyController(repo, events, users, moderation, priv);
    }

    @Test
    void eventBuddyListFiltersBlockedAndInactiveAndHidesPrivateDetails() {
        ConcertBuddyRepository repo = mock(ConcertBuddyRepository.class);
        User open = user(5), priv = user(6), blocked = user(4), banned = user(3);
        open.setCity("Ankara");
        priv.setCity("Izmir");
        banned.setIsActive(false);
        ConcertBuddy bOpen = looking(open, concert); bOpen.setMessage("selam");
        ConcertBuddy bPriv = looking(priv, concert); bPriv.setMessage("gizli");
        when(repo.findByEventIdOrderByCreatedAtDesc(100L)).thenReturn(List.of(
                bOpen, bPriv, looking(blocked, concert), looking(banned, concert)));
        when(moderation.getHiddenUserIds(2L)).thenReturn(Set.of(4L));
        PrivacyService priSvc = mock(PrivacyService.class);
        when(priSvc.restrictedOwnerIds(eq(2L), anyCollection())).thenReturn(Set.of(6L));
        login(2L);

        List<Map<String, Object>> res = buddyController(repo, mock(EventRepository.class), priSvc).getBuddies(100L);

        assertEquals(2, res.size());
        assertEquals("Ankara", res.get(0).get("city"));
        assertEquals("selam", res.get(0).get("message"));
        assertEquals("", res.get(1).get("city"));
        assertEquals("", res.get(1).get("message"));
    }

    @Test
    void joiningCancelledDelistedMergedOrPastEventIsRefused() {
        EventRepository events = mock(EventRepository.class);
        ConcertBuddyRepository repo = mock(ConcertBuddyRepository.class);
        when(users.findById(7L)).thenReturn(Optional.of(user(7)));
        login(7L);
        ConcertBuddyController c = buddyController(repo, events, mock(PrivacyService.class));

        Event cancelled = event(1L); cancelled.setDelistedReason("CANCELLED"); cancelled.setIsApproved(false);
        Event delisted = event(2L); delisted.setDelistedReason("NON_MUSIC");
        Event merged = event(3L); merged.setMergedIntoEventId(100L);
        Event past = event(4L); past.setEventDate(LocalDateTime.now().minusDays(1));
        for (Event e : List.of(cancelled, delisted, merged, past)) {
            when(events.findById(e.getId())).thenReturn(Optional.of(e));
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                    () -> c.joinAsBuddy(e.getId(), null));
            assertEquals("EVENT_NOT_JOINABLE", ex.getMessage());
        }
        verify(repo, never()).save(any());

        when(events.findById(100L)).thenReturn(Optional.of(concert));
        when(repo.findByUserIdAndEventId(7L, 100L)).thenReturn(Optional.empty());
        assertEquals(true, c.joinAsBuddy(100L, null).get("joined"));
    }
}
