package com.concertly.backend.repository;

import com.concertly.backend.model.AccountDeletionFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AccountDeletionFeedbackRepository extends JpaRepository<AccountDeletionFeedback, Long> {

    List<AccountDeletionFeedback> findAllByOrderByCreatedAtDesc();
}
