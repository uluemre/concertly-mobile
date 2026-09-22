package com.concertly.backend.dto.response;

import com.concertly.backend.model.Report;

import java.time.LocalDateTime;

/**
 * Admin şikayet kuyruğu satırı. Moderatörün karar verebilmesi için şikayet
 * edilen içeriğin özeti de taşınır — aksi halde her satır için ayrı sorgu
 * gerekirdi.
 */
public class ReportResponse {

    private Long id;
    private String targetType;
    private Long targetId;
    private String reason;
    private boolean resolved;
    private LocalDateTime createdAt;

    private Long reporterId;
    private String reporterUsername;

    /** Şikayet edilen içeriğin kısa metni (gönderi/yorum/mesaj) ya da kullanıcı adı. */
    private String targetPreview;
    /** İçerik şu an gizli mi. */
    private boolean targetHidden;
    /** İçerik sahibinin id'si — doğrudan profiline gitmek için. */
    private Long targetOwnerId;
    private String targetOwnerUsername;

    public static ReportResponse from(Report r, String preview, boolean hidden,
                                      Long ownerId, String ownerUsername) {
        ReportResponse dto = new ReportResponse();
        dto.id = r.getId();
        dto.targetType = r.getTargetType();
        dto.targetId = r.getTargetId();
        dto.reason = r.getReason();
        dto.resolved = r.isResolved();
        dto.createdAt = r.getCreatedAt();
        dto.reporterId = r.getReporter() != null ? r.getReporter().getId() : null;
        dto.reporterUsername = r.getReporter() != null ? r.getReporter().getUsername() : null;
        dto.targetPreview = preview;
        dto.targetHidden = hidden;
        dto.targetOwnerId = ownerId;
        dto.targetOwnerUsername = ownerUsername;
        return dto;
    }

    public Long getId() { return id; }
    public String getTargetType() { return targetType; }
    public Long getTargetId() { return targetId; }
    public String getReason() { return reason; }
    public boolean isResolved() { return resolved; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Long getReporterId() { return reporterId; }
    public String getReporterUsername() { return reporterUsername; }
    public String getTargetPreview() { return targetPreview; }
    public boolean isTargetHidden() { return targetHidden; }
    public Long getTargetOwnerId() { return targetOwnerId; }
    public String getTargetOwnerUsername() { return targetOwnerUsername; }
}
