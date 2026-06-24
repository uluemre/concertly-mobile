package com.concertly.backend.repository;

import com.concertly.backend.model.CommunityPostPollOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;

public interface CommunityPostPollOptionRepository extends JpaRepository<CommunityPostPollOption, Long> {
    void deleteByCommunityPostIdIn(Collection<Long> communityPostIds);
}
