package com.concertly.backend.controller;

import com.concertly.backend.service.AppSettingsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Uygulamanın açılışta okuduğu ayarlar: özellik anahtarları, bakım modu, duyuru. Kimlik gerekmez. */
@RestController
@RequestMapping("/api/app")
public class AppConfigController {

    private final AppSettingsService settings;

    public AppConfigController(AppSettingsService settings) {
        this.settings = settings;
    }

    @GetMapping("/config")
    public Map<String, Object> config() {
        return settings.publicConfig();
    }
}
