package com.concertly.backend.repository;

import com.concertly.backend.model.SourcePage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SourcePageRepository extends JpaRepository<SourcePage, Long> {

    List<SourcePage> findBySource(String source);
}
