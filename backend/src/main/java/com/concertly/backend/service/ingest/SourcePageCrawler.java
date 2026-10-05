package com.concertly.backend.service.ingest;

import com.concertly.backend.model.SourcePage;
import com.concertly.backend.repository.SourcePageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;

/**
 * Site haritasından keşfedilen etkinlik sayfalarını "bir kez sınıflandır, sonra
 * yalnız gerekeni aç" kuralıyla tarar. Kaynaktan bağımsızdır (Bubilet, BiletimGo …).
 *
 * Her gece açılanlar:
 *   1) Bilinen konser sayfaları (tarih değişikliği / iptal için tazelenir)
 *   2) Hiç görülmemiş sayfalar — gece başına en fazla {@code maxNew}; ilk tarama
 *      böylece birkaç geceye yayılır ve karşı siteye yük bindirmez
 *   3) Bütçe kalırsa, uzun süredir bakılmamış "konser değil" sayfalar (etiket sonradan
 *      değişmiş olabilir)
 */
@Service
public class SourcePageCrawler {

    private static final Logger log = LoggerFactory.getLogger(SourcePageCrawler.class);

    /** "Konser değil" işaretli sayfa bu kadar gün sonra yeniden kontrol edilebilir. */
    static final int OTHER_RECHECK_DAYS = 30;

    private final SourcePageRepository pageRepository;

    public SourcePageCrawler(SourcePageRepository pageRepository) {
        this.pageRepository = pageRepository;
    }

    /** Tek sayfanın okunma sonucu. ok=false: sayfa çekilemedi (durum değiştirilmez). */
    public record PageResult(boolean ok, boolean music, List<RawConcertData> records) {
        public static PageResult failed() { return new PageResult(false, false, List.of()); }
        public static PageResult of(boolean music, List<RawConcertData> records) {
            return new PageResult(true, music, music ? records : List.of());
        }
    }

    /** Bu gece açılacak sayfalar. */
    record Plan(List<String> refresh, List<String> discover) {
        int size() { return refresh.size() + discover.size(); }
    }

    /** Saf karar (test edilebilir): hangi sayfa açılacak. */
    static Plan plan(Collection<String> candidates, Map<String, SourcePage> known, int maxNew, LocalDateTime now) {
        List<String> refresh = new ArrayList<>();
        List<String> fresh = new ArrayList<>();
        List<String> recheck = new ArrayList<>();
        for (String url : new LinkedHashSet<>(candidates)) {
            SourcePage page = known.get(url);
            if (page == null) fresh.add(url);
            else if (page.isMusic()) refresh.add(url);
            else if (page.getLastCheckedAt().isBefore(now.minusDays(OTHER_RECHECK_DAYS))) recheck.add(url);
        }
        // En eski kontrol edilen önce
        recheck.sort(Comparator.comparing(u -> known.get(u).getLastCheckedAt()));
        List<String> discover = new ArrayList<>();
        for (String url : fresh) { if (discover.size() >= maxNew) break; discover.add(url); }
        for (String url : recheck) { if (discover.size() >= maxNew) break; discover.add(url); }
        return new Plan(refresh, discover);
    }

    /**
     * Adayları planlar, sayfaları açar, sınıflandırmayı kaydeder ve konser kayıtlarını döndürür.
     *
     * @param fallback sınıflandırma tablosu yoksa (migration uygulanmamış) yalnız bunlar açılır
     */
    public List<RawConcertData> crawl(String source, Collection<String> candidates, int maxNew,
                                      Collection<String> fallback, Function<String, PageResult> fetcher) {
        Map<String, SourcePage> known;
        try {
            known = new HashMap<>();
            for (SourcePage p : pageRepository.findBySource(source)) known.put(p.getUrl(), p);
        } catch (Exception e) {
            log.warn("{} sayfa tablosu okunamadi ({}); yalniz liste sayfalari taranacak", source, e.getMessage());
            List<RawConcertData> out = new ArrayList<>();
            for (String url : new LinkedHashSet<>(fallback)) out.addAll(fetcher.apply(url).records());
            return out;
        }

        LocalDateTime now = LocalDateTime.now();
        Plan plan = plan(candidates, known, maxNew, now);
        int backlog = (int) new LinkedHashSet<>(candidates).stream().filter(u -> !known.containsKey(u)).count()
                - (int) plan.discover().stream().filter(u -> !known.containsKey(u)).count();
        log.info("{} tarama: {} aday, {} konser tazelenecek, {} yeni/eski sayfa acilacak, {} sonraki gecelere kaldi",
                source, candidates.size(), plan.refresh().size(), plan.discover().size(), Math.max(0, backlog));

        List<RawConcertData> records = new ArrayList<>();
        List<SourcePage> changed = new ArrayList<>();
        int music = 0;
        for (String url : concat(plan.refresh(), plan.discover())) {
            PageResult result = fetcher.apply(url);
            if (!result.ok()) continue;
            if (result.music()) music++;
            records.addAll(result.records());
            SourcePage page = known.get(url);
            if (page == null) {
                page = new SourcePage();
                page.setSource(source);
                page.setUrl(url);
            }
            page.setKind(result.music() ? SourcePage.MUSIC : SourcePage.OTHER);
            page.setLastCheckedAt(now);
            changed.add(page);
        }
        try {
            pageRepository.saveAll(changed);
        } catch (Exception e) {
            // Durum yazılamazsa kayıtlar yine içe aktarılır; yalnızca yarın aynı sayfalar tekrar açılır
            log.warn("{} sayfa durumu yazilamadi: {}", source, e.getMessage());
        }
        log.info("{} tarama bitti: {} sayfa acildi, {} konser sayfasi, {} kayit", source, plan.size(), music, records.size());
        return records;
    }

    private static List<String> concat(List<String> a, List<String> b) {
        List<String> all = new ArrayList<>(a);
        all.addAll(b);
        return all;
    }
}
