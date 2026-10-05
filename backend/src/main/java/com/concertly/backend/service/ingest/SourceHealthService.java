package com.concertly.backend.service.ingest;

import com.concertly.backend.model.SourceSyncRun;
import com.concertly.backend.repository.SourceSyncRunRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Kaynak sağlığı: her açık kaynağın son koşularına bakıp OK / WARN / FAIL üretir.
 *
 * Neden gerekli: bilet sitesi tasarımını değiştirince okuyucu hata vermeden 0 kayıt
 * dönebilir. Bu durum ancak geçmişle karşılaştırınca görünür.
 */
@Service
public class SourceHealthService {

    public static final String OK = "OK";
    public static final String WARN = "WARN";
    public static final String FAIL = "FAIL";

    /** Bu kadar süredir koşu yoksa gece senkronu kaçmış demektir. */
    static final Duration STALE_AFTER = Duration.ofHours(30);
    /** Son koşu, önceki başarılı koşuların ortancasının bu oranından azsa uyarı. */
    static final double DROP_RATIO = 0.5;
    /** Koşu geçmişi bu kadar gün tutulur. */
    static final int KEEP_DAYS = 60;

    private final SourceSyncRunRepository runRepository;
    private final ConcertSyncScheduler scheduler;

    public SourceHealthService(SourceSyncRunRepository runRepository, ConcertSyncScheduler scheduler) {
        this.runRepository = runRepository;
        this.scheduler = scheduler;
    }

    /** Admin ekranındaki tek kaynak satırı. */
    public record SourceHealth(
            String source,
            String status,
            /** Durumun makine okunur nedeni: NEVER_RAN, FAILED, EMPTY, DROPPED, STALE ya da null. */
            String reason,
            LocalDateTime lastRunAt,
            Integer lastProcessed,
            Integer typicalProcessed,
            String lastError,
            List<RunSummary> recent) {}

    public record RunSummary(LocalDateTime startedAt, int processed, Integer created, boolean failed, long durationMs) {}

    public record HealthReport(boolean running, List<SourceHealth> sources) {}

    public HealthReport report() {
        List<SourceHealth> list = new ArrayList<>();
        for (String code : scheduler.enabledSources()) {
            list.add(evaluate(code, runRepository.findTop10BySourceOrderByStartedAtDesc(code), LocalDateTime.now()));
        }
        return new HealthReport(scheduler.isRunning(), list);
    }

    /** Saf hesap (test edilebilir): koşular en yeniden eskiye sıralı gelir. */
    static SourceHealth evaluate(String code, List<SourceSyncRun> runs, LocalDateTime now) {
        List<RunSummary> recent = runs.stream().limit(5)
                .map(r -> new RunSummary(r.getStartedAt(), r.getProcessed(), r.getCreated(), r.isFailed(), r.getDurationMs()))
                .toList();
        if (runs.isEmpty()) {
            return new SourceHealth(code, WARN, "NEVER_RAN", null, null, null, null, recent);
        }
        SourceSyncRun last = runs.get(0);
        Integer typical = medianProcessed(runs.subList(1, runs.size()));

        String status = OK;
        String reason = null;
        if (last.isFailed()) {
            status = FAIL;
            reason = "FAILED";
        } else if (last.getProcessed() == 0 && (typical == null || typical > 0)) {
            // Hiç kayıt yok: önceden de 0 değilse okuyucu bozulmuş olabilir
            status = FAIL;
            reason = "EMPTY";
        } else if (typical != null && typical > 0 && last.getProcessed() < typical * DROP_RATIO) {
            status = WARN;
            reason = "DROPPED";
        } else if (Duration.between(last.getStartedAt(), now).compareTo(STALE_AFTER) > 0) {
            status = WARN;
            reason = "STALE";
        }
        return new SourceHealth(code, status, reason, last.getStartedAt(), last.getProcessed(), typical,
                last.getError(), recent);
    }

    /** Başarılı koşuların işlenen kayıt ortancası; yoksa null. */
    static Integer medianProcessed(List<SourceSyncRun> runs) {
        List<Integer> values = runs.stream().filter(r -> !r.isFailed()).map(SourceSyncRun::getProcessed).sorted().toList();
        if (values.isEmpty()) return null;
        // Çift sayıda koşuda alt-orta değer: daha az yanlış alarm
        return values.get((values.size() - 1) / 2);
    }

    /** Eski geçmişi her gece siler (04:00 senkronundan önce). */
    @Scheduled(cron = "${app.sources.history-cleanup-cron:0 30 3 * * *}")
    @Transactional
    public void cleanup() {
        runRepository.deleteByStartedAtBefore(LocalDateTime.now().minusDays(KEEP_DAYS));
    }
}
