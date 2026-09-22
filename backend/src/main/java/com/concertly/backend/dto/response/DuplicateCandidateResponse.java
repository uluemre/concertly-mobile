package com.concertly.backend.dto.response;

import com.concertly.backend.model.Event;

import java.time.LocalDateTime;

/**
 * Admin inceleme ekrani icin mukerrer aday cifti.
 *
 * Iki kayit da TAM olarak gosterilir; karari veren insan, iki satiri yan yana
 * gorup "bunlar ayni konser mi" sorusunu kendisi yanitlayabilsin diye.
 * Bu tip yalnizca okumak icindir: hicbir birlestirme/silme islemi tetiklemez.
 */
public record DuplicateCandidateResponse(
        EventSide biletinial,
        EventSide other,
        /** STRONG | WEAK */
        String confidence,
        /** Eslesmenin (ya da belirsizligin) insan tarafindan okunabilir gerekcesi. */
        String reason,
        /** Iki etkinlik saati arasindaki fark (dakika). */
        Long minutesApart) {

    /** Ciftin tek bir tarafi. */
    public record EventSide(
            Long eventId,
            String source,
            String externalId,
            String concertName,
            String artistName,
            LocalDateTime eventDate,
            String venueName,
            String city,
            Double latitude,
            Double longitude,
            String ticketUrl) {

        public static EventSide from(Event event) {
            if (event == null) return null;
            return new EventSide(
                    event.getId(),
                    event.getSource() != null ? event.getSource().name() : null,
                    event.getExternalId(),
                    event.getName(),
                    event.getArtist() != null ? event.getArtist().getName() : null,
                    event.getEventDate(),
                    event.getVenue() != null ? event.getVenue().getName() : null,
                    event.getVenue() != null ? event.getVenue().getCity() : null,
                    event.getVenue() != null ? event.getVenue().getLatitude() : null,
                    event.getVenue() != null ? event.getVenue().getLongitude() : null,
                    event.getTicketUrl());
        }
    }
}
