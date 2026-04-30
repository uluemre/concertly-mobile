package com.concertly.backend.controller;

import com.concertly.backend.dto.response.AttendanceResponse;
import com.concertly.backend.model.AttendanceStatus;
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

    // POST /api/events/{eventId}/attendance?userId=1&status=GOING
    @PostMapping
    public AttendanceResponse attend(
            @PathVariable Long eventId,
            @RequestParam Long userId,
            @RequestParam AttendanceStatus status
    ) {
        return attendanceService.setAttendance(userId, eventId, status);
    }

    // DELETE /api/events/{eventId}/attendance?userId=1
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unattend(
            @PathVariable Long eventId,
            @RequestParam Long userId
    ) {
        attendanceService.removeAttendance(userId, eventId);
    }
}