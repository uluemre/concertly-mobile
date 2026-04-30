package com.concertly.backend.dto.response;

import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.model.EventAttendance;

public class AttendanceResponse {
    private Long eventId;
    private AttendanceStatus status;
    private long goingCount;
    private long interestedCount;

    public static AttendanceResponse from(EventAttendance attendance,
                                          long goingCount,
                                          long interestedCount) {
        AttendanceResponse dto = new AttendanceResponse();
        dto.eventId        = attendance.getEvent().getId();
        dto.status         = attendance.getStatus();
        dto.goingCount     = goingCount;
        dto.interestedCount = interestedCount;
        return dto;
    }

    public Long getEventId() { return eventId; }
    public AttendanceStatus getStatus() { return status; }
    public long getGoingCount() { return goingCount; }
    public long getInterestedCount() { return interestedCount; }
}