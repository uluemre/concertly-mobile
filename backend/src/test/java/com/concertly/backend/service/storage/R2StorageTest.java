package com.concertly.backend.service.storage;

import com.concertly.backend.controller.UploadsRedirectController;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class R2StorageTest {

    /** AWS belgelerindeki SigV4 örneği (GET /test.txt, Range başlıklı) birebir tutmalı. */
    @Test
    void signerMatchesAwsReferenceExample() {
        S3Signer signer = new S3Signer("AKIAIOSFODNN7EXAMPLE",
                "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", "us-east-1");
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Host", "examplebucket.s3.amazonaws.com");
        headers.put("Range", "bytes=0-9");
        headers.put("x-amz-content-sha256", S3Signer.EMPTY_SHA256);
        headers.put("x-amz-date", "20130524T000000Z");

        String auth = signer.authorization("GET", "/test.txt", headers, S3Signer.EMPTY_SHA256, "20130524T000000Z");

        assertEquals("AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,"
                + "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,"
                + "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41", auth);
    }

    @Test
    void pathEncodingKeepsSlashesAndEscapesTheRest() {
        assertEquals("/bucket/a-b_c.~x.jpg", S3Signer.encodePath("/bucket/a-b_c.~x.jpg"));
        assertEquals("/bucket/a%20b%24.jpg", S3Signer.encodePath("/bucket/a b$.jpg"));
    }

    @Test
    void sha256OfEmptyInput() {
        assertEquals(S3Signer.EMPTY_SHA256, S3Signer.sha256Hex(new byte[0]));
    }

    @Test
    void r2StorageRefusesToStartWithMissingConfig() {
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> new R2ImageStorage("acc", "key", "secret", "bucket", ""));
        assertTrue(ex.getMessage().contains("R2_PUBLIC_URL"));
        assertThrows(IllegalStateException.class,
                () -> new R2ImageStorage("", "key", "secret", "bucket", "https://cdn.example.com"));
    }

    @Test
    void r2StorageRequiresHttpsPublicUrl() {
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> new R2ImageStorage("acc", "key", "secret", "bucket", "http://cdn.example.com"));
        assertTrue(ex.getMessage().contains("https"));
        assertDoesNotThrow(() -> new R2ImageStorage("acc", "key", "secret", "bucket", " HTTPS://cdn.example.com "));
    }

    @Test
    void uploadsRedirectToPublicBucket() {
        UploadsRedirectController c = new UploadsRedirectController("https://cdn.example.com/");
        ResponseEntity<Void> res = c.redirect("3f2a9c1e-0b7d-4e55-9a51-2c7c1d0e9f10.jpg");
        assertEquals(HttpStatus.FOUND, res.getStatusCode());
        assertEquals("https://cdn.example.com/3f2a9c1e-0b7d-4e55-9a51-2c7c1d0e9f10.jpg",
                res.getHeaders().getLocation().toString());
    }

    @Test
    void uploadsRedirectRejectsOddKeys() {
        UploadsRedirectController c = new UploadsRedirectController("https://cdn.example.com");
        for (String key : new String[]{"..%2Fetc.jpg", "a/b.jpg", "x.jpg?y=1", "noext", "a.verylongext"}) {
            assertEquals(HttpStatus.NOT_FOUND, c.redirect(key).getStatusCode(), key);
        }
    }
}
