package com.concertly.backend.repository;

import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.model.EventAttendance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EventAttendanceRepository extends JpaRepository<EventAttendance, Long> {
    Optional<EventAttendance> findByUserIdAndEventId(Long userId, Long eventId);
    long countByEventIdAndStatus(Long eventId, AttendanceStatus status);
}