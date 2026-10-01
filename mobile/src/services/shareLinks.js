import { Share, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../i18n/translations';

/**
 * Paylaşılabilir linkler.
 *
 * Paylaşımlar şimdiye kadar düz metindi: karşı taraf uygulamaya geçemiyordu.
 * Artık her paylaşım, uygulamayı açan (yüklü değilse mağazaya yönlendiren)
 * bir web adresi taşır.
 */

export const SHARE_BASE_URL = 'https://concertly-api.onrender.com';

/** Uygulama indirme adresi — App Store yayınlanınca doğrudan oraya çevrilir. */
export const DOWNLOAD_URL = `${SHARE_BASE_URL}/promo/`;

const SHORT = {
  event: 'e',
  artist: 'a',
  user: 'u',
  post: 'p',
  community: 'c',
};

/**
 * @param {'event'|'artist'|'user'|'post'|'community'} kind
 * @param {string|number} id  etkinlik/gönderi id'si ya da kullanıcı adı
 */
export function buildShareUrl(kind, id) {
  const short = SHORT[kind];
  if (!short || id === null || id === undefined || id === '') return DOWNLOAD_URL;
  return `${SHARE_BASE_URL}/${short}/${encodeURIComponent(String(id))}`;
}

/**
 * Metin + link paylaşır.
 *
 * iOS'ta `url` alanı ayrı verilince bazı hedefler yalnızca linki alıyor ve
 * metin kayboluyor; bu yüzden link mesajın içine de gömülür.
 */
export async function shareWithLink(message, url) {
  const link = url || DOWNLOAD_URL;
  const body = message ? `${message}\n\n${link}` : link;
  if (Platform.OS === 'web') {
    // Web'de Share API'si çoğu tarayıcıda yok ya da reddediliyor: panoya kopyala.
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ text: body });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // kullanıcı kendisi vazgeçti
    }
    try {
      await navigator.clipboard.writeText(body);
      let lang = 'tr';
      try { lang = (await AsyncStorage.getItem('appLanguage')) || 'tr'; } catch {}
      const dict = translations[lang] || translations.tr;
      Alert.alert(dict.share_link_copied || translations.tr.share_link_copied);
    } catch {}
    return;
  }
  try {
    await Share.share({ message: body });
  } catch {}
}
