package com.concertly.backend.repository;

import com.concertly.backend.model.Report;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReportRepository extends JpaRepository<Report, Long> {

    List<Report> findByResolvedFalseOrderByCreatedAtDesc();

    /** Kapatılmış şikâyetler (moderasyon kuyruğunun "Sonuçlanan" sekmesi). */
    List<Report> findTop500ByResolvedTrueOrderByCreatedAtDesc();

    List<Report> findByTargetTypeAndTargetIdAndResolvedFalse(String targetType, Long targetId);

    boolean existsByReporterIdAndTargetTypeAndTargetId(Long reporterId, String targetType, Long targetId);
}
