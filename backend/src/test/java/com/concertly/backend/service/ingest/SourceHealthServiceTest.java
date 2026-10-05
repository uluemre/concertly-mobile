package com.concertly.backend.service.ingest;

import com.concertly.backend.model.SourceSyncRun;
import com.concertly.backend.repository.SourceSyncRunRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SourceHealthServiceTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 6, 12, 0);

    /** processed değerleri en yeniden eskiye; her koşu bir gün önce. Negatif = hata. */
    private static List<SourceSyncRun> runs(int... processed) {
        List<SourceSyncRun> list = new ArrayList<>();
        for (int i = 0; i < processed.length; i++) {
            SourceSyncRun r = new SourceSyncRun();
            r.setSource("X");
            r.setStartedAt(NOW.minusHours(8).minusDays(i));
            r.setFailed(processed[i] < 0);
            r.setProcessed(Math.max(0, processed[i]));
            if (processed[i] < 0) r.setError("timeout");
            list.add(r);
        }
        return list;
    }

    private static SourceHealthService.SourceHealth eval(List<SourceSyncRun> runs) {
        return SourceHealthService.evaluate("X", runs, NOW);
    }

    @Test
    void steadySourceIsOk() {
        var h = eval(runs(160, 170, 165));
        assertEquals("OK", h.status());
        assertEquals(165, h.typicalProcessed());
    }

    @Test
    void failedLastRunIsFail() {
        var h = eval(runs(-1, 170));
        assertEquals("FAIL", h.status());
        assertEquals("FAILED", h.reason());
        assertEquals("timeout", h.lastError());
    }

    @Test
    void suddenZeroIsFail() {
        // Site tasarımı değişince okuyucu hata vermeden 0 dönebilir
        assertEquals("EMPTY", eval(runs(0, 170, 165)).reason());
    }

    @Test
    void sourceThatWasAlwaysEmptyIsNotAlarming() {
        assertEquals("OK", eval(runs(0, 0, 0)).status());
    }

    @Test
    void bigDropIsWarn() {
        var h = eval(runs(60, 170, 165, 160));
        assertEquals("WARN", h.status());
        assertEquals("DROPPED", h.reason());
    }

    @Test
    void noRunForMoreThan30HoursIsStale() {
        List<SourceSyncRun> r = runs(160, 170);
        r.get(0).setStartedAt(NOW.minusHours(40));
        assertEquals("STALE", eval(r).reason());
    }

    @Test
    void neverRanIsWarn() {
        assertEquals("NEVER_RAN", eval(List.of()).reason());
    }

    @Test
    void schedulerRecordsEveryRun() {
        SourceSyncRunRepository repo = mock(SourceSyncRunRepository.class);
        ConcertSource ok = new ConcertSource() {
            public String code() { return "OKSRC"; }
            public SourceSyncResult sync() { return SourceSyncResult.ok("OKSRC", 5, 2, 3, 0, 10); }
        };
        ConcertSource broken = new ConcertSource() {
            public String code() { return "BROKEN"; }
            public SourceSyncResult sync() { throw new IllegalStateException("site degisti"); }
        };
        new ConcertSyncScheduler(List.of(ok, broken), repo).syncAllAs(ConcertSyncScheduler.BY_TRIGGER);
        verify(repo, times(2)).save(any(SourceSyncRun.class));
        verify(repo).save(argThat(r -> r.getSource().equals("BROKEN") && r.isFailed()
                && "site degisti".equals(r.getError()) && "TRIGGER".equals(r.getTriggeredBy())));
    }

    @Test
    void historyWriteFailureDoesNotBreakSync() {
        SourceSyncRunRepository repo = mock(SourceSyncRunRepository.class);
        when(repo.save(any())).thenThrow(new RuntimeException("tablo yok"));
        ConcertSource ok = new ConcertSource() {
            public String code() { return "OKSRC"; }
            public SourceSyncResult sync() { return SourceSyncResult.ok("OKSRC", 5, 2, 3, 0, 10); }
        };
        var results = new ConcertSyncScheduler(List.of(ok), repo).syncAll();
        assertEquals(1, results.size());
        assertFalse(results.get(0).failed());
    }

    @Test
    void secondConcurrentSyncIsSkipped() throws Exception {
        java.util.concurrent.CountDownLatch inside = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch release = new java.util.concurrent.CountDownLatch(1);
        ConcertSource slow = new ConcertSource() {
            public String code() { return "SLOW"; }
            public SourceSyncResult sync() {
                inside.countDown();
                try { release.await(); } catch (InterruptedException ignored) { }
                return SourceSyncResult.ok("SLOW", 1, 1, 0, 0, 1);
            }
        };
        ConcertSyncScheduler scheduler = new ConcertSyncScheduler(List.of(slow));
        Thread first = new Thread(() -> scheduler.syncAll());
        first.start();
        inside.await();
        assertTrue(scheduler.isRunning());
        assertEquals(List.of(), scheduler.syncAll(), "ikinci senkron beklemeden atlanmalı");
        release.countDown();
        first.join();
        assertFalse(scheduler.isRunning());
    }
}
