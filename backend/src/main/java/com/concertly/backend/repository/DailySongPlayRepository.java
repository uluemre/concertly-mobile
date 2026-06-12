package com.concertly.backend.repository;

import com.concertly.backend.model.DailySongPlay;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DailySongPlayRepository extends JpaRepository<DailySongPlay, Long> {

    Optional<DailySongPlay> findByUserIdAndEpochDay(Long userId, long epochDay);

    List<DailySongPlay> findByUserIdAndSolvedTrueOrderByEpochDayDesc(Long userId);

    long countByEpochDay(long epochDay);

    long countByEpochDayAndSolvedTrue(long epochDay);
}
