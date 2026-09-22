package com.concertly.backend.dto.request;

/**
 * Konser doğrulama isteği. Koordinat ZORUNLU — doğrulamanın tek kanıtı bu.
 *
 * accuracyMeters ve mocked, cihazın kendi bildirdiği değerlerdir; güvenlik
 * sınırı olarak değil, şüpheli kayıtları işaretlemek/loglamak için kullanılır.
 */
public class VerifyEventRequest {

    private Double latitude;
    private Double longitude;
    private Double accuracyMeters;
    private Boolean mocked;

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public Double getAccuracyMeters() { return accuracyMeters; }
    public void setAccuracyMeters(Double accuracyMeters) { this.accuracyMeters = accuracyMeters; }

    public Boolean getMocked() { return mocked; }
    public void setMocked(Boolean mocked) { this.mocked = mocked; }
}
