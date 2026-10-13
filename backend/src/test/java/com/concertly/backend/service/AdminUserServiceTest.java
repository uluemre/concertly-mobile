package com.concertly.backend.service;

import com.concertly.backend.model.Role;
import com.concertly.backend.model.User;
import com.concertly.backend.model.UserSanction;
import com.concertly.backend.repository.BadgeRepository;
import com.concertly.backend.repository.UserBadgeRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.repository.UserSanctionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Admin kullanıcı yönetimi: süreli yasak, uyarı bildirimi, korumalar, otomatik yasak bitişi. */
class AdminUserServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UserRepository users = mock(UserRepository.class);
    private final UserSanctionRepository sanctions = mock(UserSanctionRepository.class);
    private final RefreshTokenService tokens = mock(RefreshTokenService.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final AdminUserService service = new AdminUserService(jdbc, users, sanctions,
            mock(BadgeRepository.class), mock(UserBadgeRepository.class), tokens, notifications);

    private User target;

    @BeforeEach
    void setUp() {
        target = new User();
        ReflectionTestUtils.setField(target, "id", 20L);
        target.setRoles(new HashSet<>());
        when(users.findById(20L)).thenReturn(Optional.of(target));
        when(sanctions.save(any())).thenAnswer(inv -> {
            UserSanction s = inv.getArgument(0);
            ReflectionTestUtils.setField(s, "id", 99L);
            return s;
        });
    }

    private static String reason(Runnable r) {
        return assertThrows(ResponseStatusException.class, r::run).getReason();
    }

    @Test
    void timedBanSetsUntilClosesSessionsAndRecords() {
        String detail = service.ban(20L, "Spam", 7, 1L, "d");
        assertFalse(target.getIsActive());
        assertNotNull(target.getBannedUntil());
        assertTrue(target.getBannedUntil().isAfter(LocalDateTime.now().plusDays(6)));
        verify(tokens).deleteByUser(target);
        ArgumentCaptor<UserSanction> s = ArgumentCaptor.forClass(UserSanction.class);
        verify(sanctions).save(s.capture());
        assertEquals(UserSanction.Type.BAN, s.getValue().getType());
        assertEquals("d", s.getValue().getAdminName());
        assertTrue(detail.contains("7"));
    }

    @Test
    void permanentBanHasNoEnd() {
        service.ban(20L, "Taciz", 0, 1L, "d");
        assertNull(target.getBannedUntil());
        assertFalse(target.getIsActive());
    }

    @Test
    void banGuards() {
        assertEquals("REASON_REQUIRED", reason(() -> service.ban(20L, " ", 3, 1L, "d")));
        assertEquals("CANNOT_BAN_SELF", reason(() -> service.ban(20L, "x", 3, 20L, "d")));
        assertEquals("INVALID_DURATION", reason(() -> service.ban(20L, "x", 400, 1L, "d")));
        Role admin = new Role();
        admin.setName("ROLE_ADMIN");
        target.setRoles(new HashSet<>(Set.of(admin)));
        assertEquals("CANNOT_BAN_ADMIN", reason(() -> service.ban(20L, "x", 3, 1L, "d")));
        verifyNoInteractions(tokens);
    }

    @Test
    void reinstateClearsBan() {
        target.setIsActive(false);
        target.setBannedUntil(LocalDateTime.now().plusDays(3));
        service.unban(20L, null, "d");
        assertTrue(target.getIsActive());
        assertNull(target.getBannedUntil());
        assertEquals("NOT_BANNED", reason(() -> service.unban(20L, null, "d")));
    }

    @Test
    void warningNotifiesUserWithReason() {
        service.warn(20L, "Yorumlarda hakaret var", "d");
        verify(notifications).sendSystem(20L, "admin_warning", "user", 99L, "Yorumlarda hakaret var");
        assertEquals("REASON_REQUIRED", reason(() -> service.warn(20L, "", "d")));
    }

    @Test
    void notesAreNotSentToUser() {
        service.note(20L, "Önceki hesabı da spamdı", "d");
        verifyNoInteractions(notifications);
    }

    @Test
    void expiredBansAreLiftedAutomatically() {
        when(jdbc.queryForList(contains("banned_until <= now()"), eq(Long.class))).thenReturn(List.of(20L, 21L));
        service.expireBans();
        verify(jdbc).update(contains("is_active = true"), eq(20L));
        verify(jdbc).update(contains("is_active = true"), eq(21L));
        verify(sanctions, times(2)).save(argThat(s -> s.getType() == UserSanction.Type.UNBAN && "system".equals(s.getAdminName())));
    }
}
