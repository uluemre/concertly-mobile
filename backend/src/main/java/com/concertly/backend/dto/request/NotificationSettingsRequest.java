package com.concertly.backend.dto.request;

/**
 * Bildirim tercihleri. Alanlar null gelebilir — yalnızca gönderilenler
 * güncellenir, böylece istemci tek anahtarı değiştirebilir.
 */
public class NotificationSettingsRequest {

    private Boolean pushEnabled;
    private Boolean pushSocial;
    private Boolean pushMessages;
    private Boolean pushEvents;
    private Boolean pushCommunities;
    private Boolean pushGames;

    public Boolean getPushEnabled() { return pushEnabled; }
    public void setPushEnabled(Boolean pushEnabled) { this.pushEnabled = pushEnabled; }

    public Boolean getPushSocial() { return pushSocial; }
    public void setPushSocial(Boolean pushSocial) { this.pushSocial = pushSocial; }

    public Boolean getPushMessages() { return pushMessages; }
    public void setPushMessages(Boolean pushMessages) { this.pushMessages = pushMessages; }

    public Boolean getPushEvents() { return pushEvents; }
    public void setPushEvents(Boolean pushEvents) { this.pushEvents = pushEvents; }

    public Boolean getPushCommunities() { return pushCommunities; }
    public void setPushCommunities(Boolean pushCommunities) { this.pushCommunities = pushCommunities; }

    public Boolean getPushGames() { return pushGames; }
    public void setPushGames(Boolean pushGames) { this.pushGames = pushGames; }
}
