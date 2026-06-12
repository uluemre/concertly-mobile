package com.concertly.backend.dto.response;

import java.time.LocalDateTime;

public class ConversationResponse {
    private Long userId;
    private String username;
    private String profileImageUrl;
    private String lastMessage;
    private boolean lastFromMe;
    private LocalDateTime lastMessageAt;
    private long unreadCount;

    public ConversationResponse(Long userId, String username, String profileImageUrl,
                                String lastMessage, boolean lastFromMe,
                                LocalDateTime lastMessageAt, long unreadCount) {
        this.userId          = userId;
        this.username        = username;
        this.profileImageUrl = profileImageUrl;
        this.lastMessage     = lastMessage;
        this.lastFromMe      = lastFromMe;
        this.lastMessageAt   = lastMessageAt;
        this.unreadCount     = unreadCount;
    }

    public Long getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getProfileImageUrl() { return profileImageUrl; }
    public String getLastMessage() { return lastMessage; }
    public boolean isLastFromMe() { return lastFromMe; }
    public LocalDateTime getLastMessageAt() { return lastMessageAt; }
    public long getUnreadCount() { return unreadCount; }
}
