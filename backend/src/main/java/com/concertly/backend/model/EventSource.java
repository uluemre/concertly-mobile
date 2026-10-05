package com.concertly.backend.model;

/**
 * Etkinliğin hangi kanaldan geldiği.
 *
 * Tek kaynağa (Ticketmaster) bağımlı kalmamak ürünün uzun vadeli
 * savunulabilirliği için kritik; kanal bilgisi hem güven rozetini hem de
 * "hangi kanal ne kadar veri getiriyor" ölçümünü mümkün kılar.
 */
public enum EventSource {
    /** Ticketmaster içe aktarımı. */
    TICKETMASTER,
    /** Biletinial içe aktarımı (schema.org JSON-LD). */
    BILETINIAL,
    /** Bubilet içe aktarımı (schema.org JSON-LD). */
    BUBILET,
    /** Zorlu PSM mekân sitesi (schema.org JSON-LD). */
    ZORLU_PSM,
    /** BiletimGo içe aktarımı (HTML). */
    BILETIMGO,
    /** Biletino içe aktarımı (schema.org JSON-LD). */
    BILETINO,
    /** Admin panelinden elle eklendi. */
    ADMIN,
    /** Sıradan kullanıcı önerdi — admin onayı gerekir. */
    USER,
    /** Doğrulanmış organizatör/mekan/menajer hesabı ekledi. */
    ORGANIZER
}
