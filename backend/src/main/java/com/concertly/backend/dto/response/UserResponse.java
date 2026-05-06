package com.concertly.backend.dto.response;

public class UserResponse {

    private Long id;
    private String username;
    private String email;
    private String city;

    public UserResponse(Long id, String username, String email) {
        this(id, username, email, null);
    }

    public UserResponse(Long id, String username, String email, String city) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.city = city;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public String getCity() {
        return city;
    }
}