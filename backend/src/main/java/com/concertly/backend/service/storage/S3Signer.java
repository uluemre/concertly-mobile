package com.concertly.backend.service.storage;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * AWS Signature V4 (yalnızca S3 için, sorgu parametresiz istekler).
 * R2 S3 uyumlu; tek ihtiyacımız PutObject olduğu için AWS SDK'yı (onlarca MB,
 * 96 MB metaspace sınırını zorlar) eklemek yerine imzayı burada atıyoruz.
 */
final class S3Signer {

    static final String EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    private final String accessKey;
    private final String secretKey;
    private final String region;

    S3Signer(String accessKey, String secretKey, String region) {
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.region = region;
    }

    /**
     * Authorization başlığının değerini döner.
     *
     * @param canonicalUri URI-kodlanmış yol, ör. {@code /bucket/key.jpg}
     * @param headers      imzalanacak başlıklar; {@code host}, {@code x-amz-date}
     *                     ve {@code x-amz-content-sha256} mutlaka bulunmalı
     * @param amzDate      {@code yyyyMMdd'T'HHmmss'Z'}
     */
    String authorization(String method, String canonicalUri, Map<String, String> headers,
                         String payloadHash, String amzDate) {
        TreeMap<String, String> sorted = new TreeMap<>();
        headers.forEach((k, v) -> sorted.put(k.toLowerCase(), v.trim()));
        String canonicalHeaders = sorted.entrySet().stream()
                .map(e -> e.getKey() + ":" + e.getValue() + "\n")
                .collect(Collectors.joining());
        String signedHeaders = String.join(";", sorted.keySet());

        String canonicalRequest = method + "\n" + canonicalUri + "\n" + "\n"
                + canonicalHeaders + "\n" + signedHeaders + "\n" + payloadHash;

        String date = amzDate.substring(0, 8);
        String scope = date + "/" + region + "/s3/aws4_request";
        String stringToSign = "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n"
                + sha256Hex(canonicalRequest.getBytes(StandardCharsets.UTF_8));

        byte[] key = hmac(("AWS4" + secretKey).getBytes(StandardCharsets.UTF_8), date);
        key = hmac(key, region);
        key = hmac(key, "s3");
        key = hmac(key, "aws4_request");
        String signature = HexFormat.of().formatHex(hmac(key, stringToSign));

        return "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + scope
                + ",SignedHeaders=" + signedHeaders + ",Signature=" + signature;
    }

    static String sha256Hex(byte[] data) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** S3 yol kodlaması: harf, rakam ve {@code -._~/} dışındaki her bayt %XX olur. */
    static String encodePath(String path) {
        StringBuilder sb = new StringBuilder();
        for (byte b : path.getBytes(StandardCharsets.UTF_8)) {
            char c = (char) (b & 0xFF);
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
                    || c == '-' || c == '.' || c == '_' || c == '~' || c == '/') {
                sb.append(c);
            } else {
                sb.append('%').append(String.format("%02X", b & 0xFF));
            }
        }
        return sb.toString();
    }

    private static byte[] hmac(byte[] key, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
