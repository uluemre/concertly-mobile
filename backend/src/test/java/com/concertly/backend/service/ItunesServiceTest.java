package com.concertly.backend.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ItunesServiceTest {

    private final ItunesService service = new ItunesService();

    private static String row(String artist, String title, String preview) {
        return "{\"artistName\":\"" + artist + "\",\"trackName\":\"" + title + "\",\"previewUrl\":\"" + preview
                + "\",\"artworkUrl100\":\"https://img/x/100x100bb.jpg\"}";
    }

    @Test
    void keepsOnlyExactArtistTracksWithPreviewAndDedupesTitles() throws Exception {
        String body = "{\"resultCount\":5,\"results\":["
                + row("Hadise", "Ara Beni", "https://a/1.m4a") + ","
                + row("Hadise feat. Murat Boz", "Düet", "https://a/2.m4a") + ","
                + row("HADİSE", "ara beni", "https://a/3.m4a") + ","
                + row("Hadise", "Önizlemesiz", "") + ","
                + row("Hadise", "Sıfır Tolerans", "https://a/4.m4a") + "]}";

        List<DeezerService.Track> tracks = service.parseTracks(body, "Hadise", 10);

        assertEquals(List.of("Ara Beni", "Sıfır Tolerans"), tracks.stream().map(t -> t.title).toList());
        assertEquals("https://img/x/250x250bb.jpg", tracks.get(0).coverUrl);
        assertEquals("https://a/1.m4a", tracks.get(0).previewUrl);
    }

    @Test
    void respectsLimitAndHandlesEmptyBody() throws Exception {
        String body = "{\"results\":[" + row("Hadise", "A", "p1") + "," + row("Hadise", "B", "p2") + "]}";
        assertEquals(1, service.parseTracks(body, "Hadise", 1).size());
        assertTrue(service.parseTracks("", "Hadise", 5).isEmpty());
        assertTrue(service.getTopTracks(" ", 5).isEmpty());
    }
}
