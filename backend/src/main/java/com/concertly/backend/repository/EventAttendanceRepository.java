package com.concertly.backend.repository;

import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.model.EventAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EventAttendanceRepository extends JpaRepository<EventAttendance, Long> {
    Optional<EventAttendance> findByUserIdAndEventId(Long userId, Long eventId);
    long countByEventIdAndStatus(Long eventId, AttendanceStatus status);
    long countByUserIdAndStatus(Long userId, AttendanceStatus status);
    List<EventAttendance> findByUserIdAndStatus(Long userId, AttendanceStatus status);

    @Query("SELECT ea FROM EventAttendance ea WHERE ea.event.id = :eventId AND ea.status = 'GOING' " +
           "AND ea.user.id IN (SELECT f.following.id FROM Follow f WHERE f.follower.id = :userId)")
    List<EventAttendance> findFriendsAttending(@Param("userId") Long userId, @Param("eventId") Long eventId);
}