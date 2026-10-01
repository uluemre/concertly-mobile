package com.concertly.backend.repository;

import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Venue;

import java.util.Optional;

/**
 * Yumusak birlestirme (N-08 / N-09) isaretcilerini koke kadar izler.
 *
 * Birlestirilen sanatci/mekan silinmez; merged_into_* asil kaydin kimligini tutar.
 * Eski kimlikle gelen her arama (ice aktarim, eski derin link, onbellekteki istemci)
 * bu yardimciyla ASIL kayda cevrilir. Isaretci yoksa kayit aynen doner (ek sorgu yok).
 * Zincirler (A -> B -> C) kokune kadar izlenir; dongu ya da kirik isaretci durumunda
 * sonsuz donguye girmez, ulasilabilen son kaydi dondurur.
 */
public final class MergePointers {

    /** Zincir ust siniri; birlestirme servisi zinciri zaten kok'e kisaltir. */
    static final int MAX_DEPTH = 20;

    private MergePointers() {}

    public static Artist rootOf(Artist artist, ArtistRepository repo) {
        Artist current = artist;
        for (int i = 0; current != null && current.getMergedIntoArtistId() != null && i < MAX_DEPTH; i++) {
            Long next = current.getMergedIntoArtistId();
            if (next.equals(current.getId())) return current;
            Artist target = repo.findById(next).orElse(null);
            if (target == null) return current;
            current = target;
        }
        return current;
    }

    public static Venue rootOf(Venue venue, VenueRepository repo) {
        Venue current = venue;
        for (int i = 0; current != null && current.getMergedIntoVenueId() != null && i < MAX_DEPTH; i++) {
            Long next = current.getMergedIntoVenueId();
            if (next.equals(current.getId())) return current;
            Venue target = repo.findById(next).orElse(null);
            if (target == null) return current;
            current = target;
        }
        return current;
    }

    public static Optional<Artist> canonical(Optional<Artist> found, ArtistRepository repo) {
        return found.map(a -> rootOf(a, repo));
    }

    public static Optional<Venue> canonical(Optional<Venue> found, VenueRepository repo) {
        return found.map(v -> rootOf(v, repo));
    }
}
