package com.concertly.backend.repository;

import com.concertly.backend.model.CommunityPostPollVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CommunityPostPollVoteRepository extends JpaRepository<CommunityPostPollVote, Long> {

    long countByPollOptionId(Long pollOptionId);

    Optional<CommunityPostPollVote> findByUserIdAndCommunityPostId(Long userId, Long communityPostId);

    // Toplu seçenek oy sayımı — (pollOptionId, count)
    @Query("SELECT v.pollOption.id, COUNT(v) FROM CommunityPostPollVote v " +
           "WHERE v.pollOption.id IN :ids GROUP BY v.pollOption.id")
    List<Object[]> countByPollOptionIdIn(@Param("ids") Collection<Long> ids);

    // Kullanıcının bu postlardaki oyları — (communityPostId, pollOptionId)
    @Query("SELECT v.communityPostId, v.pollOption.id FROM CommunityPostPollVote v " +
           "WHERE v.user.id = :userId AND v.communityPostId IN :postIds")
    List<Object[]> findUserVotes(@Param("userId") Long userId, @Param("postIds") Collection<Long> postIds);

    void deleteByCommunityPostIdIn(Collection<Long> communityPostIds);
}
