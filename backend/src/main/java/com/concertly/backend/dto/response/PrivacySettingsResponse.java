package com.concertly.backend.dto.response;

import com.concertly.backend.model.MessagePrivacy;
import com.concertly.backend.model.User;

public class PrivacySettingsResponse {

    private MessagePrivacy messagePrivacy;
    private boolean privateAccount;

    public static PrivacySettingsResponse from(User u) {
        PrivacySettingsResponse dto = new PrivacySettingsResponse();
        dto.messagePrivacy = u.getMessagePrivacy();
        dto.privateAccount = Boolean.TRUE.equals(u.getPrivateAccount());
        return dto;
    }

    public MessagePrivacy getMessagePrivacy() { return messagePrivacy; }
    public boolean isPrivateAccount() { return privateAccount; }
}
