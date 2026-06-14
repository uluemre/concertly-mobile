package com.concertly.backend.repository;

import com.concertly.backend.model.Report;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReportRepository extends JpaRepository<Report, Long> {

    List<Report> findByResolvedFalseOrderByCreatedAtDesc();

    boolean existsByReporterIdAndTargetTypeAndTargetId(Long reporterId, String targetType, Long targetId);
}
