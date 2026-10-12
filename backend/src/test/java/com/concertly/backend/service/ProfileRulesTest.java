package com.concertly.backend.service;

import com.concertly.backend.dto.request.BasicInfoRequest;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ProfileRulesTest {

    private static final LocalDate TODAY = LocalDate.now(ZoneId.of("Europe/Istanbul"));

    private static String reason(Runnable r) {
        return assertThrows(ResponseStatusException.class, r::run).getReason();
    }

    @Test
    void fullNameIsTrimmedAndValidated() {
        assertEquals("Hadise Açıkgöz", ProfileRules.requireFullName("  Hadise   Açıkgöz "));
        assertEquals("Jean-Luc O'Neil", ProfileRules.requireFullName("Jean-Luc O'Neil"));
        assertEquals("FULL_NAME_INVALID", reason(() -> ProfileRules.requireFullName(null)));
        assertEquals("FULL_NAME_INVALID", reason(() -> ProfileRules.requireFullName(" a ")));
        assertEquals("FULL_NAME_INVALID", reason(() -> ProfileRules.requireFullName("Emre 123")));
        assertEquals("FULL_NAME_INVALID", reason(() -> ProfileRules.requireFullName("--")));
        assertEquals("FULL_NAME_INVALID", reason(() -> ProfileRules.requireFullName("a".repeat(61))));
    }

    @Test
    void birthDateMustBeRealAndAdult() {
        LocalDate eighteenToday = TODAY.minusYears(18);
        assertEquals(eighteenToday, ProfileRules.requireAdultBirthDate(eighteenToday));
        assertEquals("UNDERAGE", reason(() -> ProfileRules.requireAdultBirthDate(eighteenToday.plusDays(1))));
        assertEquals("BIRTH_DATE_INVALID", reason(() -> ProfileRules.requireAdultBirthDate(null)));
        assertEquals("BIRTH_DATE_INVALID", reason(() -> ProfileRules.requireAdultBirthDate(TODAY.plusDays(1))));
        assertEquals("BIRTH_DATE_INVALID", reason(() -> ProfileRules.requireAdultBirthDate(LocalDate.of(1899, 12, 31))));
    }

    @Test
    void ageCountsCompletedYears() {
        assertEquals(17, ProfileRules.age(LocalDate.of(2000, 6, 2), LocalDate.of(2018, 6, 1)));
        assertEquals(18, ProfileRules.age(LocalDate.of(2000, 6, 2), LocalDate.of(2018, 6, 2)));
        assertNull(ProfileRules.age(null));
    }

    @Test
    void basicInfoWritesBirthDateOnlyOnce() {
        UserRepository repo = mock(UserRepository.class);
        User user = new User();
        user.setUsername("emre");
        when(repo.findById(1L)).thenReturn(Optional.of(user));
        when(repo.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        UserService svc = new UserService(repo, null, null, null, null, null, null, null, null, null);

        BasicInfoRequest req = new BasicInfoRequest();
        req.setFullName(" Emre  Ulu ");
        req.setBirthDate(LocalDate.of(1999, 3, 4));
        assertTrue(svc.updateBasicInfo(1L, req).isProfileComplete());
        assertEquals("Emre Ulu", user.getFullName());

        // Aynı tarihle ad değiştirilebilir; farklı tarih reddedilir
        req.setFullName("Emre U");
        svc.updateBasicInfo(1L, req);
        assertEquals("Emre U", user.getFullName());
        req.setBirthDate(LocalDate.of(1990, 1, 1));
        assertEquals("BIRTH_DATE_LOCKED", reason(() -> svc.updateBasicInfo(1L, req)));
        assertEquals(LocalDate.of(1999, 3, 4), user.getBirthDate());
    }

    @Test
    void underageCannotCompleteProfile() {
        UserRepository repo = mock(UserRepository.class);
        when(repo.findById(1L)).thenReturn(Optional.of(new User()));
        UserService svc = new UserService(repo, null, null, null, null, null, null, null, null, null);
        BasicInfoRequest req = new BasicInfoRequest();
        req.setFullName("Genç Dinleyici");
        req.setBirthDate(TODAY.minusYears(16));
        assertEquals("UNDERAGE", reason(() -> svc.updateBasicInfo(1L, req)));
        verify(repo, never()).save(any());
    }
}
