package com.concertly.backend.dto.response;

import com.concertly.backend.model.User;

public class NotificationSettingsResponse {

    private boolean pushEnabled;
    private boolean pushSocial;
    private boolean pushMessages;
    private boolean pushEvents;
    private boolean pushCommunities;
    private boolean pushGames;

    public static NotificationSettingsResponse from(User u) {
        NotificationSettingsResponse dto = new NotificationSettingsResponse();
        dto.pushEnabled     = Boolean.TRUE.equals(u.getPushEnabled());
        dto.pushSocial      = Boolean.TRUE.equals(u.getPushSocial());
        dto.pushMessages    = Boolean.TRUE.equals(u.getPushMessages());
        dto.pushEvents      = Boolean.TRUE.equals(u.getPushEvents());
        dto.pushCommunities = Boolean.TRUE.equals(u.getPushCommunities());
        dto.pushGames       = Boolean.TRUE.equals(u.getPushGames());
        return dto;
    }

    public boolean isPushEnabled() { return pushEnabled; }
    public boolean isPushSocial() { return pushSocial; }
    public boolean isPushMessages() { return pushMessages; }
    public boolean isPushEvents() { return pushEvents; }
    public boolean isPushCommunities() { return pushCommunities; }
    public boolean isPushGames() { return pushGames; }
}
