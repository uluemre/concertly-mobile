package com.concertly.backend.controller;

import com.concertly.backend.repository.SourceSyncRunRepository;
import com.concertly.backend.service.ingest.ConcertSyncScheduler;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Dış tetikleyici: gizli anahtar, "kaçırıldıysa" kuralı ve çift çalışma koruması. */
class InternalSyncControllerTest {

    private final ConcertSyncScheduler scheduler = mock(ConcertSyncScheduler.class);
    private final SourceSyncRunRepository runs = mock(SourceSyncRunRepository.class);

    private InternalSyncController controller(String token) {
        return new InternalSyncController(scheduler, runs, token);
    }

    @Test
    void endpointIsHiddenWhenNoTokenConfigured() {
        assertEquals(HttpStatus.NOT_FOUND, controller("").trigger("x", null).getStatusCode());
        verifyNoInteractions(scheduler);
    }

    @Test
    void wrongOrMissingTokenIsRejected() {
        assertEquals(HttpStatus.UNAUTHORIZED, controller("gizli").trigger("yanlis", null).getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, controller("gizli").trigger(null, null).getStatusCode());
        verifyNoInteractions(scheduler);
    }

    @Test
    void skipsWhenARecentSuccessfulRunExists() {
        when(runs.existsByFailedFalseAndStartedAtAfter(any())).thenReturn(true);
        var res = controller("gizli").trigger("gizli", 20);
        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertEquals("SKIPPED_RECENT", res.getBody().get("status"));
        verify(scheduler, never()).syncAllAs(any());
    }

    @Test
    void conflictWhenAlreadyRunning() {
        when(scheduler.isRunning()).thenReturn(true);
        assertEquals(HttpStatus.CONFLICT, controller("gizli").trigger("gizli", null).getStatusCode());
    }

    @Test
    void startsInBackgroundAndReturns202() {
        var res = controller("gizli").trigger("gizli", 20);
        assertEquals(HttpStatus.ACCEPTED, res.getStatusCode());
        verify(scheduler, timeout(2000)).syncAllAs(ConcertSyncScheduler.BY_TRIGGER);
    }
}
