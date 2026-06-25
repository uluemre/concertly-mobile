# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Concertly is a full-stack concert/event discovery social app. The repo has two sub-projects:

- `mobile/` — React Native (Expo) frontend
- `backend/` — Spring Boot (Java 17) REST API

The backend is deployed on Railway; the mobile app targets the iOS App Store (built via EAS).

---

## Commands

### Mobile (`mobile/`)

```bash
npm start          # Start Expo dev server (scan QR with Expo Go)
npm run android    # Start on Android emulator/device
npm run ios        # Start on iOS simulator
npm run web        # Start in browser
```

EAS build config lives in `mobile/eas.json`; app metadata in `mobile/app.json`
(name `Concertly`, slug `concertly`, bundle id `com.concertly.app`).

### Backend (`backend/`)

```bash
./mvnw spring-boot:run     # Start the Spring Boot server on port 8082
./mvnw test                # Run tests
./mvnw package             # Build JAR
```

Backend requires a local PostgreSQL instance: database `concertly_mobile`, user `postgres`, password `1234` (these are the local defaults; see Configuration below).

---

## Mobile Architecture

**Entry point**: `App.js` nests the providers in this order:
`ThemeProvider` → `LanguageProvider` → `AuthProvider` → `AppNavigator`.

**Navigation** (`src/navigation/AppNavigator.js`):
- Top-level `Stack.Navigator`. The initial route is computed from auth state, not hardcoded:
  - logged in + admin → `Admin`; logged in → `MainApp`; otherwise `Login`,
    unless `AsyncStorage['onboardingDone'] !== 'true'`, in which case → `Onboarding`.
- `MainApp` is a `Tab.Navigator` with **five** tabs: **Home**, **Events**, **Explore** (menu grid), **Notifications** (with unread badge), **Profile**.
- The tab bar is a custom `SlideTabBar` (`src/navigation/SlideTabBar.js`) — long-press + slide to pick a tab.
- Many stack screens are pushed on top of the tabs: EventDetail, CreatePost, Communities/CommunityDetail/CreateCommunity/CommunityManage, ArtistProfile, VenueProfile, UserProfile, Settings, Map, Chat/ChatList, ConcertPassport, ConcertBuddyMatch, Wrapped, the games (SongQuiz, DailySong, BlindRank, ConcertBingo, SetlistPrediction, Games), the onboarding flow (Onboarding, GenreSelection, ArtistSelection), password screens, Legal, and the Admin\* screens.

**Auth & session state** (`src/context/AuthContext.js`):
- `useAuth()` exposes `{ session, isReady, login, logout, updateSession, notificationCount, setNotificationCount }`.
- `session` holds `{ authToken, refreshToken, userId, username, userCity, favoriteGenres, isAdmin, onboardingCompleted }`, hydrated from `AsyncStorage` on launch and persisted on `login`/`updateSession`.
- The context pushes the tokens into the API client via `setApiToken` / `setApiRefreshToken`, and registers a `setTokenRefreshedHandler` so silent refreshes update the stored access token.
- NOTE: there are no `global.authToken` / `global.userId` globals — read from `useAuth()` instead.

**Localization** (`src/context/LanguageContext.js`, `src/i18n/translations.js`):
- `useLanguage()` exposes a `t()` function and the current language. Strings live in `translations.js` (large, multi-language). Use `t('key')` for user-facing text.

**Theme** (`src/theme.js`):
- `ThemeProvider` + `useTheme()` hook expose `{ themeMode, colors, setThemeMode }`.
- Two palettes: `dark` (default) and `light`, both in `themePalettes`.
- Screens that need theme-aware styles use the pattern: `const styles = useMemo(() => createStyles(colors), [colors])`.

**API client** (`src/services/api.js`):
- Axios instance. `getBaseUrl()` picks the host automatically:
  - production builds (and dev when `USE_PROD_IN_DEV = true`, the current default) → the Railway server `https://concertly-mobile-production.up.railway.app/api`.
  - dev with `USE_PROD_IN_DEV = false` → the LAN IP from Expo's `hostUri` on port 8082, so a phone on the same network hits the local backend. To test against the local backend, flip `USE_PROD_IN_DEV` to `false`.
