import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from './api';

/**
 * Expo push bildirimleri.
 *
 * Bildirimler şimdiye kadar yalnızca veritabanına yazılıyordu; kullanıcı
 * uygulamayı açmadıkça haberi olmuyordu. Burada cihazın push adresi alınır ve
 * backend'e kaydedilir, gönderimi sunucu yapar.
 *
 * NOT: Expo Go (SDK 53+) uzaktan push DESTEKLEMEZ — token alma orada hata
 * verir ve sessizce atlanır. Gerçek testi development build / TestFlight ile
 * yapmak gerekir.
 */

const TOKEN_CACHE_KEY = 'expoPushToken';

/**
 * Uygulama önplandayken de bildirim görünsün.
 * Web'de expo-notifications kısıtlı; kurulum hatası uygulamayı açılamaz
 * hale getirmemeli, bu yüzden sarmalandı.
 */
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      // SDK 54+ alan adları; eski alan geriye dönük uyumluluk için duruyor.
      shouldShowBanner: true,
      shouldShowList: true,
      shouldShowAlert: true,
    }),
  });
} catch {}

/** Android'de kanal tanımlı olmazsa bildirim sessiz düşer. */
export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Concertly',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E94560',
    });
  } catch {}
}

function getProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    null
  );
}

/**
 * İzin ister, token alır ve backend'e kaydeder.
 * @returns {Promise<string|null>} kaydedilen token ya da null
 */
export async function registerPushToken(language = 'tr') {
  // Emülatör/simülatörde push token alınamaz.
  if (!Device.isDevice) return null;

  await ensureAndroidChannel();

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return null;

    const projectId = getProjectId();
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    if (!token) return null;

    await API.post('/push/tokens', {
      token,
      platform: Platform.OS,
      language,
    });
    await AsyncStorage.setItem(TOKEN_CACHE_KEY, token);
    return token;
  } catch (err) {
    // Expo Go'da ya da izin reddinde buraya düşer — uygulama akışı bozulmamalı.
    console.log('Push token kaydedilemedi:', err?.message);
    return null;
  }
}

/** Çıkışta cihazı hesaptan düşürür. */
export async function unregisterPushToken() {
  try {
    const token = await AsyncStorage.getItem(TOKEN_CACHE_KEY);
    if (!token) return;
    await API.delete('/push/tokens', { params: { token } });
  } catch {
    // Token zaten geçersizse sunucu tarafı ilk başarısız gönderimde temizler.
  } finally {
    try {
      await AsyncStorage.removeItem(TOKEN_CACHE_KEY);
    } catch {}
  }
}

/** Uygulama simgesindeki rozeti günceller. */
export async function setBadgeCount(count) {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, Number(count) || 0));
  } catch {}
}

/**
 * Bildirim verisini uygulama içi rotaya çevirir.
 * Sunucu data yükünde type/entityType/entityId gönderir.
 */
export function routeForNotification(data) {
  if (!data) return null;
  const entityId = data.entityId != null ? Number(data.entityId) : null;
  switch (data.entityType) {
    case 'post':
      return entityId ? { screen: 'PostDetail', params: { postId: entityId } } : null;
    case 'event':
      return entityId ? { screen: 'EventDetail', params: { eventId: entityId } } : null;
    case 'community':
      return entityId ? { screen: 'CommunityDetail', params: { communityId: entityId } } : null;
    case 'user':
      // Mesaj bildirimi sohbeti açar, takip bildirimi profili.
      if (data.type === 'message' && data.actorId) {
        return { screen: 'Chat', params: { userId: Number(data.actorId), username: data.actorUsername } };
      }
      return entityId ? { screen: 'UserProfile', params: { userId: entityId } } : null;
    case 'daily_song':
      return { screen: 'DailySong', params: {} };
    default:
      // Bildirimler bir sekme; kök yığından iç içe rota ile açılır.
      return { screen: 'MainApp', params: { screen: 'Notifications' } };
  }
}
