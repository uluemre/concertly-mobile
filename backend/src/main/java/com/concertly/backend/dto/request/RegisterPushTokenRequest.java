package com.concertly.backend.dto.request;

/** Cihazın Expo push adresini kaydetme isteği. */
public class RegisterPushTokenRequest {

    private String token;
    /** ios | android */
    private String platform;
    /** Uygulamanın o anki dili (tr/en) — bildirim metni buna göre seçilir. */
    private String language;

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
}
