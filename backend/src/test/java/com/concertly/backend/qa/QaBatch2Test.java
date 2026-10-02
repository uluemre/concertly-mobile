package com.concertly.backend.qa;

import com.concertly.backend.model.Artist;
import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventAttendance;
import com.concertly.backend.repository.BuddySwipeRepository;
import com.concertly.backend.repository.EventAttendanceRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.SetlistSubmissionRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.service.DeezerService;
import com.concertly.backend.service.ItunesService;
import com.concertly.backend.service.SetlistService;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** QA Batch 2 (N-10, N-25, SEC-07): ek regresyonlar. */
class QaBatch2Test {

    private static final Path MAIN = Path.of("src/main/java/com/concertly/backend");

    // N-10: deleteBetween yalnizca bu cift, iki yon (JPQL metni)
    @Test
    void deleteBetweenJpqlCoversBothDirectionsOfThePairOnly() throws Exception {
        var m = BuddySwipeRepository.class.getMethod("deleteBetween", Long.class, Long.class);
        String q = m.getAnnotation(Query.class).value().replaceAll("\\s+", " ");
        assertTrue(q.startsWith("DELETE FROM BuddySwipe"), q);
        assertTrue(q.contains("bs.swiperId = :a AND bs.targetId = :b"), q);
        assertTrue(q.contains("bs.swiperId = :b AND bs.targetId = :a"), q);
        assertTrue(m.isAnnotationPresent(org.springframework.data.jpa.repository.Modifying.class));
        assertEquals(2, m.getParameterCount());
        assertEquals(2, q.split(" OR ", -1).length);
    }

    // N-25: kimlik degisimi yolunda hicbir yerde refresh token cagrisi yok
    @Test
    void identityChangePathsNeverReferenceRefreshTokens() throws IOException {
        for (String f : new String[]{"service/UserService.java", "service/EmailVerificationService.java",
                "controller/UserController.java"}) {
            String src = Files.readString(MAIN.resolve(f));
            assertFalse(src.toLowerCase().contains("refreshtoken"), f);
            assertFalse(src.contains("issueTokens"), f);
        }
    }

    // N-25: /users/me/verify-email token uretmez (204, govde yok) ve yalniz JWT'deki kullaniciyi kullanir
    @Test
    void meVerifyEmailEndpointReturnsNoBodyAndUsesJwtUser() throws IOException {
        String src = Files.readString(MAIN.resolve("controller/UserController.java"));
        int i = src.indexOf("@PostMapping(\"/me/verify-email\")");
        assertTrue(i > 0);
        int end = src.indexOf("userService.verifyEmailChange", i);
        String block = src.substring(i, src.indexOf(";", end) + 1);
        assertTrue(block.contains("NO_CONTENT"), block);
        assertTrue(block.contains("public void verifyMyEmail"), block);
        assertTrue(block.contains("JwtUtil.getCurrentUserId()"), block);
        assertFalse(block.contains("body.get(\"email\")"), block);
    }

    // SEC-07: tek yazma yolu SetlistService; baska kod SetlistSubmission yazamaz (bypass yok)
    @Test
    void onlySetlistServiceWritesSetlistSubmissions() throws IOException {
        try (Stream<Path> s = Files.walk(MAIN)) {
            for (Path p : s.filter(x -> x.toString().endsWith(".java")).toList()) {
                String n = p.getFileName().toString();
                if (n.equals("SetlistService.java") || n.equals("SetlistSubmission.java")
                        || n.equals("SetlistSubmissionRepository.java") || n.equals("AccountDeletionService.java")) continue;
                String src = Files.readString(p);
                assertFalse(src.contains("SetlistSubmissionRepository"), n);
                assertFalse(src.contains("KIND_CONFIRMATION"), n);
            }
        }
    }

    private SetlistService svc(EventAttendanceRepository att, SetlistSubmissionRepository sub, Event ev) {
        EventRepository er = mock(EventRepository.class);
        when(er.findById(1L)).thenReturn(Optional.of(ev));
        return new SetlistService(mock(DeezerService.class), mock(ItunesService.class), sub, er, mock(UserRepository.class), att);
    }

    private Event event(LocalDateTime d) {
        Event e = new Event();
        e.setEventDate(d);
        Artist a = new Artist();
        a.setName("Hadise");
        e.setArtist(a);
        return e;
    }

    // SEC-07: WENT de katilmis sayilir
    @Test
    void wentStatusPassesAttendanceCheck() {
        var att = mock(EventAttendanceRepository.class);
        var sub = mock(SetlistSubmissionRepository.class);
        var ua = new EventAttendance();
        ua.setStatus(AttendanceStatus.WENT);
        when(att.findByUserIdAndEventId(1L, 1L)).thenReturn(Optional.of(ua));
        when(sub.findByUserIdAndEventIdAndKind(any(), any(), any())).thenReturn(Optional.empty());
        var s = svc(att, sub, event(LocalDateTime.now().minusDays(1)));
        try {
            s.submitConfirmation(1L, 1L, List.of("A"));
        } catch (ResponseStatusException ex) {
            fail("WENT 403 almamali: " + ex.getReason());
        } catch (RuntimeException expected) {
            // kullanici mock'u bos: katilim kontrolunden sonra
        }
    }

    // SEC-07: kontrol sirasi - konser bitmemisse 400, bitmisse katilim yoksa 403; kayit yazilmaz
    @Test
    void checkOrderEndedFirstThenAttendanceAndNoWriteOnReject() {
        var att = mock(EventAttendanceRepository.class);
        var sub = mock(SetlistSubmissionRepository.class);
        when(att.findByUserIdAndEventId(any(), any())).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class,
                () -> svc(att, sub, event(LocalDateTime.now().plusDays(1))).submitConfirmation(1L, 9L, List.of("A")));
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> svc(att, sub, event(LocalDateTime.now().minusDays(1))).submitConfirmation(1L, 9L, List.of("A")));
        assertEquals(403, ex.getStatusCode().value());
        verify(sub, never()).save(any());
    }

    // SEC-07: oturumsuz (userId null) 403
    @Test
    void nullUserIsNotAttended() {
        var att = mock(EventAttendanceRepository.class);
        var sub = mock(SetlistSubmissionRepository.class);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> svc(att, sub, event(LocalDateTime.now().minusDays(1))).submitConfirmation(1L, null, List.of("A")));
        assertEquals("SETLIST_NOT_ATTENDED", ex.getReason());
        verify(sub, never()).save(any());
    }
}
