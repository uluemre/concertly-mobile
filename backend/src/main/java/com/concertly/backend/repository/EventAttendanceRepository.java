package com.concertly.backend.repository;

import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.model.EventAttendance;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface EventAttendanceRepository extends JpaRepository<EventAttendance, Long> {
    Optional<EventAttendance> findByUserIdAndEventId(Long userId, Long eventId);
    long countByEventIdAndStatus(Long eventId, AttendanceStatus status);
    long countByUserIdAndStatus(Long userId, AttendanceStatus status);
    List<EventAttendance> findByUserIdAndStatus(Long userId, AttendanceStatus status);
    List<EventAttendance> findByEventIdAndStatus(Long eventId, AttendanceStatus status);

    @Query("SELECT ea FROM EventAttendance ea WHERE ea.event.id = :eventId AND ea.status = 'GOING' " +
           "AND ea.user.id IN (SELECT f.following.id FROM Follow f WHERE f.follower.id = :userId)")
    List<EventAttendance> findFriendsAttending(@Param("userId") Long userId, @Param("eventId") Long eventId);

    /** Kullanıcının "gidiyorum" dediği, henüz bitmemiş konserler — en yakını önce. */
    @Query("SELECT ea FROM EventAttendance ea JOIN FETCH ea.event e " +
           "WHERE ea.user.id = :userId AND ea.status = 'GOING' AND e.eventDate >= :from " +
           "AND e.mergedIntoEventId IS NULL ORDER BY e.eventDate ASC")
    List<EventAttendance> findUpcomingGoing(@Param("userId") Long userId,
                                            @Param("from") LocalDateTime from,
                                            Pageable pageable);
}
