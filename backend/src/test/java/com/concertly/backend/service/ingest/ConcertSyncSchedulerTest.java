package com.concertly.backend.service.ingest;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Zamanlayicinin yalitim sozu: bir kaynak cokerse digerleri calismaya devam eder.
 *
 * Bu davranis olmazsa tek bir sitenin kesintisi tum konser verisini gunceller
 * olmaktan cikarir; bu yuzden ayri test ediliyor.
 */
class ConcertSyncSchedulerTest {

    /** Testte kullanilan sahte kaynak. */
    private static class FakeSource implements ConcertSource {
        private final String code;
        private final boolean shouldFail;
        private final boolean enabled;
        final AtomicInteger runs = new AtomicInteger();

        FakeSource(String code, boolean shouldFail, boolean enabled) {
            this.code = code;
            this.shouldFail = shouldFail;
            this.enabled = enabled;
        }

        @Override public String code() { return code; }
        @Override public boolean isEnabled() { return enabled; }

        @Override
        public SourceSyncResult sync() {
            runs.incrementAndGet();
            if (shouldFail) throw new IllegalStateException("kaynak coktu");
            return SourceSyncResult.ok(code, 5, 3, 2, 0, 10);
        }
    }

    @Test
    void failingSourceDoesNotStopOthers() {
        FakeSource broken = new FakeSource("KIRIK", true, true);
        FakeSource healthy = new FakeSource("SAGLAM", false, true);
        ConcertSyncScheduler scheduler = new ConcertSyncScheduler(List.of(broken, healthy));

        List<SourceSyncResult> results = scheduler.syncAll();

        assertEquals(2, results.size());
        assertEquals(1, broken.runs.get());
        assertEquals(1, healthy.runs.get(), "Kirik kaynak digerini engellememeli");

        SourceSyncResult brokenResult = results.get(0);
        assertTrue(brokenResult.failed());
        assertEquals("kaynak coktu", brokenResult.error());

        SourceSyncResult healthyResult = results.get(1);
        assertFalse(healthyResult.failed());
        assertEquals(3, healthyResult.created());
    }

    @Test
    void schedulerNeverThrows() {
        ConcertSyncScheduler scheduler =
                new ConcertSyncScheduler(List.of(new FakeSource("KIRIK", true, true)));
        assertDoesNotThrow(scheduler::syncAll);
    }

    @Test
    void disabledSourceIsSkipped() {
        FakeSource off = new FakeSource("KAPALI", false, false);
        ConcertSyncScheduler scheduler = new ConcertSyncScheduler(List.of(off));

        scheduler.syncAll();

        assertEquals(0, off.runs.get(), "Kapali kaynak calistirilmamali");
    }

    @Test
    void unknownSourceCodeReportsFailureInsteadOfThrowing() {
        ConcertSyncScheduler scheduler =
                new ConcertSyncScheduler(List.of(new FakeSource("BILETINIAL", false, true)));

        SourceSyncResult result = scheduler.syncByCode("YOKSA");

        assertTrue(result.failed());
        assertEquals("Bilinmeyen kaynak", result.error());
    }

    @Test
    void sourceCanBeTriggeredByCodeIgnoringCase() {
        FakeSource source = new FakeSource("BILETINIAL", false, true);
        ConcertSyncScheduler scheduler = new ConcertSyncScheduler(List.of(source));

        SourceSyncResult result = scheduler.syncByCode("biletinial");

        assertFalse(result.failed());
        assertEquals(1, source.runs.get());
    }
}
