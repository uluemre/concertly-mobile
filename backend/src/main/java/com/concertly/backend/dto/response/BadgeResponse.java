package com.concertly.backend.dto.response;

import com.concertly.backend.model.Badge;
import java.time.LocalDateTime;

public class BadgeResponse {
    private Long id;
    private String code;
    private String name;
    private String description;
    private String icon;
    private LocalDateTime earnedAt;
    private boolean earned;
    private int progress;
    private int required;

    public static BadgeResponse from(Badge badge, LocalDateTime earnedAt) {
        BadgeResponse r = new BadgeResponse();
        r.id = badge.getId();
        r.code = badge.getCode();
        r.name = badge.getName();
        r.description = badge.getDescription();
        r.icon = badge.getIcon();
        r.earnedAt = earnedAt;
        r.earned = earnedAt != null;
        return r;
    }

    public static BadgeResponse withProgress(Badge badge, LocalDateTime earnedAt, int progress, int required) {
        BadgeResponse r = from(badge, earnedAt);
        r.progress = progress;
        r.required = required;
        return r;
    }

    public Long getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public String getIcon() { return icon; }
    public LocalDateTime getEarnedAt() { return earnedAt; }
    public boolean isEarned() { return earned; }
    public int getProgress() { return progress; }
    public int getRequired() { return required; }
}
