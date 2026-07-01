package com.concertly.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String uploadDir;

    public WebConfig(@Value("${app.upload.dir:uploads}") String uploadDir) {
        this.uploadDir = uploadDir;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Yüklenen görselleri /uploads/** altından statik sun
        String location = Paths.get(uploadDir).toAbsolutePath().normalize().toUri().toString();
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(location)
                .setCachePeriod(60 * 60 * 24 * 30); // 30 gün cache
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        // Çıplak /legal/ dizin isteğini index.html'e yönlendir (Support URL)
        registry.addViewController("/legal/").setViewName("forward:/legal/index.html");
        registry.addViewController("/legal").setViewName("forward:/legal/index.html");
        // Tanıtım sayfası (Marketing URL / sosyal medya bio linki)
        registry.addViewController("/promo/").setViewName("forward:/promo/index.html");
        registry.addViewController("/promo").setViewName("forward:/promo/index.html");
    }
}
