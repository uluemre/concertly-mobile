package com.concertly.backend.repository;

import com.concertly.backend.model.CommunityMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CommunityMemberRepository extends JpaRepository<CommunityMember, Long> {

    Optional<CommunityMember> findByUserIdAndCommunityId(Long userId, Long communityId);

    long countByCommunityId(Long communityId);

    boolean existsByUserIdAndCommunityId(Long userId, Long communityId);
}
