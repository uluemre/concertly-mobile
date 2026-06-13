package com.concertly.backend.service;

import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.model.Event;
import com.concertly.backend.repository.EventAttendanceRepository;
import com.concertly.backend.repository.EventBookmarkRepository;
import com.concertly.backend.repository.EventRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Konser hatırlatmaları: yaklaşan etkinliği kaydetmiş ya da "Gidiyorum" demiş
 * kullanıcılara bildirim düşürür. sendSystem mükerrer göndermeyi engeller,
 * bu yüzden görev her gün güvenle tekrar çalışabilir.
 */
@Service
public class ReminderService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("d MMMM HH:mm");

    private final EventRepository eventRepository;
    private final EventAttendanceRepository attendanceRepository;
    private final EventBookmarkRepository bookmarkRepository;
    private final NotificationService notificationService;

    public ReminderService(EventRepository eventRepository,
                           EventAttendanceRepository attendanceRepository,
                           EventBookmarkRepository bookmarkRepository,
                           NotificationService notificationService) {
        this.eventRepository = eventRepository;
        this.attendanceRepository = attendanceRepository;
        this.bookmarkRepository = bookmarkRepository;
        this.notificationService = notificationService;
    }

    /** Her sabah 09:00 — önümüzdeki 36 saat içindeki konserler için hatırlatma. */
    @Scheduled(cron = "${reminder.cron:0 0 9 * * *}")
    public void sendUpcomingEventReminders() {
        LocalDateTime now = LocalDateTime.now();
        List<Event> upcoming = eventRepository.findByEventDateBetween(now, now.plusHours(36));
        if (upcoming.isEmpty()) return;

        int sent = 0;
        for (Event event : upcoming) {
            Set<Long> recipients = new HashSet<>();
            attendanceRepository.findByEventIdAndStatus(event.getId(), AttendanceStatus.GOING)
                    .forEach(a -> recipients.add(a.getUser().getId()));
            bookmarkRepository.findAllByEventId(event.getId())
                    .forEach(b -> recipients.add(b.getUser().getId()));
            if (recipients.isEmpty()) continue;

            String message = event.getName() + " · " + event.getEventDate().format(DATE_FMT);
            for (Long userId : recipients) {
                notificationService.sendSystem(userId, "event_reminder", "event", event.getId(), message);
                sent++;
            }
        }
        System.out.println("🔔 Konser hatırlatmaları gönderildi: " + sent + " bildirim, " + upcoming.size() + " etkinlik tarandı.");
    }
}
