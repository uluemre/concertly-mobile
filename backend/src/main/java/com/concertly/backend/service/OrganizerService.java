package com.concertly.backend.service;

import com.concertly.backend.dto.response.OrganizerRequestResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.OrganizerRequest;
import com.concertly.backend.model.Role;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.OrganizerRequestRepository;
import com.concertly.backend.repository.RoleRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Organizatör hesabı başvuruları.
 *
 * Doğrulanmış organizatör, etkinliğini onay beklemeden yayınlayabilir — veri
 * kanalının işlemesi için gereken şey bu. Bu yüzden rol yalnızca admin
 * incelemesiyle verilir.
 */
@Service
public class OrganizerService {

    public static final String ROLE_ORGANIZER = "ROLE_ORGANIZER";

    private final OrganizerRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final NotificationService notificationService;

    public OrganizerService(OrganizerRequestRepository requestRepository,
            UserRepository userRepository,
            RoleRepository roleRepository,
            NotificationService notificationService) {
        this.requestRepository = requestRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public OrganizerRequestResponse apply(Long userId, OrganizerRequest form) {
        if (form == null || form.getOrganizationName() == null || form.getOrganizationName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kurum/organizasyon adı gerekli.");
        }
        if ((form.getWebsite() == null || form.getWebsite().isBlank())
                && (form.getInstagram() == null || form.getInstagram().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Doğrulama için site ya da Instagram adresi gerekli.");
        }
        if (requestRepository.existsByUserIdAndStatus(userId, OrganizerRequest.Status.PENDING)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Zaten inceleme bekleyen bir başvurun var.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));

        OrganizerRequest request = new OrganizerRequest();
        request.setUser(user);
        request.setOrganizationName(form.getOrganizationName().trim());
        request.setType(form.getType());
        request.setWebsite(form.getWebsite());
        request.setInstagram(form.getInstagram());
        request.setMessage(form.getMessage());
        return OrganizerRequestResponse.from(requestRepository.save(request));
    }

    public List<OrganizerRequestResponse> myRequests(Long userId) {
        return requestRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(OrganizerRequestResponse::from)
                .toList();
    }

    public List<OrganizerRequestResponse> pending() {
        return requestRepository.findByStatusOrderByCreatedAtAsc(OrganizerRequest.Status.PENDING).stream()
                .map(OrganizerRequestResponse::from)
                .toList();
    }

    @Transactional
    public void approve(Long requestId) {
        OrganizerRequest request = load(requestId);
        request.setStatus(OrganizerRequest.Status.APPROVED);
        request.setReviewedAt(LocalDateTime.now());
        requestRepository.save(request);

        User user = request.getUser();
        Role role = roleRepository.findByName(ROLE_ORGANIZER).orElseGet(() -> {
            Role created = new Role();
            created.setName(ROLE_ORGANIZER);
            return roleRepository.save(created);
        });
        user.getRoles().add(role);
        user.setIsVerified(true);
        userRepository.save(user);

        notificationService.sendSystem(user.getId(), "organizer_approved", "user", request.getId(),
                request.getOrganizationName() + " organizatör hesabı onaylandı");
    }

    @Transactional
    public void reject(Long requestId, String note) {
        OrganizerRequest request = load(requestId);
        request.setStatus(OrganizerRequest.Status.REJECTED);
        request.setReviewNote(note);
        request.setReviewedAt(LocalDateTime.now());
        requestRepository.save(request);

        notificationService.sendSystem(request.getUser().getId(), "organizer_rejected", "user", request.getId(),
                note != null && !note.isBlank() ? note : "Organizatör başvurun onaylanmadı");
    }

    /** Etkinlik önerisi doğrudan yayına girsin mi? */
    public boolean isTrustedOrganizer(Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getRoles() == null) return false;
        return user.getRoles().stream()
                .anyMatch(r -> ROLE_ORGANIZER.equals(r.getName()) || "ROLE_ADMIN".equals(r.getName()));
    }

    private OrganizerRequest load(Long requestId) {
        return requestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru bulunamadı: " + requestId));
    }
}