- JWT is attached automatically by a request interceptor reading a module-level `_authToken` (set by `AuthContext`).
- **Refresh-token rotation**: on `401`, the response interceptor calls `/auth/refresh` once, queues concurrent requests while refreshing, retries them with the new token, and on failure invokes the session-expired handler (logout + navigate to Login).
- **Image URLs are stored relative** (`/uploads/<file>`) and absolutized to `SERVER_ORIGIN` in the response interceptor so they survive host changes. `uploadImage()` posts multipart to `/media/upload` and stores back the relative path.

---

## Backend Architecture

**Stack**: Spring Boot 3.5.13, Spring Security, Spring Data JPA, PostgreSQL, JWT (jjwt 0.12.6).

**Package layout** (`com.concertly.backend`):
- `controller/` — REST controllers (`@RequestMapping("/api/...")`)
- `service/` — business logic
- `repository/` — Spring Data JPA interfaces
- `model/` — JPA entities (User, Event, Venue, Artist, Post, Comment, Like, Follow, Community, Message, Badge, etc.)
- `dto/` — request/response DTOs
- `security/` — `JwtFilter`, `JwtUtil`, `UserDetailsServiceImpl`, `SecurityConfig`
- `config/` — `WebConfig` (static/uploads serving)
- `exception/` — `GlobalExceptionHandler`, custom exceptions

The app is feature-rich: events (with Ticketmaster import), posts/feed, comments/replies, follows, communities (visibility tiers + roles + invites + admin approval), messaging, concert-buddy matching, badges/passport, setlist predictions, Spotify recommendations, "Wrapped", and several games (quiz, bingo, blind rank, daily song).

**Auth flow**: `POST /api/auth/login` returns an `AuthResponse`: `{ accessToken, refreshToken, tokenType, userId, username, email, city, favoriteGenres, onboardingCompleted, isAdmin }`. Protected endpoints expect `Authorization: Bearer <accessToken>`. `POST /api/auth/refresh` exchanges a refresh token for a fresh access token; there are also `/auth/register`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`.

**Security** (`security/SecurityConfig.java`): stateless, CSRF disabled, CORS open (`allowedOriginPatterns("*")`, credentials off — fine for the mobile client). Unauthenticated/expired tokens return `401` (so the client's refresh flow triggers). Public routes include auth endpoints, `GET /api/events/**`, public profiles, `GET /api/communities/**`, `GET /uploads/**`, and `GET /legal/**`. Costly/admin actions (`/api/admin/**`, `/api/events/sync`, `/api/events/enrich`, `/api/demo/**`, direct event creation/approval, artist enrich) require `ROLE_ADMIN`.

**Legal pages**: privacy policy & terms are served as public static HTML from `src/main/resources/static/legal/` at `/legal/**` (linked from the app and used by the App Store reviewer).

**External integrations**:
- `SpotifyService` / `SpotifyUserService` — artist metadata & recommendations
- `TicketmasterService` — event data import
- `DeezerService` — song/preview data for games
- `EmailService` — password-reset codes via Gmail SMTP (no-op unless `MAIL_ENABLED=true`)

**Configuration** (`application.properties`): all secrets are read as `${ENV_VAR:safe-default}` — the file is committed but contains **no real secrets**. Production (Railway) supplies env vars (`DB_URL`, `JWT_SECRET`, `SPOTIFY_*`, `TICKETMASTER_API_KEY`, `MAIL_*`, `ADMIN_EMAIL`, etc.); the inline defaults are for local dev only. The JWT default is explicitly marked "do not use in production". A user matching `ADMIN_EMAIL` is promoted to `ROLE_ADMIN` on startup.

**Database**: `spring.jpa.hibernate.ddl-auto` defaults to `update` (auto-updates schema on startup; no migration tool). The properties file recommends `DDL_AUTO=validate` + Flyway/Liquibase for production. Server timezone is pinned to `Europe/Istanbul`; event times render in the venue's wall-clock.
