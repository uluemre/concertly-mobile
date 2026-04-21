package com.concertly.backend.dto.response;

public class AuthResponse {

    private String accessToken;
    private String tokenType = "Bearer";
    private Long userId;
    private String username;
    private String email;

    public AuthResponse(String accessToken, Long userId, String username, String email) {
        this.accessToken = accessToken;
        this.userId      = userId;
        this.username    = username;
        this.email       = email;
    }

    public String getAccessToken()  { return accessToken; }
    public String getTokenType()    { return tokenType; }
    public Long getUserId()         { return userId; }
    public String getUsername()     { return username; }
    public String getEmail()        { return email; }
}