package com.concertly.backend.repository;

import com.concertly.backend.model.PollVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PollVoteRepository extends JpaRepository<PollVote, Long> {
    Optional<PollVote> findByUserIdAndPostId(Long userId, Long postId);
    long countByPollOptionId(Long pollOptionId);
    void deleteByPostId(Long postId);

    // Toplu seçenek oy sayımı — feed'deki N+1'i önlemek için (optionId, count)
    @Query("SELECT v.pollOption.id, COUNT(v) FROM PollVote v WHERE v.pollOption.id IN :optionIds GROUP BY v.pollOption.id")
    List<Object[]> countByPollOptionIdIn(@Param("optionIds") Collection<Long> optionIds);

    // Bir kullanıcının verdiği oylar — (postId, optionId)
    @Query("SELECT v.postId, v.pollOption.id FROM PollVote v WHERE v.user.id = :userId AND v.postId IN :postIds")
    List<Object[]> findUserVotes(@Param("userId") Long userId, @Param("postIds") Collection<Long> postIds);
}
