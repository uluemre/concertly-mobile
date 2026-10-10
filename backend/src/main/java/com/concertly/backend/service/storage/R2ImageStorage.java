package com.concertly.backend.service.storage;

import com.concertly.backend.config.ExternalHttp;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Cloudflare R2 deposu ({@code STORAGE_TYPE=r2}). Görseller kovaya yazılır,
 * {@code /uploads/<anahtar>} istekleri UploadsRedirectController ile
 * kovanın herkese açık adresine yönlendirilir; böylece veritabanındaki göreli
 * yollar ve eski uygulama sürümleri değişmeden çalışır.
 */
@Component
@ConditionalOnProperty(name = "app.storage.type", havingValue = "r2")
public class R2ImageStorage implements ImageStorage {

    static final String CACHE_CONTROL = "public, max-age=31536000, immutable";
    private static final DateTimeFormatter AMZ_DATE = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");

    private final String host;
    private final String bucket;
    private final S3Signer signer;
    // 10 MB'lık bir görseli yavaş bağlantıda yüklemek 10 sn'yi aşabilir
    private final RestTemplate http = ExternalHttp.restTemplate(ExternalHttp.CONNECT_TIMEOUT, Duration.ofSeconds(30));

    public R2ImageStorage(@Value("${app.storage.r2.account-id:}") String accountId,
                          @Value("${app.storage.r2.access-key-id:}") String accessKeyId,
                          @Value("${app.storage.r2.secret-access-key:}") String secretAccessKey,
                          @Value("${app.storage.r2.bucket:}") String bucket,
                          @Value("${app.storage.r2.public-url:}") String publicUrl) {
        requireSet("R2_ACCOUNT_ID", accountId);
        requireSet("R2_ACCESS_KEY_ID", accessKeyId);
        requireSet("R2_SECRET_ACCESS_KEY", secretAccessKey);
        requireSet("R2_BUCKET", bucket);
        // Yönlendirme hedefi yoksa yüklenen görseller hiç görünmez — açılışta dur
        requireSet("R2_PUBLIC_URL", publicUrl);
        // http:// olursa uygulama görselleri şifresiz çeker (ve iOS ATS engeller)
        if (!publicUrl.trim().toLowerCase().startsWith("https://")) {
            throw new IllegalStateException("R2_PUBLIC_URL https:// ile baslamali");
        }
        this.host = accountId.trim() + ".r2.cloudflarestorage.com";
        this.bucket = bucket.trim();
        this.signer = new S3Signer(accessKeyId.trim(), secretAccessKey.trim(), "auto");
    }

    private static void requireSet(String env, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("STORAGE_TYPE=r2 icin " + env + " tanimli olmali");
        }
    }

    @Override
    public void put(String key, byte[] content, String contentType) throws IOException {
        String path = S3Signer.encodePath("/" + bucket + "/" + key);
        String amzDate = ZonedDateTime.now(ZoneOffset.UTC).format(AMZ_DATE);
        String payloadHash = S3Signer.sha256Hex(content);

        Map<String, String> signed = new LinkedHashMap<>();
        signed.put("host", host);
        signed.put("content-type", contentType);
        signed.put("cache-control", CACHE_CONTROL);
        signed.put("x-amz-content-sha256", payloadHash);
        signed.put("x-amz-date", amzDate);

        HttpHeaders headers = new HttpHeaders();
        // Host'u HttpURLConnection URL'den kendisi yazar (elle verilemez)
        signed.forEach((k, v) -> { if (!k.equals("host")) headers.set(k, v); });
        headers.set(HttpHeaders.AUTHORIZATION, signer.authorization("PUT", path, signed, payloadHash, amzDate));

        try {
            http.exchange(URI.create("https://" + host + path), HttpMethod.PUT,
                    new HttpEntity<>(content, headers), Void.class);
        } catch (RestClientException e) {
            throw new IOException("R2 yuklemesi basarisiz: " + e.getMessage(), e);
        }
    }

    @Override
    public void delete(String key) throws IOException {
        // S3 DELETE olmayan anahtar için de 204 döner
        String path = S3Signer.encodePath("/" + bucket + "/" + key);
        String amzDate = ZonedDateTime.now(ZoneOffset.UTC).format(AMZ_DATE);
        String payloadHash = S3Signer.EMPTY_SHA256;

        Map<String, String> signed = new LinkedHashMap<>();
        signed.put("host", host);
        signed.put("x-amz-content-sha256", payloadHash);
        signed.put("x-amz-date", amzDate);

        HttpHeaders headers = new HttpHeaders();
        signed.forEach((k, v) -> { if (!k.equals("host")) headers.set(k, v); });
        headers.set(HttpHeaders.AUTHORIZATION, signer.authorization("DELETE", path, signed, payloadHash, amzDate));

        try {
            http.exchange(URI.create("https://" + host + path), HttpMethod.DELETE,
                    new HttpEntity<>(headers), Void.class);
        } catch (RestClientException e) {
            throw new IOException("R2 silmesi basarisiz: " + e.getMessage(), e);
        }
    }
}
