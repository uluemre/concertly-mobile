package com.concertly.backend.controller;

import com.concertly.backend.dto.response.AttendanceResponse;
import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.EventAttendanceService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/events/{eventId}/attendance")
public class EventAttendanceController {

    private final EventAttendanceService attendanceService;

    public EventAttendanceController(EventAttendanceService attendanceService) {
        this.attendanceService = attendanceService;
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