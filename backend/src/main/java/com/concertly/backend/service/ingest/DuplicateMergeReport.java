package com.concertly.backend.service.ingest;

import java.util.List;
import java.util.Map;

/**
 * Mukerrer birlestirme raporu (dry-run ve uygulama AYNI sekli kullanir).
 *
 * artistGroups/venueGroups/eventGroups yalnizca otomatik uygulanacak (HIGH) gruplardir; MEDIUM/LOW
 * eslesmeler *Suggestions listelerindedir (autoApply=false) ve toplu apply tarafindan asla uygulanmaz.
 *
 * applyConfidence: toplu apply'in birlestirdigi seviye; HER ZAMAN "HIGH". suggestionMinConfidence: dry-run'da
 * istenen oneri tabani (apply/elle birlestirmede null). minConfidence: GERIYE UYUMLULUK icin eski alan (dry-run'da
 * istenen deger; apply'da HIGH) - yeni istemciler yukaridaki ikisini kullanmali.
 *
 * totals: *Merged = otomatik (HIGH) birlestirilen mukerrer sayisi; *SuggestionGroups = oneri grubu sayisi;
 * *SuggestionDuplicates = oneri gruplarindaki toplam mukerrer sayisi.
 *
 * dryRun=true iken counts "tasinacak" sayilardir; false iken gercekte tasinanlar.
 * counts anahtarlari (varsa): events, follows, reviews, attendances, bookmarks, verifications,
 * eventReviews, concertBuddies, setlistSubmissions, posts, bingoCards, notifications, sourceLinks,
 * attendanceStatusUpgrades, repointedMergePointers, fieldsFilled ve conflictsDropped.
 */
public record DuplicateMergeReport(
        boolean dryRun,
        String minConfidence,
        String applyConfidence,
        String suggestionMinConfidence,
        List<GroupReport> artistGroups,
        List<GroupReport> venueGroups,
        List<GroupReport> eventGroups,
        Map<String, Integer> totals,
        List<GroupReport> artistSuggestions,
        List<GroupReport> venueSuggestions,
        List<GroupReport> eventSuggestions) {

    /**
     * Bir asil kayit ve ona birlestirilecek mukerrerler. renameTo: yalnizca sanatcida, asilin adi grubun
     * daha iyi yazilmis adiyla degisecekse (dry-run) / degistiyse (apply) o ad; yoksa null.
     */
    public record GroupReport(Long canonicalId, String canonicalName, List<DuplicateReport> duplicates, String renameTo) {
        public GroupReport(Long canonicalId, String canonicalName, List<DuplicateReport> duplicates) {
            this(canonicalId, canonicalName, duplicates, null);
        }
    }

    /**
     * autoApply=true: HIGH guvenli, toplu apply bunu birlestirir. autoApply=false: yalnizca ONERI;
     * toplu apply asla dokunmaz, ancak elle uc noktalarla (artists/venues .../{dup}/into/{canonical}) birlestirilebilir.
     */
    public record DuplicateReport(Long id, String name, String reason, String confidence,
                                  Map<String, Integer> counts, boolean autoApply) {}

    /**
     * Uygulama istegi. Istemcinin gonderdigi PLAN yoktur: sunucu plani yeniden hesaplar.
     * excludeXxxIds: bu kimlikler plana hic alinmaz (ne mukerrer ne asil olarak dokunulur).
     * minConfidence: GERIYE UYUMLULUK icin kabul edilir ama YOK SAYILIR; toplu apply her zaman yalnizca HIGH birlestirir.
     */
    public record ApplyRequest(List<Long> excludeArtistIds, List<Long> excludeVenueIds,
                               List<Long> excludeEventIds, String minConfidence) {}
}
