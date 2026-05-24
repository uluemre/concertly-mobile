package com.concertly.backend.repository;

import com.concertly.backend.model.PollVote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PollVoteRepository extends JpaRepository<PollVote, Long> {
    Optional<PollVote> findByUserIdAndPostId(Long userId, Long postId);
    long countByPollOptionId(Long pollOptionId);
    void deleteByPostId(Long postId);
}
