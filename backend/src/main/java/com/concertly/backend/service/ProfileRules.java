package com.concertly.backend.service;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;

/**
 * Ad soyad ve doğum tarihi kuralları — kayıtta ve "profilini tamamla" adımında.
 * Hatalar istemcinin çevirdiği kodlarla döner (400): FULL_NAME_INVALID,
 * BIRTH_DATE_INVALID, UNDERAGE.
 */
public final class ProfileRules {

    public static final int MIN_AGE = 18;
    static final int FULL_NAME_MAX = 60;
    private static final ZoneId ZONE = ZoneId.of("Europe/Istanbul");
    private static final LocalDate OLDEST = LocalDate.of(1900, 1, 1);

    private ProfileRules() {}

    /** Kırpar, aradaki boşlukları teke indirir; 2-60 karakter, en az bir harf, rakam yok. */
    public static String requireFullName(String raw) {
        String name = raw == null ? "" : raw.trim().replaceAll("\s+", " ");
        boolean hasLetter = name.codePoints().anyMatch(Character::isLetter);
        boolean allowed = name.codePoints().allMatch(c ->
                Character.isLetter(c) || c == ' ' || c == '-' || c == '\'' || c == '.' || Character.getType(c) == Character.NON_SPACING_MARK);
        if (name.length() < 2 || name.length() > FULL_NAME_MAX || !hasLetter || !allowed) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "FULL_NAME_INVALID");
        }
        return name;
    }

    /** Geçerli ve 18 yaşını doldurmuş bir doğum tarihi ister. */
    public static LocalDate requireAdultBirthDate(LocalDate birthDate) {
        LocalDate today = today();
        if (birthDate == null || birthDate.isBefore(OLDEST) || birthDate.isAfter(today)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "BIRTH_DATE_INVALID");
        }
        if (age(birthDate, today) < MIN_AGE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "UNDERAGE");
        }
        return birthDate;
    }

    /** Doğum tarihi yoksa null. */
    public static Integer age(LocalDate birthDate) {
        return birthDate == null ? null : age(birthDate, today());
    }

    static int age(LocalDate birthDate, LocalDate today) {
        return Period.between(birthDate, today).getYears();
    }

    private static LocalDate today() {
        return LocalDate.now(ZONE);
    }
}
