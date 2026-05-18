package com.concertly.backend.service;

import com.concertly.backend.dto.response.AttendanceResponse;
import com.concertly.backend.dto.response.FriendAttendeeDto;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;

import java.util.List;
import java.util.stream.Collectors;
import com.concertly.backend.repository.*;
import org.springframework.stereotype.Service;

@Service
public class EventAttendanceService {

    private final EventAttendanceRepository attendanceRepository;
    private final UserRepository userRepository;
    private final EventRepository eventRepository;

    public EventAttendanceService(EventAttendanceRepository attendanceRepository,
                                  UserRepository userRepository,
                                  EventRepository eventRepository) {
        this.attendanceRepository = attendanceRepository;
        this.userRepository       = userRepository;
        this.eventRepository      = eventRepository;
    }

    public AttendanceResponse getAttendance(Long userId, Long eventId) {
        long goingCount      = attendanceRepository.countByEventIdAndStatus(eventId, AttendanceStatus.GOING);
        long interestedCount = attendanceRepository.countByEventIdAndStatus(eventId, AttendanceStatus.INTERESTED);

        return attendanceRepository.findByUserIdAndEventId(userId, eventId)
                .map(a -> AttendanceResponse.from(a, goingCount, interestedCount))
                .orElse(AttendanceResponse.counts(eventId, goingCount, interestedCount));
    }

    public AttendanceResponse setAttendance(Long userId, Long eventId, AttendanceStatus status) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Etkinlik bulunamadı: " + eventId));

        EventAttendance attendance = attendanceRepository
                .findByUserIdAndEventId(userId, eventId)
                .orElse(new EventAttendance());

        attendance.setUser(user);
        attendance.setEvent(event);
        attendance.setStatus(status);
        attendanceRepository.save(attendance);

        long goingCount      = attendanceRepository.countByEventIdAndStatus(eventId, AttendanceStatus.GOING);
        long interestedCount = attendanceRepository.countByEventIdAndStatus(eventId, AttendanceStatus.INTERESTED);

        return AttendanceResponse.from(attendance, goingCount, interestedCount);
    }

    public List<FriendAttendeeDto> getFriendsAttending(Long userId, Long eventId) {
        return attendanceRepository.findFriendsAttending(userId, eventId)
                .stream()
                .map(ea -> FriendAttendeeDto.from(ea.getUser()))
                .collect(Collectors.toList());
    }

    public void removeAttendance(Long userId, Long eventId) {
        EventAttendance attendance = attendanceRepository
                .findByUserIdAndEventId(userId, eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Katılım kaydı bulunamadı."));
        attendanceRepository.delete(attendance);
    }
}