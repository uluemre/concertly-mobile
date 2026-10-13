package com.concertly.backend.service;

import com.concertly.backend.model.Organizer;
import com.concertly.backend.model.OrganizerRequest;
import com.concertly.backend.model.Role;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.OrganizerRepository;
import com.concertly.backend.repository.OrganizerRequestRepository;
import com.concertly.backend.repository.RoleRepository;
import com.concertly.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Organizatör başvurusu → onay → organizatör hesabı; durum ve güven kuralları. */
class OrganizerServiceTest {

    private final OrganizerRequestRepository requests = mock(OrganizerRequestRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final RoleRepository roles = mock(RoleRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final OrganizerRepository organizers = mock(OrganizerRepository.class);
    private final OrganizerService service = new OrganizerService(requests, users, roles, notifications, organizers);

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        ReflectionTestUtils.setField(user, "id", 7L);
        user.setRoles(new HashSet<>());
        when(users.findById(7L)).thenReturn(Optional.of(user));
        when(organizers.findByOwnerId(7L)).thenReturn(Optional.empty());
        when(requests.findByUserIdOrderByCreatedAtDesc(7L)).thenReturn(List.of());
        when(requests.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(organizers.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(roles.findByName(OrganizerService.ROLE_ORGANIZER)).thenReturn(Optional.of(new Role()));
    }

    private OrganizerRequest form(String name, String website, String instagram) {
        OrganizerRequest f = new OrganizerRequest();
        f.setOrganizationName(name);
        f.setWebsite(website);
        f.setInstagram(instagram);
        return f;
    }

    private String reason(Runnable r) {
        return assertThrows(ResponseStatusException.class, r::run).getReason();
    }

    @Test
    void applyValidatesWithCodes() {
        assertEquals("ORG_NAME_REQUIRED", reason(() -> service.apply(7L, form(" ", "https://x.com", null))));
        assertEquals("ORG_LINK_REQUIRED", reason(() -> service.apply(7L, form("Pozitif", null, " "))));
        when(requests.existsByUserIdAndStatus(7L, OrganizerRequest.Status.PENDING)).thenReturn(true);
        assertEquals("REQUEST_PENDING", reason(() -> service.apply(7L, form("Pozitif", "https://x.com", null))));
    }

    @Test
    void activeOrganizerCannotApplyAgain() {
        Organizer o = new Organizer();
        when(organizers.findByOwnerId(7L)).thenReturn(Optional.of(o));
        assertEquals("ALREADY_ORGANIZER", reason(() -> service.apply(7L, form("Pozitif", "https://x.com", null))));
    }

    @Test
    void approvalCreatesOrganizerAccountAndTrust() {
        OrganizerRequest req = form("Pozitif Live", "https://pozitif.com", "@pozitif");
        req.setUser(user);
        req.setType(OrganizerRequest.Type.ORGANIZER);
        when(requests.findById(3L)).thenReturn(Optional.of(req));

        service.approve(3L);

        verify(organizers).save(argThat(o -> o.getName().equals("Pozitif Live") && o.isActive()
                && o.getOwner() == user && "https://pozitif.com".equals(o.getWebsite())));
        assertEquals(OrganizerRequest.Status.APPROVED, req.getStatus());
    }

    @Test
    void reviewedRequestCannotBeDecidedTwice() {
        OrganizerRequest req = form("Pozitif Live", "https://pozitif.com", null);
        req.setUser(user);
        req.setStatus(OrganizerRequest.Status.REJECTED);
        when(requests.findById(4L)).thenReturn(Optional.of(req));
        assertEquals("REQUEST_ALREADY_REVIEWED", reason(() -> service.approve(4L, "d")));
        assertEquals("REQUEST_ALREADY_REVIEWED", reason(() -> service.reject(4L, "x", "d")));
        verifyNoInteractions(notifications);
        verify(organizers, never()).save(any());
    }

    @Test
    void reviewerIsRecorded() {
        OrganizerRequest req = form("Pozitif Live", "https://pozitif.com", null);
        req.setUser(user);
        when(requests.findById(5L)).thenReturn(Optional.of(req));
        service.reject(5L, "Instagram hesabı doğrulanamadı", "d");
        assertEquals("d", req.getReviewedBy());
        assertEquals("Instagram hesabı doğrulanamadı", req.getReviewNote());
    }

    @Test
    void statusStates() {
        assertEquals("NONE", service.status(7L).get("state"));

        OrganizerRequest pending = form("A", "https://a.com", null);
        pending.setUser(user);
        when(requests.findByUserIdOrderByCreatedAtDesc(7L)).thenReturn(List.of(pending));
        assertEquals("PENDING", service.status(7L).get("state"));

        pending.setStatus(OrganizerRequest.Status.REJECTED);
        assertEquals("REJECTED", service.status(7L).get("state"));

        Organizer o = new Organizer();
        o.setName("A");
        when(organizers.findByOwnerId(7L)).thenReturn(Optional.of(o));
        Map<String, Object> approved = service.status(7L);
        assertEquals("APPROVED", approved.get("state"));
        assertNotNull(approved.get("organizer"));

        o.setActive(false);
        assertEquals("SUSPENDED", service.status(7L).get("state"));
    }

    @Test
    void suspendedOrganizerIsNotTrustedAndPanelIsClosed() {
        Organizer o = new Organizer();
        when(organizers.findByOwnerId(7L)).thenReturn(Optional.of(o));
        assertTrue(service.isTrustedOrganizer(7L));
        assertSame(o, service.requireOrganizer(7L));

        o.setActive(false);
        assertFalse(service.isTrustedOrganizer(7L));
        assertEquals("NOT_ORGANIZER", reason(() -> service.requireOrganizer(7L)));
    }
}
