package com.concertly.backend.dto.response;

import com.concertly.backend.model.User;

import java.time.LocalDate;

/** Yalnız sahibine döner: doğum tarihi başka hiçbir yanıtta yok. */
public class BasicInfoResponse {

    private String fullName;
    private LocalDate birthDate;
    private boolean profileComplete;

    public static BasicInfoResponse from(User user) {
        BasicInfoResponse dto = new BasicInfoResponse();
        dto.fullName = user.getFullName();
        dto.birthDate = user.getBirthDate();
        dto.profileComplete = user.isProfileComplete();
        return dto;
    }

    public String getFullName() { return fullName; }
    public LocalDate getBirthDate() { return birthDate; }
    public boolean isProfileComplete() { return profileComplete; }
}
