package com.concertly.backend.repository;

import com.concertly.backend.model.BingoCard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BingoCardRepository extends JpaRepository<BingoCard, Long> {
    Optional<BingoCard> findByUserIdAndEventId(Long userId, Long eventId);
    List<BingoCard> findByUserIdOrderByCreatedAtDesc(Long userId);
}
