package com.concertly.backend.service;

import com.concertly.backend.controller.ConcertBuddyController;
import com.concertly.backend.controller.EventAttendanceController;
import com.concertly.backend.controller.EventBookmarkController;
import com.concertly.backend.controller.MediaController;
import com.concertly.backend.controller.SpotifyController;
import com.concertly.backend.dto.request.CreateCommentRequest;
import com.concertly.backend.dto.response.CommentResponse;
import com.concertly.backend.dto.response.FriendAttendeeDto;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Comment;
import com.concertly.backend.model.ConcertBuddy;
import com.concertly.backend.model.Post;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.*;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.storage.LocalImageStorage;
import com.concertly.backend.service.storage.MediaUploadService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** N fazı güvenlik düzeltmeleri: SEC-01..04, SEC-06, N-55 (N-58 PasswordResetSecurityTest'te). */
class SecurityFixesNPhaseTest {

    private static final String SECRET = "test-secret-key-that-is-at-least-32-characters-long";

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private static void loginAs(Long id) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(id + ":u" + id + "@mail.com", null, List.of()));
    }

    private static User user(long id, String name) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername(name);
        u.setCity("Ankara");
        return u;
    }

    // ── SEC-01: Spotify state ───────────────────────────────────────────────────

    private SpotifyUserService spotifyService(JwtUtil jwt) {
        SpotifyUserService s = new SpotifyUserService(mock(SpotifyConnectionRepository.class),
                mock(UserRepository.class), mock(ArtistRepository.class), mock(ArtistFollowRepository.class),
                mock(SpotifyService.class), jwt);
        ReflectionTestUtils.setField(s, "clientId", "cid");
        ReflectionTestUtils.setField(s, "clientSecret", "sec");
        ReflectionTestUtils.setField(s, "configuredRedirectUri", "https://x.test/api/spotify/callback");
        return s;
    }

    @Test
    void sec01_authUrlCarriesSignedStateNotRawUserId() {
        JwtUtil jwt = new JwtUtil(SECRET, 3_600_000L);
        SpotifyUserService s = spotifyService(jwt);
        String url = s.getAuthUrl(7L);
        String state = url.substring(url.indexOf("&state=") + 7, url.indexOf("&show_dialog"));
        state = java.net.URLDecoder.decode(state, java.nio.charset.StandardCharsets.UTF_8);
        assertNotEquals("7", state);
        assertEquals(7L, s.verifyState(state));
    }

    @Test
    void sec01_rawUserIdExpiredForeignAndAccessTokensAreRejected() {
        JwtUtil jwt = new JwtUtil(SECRET, 3_600_000L);
        SpotifyUserService s = spotifyService(jwt);
        assertNull(s.verifyState("7"));
        assertNull(s.verifyState(null));
        assertNull(s.verifyState(jwt.generateToken(7L, "a@b.com")));          // erişim belirteci
        assertNull(s.verifyState(jwt.generatePurposeToken(7L, "other", 60_000L))); // başka amaç
        assertNull(s.verifyState(jwt.generatePurposeToken(7L, "spotify-link", -1000L))); // süresi dolmuş
        JwtUtil other = new JwtUtil("another-secret-key-that-is-also-32-chars-long!!", 3_600_000L);
        assertNull(s.verifyState(other.generatePurposeToken(7L, "spotify-link", 60_000L))); // yanlış imza
    }

    @Test
    void sec01_purposeTokenIsNotAValidAccessToken() {
        JwtUtil jwt = new JwtUtil(SECRET, 3_600_000L);
        String state = jwt.generatePurposeToken(7L, "spotify-link", 60_000L);
        // Subject "id:email" biçiminde değil: JwtFilter kullanıcıyı çözemez
        assertEquals("7", jwt.extractEmail(state));
    }

    @Test
    void sec01_callbackRejectsInvalidStateWithoutLinking() {
        SpotifyUserService svc = mock(SpotifyUserService.class);
        when(svc.verifyState("7")).thenReturn(null);
        ResponseEntity<String> res = new SpotifyController(svc).handleCallback("code", "7");
        assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode());
        verify(svc, never()).handleCallback(any(), anyLong());
    }

    @Test
    void sec01_callbackLinksWhenStateValid() {
        SpotifyUserService svc = mock(SpotifyUserService.class);
        when(svc.verifyState("signed")).thenReturn(7L);
        when(svc.handleCallback("code", 7L)).thenReturn(true);
        ResponseEntity<String> res = new SpotifyController(svc).handleCallback("code", "signed");
        assertEquals(HttpStatus.OK, res.getStatusCode());
        verify(svc).handleCallback("code", 7L);
    }

    // ── SEC-02: kaydedilenler ───────────────────────────────────────────────────

    @Test
    void sec02_bookmarksOnlyForOwner() {
        EventBookmarkService svc = mock(EventBookmarkService.class);
        EventBookmarkController c = new EventBookmarkController(svc);
        loginAs(5L);
        assertThrows(AccessDeniedException.class, () -> c.getUserBookmarks(9L));
        verify(svc, never()).getUserBookmarks(anyLong());
        c.getUserBookmarks(5L);
        verify(svc).getUserBookmarks(5L);
    }

    @Test
    void sec02_bookmarksAnonymousDenied() {
        EventBookmarkController c = new EventBookmarkController(mock(EventBookmarkService.class));
        assertThrows(AccessDeniedException.class, () -> c.getUserBookmarks(5L));
    }

    // ── SEC-03: yorumlar ────────────────────────────────────────────────────────

    private final CommentRepository comments = mock(CommentRepository.class);
    private final PostRepository posts = mock(PostRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final ModerationService moderation = mock(ModerationService.class);
    private final CommentService commentService = new CommentService(comments, posts, users, notifications,
            mock(ContentLimitService.class), moderation,
            new PrivacyService(mock(com.concertly.backend.repository.FollowRepository.class), users));

    private Post post(long id, User author, boolean hidden) {
        Post p = new Post();
        ReflectionTestUtils.setField(p, "id", id);
        p.setUser(author);
        p.setIsHidden(hidden);
        when(posts.findById(id)).thenReturn(Optional.of(p));
        return p;
    }

    private static CreateCommentRequest req() {
        CreateCommentRequest r = new CreateCommentRequest();
        r.setContent("merhaba");
        return r;
    }

    @Test
    void sec03_commentOnHiddenPostIs404AndNoNotification() {
        post(1L, user(2, "yazar"), true);
        when(moderation.getHiddenUserIds(3L)).thenReturn(Set.of());
        assertThrows(ResourceNotFoundException.class, () -> commentService.addComment(3L, 1L, req()));
        verify(comments, never()).save(any());
        verify(notifications, never()).send(any(), any(), anyString(), anyString(), any());
    }

    @Test
    void sec03_commentWhenBlockedEitherWayIs404() {
        post(1L, user(2, "yazar"), false);
        when(moderation.getHiddenUserIds(3L)).thenReturn(Set.of(2L));
        assertThrows(ResourceNotFoundException.class, () -> commentService.addComment(3L, 1L, req()));
        verify(comments, never()).save(any());
        verify(notifications, never()).send(any(), any(), anyString(), anyString(), any());
    }

    @Test
    void sec03_commentOnVisiblePostStillWorks() {
        post(1L, user(2, "yazar"), false);
        when(moderation.getHiddenUserIds(3L)).thenReturn(Set.of());
        when(users.findById(3L)).thenReturn(Optional.of(user(3, "ben")));
        when(comments.save(any(Comment.class))).thenAnswer(i -> i.getArgument(0));
        CommentResponse r = commentService.addComment(3L, 1L, req());
        assertEquals("merhaba", r.getContent());
        verify(notifications).send(eq(2L), eq(3L), eq("comment"), eq("post"), eq(1L));
    }

    @Test
    void sec03_readHiddenPostIs404ButOwnerCanRead() {
        post(1L, user(2, "yazar"), true);
        when(moderation.getHiddenUserIds(any())).thenReturn(Set.of());
        when(comments.findByPostIdOrderByCreatedAtDesc(1L)).thenReturn(List.of());
        assertThrows(ResourceNotFoundException.class, () -> commentService.getCommentsByPost(1L, null));
        assertThrows(ResourceNotFoundException.class, () -> commentService.getCommentsByPost(1L, 3L));
        assertDoesNotThrow(() -> commentService.getCommentsByPost(1L, 2L));
    }

    @Test
    void sec03_readBlockedAuthorPostIs404() {
        post(1L, user(2, "yazar"), false);
        when(moderation.getHiddenUserIds(3L)).thenReturn(Set.of(2L));
        assertThrows(ResourceNotFoundException.class, () -> commentService.getCommentsByPost(1L, 3L));
    }

    @Test
    void sec03_readFiltersBlockedCommenters() {
        post(1L, user(2, "yazar"), false);
        when(moderation.getHiddenUserIds(3L)).thenReturn(Set.of(4L));
        Comment ok = new Comment();
        ok.setUser(user(5, "iyi"));
        ok.setContent("a");
        Comment blocked = new Comment();
        blocked.setUser(user(4, "engelli"));
        blocked.setContent("b");
        when(comments.findByPostIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(ok, blocked));
        List<CommentResponse> res = commentService.getCommentsByPost(1L, 3L);
        assertEquals(1, res.size());
        assertEquals("iyi", res.get(0).getUsername());
    }

    @Test
    void sec03_anonymousReadWorksOnVisiblePost() {
        post(1L, user(2, "yazar"), false);
        when(moderation.getHiddenUserIds(null)).thenReturn(Set.of());
        when(comments.findByPostIdOrderByCreatedAtDesc(1L)).thenReturn(List.of());
        assertTrue(commentService.getCommentsByPost(1L, null).isEmpty());
    }

    // ── SEC-04: buddies + friends ───────────────────────────────────────────────

    private ConcertBuddy buddy(User u, String message) {
        ConcertBuddy b = new ConcertBuddy();
        b.setUser(u);
        b.setMessage(message);
        return b;
    }

    @Test
    void sec04_anonymousBuddyListHasNoCityOrMessage() {
        ConcertBuddyRepository repo = mock(ConcertBuddyRepository.class);
        when(repo.findByEventIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(buddy(user(5, "ali"), "gizli not")));
        ConcertBuddyController c = new ConcertBuddyController(repo, mock(EventRepository.class),
                mock(UserRepository.class), moderation);
        when(moderation.getHiddenUserIds(null)).thenReturn(Set.of());
        List<Map<String, Object>> res = c.getBuddies(1L);
        assertEquals(1, res.size());
        assertEquals("ali", res.get(0).get("username"));
        assertFalse(res.get(0).containsKey("city"));
        assertFalse(res.get(0).containsKey("message"));
    }

    @Test
    void sec04_loggedInBuddyListFiltersBlockedAndKeepsDetails() {
        ConcertBuddyRepository repo = mock(ConcertBuddyRepository.class);
        when(repo.findByEventIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(
                buddy(user(5, "ali"), "selam"), buddy(user(6, "engelli"), "x")));
        ConcertBuddyController c = new ConcertBuddyController(repo, mock(EventRepository.class),
                mock(UserRepository.class), moderation);
        loginAs(3L);
        when(moderation.getHiddenUserIds(3L)).thenReturn(Set.of(6L));
        List<Map<String, Object>> res = c.getBuddies(1L);
        assertEquals(1, res.size());
        assertEquals("Ankara", res.get(0).get("city"));
        assertEquals("selam", res.get(0).get("message"));
    }

    @Test
    void sec04_friendsEmptyForAnonymousAndFilteredForBlocked() {
        EventAttendanceService svc = mock(EventAttendanceService.class);
        EventAttendanceController c = new EventAttendanceController(svc, moderation);
        assertTrue(c.getFriendsAttending(1L).isEmpty());
        verify(svc, never()).getFriendsAttending(any(), any());

        loginAs(3L);
        when(moderation.getHiddenUserIds(3L)).thenReturn(Set.of(6L));
        when(svc.getFriendsAttending(3L, 1L)).thenReturn(List.of(
                FriendAttendeeDto.from(user(5, "ali")), FriendAttendeeDto.from(user(6, "engelli"))));
        List<FriendAttendeeDto> res = c.getFriendsAttending(1L);
        assertEquals(1, res.size());
        assertEquals(5L, res.get(0).getUserId());
    }

    // ── SEC-06: görsel imzası ───────────────────────────────────────────────────

    private static final byte[] PNG = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
    private static final byte[] JPG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0, 0, 0, 0, 0, 0, 0};
    private static final byte[] GIF = "GIF89a______".getBytes();
    private static final byte[] WEBP = "RIFF\0\0\0\0WEBP".getBytes();

    @Test
    void sec06_validSignaturesAreAccepted(@TempDir Path dir) throws Exception {
        MediaController c = new MediaController(new LocalImageStorage(dir.toString()), mock(MediaUploadService.class));
        assertTrue(c.upload(new MockMultipartFile("file", "a.png", "image/png", PNG)).get("url").startsWith("/uploads/"));
        assertNotNull(c.upload(new MockMultipartFile("file", "a.JPG", "image/jpeg", JPG)));
        assertNotNull(c.upload(new MockMultipartFile("file", "a.jpeg", "image/jpeg", JPG)));
        assertNotNull(c.upload(new MockMultipartFile("file", "a.gif", "image/gif", GIF)));
        assertNotNull(c.upload(new MockMultipartFile("file", "a.webp", "image/webp", WEBP)));
    }

    @Test
    void sec06_mismatchedOrFakeContentIsRejected(@TempDir Path dir) throws Exception {
        MediaController c = new MediaController(new LocalImageStorage(dir.toString()), mock(MediaUploadService.class));
        byte[] html = "<html><script>alert(1)</script>".getBytes();
        for (MockMultipartFile f : List.of(
                new MockMultipartFile("file", "a.png", "image/png", html),
                new MockMultipartFile("file", "a.jpg", "image/jpeg", PNG),
                new MockMultipartFile("file", "a.webp", "image/webp", "RIFF\0\0\0\0WAVE".getBytes()),
                new MockMultipartFile("file", "a.gif", "image/gif", new byte[]{1}))) {
            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> c.upload(f));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            assertEquals("INVALID_IMAGE", ex.getReason());
        }
        try (var files = java.nio.file.Files.list(dir)) {
            assertEquals(0, files.count(), "reddedilen dosya diske yazılmamalı");
        }
    }

    // ── N-55: büyük/küçük harf duyarsız kullanıcı adı ───────────────────────────

    @Test
    void n55_lookupPrefersExactThenSingleIgnoreCaseNeverAmbiguous() {
        UserRepository repo = mock(UserRepository.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        User exact = user(1, "Emre");
        User lower = user(2, "emre");
        doReturn(Optional.of(exact)).when(repo).findByUsername("Emre");
        doReturn(Optional.empty()).when(repo).findByUsername("EMRE");
        doReturn(List.of(exact, lower)).when(repo).findAllByUsernameIgnoreCase("EMRE");
        doReturn(Optional.empty()).when(repo).findByUsername("tek");
        doReturn(List.of(lower)).when(repo).findAllByUsernameIgnoreCase("tek");

        assertEquals(1L, repo.findByUsernameNormalized("Emre").orElseThrow().getId()); // birebir
        assertTrue(repo.findByUsernameNormalized("EMRE").isEmpty());                   // belirsiz -> yok
        assertEquals(2L, repo.findByUsernameNormalized("tek").orElseThrow().getId());  // tek eşleşme
        assertTrue(repo.findByUsernameNormalized(" ").isEmpty());
    }

    @Test
    void n55_getUserByUsernameUsesNormalizedLookup() {
        UserRepository repo = mock(UserRepository.class);
        UserService svc = new UserService(repo, mock(PostRepository.class), mock(LikeRepository.class),
                mock(CommentRepository.class), mock(EventVerificationRepository.class),
                mock(BingoCardRepository.class), mock(BadgeService.class), mock(ConcertAttendanceService.class),
                mock(org.springframework.security.crypto.password.PasswordEncoder.class),
                mock(com.concertly.backend.repository.FollowRepository.class));
        when(repo.findByUsernameNormalized("EMRE")).thenReturn(Optional.of(user(1, "emre")));
        assertEquals("emre", svc.getUserByUsername("EMRE").getUsername());
        when(repo.findByUsernameNormalized("yok")).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> svc.getUserByUsername("yok"));
    }

    @Test
    void n55_registerRejectsUsernameDifferingOnlyByCase() {
        UserRepository repo = mock(UserRepository.class);
        AuthService auth = new AuthService(repo, mock(ArtistRepository.class), mock(ArtistFollowRepository.class),
                new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(), mock(JwtUtil.class),
                mock(org.springframework.security.authentication.AuthenticationManager.class),
                mock(RefreshTokenService.class), mock(EmailService.class), mock(EmailVerificationService.class),
                new com.concertly.backend.security.AuthRateLimiter());
        when(repo.findAllByEmailIgnoreCase(anyString())).thenReturn(List.of());
        when(repo.findAllByUsernameIgnoreCase(anyString())).thenReturn(List.of(user(9, "emre")));
        com.concertly.backend.dto.request.RegisterRequest r = new com.concertly.backend.dto.request.RegisterRequest();
        r.setUsername("emre");
        r.setEmail("yeni@test.local");
        r.setPassword("abc123");
        assertThrows(com.concertly.backend.exception.AlreadyExistsException.class, () -> auth.register(r));
        verify(repo, never()).save(any());
    }
}
