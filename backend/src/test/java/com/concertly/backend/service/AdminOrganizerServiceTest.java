package com.concertly.backend.service;

import com.concertly.backend.model.Organizer;
import com.concertly.backend.model.OrganizerRequest;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.OrganizerRepository;
import com.concertly.backend.repository.OrganizerRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Admin organizatör yönetimi: askıya alma bildirimi, yetki anahtarları, iç not. */
class AdminOrganizerServiceTest {

    private final OrganizerRequestRepository requests = mock(OrganizerRequestRepository.class);
    private final OrganizerRepository organizers = mock(OrganizerRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final AdminOrganizerService service = new AdminOrganizerService(
            mock(JdbcTemplate.class), requests, organizers, mock(OrganizerEventService.class), notifications);

    private Organizer org;

    @BeforeEach
    void setUp() {
        User owner = new User();
        ReflectionTestUtils.setField(owner, "id", 7L);
        org = new Organizer();
        ReflectionTestUtils.setField(org, "id", 3L);
        org.setOwner(owner);
        org.setName("Pozitif");
        when(organizers.findById(3L)).thenReturn(Optional.of(org));
    }

    @Test
    void suspendingNotifiesOwnerAndIsRecorded() {
        List<String> diff = service.update(3L, Map.of("active", false));
        assertFalse(org.isActive());
        assertEquals(List.of("active: true → false"), diff);
        verify(notifications).sendSystem(eq(7L), eq("organizer_suspended"), eq("user"), eq(3L), anyString());

        service.update(3L, Map.of("active", true));
        verify(notifications).sendSystem(eq(7L), eq("organizer_reactivated"), eq("user"), eq(3L), anyString());
    }

    @Test
    void togglesAnnounceAndBadgeWithoutNotification() {
        List<String> diff = service.update(3L, Map.of("canAnnounce", false, "verified", "false"));
        assertFalse(org.isCanAnnounce());
        assertFalse(org.isVerified());
        assertEquals(2, diff.size());
        verifyNoInteractions(notifications);
    }

    @Test
    void unchangedValuesProduceNoDiff() {
        assertTrue(service.update(3L, Map.of("active", true, "name", "Pozitif")).isEmpty());
        verifyNoInteractions(notifications);
    }

    @Test
    void invalidValuesAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.update(3L, Map.of("active", "evet")));
        assertThrows(IllegalArgumentException.class, () -> service.update(3L, Map.of("name", " ")));
    }

    @Test
    void internalNoteIsTrimmedAndLimited() {
        OrganizerRequest r = new OrganizerRequest();
        when(requests.findById(9L)).thenReturn(Optional.of(r));
        service.setInternalNote(9L, "  Instagram 12 bin takipçili, gerçek  ");
        assertEquals("Instagram 12 bin takipçili, gerçek", r.getInternalNote());
        service.setInternalNote(9L, "   ");
        assertNull(r.getInternalNote());
        assertThrows(IllegalArgumentException.class, () -> service.setInternalNote(9L, "x".repeat(1001)));
    }
}
