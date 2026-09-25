package com.concertly.backend.model;

import com.concertly.backend.dto.response.ArtistResponse;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Deezer'in "fotografi yok" silueti gercek fotograf gibi sunulmamali. */
class ImageUrlsTest {

    private static final String DEEZER_EMPTY =
            "https://cdn-images.dzcdn.net/images/artist/d41d8cd98f00b204e9800998ecf8427e/1000x1000-000000-80-0-0.jpg";
    private static final String DEEZER_REAL =
            "https://cdn-images.dzcdn.net/images/artist/7174fef98d267c96a5d38ff7615727a3/1000x1000-000000-80-0-0.jpg";

    @Test
    void placeholderAndBlankAreNotUsable() {
        assertNull(ImageUrls.usable(DEEZER_EMPTY));
        assertNull(ImageUrls.usable("https://cdn-images.dzcdn.net/images/artist//500x500.jpg"));
        assertNull(ImageUrls.usable("  "));
        assertNull(ImageUrls.usable(null));
        assertEquals(DEEZER_REAL, ImageUrls.usable(DEEZER_REAL));
    }

    @Test
    void artistResponseHidesPlaceholderWithoutChangingTheEntity() {
        Artist a = new Artist();
        a.setName("mor ve otesi");
        a.setImageUrl(DEEZER_EMPTY);

        assertNull(ArtistResponse.from(a, 0, false).getImageUrl());
        assertEquals(DEEZER_EMPTY, a.getImageUrl(), "veri degismemeli");
    }
}
