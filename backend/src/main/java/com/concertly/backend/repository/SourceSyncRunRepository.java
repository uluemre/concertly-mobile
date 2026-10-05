package com.concertly.backend.repository;

import com.concertly.backend.model.SourceSyncRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface SourceSyncRunRepository extends JpaRepository<SourceSyncRun, Long> {

    /** Bir kaynağın en yeni koşuları (sağlık hesabı için son birkaç koşu yeter). */
    List<SourceSyncRun> findTop10BySourceOrderByStartedAtDesc(String source);

    /** Yedek tetikleyici: bu tarihten sonra başarılı bir koşu var mı. */
    boolean existsByFailedFalseAndStartedAtAfter(LocalDateTime after);

    /** Eski kayıtların temizliği (tablo sınırsız büyümesin). */
    long deleteByStartedAtBefore(LocalDateTime before);
}
