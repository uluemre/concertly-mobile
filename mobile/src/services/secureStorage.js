import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Oturum anahtarları için depolama katmanı.
 *
 * Access/refresh token'lar AsyncStorage'da düz metin duruyordu; root'lu ya da
 * jailbreak'li bir cihazda (ve yedeklerde) okunabilir haldeler. Hassas olanlar
 * artık iOS Keychain / Android Keystore'a (expo-secure-store) yazılıyor;
 * kalanlar AsyncStorage'da kalıyor çünkü gizli değiller.
 *
 * SecureStore web'de yok ve bazı cihazlarda hata verebilir — her çağrı
 * AsyncStorage'a düşecek şekilde sarmalandı: uygulama hiçbir durumda oturum
 * açamaz hale gelmemeli.
 */

/** Keychain/Keystore'a yazılacak anahtarlar. */
export const SECURE_KEYS = ['authToken', 'refreshToken'];

const secureAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

const isSecure = (key) => secureAvailable && SECURE_KEYS.includes(key);

export async function getItem(key) {
  if (isSecure(key)) {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value !== null && value !== undefined) return value;
      // Güvenli depoda yoksa eski AsyncStorage kaydını taşı (tek seferlik geçiş).
      const legacy = await AsyncStorage.getItem(key);
      if (legacy) {
        await setItem(key, legacy);
        await AsyncStorage.removeItem(key);
        return legacy;
      }
      return null;
    } catch {
      return AsyncStorage.getItem(key).catch(() => null);
    }
  }
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItem(key, value) {
  // Boş değer = kaydı sil; SecureStore null kabul etmez.
  if (value === null || value === undefined || value === '') {
    return removeItem(key);
  }
  if (isSecure(key)) {
    try {
      await SecureStore.setItemAsync(key, String(value));
      return;
    } catch {
      // Keychain kullanılamıyorsa oturumu kaybetmektense AsyncStorage'a yaz.
    }
  }
  try {
    await AsyncStorage.setItem(key, String(value));
  } catch {}
}

export async function removeItem(key) {
  if (isSecure(key)) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

/** [[key, value], ...] döner — AsyncStorage.multiGet ile aynı biçim. */
export async function multiGet(keys) {
  const secure = keys.filter(isSecure);
  const plain = keys.filter((k) => !isSecure(k));

  const [securePairs, plainPairs] = await Promise.all([
    Promise.all(secure.map(async (key) => [key, await getItem(key)])),
    plain.length
      ? AsyncStorage.multiGet(plain).catch(() => plain.map((k) => [k, null]))
      : Promise.resolve([]),
  ]);

  const byKey = Object.fromEntries([...securePairs, ...plainPairs]);
  return keys.map((key) => [key, byKey[key] ?? null]);
}

export async function multiSet(pairs) {
  const plain = [];
  const writes = [];
  for (const [key, value] of pairs) {
    if (isSecure(key)) writes.push(setItem(key, value));
    else plain.push([key, value == null ? '' : String(value)]);
  }
  if (plain.length) {
    writes.push(AsyncStorage.multiSet(plain).catch(() => {}));
  }
  await Promise.all(writes);
}

export async function multiRemove(keys) {
  const plain = keys.filter((k) => !isSecure(k));
  const writes = keys.filter(isSecure).map(removeItem);
  if (plain.length) writes.push(AsyncStorage.multiRemove(plain).catch(() => {}));
  await Promise.all(writes);
}
