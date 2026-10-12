package com.concertly.backend.dto.request;

import java.time.LocalDate;

/** "Profilini tamamla": ad soyad + doğum tarihi (doğum tarihi bir kez yazılır). */
public class BasicInfoRequest {

    private String fullName;
    private LocalDate birthDate;   // "YYYY-MM-DD"

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public LocalDate getBirthDate() { return birthDate; }
    public void setBirthDate(LocalDate birthDate) { this.birthDate = birthDate; }
}
