package com.concertly.backend.repository;

import com.concertly.backend.model.QuizScore;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QuizScoreRepository extends JpaRepository<QuizScore, Long> {

    List<QuizScore> findTop10ByArtistNameIgnoreCaseOrderByScoreDescDurationMsAsc(String artistName);

    Optional<QuizScore> findFirstByArtistNameIgnoreCaseAndUserIdOrderByScoreDescDurationMsAsc(String artistName, Long userId);
}
