# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Concertly is a full-stack concert/event discovery social app. The repo has two sub-projects:

- `mobile/` — React Native (Expo) frontend
- `backend/` — Spring Boot (Java 17) REST API

---

## Commands

### Mobile (`mobile/`)

```bash
npm start          # Start Expo dev server (scan QR with Expo Go)
npm run android    # Start on Android emulator/device
npm run ios        # Start on iOS simulator
npm run web        # Start in browser
```

### Backend (`backend/`)

```bash
./mvnw spring-boot:run     # Start the Spring Boot server on port 8082
./mvnw test                # Run tests
./mvnw package             # Build JAR
```

Backend requires a local PostgreSQL instance: database `concertly_mobile`, user `postgres`, password `1234`.

---

## Mobile Architecture

**Entry point**: `App.js` wraps everything in `ThemeProvider` and renders `AppNavigator`.

**Navigation** (`src/navigation/AppNavigator.js`):
- On startup, checks `AsyncStorage` for `onboardingDone` to decide initial route.
- Top-level `Stack.Navigator` handles: Onboarding → Auth (Login, Register) → MainApp → detail/modal screens.
- `MainApp` is a `Tab.Navigator` with three tabs: **Home**, **Explore** (menu grid), **Profile**.
- Stack screens pushed from tabs: EventDetail, CreatePost, Events, FeedTab, UserProfile, Communities, CommunityDetail, ArtistProfile, Settings, Map.

**Global state** (not React state — plain JS globals set after login):
- `global.authToken` — JWT bearer token
- `global.userId` — logged-in user ID
- `global.userCity` — user's city, used to filter events on HomeScreen

**Theme** (`src/theme.js`):
- `ThemeProvider` + `useTheme()` hook expose `{ themeMode, colors, setThemeMode }`.
- Two palettes: `dark` (default) and `light`, both in `themePalettes`.
- Screens that need theme-aware styles use the pattern: `const styles = useMemo(() => createStyles(colors), [colors])`.

**API client** (`src/services/api.js`):
- Axios instance with `baseURL` pointing to local network IP on port 8082.
- **Important**: The `baseURL` is a hardcoded local IP — update it when switching networks (home vs. office IPs are both commented in the file).
- JWT is attached automatically via a request interceptor that reads `global.authToken`.

---

## Backend Architecture

**Stack**: Spring Boot 3.5.13, Spring Security, Spring Data JPA, PostgreSQL, JWT (jjwt 0.12.6).

**Package layout** (`com.concertly.backend`):
- `controller/` — REST controllers (`@RequestMapping("/api/...")`)
- `service/` — business logic
- `repository/` — Spring Data JPA interfaces
- `model/` — JPA entities (User, Event, Venue, Artist, Post, Comment, Like, Follow, etc.)
- `dto/` — request/response DTOs
- `security/` — `JwtFilter`, `JwtUtil`, `UserDetailsServiceImpl`, `SecurityConfig`
- `exception/` — `GlobalExceptionHandler`, custom exceptions

**Auth flow**: `POST /api/auth/login` returns `{ accessToken, userId, username, city }`. All protected endpoints expect `Authorization: Bearer <token>`.

**External integrations**:
- `SpotifyService` — artist metadata (client ID/secret in `application.properties`)
- `TicketmasterService` — event data import (API key in `application.properties`)

**Database**: `spring.jpa.hibernate.ddl-auto=update` — schema is auto-updated on startup; no separate migration tool.
