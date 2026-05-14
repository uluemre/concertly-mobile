package com.concertly.backend.repository;

import com.concertly.backend.model.CommunityPost;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, Long> {

    List<CommunityPost> findByCommunityIdOrderByCreatedAtDesc(Long communityId);
}
