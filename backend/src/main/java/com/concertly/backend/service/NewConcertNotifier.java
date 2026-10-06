package com.concertly.backend.service;

import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Event;
import com.concertly.backend.repository.ArtistFollowRepository;
import com.concertly.backend.repository.EventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Takip edilen sanatçının yeni konseri eklenince takipçilere "new_event" bildirimi.
 *
 * Tüm kaynaklar (Ticketmaster, Biletinial, Bubilet, Zorlu PSM, BiletimGo) bunu kullanır;
 * eskiden yalnız Ticketmaster bildiriyordu.
 *
 * Aynı konser birden çok sitede satılıyor: sanatçının aynı gece (±6 saat) başka bir
 * kaydı zaten varsa bu yeni kayıt bir kopyadır, bildirim gitmez.
 */
@Service
public class NewConcertNotifier {

    private static final Logger log = LoggerFactory.getLogger(NewConcertNotifier.class);

    /** Aynı sanatçının bu kadar yakın kaydı aynı konser sayılır (ConcertGrouping ile aynı pencere). */
    static final long SAME_CONCERT_HOURS = 6;

    private final EventRepository eventRepository;
    private final ArtistFollowRepository artistFollowRepository;
    private final NotificationService notificationService;

    public NewConcertNotifier(EventRepository eventRepository,
                              ArtistFollowRepository artistFollowRepository,
                              NotificationService notificationService) {
        this.eventRepository = eventRepository;
        this.artistFollowRepository = artistFollowRepository;
        this.notificationService = notificationService;
    }

    /** Yeni kaydedilmiş etkinlik için çağrılır. Hata yutulur: senkron bozulmamalı. */
    public void notifyFollowers(Event event) {
        try {
            Artist artist = event.getArtist();
            if (artist == null || artist.getId() == null || event.getId() == null) return;
            if (event.getEventDate() == null || event.getEventDate().isBefore(LocalDateTime.now())) return;
            if (!event.listedPublicly()) return;   // müzik dışı, iptal ya da gizli kayıt bildirilmez
            if (eventRepository.existsByArtistIdAndIdNotAndEventDateBetween(artist.getId(), event.getId(),
                    event.getEventDate().minusHours(SAME_CONCERT_HOURS),
                    event.getEventDate().plusHours(SAME_CONCERT_HOURS))) {
                return;   // başka siteden zaten gelmiş konser
            }
            String city = event.getVenue() != null && event.getVenue().getCity() != null
                    ? " (" + event.getVenue().getCity() + ")" : "";
            String message = artist.getName() + " — " + event.getName() + city;
            artistFollowRepository.findAllByArtistId(artist.getId()).forEach(follow ->
                    notificationService.sendSystem(follow.getUser().getId(), "new_event", "event", event.getId(), message));
        } catch (Exception e) {
            log.warn("Yeni konser bildirimi gonderilemedi ({}): {}", event.getId(), e.getMessage());
        }
    }
}
