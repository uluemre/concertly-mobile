package com.concertly.backend.service;

import com.concertly.backend.controller.ConcertBuddyController;
import com.concertly.backend.controller.EventBookmarkController;
import com.concertly.backend.exception.ApiError;
import com.concertly.backend.exception.GlobalExceptionHandler;
import com.concertly.backend.model.Notification;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.CommunityRepository;
import com.concertly.backend.repository.ConcertBuddyRepository;
import com.concertly.backend.repository.NotificationRepository;
import com.concertly.backend.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.lang.reflect.Method;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** N-phase backend (güvenlik dışı): N-01 süpürme, N-30, N-49, NEW-02, NEW-03. */
class NonSecurityNPhaseTest {

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    // ── N-30: beğeni/takip bildirimi tekrarlanmaz; yorum/mesaj her seferinde gider ──────────

    private NotificationService notificationService(NotificationRepository repo) {
        UserRepository users = mock(UserRepository.class);
        when(users.findById(anyLong())).thenAnswer(i -> Optional.of(new User()));
        return new NotificationService(repo, users, mock(ExpoPushService.class), mock(PushMessageFactory.class));
    }

    private static long anyLong() {
        return org.mockito.ArgumentMatchers.anyLong();
    }

    @Test
    void n30_likeNotificationSkippedWhenAlreadySent() {
        NotificationRepository repo = mock(NotificationRepository.class);
        when(repo.existsByRecipientIdAndActorIdAndTypeAndEntityId(1L, 2L, "like", 10L)).thenReturn(true);
        notificationService(repo).send(1L, 2L, "like", "post", 10L);
        verify(repo, never()).save(any(Notification.class));
    }

    @Test
    void n30_firstLikeAndFollowAreStored() {
        NotificationRepository repo = mock(NotificationRepository.class);
        NotificationService svc = notificationService(repo);
        svc.send(1L, 2L, "like", "post", 10L);
        svc.send(1L, 2L, "follow", "user", 1L);
        verify(repo, times(2)).save(any(Notification.class));
    }

    @Test
    void n30_followSkippedWhenAlreadySent() {
        NotificationRepository repo = mock(NotificationRepository.class);
        when(repo.existsByRecipientIdAndActorIdAndTypeAndEntityId(1L, 2L, "follow", 1L)).thenReturn(true);
        notificationService(repo).send(1L, 2L, "follow", "user", 1L);
        verify(repo, never()).save(any(Notification.class));
    }

    @Test
    void n30_commentAndMessageStillNotifyEveryTime() {
        NotificationRepository repo = mock(NotificationRepository.class);
        when(repo.existsByRecipientIdAndActorIdAndTypeAndEntityId(any(), any(), any(), any())).thenReturn(true);
        NotificationService svc = notificationService(repo);
        svc.send(1L, 2L, "comment", "post", 10L);
        svc.send(1L, 2L, "message", "user", 2L);
        verify(repo, times(2)).save(any(Notification.class));
        verify(repo, never()).existsByRecipientIdAndActorIdAndTypeAndEntityId(any(), any(), any(), any());
    }

    // ── N-49: olmayan yol 404, yöntem 405, 500'de iç mesaj sızmaz ───────────────────────────

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void n49_missingResourceIs404() {
        ResponseEntity<ApiError> r = handler.handleNoResource(new NoResourceFoundException(HttpMethod.GET, "nope"));
        assertEquals(404, r.getStatusCode().value());
        ResponseEntity<ApiError> r2 = handler.handleNoResource(
                new NoHandlerFoundException("GET", "/api/yok", new HttpHeaders()));
        assertEquals(404, r2.getStatusCode().value());
    }

    @Test
    void n49_wrongMethodIs405() {
        ResponseEntity<ApiError> r = handler.handleMethodNotSupported(
                new HttpRequestMethodNotSupportedException("DELETE"));
        assertEquals(405, r.getStatusCode().value());
    }

    @Test
    void n49_catchAllDoesNotLeakInternalMessage() {
        ResponseEntity<ApiError> r = handler.handleGeneral(
                new RuntimeException("could not initialize proxy [User#5] - no session"));
        assertEquals(500, r.getStatusCode().value());
        assertFalse(String.valueOf(r.getBody().getMessage()).contains("proxy"));
    }

    // ── NEW-02: topluluk aramasında % ve _ joker değil, Türkçe harf duyarsız ────────────────

    @Test
    void new02_communitySearchEscapesWildcardsAndFoldsTurkish() {
        CommunityRepository repo = mock(CommunityRepository.class, CALLS_REAL_METHODS);
        repo.search("Şb_%");
        verify(repo).searchByPattern("%sb!_!%%");
    }

    // ── NEW-03: anonim istekte bookmark / buddy durumu güvenli değer döner ─────────────────

    @Test
    void new03_anonymousBookmarkStatusIsFalse() {
        EventBookmarkService svc = mock(EventBookmarkService.class);
        Map<String, Boolean> r = new EventBookmarkController(svc).status(5L);
        assertEquals(Map.of("bookmarked", false), r);
        verify(svc, never()).isBookmarked(any(), any());
    }

    @Test
    void new03_anonymousBuddyStatusIsNotJoined() {
        ConcertBuddyRepository repo = mock(ConcertBuddyRepository.class);
        ConcertBuddyController c = new ConcertBuddyController(repo,
                mock(com.concertly.backend.repository.EventRepository.class), mock(UserRepository.class),
                mock(ModerationService.class));
        Map<String, Object> r = c.myStatus(5L);
        assertEquals(false, r.get("joined"));
        assertEquals("", r.get("message"));
        verifyNoInteractions(repo);
    }

    // ── N-01 süpürme: lazy alanlara dokunan topluluk okuma metotları transaction içinde ────

    @Test
    void n01_communityReadMethodsAreTransactional() {
        for (String name : new String[] { "getAllCommunities", "getRecommendedCommunities", "getMyCommunities",
                "getCommunityById", "getJoinRequests", "getMembers", "getPendingForReview",
                "getCommunityPosts", "getPostComments" }) {
            boolean found = false;
            for (Method m : CommunityService.class.getDeclaredMethods()) {
                if (m.getName().equals(name)) {
                    found = true;
                    assertNotNull(m.getAnnotation(Transactional.class), name + " @Transactional olmalı");
                }
            }
            assertTrue(found, name);
        }
    }
}
