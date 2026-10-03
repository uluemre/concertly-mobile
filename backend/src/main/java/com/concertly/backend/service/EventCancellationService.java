package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventAttendance;
import com.concertly.backend.repository.EventAttendanceRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.service.ingest.ConcertGrouping;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Iptal edilen konserler.
 *
 * Kayit SILINMEZ: delisted_reason = CANCELLED ile tum kesif listelerinden
 * (ana sayfa, etkinlikler, harita, arama, sanatci/mekan sayfalari) duser, cunku
 * listeler zaten "delisted_reason IS NULL" kosuluyla sorgulaniyor. Detay sayfasi
 * acilmaya devam eder; istemci {@code cancelled} alaniyla iptal bandini gosterir.
 * Katilimlar, gonderiler, yorumlar yerinde kalir.
 *
 * Iki yoldan iptal edilir: kaynak (Ticketmaster durum kodu, Biletinial/Bubilet
 * schema.org EventCancelled) ya da admin. Ilk iptalde "Gidiyorum" ve
 * "Ilgileniyorum" diyenlere bildirim (ve push) gider; ayni kayit icin ikinci
 * kez bildirim gitmez.
 */
@Service
public class EventCancellationService {

    private static final Logger log = LoggerFactory.getLogger(EventCancellationService.class);

    public static final String REASON = "CANCELLED";
    public static final String NOTIFICATION_TYPE = "event_cancelled";

    private final EventRepository eventRepository;
    private final EventAttendanceRepository attendanceRepository;
    private final NotificationService notificationService;

    /** Admin iptalinde ayni konserin diger kaynaklardaki kopyalari da kapansin diye (istege bagli). */
    @Autowired(required = false)
    private ConcertGrouping grouping;

    public EventCancellationService(EventRepository eventRepository,
                                    EventAttendanceRepository attendanceRepository,
                                    NotificationService notificationService) {
        this.eventRepository = eventRepository;
        this.attendanceRepository = attendanceRepository;
        this.notificationService = notificationService;
    }

    public static boolean isCancelled(Event event) {
        return event != null && REASON.equals(event.getDelistedReason());
    }

    /**
     * Kaydi iptal eder ve katilimcilara haber verir.
     *
     * @return kayit bu cagriyla iptal edildiyse true (zaten iptalse false)
     */
    @Transactional
    public boolean cancel(Event event) {
        if (event == null || isCancelled(event)) return false;
        event.setDelistedReason(REASON);
        event.setIsApproved(false);
        eventRepository.save(event);
        notifyAttendees(event);
        log.info("Etkinlik iptal edildi: #{} {}", event.getId(), event.getName());
        return true;
    }

    /** Admin: kaydi ve listede ayni kart olarak gosterilen kopyalarini iptal eder. */
    @Transactional
    public int cancelById(Long eventId) {
        Event event = load(eventId);
        int count = 0;
        for (Event e : withListingCopies(event)) {
            if (cancel(e)) count++;
        }
        return count;
    }

    /** Admin: iptali geri alir; kayit listelere doner. Kaynak iptaliyle kapanmis olsa da. */
    @Transactional
    public int uncancelById(Long eventId) {
        Event event = load(eventId);
        int count = 0;
        for (Event e : withListingCopies(event)) {
            if (!isCancelled(e)) continue;
            e.setDelistedReason(null);
            e.setIsApproved(e.getMergedIntoEventId() == null);
            eventRepository.save(e);
            count++;
        }
        return count;
    }

    private void notifyAttendees(Event event) {
        Set<Long> recipients = new LinkedHashSet<>();
        for (AttendanceStatus status : List.of(AttendanceStatus.GOING, AttendanceStatus.INTERESTED)) {
            for (EventAttendance a : attendanceRepository.findByEventIdAndStatus(event.getId(), status)) {
                if (a.getUser() != null && a.getUser().getId() != null) recipients.add(a.getUser().getId());
            }
        }
        // Gecmis konser icin bildirim anlamsiz
        if (event.getEventDate() != null && event.getEventDate().isBefore(LocalDateTime.now())) return;
        for (Long userId : recipients) {
            notificationService.sendSystem(userId, NOTIFICATION_TYPE, "event", event.getId(), event.getName());
        }
    }

    /** Kaydin kendisi + listede onunla tek kart olarak gosterilen kopyalar. */
    private List<Event> withListingCopies(Event event) {
        List<Event> out = new ArrayList<>();
        out.add(event);
        if (grouping == null || event.getEventDate() == null) return out;
        long tolerance = grouping.toleranceMinutes();
        // Onay durumundan bagimsiz pencere: iptal edilmis kopyalar da (geri alma icin) gorunsun.
        // Baska sebeple gizlenmis ya da birlestirilmis kayitlara dokunulmaz.
        List<Event> window = new ArrayList<>();
        for (Event e : eventRepository.findByEventDateBetween(
                event.getEventDate().minusMinutes(tolerance), event.getEventDate().plusMinutes(tolerance))) {
            if (e.getMergedIntoEventId() != null) continue;
            if (e.getDelistedReason() != null && !REASON.equals(e.getDelistedReason())) continue;
            window.add(e);
        }
        if (window.stream().noneMatch(e -> e.getId().equals(event.getId()))) window.add(event);
        ConcertGrouping.Group g = grouping.group(window).get(event.getId());
        if (g != null) {
            for (Event m : g.members()) if (!m.getId().equals(event.getId())) out.add(m);
        }
        return out;
    }

    private Event load(Long id) {
        return eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Etkinlik bulunamadi: " + id));
    }
}
