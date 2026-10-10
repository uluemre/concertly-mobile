package com.concertly.backend.service.storage;

import java.io.IOException;

/**
 * Yüklenen görsellerin saklandığı yer. Anahtar düz bir dosya adıdır
 * ({@code <uuid>.<uzantı>}); istemciye ve veritabanına her zaman
 * {@code /uploads/<anahtar>} göreli yolu gider, depo değişse de kayıtlar aynı kalır.
 */
public interface ImageStorage {

    void put(String key, byte[] content, String contentType) throws IOException;

    /** Anahtarı siler; zaten yoksa hata vermez. */
    void delete(String key) throws IOException;
}
