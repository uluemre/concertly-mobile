package com.concertly.backend.service.storage;

import com.concertly.backend.model.MediaUpload;
import com.concertly.backend.repository.MediaUploadRepository;
import com.concertly.backend.service.ContentLimitService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MediaUploadServiceTest {

    private final MediaUploadRepository repo = mock(MediaUploadRepository.class);
    private final ImageStorage storage = mock(ImageStorage.class);
    private final UploadReferenceScanner scanner = mock(UploadReferenceScanner.class);
    private final ContentLimitService limits = mock(ContentLimitService.class);
    private final MediaUploadService service =
            new MediaUploadService(repo, storage, scanner, limits, 30, 10, true, 48, 500);

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    // ── Kota ─────────────────────────────────────────────────────────────────

    @Test
    void quotaAllowsUnderLimitAndRejectsAtLimit() {
        when(repo.countByUserIdAndCreatedAtAfter(eq(1L), any())).thenReturn(29L);
        assertDoesNotThrow(() -> service.checkQuota(1L));

        when(repo.countByUserIdAndCreatedAtAfter(eq(1L), any())).thenReturn(30L);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.checkQuota(1L));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatusCode());
        assertEquals("UPLOAD_LIMIT", ex.getReason());
    }

    @Test
    void newAccountsGetTheLowerLimit() {
        when(limits.isNewAccount(2L)).thenReturn(true);
        when(repo.countByUserIdAndCreatedAtAfter(eq(2L), any())).thenReturn(10L);
        assertThrows(ResponseStatusException.class, () -> service.checkQuota(2L));
    }

    @Test
    void adminsAreExempt() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "1:admin", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        when(repo.countByUserIdAndCreatedAtAfter(any(), any())).thenReturn(1000L);
        assertDoesNotThrow(() -> service.checkQuota(1L));
    }

    @Test
    void zeroLimitDisablesQuota() {
        MediaUploadService unlimited = new MediaUploadService(repo, storage, scanner, limits, 0, 0, true, 48, 500);
        when(repo.countByUserIdAndCreatedAtAfter(any(), any())).thenReturn(1000L);
        assertDoesNotThrow(() -> unlimited.checkQuota(1L));
    }

    // ── Yetim temizliği ──────────────────────────────────────────────────────

    private static MediaUpload upload(String key) {
        return new MediaUpload(key, 1L, 100, LocalDateTime.now().minusDays(5));
    }

    @Test
    void deletesOnlyUnreferencedUploads() throws IOException {
        MediaUpload used = upload("used.jpg");
        MediaUpload orphan = upload("orphan.jpg");
        when(repo.findByCreatedAtBeforeOrderByCreatedAtAsc(any())).thenReturn(List.of(used, orphan));
        when(scanner.referencedKeys()).thenReturn(Set.of("used.jpg"));

        assertEquals(1, service.cleanupOrphans());
        verify(storage).delete("orphan.jpg");
        verify(storage, never()).delete("used.jpg");
        verify(repo).delete(orphan);
        verify(repo, never()).delete(used);
    }

    @Test
    void scanFailureDeletesNothing() throws IOException {
        when(repo.findByCreatedAtBeforeOrderByCreatedAtAsc(any())).thenReturn(List.of(upload("a.jpg")));
        when(scanner.referencedKeys()).thenThrow(new IllegalStateException("db down"));

        service.cleanupOrphansJob();
        verify(storage, never()).delete(anyString());
    }

    @Test
    void suspiciousMassOrphaningIsAborted() throws IOException {
        List<MediaUpload> all = new ArrayList<>();
        for (int i = 0; i < 30; i++) all.add(upload("k" + i + ".jpg"));
        when(repo.findByCreatedAtBeforeOrderByCreatedAtAsc(any())).thenReturn(all);
        when(scanner.referencedKeys()).thenReturn(Set.of());

        assertEquals(0, service.cleanupOrphans());
        verify(storage, never()).delete(anyString());
    }

    @Test
    void storageFailureKeepsTheRowForNextRun() throws IOException {
        MediaUpload orphan = upload("orphan.jpg");
        when(repo.findByCreatedAtBeforeOrderByCreatedAtAsc(any())).thenReturn(List.of(orphan));
        when(scanner.referencedKeys()).thenReturn(Set.of());
        doThrow(new IOException("R2 500")).when(storage).delete("orphan.jpg");

        assertEquals(0, service.cleanupOrphans());
        verify(repo, never()).delete(any(MediaUpload.class));
    }

    @Test
    void disabledCleanupDoesNothing() {
        MediaUploadService off = new MediaUploadService(repo, storage, scanner, limits, 30, 10, false, 48, 500);
        assertEquals(0, off.cleanupOrphans());
        verifyNoInteractions(scanner);
    }

    // ── Yerel depo silme ─────────────────────────────────────────────────────

    @Test
    void localStorageDeletesFileAndRejectsTraversal(@TempDir Path dir) throws IOException {
        LocalImageStorage local = new LocalImageStorage(dir.toString());
        local.put("a.png", new byte[]{1}, "image/png");
        local.delete("a.png");
        assertFalse(Files.exists(dir.resolve("a.png")));
        assertDoesNotThrow(() -> local.delete("missing.png"));
        assertThrows(IllegalArgumentException.class, () -> local.delete("../outside.png"));
    }
}
