// Dokunsal geri bildirim — yalnızca anlamlı anlarda (takip, katılım, beğeni,
// oyun cevabı, sekme seçimi). Her dokunuşa eklenmez: sık titreşim yorucu olur.
// Web'de ve desteklemeyen cihazlarda sessizce hiçbir şey yapmaz.
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

const safe = (fn) => {
  if (!enabled) return;
  try { fn()?.catch?.(() => {}); } catch {}
};

/** Seçim değişti (sekme, onay kutusu, seçenek). */
export const hapticSelection = () => safe(() => Haptics.selectionAsync());

/** Hafif dokunuş (takip, beğeni, katılım gibi durum değiştiren eylemler). */
export const hapticLight = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Başarılı sonuç (doğru cevap, doğrulama, bingo). */
export const hapticSuccess = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** Hatalı sonuç (yanlış cevap). */
export const hapticError = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
