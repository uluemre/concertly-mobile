package com.concertly.backend.service;

import com.concertly.backend.dto.request.VerifyEventRequest;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventVerification;
import com.concertly.backend.model.User;
import com.concertly.backend.model.VerificationMethod;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.EventVerificationRepository;
import com.concertly.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Konser katılım doğrulaması.
 *
 * Doğrulama ürünün ana farklılaştırıcısı olduğu için karar SUNUCUDA verilir.
 * Daha önce mesafe kontrolü yalnızca mobil tarafta yapılıyordu; endpoint
 * koordinat almadığı için geçerli token sahibi biri dünyanın herhangi bir
 * yerinden "gittim" kaydı oluşturabiliyordu.
 *
 * Kontroller:
 * 1. Aynı etkinlik için tek doğrulama (unique constraint + ön kontrol).
 * 2. Koordinat zorunlu ve geçerli aralıkta.
 * 3. Mekanın koordinatı yoksa doğrulama yapılamaz (sessizce kabul edilmez).
 * 4. Haversine ile mesafe, app.verification.max-distance-meters sınırının altında.
 * 5. Zaman penceresi: etkinlik saatinden X saat önce ... Y saat sonra.
 * 6. Sahte konum (mock location) bildirimi reddedilir ve loglanır.
 */
@Service
public class EventVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EventVerificationService.class);

    private static final double EARTH_RADIUS_METERS = 6_371_000d;

    private final EventVerificationRepository verificationRepository;
    private final UserRepository userRepository;
    private final EventRepository eventRepository;

    private final double maxDistanceMeters;
    private final long windowHoursBefore;
    private final long windowHoursAfter;
    private final boolean rejectMockLocation;

    public EventVerificationService(EventVerificationRepository verificationRepository,
            UserRepository userRepository,
            EventRepository eventRepository,
            @Value("${app.verification.max-distance-meters:500}") double maxDistanceMeters,
            @Value("${app.verification.window-hours-before:6}") long windowHoursBefore,
            @Value("${app.verification.window-hours-after:12}") long windowHoursAfter,
            @Value("${app.verification.reject-mock-location:true}") boolean rejectMockLocation) {
        this.verificationRepository = verificationRepository;
        this.userRepository = userRepository;
        this.eventRepository = eventRepository;
        this.maxDistanceMeters = maxDistanceMeters;
        this.windowHoursBefore = windowHoursBefore;
        this.windowHoursAfter = windowHoursAfter;
        this.rejectMockLocation = rejectMockLocation;
    }

    public Map<String, Object> verify(Long userId, Long eventId, VerifyEventRequest request) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Oturum gerekli.");
        }
        if (verificationRepository.existsByUserIdAndEventId(userId, eventId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu konser zaten doğrulandı.");
        }

        Double lat = request != null ? request.getLatitude() : null;
        Double lng = request != null ? request.getLongitude() : null;
        if (lat == null || lng == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Doğrulama için konum gerekli.");
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Konum geçersiz.");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Etkinlik bulunamadı: " + eventId));

        boolean mocked = Boolean.TRUE.equals(request.getMocked());
        if (mocked && rejectMockLocation) {
            log.warn("Sahte konum reddedildi: userId={} eventId={}", userId, eventId);
            return rejected("MOCK_LOCATION", eventId, null);
        }

        // --- Zaman penceresi -------------------------------------------------
        LocalDateTime eventDate = event.getEventDate();
        if (eventDate == null) {
            return rejected("EVENT_NO_DATE", eventId, null);
        }
        LocalDateTime now = LocalDateTime.now();
        if (now.isBefore(eventDate.minusHours(windowHoursBefore))) {
            return rejected("TOO_EARLY", eventId, null);
        }
        if (now.isAfter(eventDate.plusHours(windowHoursAfter))) {
            return rejected("TOO_LATE", eventId, null);
        }

        // --- Mesafe ----------------------------------------------------------
        Venue venue = event.getVenue();
        if (venue == null || venue.getLatitude() == null || venue.getLongitude() == null) {
            return rejected("VENUE_NO_COORDS", eventId, null);
        }
        double distance = distanceInMeters(lat, lng, venue.getLatitude(), venue.getLongitude());
        if (distance > maxDistanceMeters) {
            return rejected("TOO_FAR", eventId, Math.round(distance));
        }

        EventVerification verification = new EventVerification();
        verification.setUser(user);
        verification.setEvent(event);
        verification.setLatitude(lat);
        verification.setLongitude(lng);
        verification.setAccuracyMeters(request.getAccuracyMeters());
        verification.setDistanceMeters(distance);
        verification.setMethod(VerificationMethod.GPS);
        verification.setMockLocationSuspected(mocked);
        verificationRepository.save(verification);

        Map<String, Object> body = new HashMap<>();
        body.put("verified", true);
        body.put("eventId", eventId);
        body.put("distanceMeters", Math.round(distance));
        body.put("verifiedAt", verification.getVerifiedAt());
        body.put("method", VerificationMethod.GPS.name());
        return body;
    }

    /**
     * İş kuralı gereği reddedilen doğrulama. HTTP 200 + verified=false döner:
     * bunlar sunucu hatası değil, beklenen kullanıcı durumlarıdır. İstemci
     * {@code reason} koduna bakıp kendi dilinde mesaj gösterir — sunucunun
     * Türkçe metnini ekrana basmak zorunda kalmaz.
     */
    private Map<String, Object> rejected(String reason, Long eventId, Long distanceMeters) {
        Map<String, Object> body = new HashMap<>();
        body.put("verified", false);
        body.put("eventId", eventId);
        body.put("reason", reason);
        body.put("distanceMeters", distanceMeters);
        body.put("maxDistanceMeters", Math.round(maxDistanceMeters));
        return body;
    }

    public Map<String, Object> getStatus(Long userId, Long eventId) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Oturum gerekli.");
        }
        Map<String, Object> body = new HashMap<>();
        body.put("eventId", eventId);
        verificationRepository.findByUserIdAndEventId(userId, eventId).ifPresentOrElse(v -> {
            body.put("verified", true);
            body.put("verifiedAt", v.getVerifiedAt());
            body.put("distanceMeters",
                    v.getDistanceMeters() != null ? Math.round(v.getDistanceMeters()) : null);
            body.put("method", v.getMethod() != null ? v.getMethod().name() : null);
        }, () -> body.put("verified", false));
        return body;
    }

    /** İki koordinat arası büyük daire mesafesi (Haversine), metre cinsinden. */
    static double distanceInMeters(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                        * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
