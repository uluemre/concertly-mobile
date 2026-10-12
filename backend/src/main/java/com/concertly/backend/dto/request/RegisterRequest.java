package com.concertly.backend.dto.request;

import java.time.LocalDate;

public class RegisterRequest {

    private String username;
    private String email;
    private String password;
    private String city;
    private String fullName;
    private LocalDate birthDate;   // "YYYY-MM-DD"

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }

    public String getCity() {
        return city;
    }

    public String getFullName() { return fullName; }
    public LocalDate getBirthDate() { return birthDate; }

    public void setUsername(String username) {
        this.username = username;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public void setFullName(String fullName) { this.fullName = fullName; }
    public void setBirthDate(LocalDate birthDate) { this.birthDate = birthDate; }
}
