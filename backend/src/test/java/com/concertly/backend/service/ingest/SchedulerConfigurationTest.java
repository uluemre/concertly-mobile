package com.concertly.backend.service.ingest;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;
import org.springframework.scheduling.config.CronTask;
import org.springframework.scheduling.config.ScheduledTask;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Zamanlayici yapilandirmasi.
 *
 * Production riski: TicketmasterService kendi @Scheduled kosusuna sahip ve
 * ConcertSyncScheduler de ayni kaynagi calistiriyor. Ikisi birden acik kalirsa
 * Ticketmaster gunde iki kez cekilir. Eski kosu yapilandirmayla kapatildi
 * (ticketmaster.sync.cron=-); bu test o korumanin yerinde oldugunu dogrular.
 */
@SpringBootTest
class SchedulerConfigurationTest {

    @Autowired private ScheduledAnnotationBeanPostProcessor postProcessor;
    @Autowired private Environment environment;
    @Autowired private List<ConcertSource> sources;

    @Test
    void ticketmasterLegacyScheduleIsDisabled() {
        assertEquals("-", environment.getProperty("ticketmaster.sync.cron"),
                "Eski Ticketmaster cron'u kapali olmali, yoksa kaynak gunde iki kez cekilir");

        boolean legacyRegistered = postProcessor.getScheduledTasks().stream()
                .map(ScheduledTask::getTask)
                .filter(CronTask.class::isInstance)
                .map(CronTask.class::cast)
                .anyMatch(task -> task.toString().contains("TicketmasterService"));

        assertFalse(legacyRegistered, "TicketmasterService.scheduledSync kayitli olmamali");
    }

    @Test
    void unifiedSchedulerIsRegisteredWithValidCron() {
        String cron = environment.getProperty("app.sources.sync-cron");
        assertNotNull(cron);
        assertNotEquals("-", cron, "Ortak zamanlayici acik olmali");

        boolean registered = postProcessor.getScheduledTasks().stream()
                .map(ScheduledTask::getTask)
                .anyMatch(task -> task.toString().contains("ConcertSyncScheduler"));
        assertTrue(registered, "ConcertSyncScheduler zamanlanmis olmali");
    }

    /** Iki kaynak da kayitli ve acik olmali. */
    @Test
    void bothSourcesAreRegisteredAndEnabled() {
        Set<String> codes = Set.copyOf(sources.stream().map(ConcertSource::code).toList());

        assertTrue(codes.contains("TICKETMASTER"), "Ticketmaster kaynagi kayitli olmali");
        assertTrue(codes.contains("BILETINIAL"), "Biletinial kaynagi kayitli olmali");
        assertTrue(sources.stream().allMatch(ConcertSource::isEnabled), "Iki kaynak da acik olmali");
    }
}
