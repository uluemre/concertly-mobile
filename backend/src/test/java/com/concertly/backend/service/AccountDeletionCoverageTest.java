package com.concertly.backend.service;

import com.concertly.backend.model.User;
import jakarta.persistence.Entity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;

import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Kullanıcıya (User) bağlanan her entity, hesap silinirken temizlenmeli; yoksa silme FK
 * hatasıyla 409 döner. (Ekim 2026: PushToken unutulmuştu, telefondan giriş yapan hiçbir
 * hesap silinemiyordu.) Yeni bir User ilişkisi eklenip AccountDeletionService'e
 * yazılmazsa bu test kırılır.
 */
class AccountDeletionCoverageTest {

    /** User alanı olup bilerek silinmeyenler (gerekçesiyle). */
    private static final Set<String> HANDLED_ELSEWHERE = Set.of(
            "User",            // kendisi
            "Community",       // sahip devri / owner=null ile çözülüyor (UPDATE Community)
            "Event"            // createdBy=null ile çözülüyor (UPDATE Event)
    );

    @Test
    void everyEntityReferencingUserIsCleanedUp() throws Exception {
        String src = Files.readString(Path.of("src/main/java/com/concertly/backend/service/AccountDeletionService.java"));

        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        Set<BeanDefinition> entities = scanner.findCandidateComponents("com.concertly.backend.model");
        assertTrue(entities.size() > 20, "entity taraması boş: " + entities.size());

        List<String> missing = new ArrayList<>();
        for (BeanDefinition bd : entities) {
            Class<?> type = Class.forName(bd.getBeanClassName());
            String name = type.getSimpleName();
            if (HANDLED_ELSEWHERE.contains(name) || !referencesUser(type)) continue;
            if (!src.contains("FROM " + name + " ")) missing.add(name);
        }
        assertEquals(List.of(), missing, "AccountDeletionService bu entity'leri temizlemiyor");
    }

    private static boolean referencesUser(Class<?> type) {
        for (Class<?> c = type; c != null && c != Object.class; c = c.getSuperclass()) {
            for (Field f : c.getDeclaredFields()) {
                if (f.getType() == User.class) return true;
            }
        }
        return false;
    }
}
