import * as Linking from 'expo-linking';
import { getStateFromPath as defaultGetStateFromPath } from '@react-navigation/native';
import { SHARE_BASE_URL } from '../services/shareLinks';

/**
 * Deep link yapılandırması.
 *
 * İki biçim desteklenir:
 *  - concertly://event/123        (uygulama şeması)
 *  - https://.../e/123            (paylaşım linki; uygulama yüklüyse doğrudan,
 *                                  değilse web sayfası mağazaya yönlendirir)
 *
 * Kısa web yolları (/e, /a, /u, /p, /c) linkin kendisi kısa kalsın diye var;
 * burada uzun uygulama yollarına çevrilip tek bir eşleme tablosu kullanılıyor.
 */

/**
 * Kök navigatördeki ekran adları. Config'te yolu olmayan ekranlar uygulama içinde
 * adlarıyla adres alır (/FeedTab, /Login…); yenilemede bunlar eskisi gibi başlangıç
 * ekranına gider. Bu listede OLMAYAN, hiçbir desene uymayan yol "bulunamadı"
 * gösterir (N-19). AppNavigator'a ekran eklenince buraya da eklenmeli.
 */
const APP_SCREEN_NAMES = new Set([
  'Onboarding', 'GenreSelection', 'ArtistSelection', 'Login', 'Register', 'VerifyEmail', 'MainApp',
  'EventDetail', 'CreatePost', 'EventsPicker', 'FeedTab', 'UserProfile', 'Communities', 'CommunityDetail',
  'CreateCommunity', 'CommunityManage', 'ArtistProfile', 'Welcome', 'Settings', 'Map', 'FollowList', 'FollowRequests',
  'Admin', 'AdminEvents', 'AdminUsers', 'AdminPosts', 'AdminDeletionFeedback', 'AdminCommunities',
  'SpotifyRecommendations', 'VenueProfile', 'PostDetail', 'ConcertBuddyMatch', 'ConcertPassport',
  'ChatList', 'Chat', 'SongQuiz', 'DailySong', 'BlindRank', 'SetlistPrediction', 'Games',
  'ConcertBingo', 'ConcertPrep', 'ForgotPassword', 'ResetPassword', 'ChangePassword', 'BlockedUsers',
  'SuggestEvent', 'AdminReports', 'AdminOrganizerRequests', 'Legal', 'NotFound',
  // MainApp sekmeleri
  'Home', 'Events', 'Explore', 'Notifications', 'Profile',
]);

const SHORT_PATHS = {
  e: 'event',
  a: 'artist',
  u: 'user',
  p: 'post',
  c: 'community',
};

export const linking = {
  prefixes: [Linking.createURL('/'), 'concertly://', SHARE_BASE_URL],

  config: {
    screens: {
      // `event` (liste öğesi ön izlemesi) URL'ye yazılmaz — yoksa /event/undefined?event=[object Object] oluşuyordu
      EventDetail: { path: 'event/:eventId', parse: { eventId: Number }, stringify: { event: () => undefined } },
      ArtistProfile: { path: 'artist/:artistId', parse: { artistId: Number } },
      UserProfile: { path: 'user/:userId' },
      PostDetail: { path: 'post/:postId', parse: { postId: Number } },
      CommunityDetail: { path: 'community/:communityId', parse: { communityId: Number } },
      Communities: 'communities',
      // Yenilenince / doğrudan açılınca ana sayfaya düşmesinler (N-19)
      VenueProfile: { path: 'venue/:venueId', parse: { venueId: Number }, stringify: { venueName: () => undefined } },
      Map: 'map',
      Settings: 'settings',
      ChatList: 'messages',
      // userId sayı olmalı: pasaport kendi hesabını session.userId ile karşılaştırır
      ConcertPassport: { path: 'passport', parse: { userId: Number } },
      GenreSelection: { path: 'onboarding/genres', parse: { editMode: (v) => v === 'true' } },
      // Seçilen türler URL'ye yazılmaz; yenilemede ekran tür seçimine döner
      ArtistSelection: {
        path: 'onboarding/artists',
        stringify: { selectedGenres: () => undefined, selectedCity: () => undefined, editMode: () => undefined },
      },
      NotFound: 'not-found',
      MainApp: {
        screens: {
          Home: 'home',
          Events: 'events',
          Explore: 'menu',
          Notifications: 'notifications',
          Profile: 'profile',
        },
      },
    },
  },

  /** Kısa web yolunu uygulama yoluna çevirip standart çözümlemeye devreder. */
  getStateFromPath(path, options) {
    const normalized = path.replace(
      /^\/?(e|a|u|p|c)\//,
      (_, short) => `/${SHORT_PATHS[short]}/`
    );
    const state = defaultGetStateFromPath(normalized, options);
    if (state) return state;

    // Eşleşme yok: kök adres ve uygulamanın kendi ekran adları başlangıç ekranına
    // (eski davranış); gerçekten bilinmeyen yol "bulunamadı" ekranına gider.
    const clean = normalized.split(/[?#]/)[0].replace(/^\/+/, '');
    if (!clean) return undefined;
    let first = clean.split('/')[0];
    try { first = decodeURIComponent(first); } catch {}
    if (APP_SCREEN_NAMES.has(first)) return undefined;
    return { routes: [{ name: 'NotFound' }] };
  },
};

export default linking;
