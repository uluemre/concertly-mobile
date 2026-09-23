# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Concertly is a full-stack concert/event discovery social app. The repo has two sub-projects:

- `mobile/` — React Native (Expo) frontend
- `backend/` — Spring Boot (Java 17) REST API

The backend is deployable with Docker (Render is the current target); the mobile app targets the iOS App Store (built via EAS).

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
  - production builds (and dev when `USE_PROD_IN_DEV = true`) → the configured production server, defaulting to `https://concertly-api.onrender.com/api`.
  - dev with `USE_PROD_IN_DEV = false` → the LAN IP from Expo's `hostUri` on port 8082, so a phone on the same network hits the local backend. To test against the local backend, flip `USE_PROD_IN_DEV` to `false`.
- JWT is attached automatically by a request interceptor reading a module-level `_authToken` (set by `AuthContext`).
- **Refresh-token rotation**: on `401`, the response interceptor calls `/auth/refresh` once, queues concurrent requests while refreshing, retries them with the new token, and on failure invokes the session-expired handler (logout + navigate to Login).
- **Image URLs are stored relative** (`/uploads/<file>`) and absolutized to `SERVER_ORIGIN` in the response interceptor so they survive host changes. `uploadImage()` posts multipart to `/media/upload` and stores back the relative path.


**Push notifications** (`src/services/pushNotifications.js`):
- `registerPushToken(lang)` asks for permission, gets the Expo push token and
  `POST`s it to `/api/push/tokens` with the platform and app language; the
  language decides which copy the server sends. `AppNavigator` calls it on every
  login, unregisters on logout (`AuthContext`), keeps the app-icon badge in sync
  with the unread count, and routes taps through `routeForNotification()`.
- Expo Go (SDK 53+) cannot receive remote push — token registration fails there
  and is swallowed. Test with a development build or TestFlight.
- Per-category preferences live on the server (`/api/notifications/settings`)
  and are edited in Settings.

**Deep links & sharing** (`src/navigation/linking.js`, `src/services/shareLinks.js`):
- Scheme `concertly://`, plus universal/app links on the share host. Short web
  paths `/e /a /u /p /c` are rewritten to `event/ artist/ user/ post/ community/`
  in `getStateFromPath`, so one screen table serves both forms.
- `buildShareUrl(kind, id)` + `shareWithLink(message, url)` are used by the
  event, artist, post, passport, profile-invite and community-invite shares.
- `EventDetail`, `PostDetail` and `UserProfile` accept an id (or username) as
  well as a full object: each wraps its content component and resolves the id
  first, showing `DeepLinkLoader` while it loads.

**Token storage** (`src/services/secureStorage.js`): `authToken`/`refreshToken`
live in iOS Keychain / Android Keystore via `expo-secure-store`; everything else
stays in AsyncStorage. Values written by older builds are migrated on first read.
Every call falls back to AsyncStorage so a Keychain failure can never lock a user out.

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

**Push delivery** (`service/ExpoPushService.java`, `PushMessageFactory`,
`model/PushToken.java`): every notification written by `NotificationService` is
also pushed to the recipient devices. Copy is built server-side (TR/EN, chosen
from the device language stored with the token) because the app may be closed.
Sending happens on a small background pool so feed actions never wait on Expo;
a `DeviceNotRegistered` ticket deletes the token. `PushCategory` maps each
notification type to a switch the user controls in Settings.

**Share links** (`controller/ShareController.java`, `service/ShareLinkService.java`):
public landing pages at `/e/{id}`, `/a/{id}`, `/u/{username}`, `/p/{id}`,
`/c/{id}` carry Open Graph tags for link previews, try to open the app and fall
back to the store (or the promo page while the App Store id is unset). All user
content is HTML-escaped. `/.well-known/apple-app-site-association` and
`/.well-known/assetlinks.json` are served for universal/app link verification —
the Apple entry stays empty until `IOS_APP_ID` is configured.

**Moderation**: `Post.isHidden` / `Comment.isHidden` remove content from feeds,
profiles and artist pages without deleting it. Admins work the queue at
`/api/admin/moderation/reports` (with a preview of the reported content) and
hide/unhide via `/api/admin/moderation/hide`. `MessagePrivacy` on the user
(`EVERYONE | FOLLOWING | NOBODY`) gates new conversations — existing threads
always continue. `ContentLimitService` caps posts/comments/messages per day for
accounts younger than `NEW_ACCOUNT_HOURS` and answers `429` with a reason code.

**Event data channels**: `POST /api/events/suggest` lets users report missing
concerts. `EventSuggestionService` rejects past dates and cities outside the
launch list, and refuses duplicates (same day, matching venue or city, and a
name/artist similarity above the threshold — Turkish spelling is folded first).
`Event.source` (`TICKETMASTER | ADMIN | USER | ORGANIZER`) and `Event.isVerified`
drive the "verified source" badge. Verified organizers (`ROLE_ORGANIZER`, granted
through `/api/admin/organizer-requests`) publish without review; everyone else
waits for admin approval, which sets `isVerified`.

**Legal pages**: privacy policy & terms are served as public static HTML from `src/main/resources/static/legal/` at `/legal/**` (linked from the app and used by the App Store reviewer).

**External integrations**:
- `SpotifyService` / `SpotifyUserService` — artist metadata & recommendations
- `TicketmasterService` — event data import
- `DeezerService` — song/preview data for games
- `EmailService` — password-reset codes via Gmail SMTP (no-op unless `MAIL_ENABLED=true`)

**Configuration** (`application.properties`): all secrets are read as `${ENV_VAR:safe-default}` — the file is committed but contains **no real secrets**. Production supplies env vars (`DB_URL`, `JWT_SECRET`, `SPOTIFY_*`, `TICKETMASTER_API_KEY`, `MAIL_*`, `ADMIN_EMAIL`, etc.); the inline defaults are for local dev only. Newer knobs: `PUSH_ENABLED`, `EXPO_ACCESS_TOKEN`, `SHARE_BASE_URL`, `IOS_APP_ID`, `IOS_BUNDLE_ID`, `ANDROID_PACKAGE`, `APP_SCHEME`, `NEW_ACCOUNT_HOURS` and the `NEW_ACCOUNT_MAX_*` caps, plus the `VERIFY_*` GPS rules. The JWT default is explicitly marked "do not use in production". A user matching `ADMIN_EMAIL` is promoted to `ROLE_ADMIN` on startup.

**Database**: `spring.jpa.hibernate.ddl-auto` defaults to `update` (auto-updates schema on startup; no migration tool). The properties file recommends `DDL_AUTO=validate` + Flyway/Liquibase for production. Server timezone is pinned to `Europe/Istanbul`; event times render in the venue's wall-clock.
