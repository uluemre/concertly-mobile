package com.concertly.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class BackendApplication {

	public static void main(String[] args) {
		// Pin the app's default timezone so wall-clock timestamps (LocalDateTime.now(),
		// Hibernate-generated createdAt, the "skip past events" check, reminders, ...)
		// stay in Turkish local time even when deployed to a UTC cloud host (Railway).
		// Without this, "now" shifts by 3h after deploy and past/upcoming filtering breaks.
		// Override with the APP_TIMEZONE env var if you ever host for another region.
		TimeZone.setDefault(TimeZone.getTimeZone(
				System.getenv().getOrDefault("APP_TIMEZONE", "Europe/Istanbul")));
		SpringApplication.run(BackendApplication.class, args);
	}

}
