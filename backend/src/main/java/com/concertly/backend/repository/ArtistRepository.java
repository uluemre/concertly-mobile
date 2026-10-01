package com.concertly.backend.repository;

import com.concertly.backend.model.Artist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

public interface ArtistRepository extends JpaRepository<Artist, Long> {

    Optional<Artist> findByExternalId(String externalId);

    /** Aynı kaynak kimliğiyle birden fazla (eski kopya) kayıt olabilir: en eskisi. */
    Optional<Artist> findFirstByExternalIdOrderByIdAsc(String externalId);

    /**
     * İçe aktarım ve etkinlik oluşturma için ortak sanatçı eşlemesi (N-09).
     *
     * Önce kaynak kimliği, sonra ad anahtarı (Türkçe harf / büyük-küçük harf / noktalama
     * farkı yok sayılır). Eskiden yalnızca birebir ad (IgnoreCase) aranıyordu: "Sebnem Ferah" /
     * "Şebnem Ferah", "Fazil Say" / "Fazıl Say" ayrı sanatçı oluyordu; bazı yollar hiç
     * aramadan yeni kayıt açıyordu. Birden fazla eşleşme varsa en eski kayıt (küçük id)
     * seçilir — tek sonuç bekleyen findByExternalId aynı kimlikli kopyalarda hata veriyordu.
     */
    default Optional<Artist> findExisting(String externalId, String name) {
        if (externalId != null && !externalId.isBlank()) {
            Optional<Artist> byId = findFirstByExternalIdOrderByIdAsc(externalId);
            if (byId.isPresent()) return MergePointers.canonical(byId, this);
        }
        String key = SearchText.nameKey(name);
        if (key.isEmpty()) return Optional.empty();
        String firstWord = name.trim().split(" ")[0];
        List<Artist> candidates = search(firstWord);
        if (candidates == null) return Optional.empty();
        // Birlestirilmis (merged_into_artist_id dolu) bir kayit bulunursa ASIL kayit doner (N-09):
        // mukerrer geri gelmez, yeni etkinlik birlestirilmis sanatciya baglanmaz.
        return MergePointers.canonical(candidates.stream()
                .filter(a -> key.equals(SearchText.nameKey(a.getName())))
                .min(Comparator.comparing(Artist::getId)), this);
    }

    Optional<Artist> findFirstByNameIgnoreCaseOrderByIdAsc(String name);

    Optional<Artist> findFirstBySpotifyIdOrderByIdAsc(String spotifyId);

    // Asagidaki aramalar birlestirilmis kayitta ASIL kaydi dondurur (N-09). Tek sonuc bekleyen
    // eski turetilmis sorgular ayni adli/Spotify kimlikli iki kayitta hata veriyordu; artik en eskisi.
    default Optional<Artist> findByNameIgnoreCase(String name) {
        return MergePointers.canonical(findFirstByNameIgnoreCaseOrderByIdAsc(name), this);
    }

    default Optional<Artist> findFirstByNameIgnoreCase(String name) {
        return MergePointers.canonical(findFirstByNameIgnoreCaseOrderByIdAsc(name), this);
    }

    default Optional<Artist> findBySpotifyId(String spotifyId) {
        return MergePointers.canonical(findFirstBySpotifyIdOrderByIdAsc(spotifyId), this);
    }

    /** Türkçe harf / büyük-küçük harf duyarsız, % ve _ joker değil (SearchText). */
    default List<Artist> search(String q) {
        return searchByPattern(SearchText.containsPattern(q));
    }

    @Query("SELECT a FROM Artist a"
            + " WHERE " + SearchText.FOLD_OPEN + "a.name" + SearchText.FOLD_CLOSE + " LIKE :pattern ESCAPE '!'"
            + " ORDER BY a.name ASC")
    List<Artist> searchByPattern(@Param("pattern") String pattern);

    @Query("""
                SELECT a FROM Artist a
                WHERE LOWER(a.genre) IN :genres
                  AND a.mergedIntoArtistId IS NULL
                ORDER BY a.name ASC
            """)
    List<Artist> findByGenreIn(@Param("genres") List<String> genres);
}