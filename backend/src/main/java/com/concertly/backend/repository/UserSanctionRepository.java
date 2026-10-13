package com.concertly.backend.repository;

import com.concertly.backend.model.UserSanction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserSanctionRepository extends JpaRepository<UserSanction, Long> {

    List<UserSanction> findByUserIdOrderByCreatedAtDesc(Long userId);
}
