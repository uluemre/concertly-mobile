package com.concertly.backend.controller;

import com.concertly.backend.service.CityService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Şehir kapsamı.
 *  GET   /api/cities                    → uygulamanın kullandığı açık şehirler (herkese açık)
 *  GET   /api/admin/cities              → 81 il, açık mı, yaklaşan konser sayısı (admin)
 *  PATCH /api/admin/cities/{id}         → {"enabled": true|false} (admin)
 */
@RestController
public class CityController {

    private final CityService cityService;

    public CityController(CityService cityService) {
        this.cityService = cityService;
    }

    @GetMapping("/api/cities")
    public Map<String, List<String>> enabledCities() {
        return Map.of("cities", cityService.enabledCities());
    }

    @GetMapping("/api/admin/cities")
    public List<CityService.AdminCity> adminList() {
        return cityService.adminList();
    }

    @PatchMapping("/api/admin/cities/{id}")
    public CityService.AdminCity setEnabled(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        Boolean enabled = body == null ? null : body.get("enabled");
        if (enabled == null) throw new IllegalArgumentException("ENABLED_REQUIRED");
        return cityService.setEnabled(id, enabled);
    }
}
