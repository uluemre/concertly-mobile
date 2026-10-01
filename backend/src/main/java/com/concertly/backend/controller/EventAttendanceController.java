package com.concertly.backend.controller;

import com.concertly.backend.dto.response.AttendanceResponse;
import com.concertly.backend.dto.response.FriendAttendeeDto;
import com.concertly.backend.model.AttendanceStatus;
import java.util.List;
import java.util.Set;
import com.concertly.backend.service.ModerationService;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.EventAttendanceService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/events/{eventId}/attendance")
public class EventAttendanceController {

    private final EventAttendanceService attendanceService;

    private final ModerationService moderationService;

    public EventAttendanceController(EventAttendanceService attendanceService,
                                     ModerationService moderationService) {
        this.attendanceService = attendanceService;
        this.moderationService = moderationService;
    }

    @GetMapping("/friends")
    public List<FriendAttendeeDto> getFriendsAttending(@PathVariable Long eventId) {
        Long userId = JwtUtil.getCurrentUserId();
        // Anonim izleyicinin "arkadaşı" yoktur; kimlik bilgisi dönmez (SEC-04)
        if (userId == null) return List.of();
        Set<Long> hidden = moderationService.getHiddenUserIds(userId);
        return attendanceService.getFriendsAttending(userId, eventId).stream()
                .filter(f -> !hidden.contains(f.getUserId()))
                .toList();
    }

    @GetMapping
    public AttendanceResponse getAttendance(@PathVariable Long eventId) {
        Long userId = JwtUtil.getCurrentUserId();
        return attendanceService.getAttendance(userId, eventId);
    }

    @PostMapping
    public AttendanceResponse attend(
            @PathVariable Long eventId,
            @RequestParam AttendanceStatus status
    ) {
        Long userId = JwtUtil.getCurrentUserId();
        return attendanceService.setAttendance(userId, eventId, status);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unattend(@PathVariable Long eventId) {
        Long userId = JwtUtil.getCurrentUserId();
        attendanceService.removeAttendance(userId, eventId);
    }
}