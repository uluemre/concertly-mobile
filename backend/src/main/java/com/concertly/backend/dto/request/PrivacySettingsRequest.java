package com.concertly.backend.dto.request;

import com.concertly.backend.model.MessagePrivacy;

/** Gizlilik ayarları. Null gelen alan değişmez. */
public class PrivacySettingsRequest {

    private MessagePrivacy messagePrivacy;
    private Boolean privateAccount;

    public MessagePrivacy getMessagePrivacy() { return messagePrivacy; }
    public void setMessagePrivacy(MessagePrivacy messagePrivacy) { this.messagePrivacy = messagePrivacy; }

    public Boolean getPrivateAccount() { return privateAccount; }
    public void setPrivateAccount(Boolean privateAccount) { this.privateAccount = privateAccount; }
}
