package com.concertly.backend.service.ingest;

import com.concertly.backend.model.SourcePage;
import com.concertly.backend.repository.SourcePageRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

/** "Bir kez sınıflandır, sonra yalnız gerekeni aç" kuralı. */
class SourcePageCrawlerTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 6, 4, 0);

    private static SourcePage page(String url, String kind, int checkedDaysAgo) {
        SourcePage p = new SourcePage();
        p.setSource("BUBILET");
        p.setUrl(url);
        p.setKind(kind);
        p.setLastCheckedAt(NOW.minusDays(checkedDaysAgo));
        return p;
    }

    private static Map<String, SourcePage> known(SourcePage... pages) {
        Map<String, SourcePage> map = new HashMap<>();
        for (SourcePage p : pages) map.put(p.getUrl(), p);
        return map;
    }

    private static RawConcertData raw(String id) {
        return new RawConcertData("BUBILET", id, "Sanatçı", "Konser", NOW.plusDays(10),
                "Sahne", null, "İstanbul", null, null, "https://x/" + id, null);
    }

    @Test
    void knownMusicIsAlwaysRefreshedAndKnownOtherIsSkipped() {
        var plan = SourcePageCrawler.plan(List.of("m", "o", "n"),
                known(page("m", SourcePage.MUSIC, 1), page("o", SourcePage.OTHER, 1)), 10, NOW);
        assertEquals(List.of("m"), plan.refresh());
        assertEquals(List.of("n"), plan.discover());
    }

    @Test
    void newPagesAreCappedPerRunSoTheFirstScanSpreadsOverNights() {
        List<String> candidates = new ArrayList<>();
        for (int i = 0; i < 10; i++) candidates.add("u" + i);
        var plan = SourcePageCrawler.plan(candidates, Map.of(), 3, NOW);
        assertEquals(List.of("u0", "u1", "u2"), plan.discover());
    }

    @Test
    void staleOtherPagesAreRecheckedOnlyWithLeftoverBudget() {
        var plan = SourcePageCrawler.plan(List.of("old", "new1", "new2"),
                known(page("old", SourcePage.OTHER, 45)), 2, NOW);
        assertEquals(List.of("new1", "new2"), plan.discover(), "yeni sayfalar önce");

        plan = SourcePageCrawler.plan(List.of("old", "new1"), known(page("old", SourcePage.OTHER, 45)), 5, NOW);
        assertEquals(List.of("new1", "old"), plan.discover());
    }

    @Test
    void crawlRemembersClassificationAndReturnsOnlyMusicRecords() {
        SourcePageRepository repo = mock(SourcePageRepository.class);
        when(repo.findBySource("BUBILET")).thenReturn(List.of());
        SourcePageCrawler crawler = new SourcePageCrawler(repo);

        Map<String, SourcePageCrawler.PageResult> pages = Map.of(
                "konser", SourcePageCrawler.PageResult.of(true, List.of(raw("k1"))),
                "tiyatro", SourcePageCrawler.PageResult.of(false, List.of(raw("t1"))),
                "kirik", SourcePageCrawler.PageResult.failed());

        List<RawConcertData> out = crawler.crawl("BUBILET", List.of("konser", "tiyatro", "kirik"), 10,
                List.of(), pages::get);

        assertEquals(List.of("k1"), out.stream().map(RawConcertData::sourceEventId).toList());
        verify(repo).saveAll(argThat((Iterable<SourcePage> saved) -> {
            Map<String, String> kinds = new HashMap<>();
            saved.forEach(p -> kinds.put(p.getUrl(), p.getKind()));
            // çekilemeyen sayfa işaretlenmez: yarın yeniden denenir
            return kinds.equals(Map.of("konser", "MUSIC", "tiyatro", "OTHER"));
        }));
    }

    @Test
    void withoutPageTableFallsBackToListingPages() {
        SourcePageRepository repo = mock(SourcePageRepository.class);
        when(repo.findBySource(any())).thenThrow(new RuntimeException("relation \"source_pages\" does not exist"));
        SourcePageCrawler crawler = new SourcePageCrawler(repo);

        List<String> opened = new ArrayList<>();
        List<RawConcertData> out = crawler.crawl("BUBILET", List.of("liste1", "harita1", "harita2"), 10,
                List.of("liste1"), url -> {
                    opened.add(url);
                    return SourcePageCrawler.PageResult.of(true, List.of(raw(url)));
                });

        assertEquals(List.of("liste1"), opened, "tablo yokken site haritası taranmaz");
        assertEquals(1, out.size());
        verify(repo, never()).saveAll(anyList());
    }
}
