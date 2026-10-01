package com.concertly.backend.service.ingest;

/** Mukerrer eslesmesinin guven seviyesi (N-08 / N-09). Sira: LOW < MEDIUM < HIGH. */
public enum MergeConfidence {
    LOW, MEDIUM, HIGH;

    public boolean atLeast(MergeConfidence min) {
        return min == null || this.ordinal() >= min.ordinal();
    }

    public static MergeConfidence lower(MergeConfidence a, MergeConfidence b) {
        return a.ordinal() <= b.ordinal() ? a : b;
    }

    /** Bos/null = LOW (en genis). Gecersiz deger 400 verir (IllegalArgumentException). */
    public static MergeConfidence parse(String value) {
        if (value == null || value.isBlank()) return LOW;
        try {
            return valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("minConfidence LOW, MEDIUM veya HIGH olmali: " + value);
        }
    }
}
