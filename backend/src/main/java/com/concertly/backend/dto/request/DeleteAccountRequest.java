package com.concertly.backend.dto.request;

/**
 * Hesap silme isteği. reason ZORUNLU (kullanıcı neden ayrıldığını belirtmeli);
 * details opsiyonel serbest metindir.
 */
public class DeleteAccountRequest {

    private String reason;
    private String details;

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }
}
