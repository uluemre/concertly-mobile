package com.concertly.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/** Dış servis çağrıları süresiz beklememeli: 5 sn bağlantı, 10 sn okuma. */
class ExternalHttpTimeoutTest {

    @Test
    void defaultClientHasFiveAndTenSecondTimeouts() {
        RestTemplate rt = ExternalHttp.restTemplate();
        SimpleClientHttpRequestFactory f = (SimpleClientHttpRequestFactory) rt.getRequestFactory();
        assertEquals(5_000, ReflectionTestUtils.getField(f, "connectTimeout"));
        assertEquals(10_000, ReflectionTestUtils.getField(f, "readTimeout"));
    }

    @Test
    void readTimeoutActuallyStopsAHangingServer() throws Exception {
        try (ServerSocket server = new ServerSocket(0)) {
            // Bağlantıyı kabul eden ama hiç yanıt vermeyen sunucu
            Thread acceptor = new Thread(() -> {
                try (Socket ignored = server.accept()) {
                    Thread.sleep(5_000);
                } catch (IOException | InterruptedException ignored) { }
            });
            acceptor.setDaemon(true);
            acceptor.start();

            RestTemplate rt = ExternalHttp.restTemplate(Duration.ofMillis(500), Duration.ofMillis(300));
            long started = System.currentTimeMillis();
            assertThrows(ResourceAccessException.class,
                    () -> rt.getForObject("http://127.0.0.1:" + server.getLocalPort() + "/", String.class));
            assertTrue(System.currentTimeMillis() - started < 3_000, "okuma zaman aşımı devreye girmeli");
        }
    }

    @Test
    void noServiceCreatesAnUntimedRestTemplate() throws IOException {
        List<String> offenders = new ArrayList<>();
        try (Stream<Path> files = Files.walk(Path.of("src/main/java"))) {
            for (Path p : files.filter(x -> x.toString().endsWith(".java")).toList()) {
                for (String line : Files.readAllLines(p)) {
                    String t = line.trim();
                    if (t.startsWith("*") || t.startsWith("//")) continue;
                    if (t.contains("new RestTemplate()")) offenders.add(p.getFileName() + ": " + t);
                }
            }
        }
        assertTrue(offenders.isEmpty(), "zaman aşımsız RestTemplate: " + offenders);
    }
}
