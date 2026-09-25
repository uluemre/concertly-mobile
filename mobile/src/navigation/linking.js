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
      MainApp: {
        screens: {
          Home: 'home',
          Events: 'events',
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
    return defaultGetStateFromPath(normalized, options);
  },
};

export default linking;
