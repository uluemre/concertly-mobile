package com.concertly.backend.dto.request;

public class ReportRequest {

    private String targetType; // POST | COMMENT | MESSAGE | USER
    private Long targetId;
    private String reason;

    public String getTargetType() { return targetType; }
    public void setTargetType(String targetType) { this.targetType = targetType; }

    public Long getTargetId() { return targetId; }
    public void setTargetId(Long targetId) { this.targetId = targetId; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
