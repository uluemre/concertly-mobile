import { Alert, Platform } from 'react-native';

/**
 * Web'de Alert.alert'i görünür yapar.
 *
 * react-native-web'deki Alert.alert boş bir fonksiyondur (`static alert() {}`):
 * web build'de hata mesajları, onaylar (çıkış, silme) ve "başarılı" pencereleri
 * hiç görünmüyordu; onPress'e bağlı akışlar (ör. gönderi sonrası geri dönüş)
 * da hiç çalışmıyordu. Uygulamadaki ~180 çağrının hepsi `Alert`i react-native'den
 * aldığı için tek bir yama hepsini kapsar.
 *
 * Yalnızca web'de çalışır; iOS/Android'de hiçbir şeye dokunmaz.
 *
 * Buton eşlemesi (tarayıcının kendi pencereleriyle):
 *  - buton yok / tek buton      → window.alert, ardından varsa o butonun onPress'i
 *  - iptal + tek eylem           → window.confirm: Tamam = eylem, İptal = iptal butonu
 *  - iptalsiz iki eylem          → window.confirm: Tamam = son buton, İptal = ilk buton
 *  - üç ve daha fazla seçenek    → window.prompt ile numaralı seçim; boş/geçersiz = iptal
 */
function text(title, message) {
  return [title, message].filter(v => v !== undefined && v !== null && String(v).trim() !== '').join('\n\n');
}

function press(button) {
  if (button && typeof button.onPress === 'function') button.onPress();
}

function webAlert(title, message, buttons) {
  const body = text(title, message);
  const list = Array.isArray(buttons) ? buttons.filter(Boolean) : [];

  if (list.length <= 1) {
    window.alert(body);
    press(list[0]);
    return;
  }

  const cancel = list.find(b => b.style === 'cancel');
  const actions = list.filter(b => b !== cancel);

  if (actions.length === 1 || (!cancel && list.length === 2)) {
    const ok = cancel ? actions[0] : list[list.length - 1];
    const dismiss = cancel || list[0];
    // Tarayıcı "Tamam/İptal" der; hangi eylemin seçildiği anlaşılsın diye etiketi ekle
    const hint = ok.text ? `\n\n(${ok.text})` : '';
    if (window.confirm(body + hint)) press(ok);
    else press(dismiss);
    return;
  }

  const menu = actions.map((b, i) => `${i + 1}) ${b.text}`).join('\n');
  const answer = window.prompt(`${body}\n\n${menu}`, '');
  const index = Number.parseInt(String(answer ?? '').trim(), 10) - 1;
  if (answer !== null && index >= 0 && index < actions.length) press(actions[index]);
  else press(cancel);
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = webAlert;
}

export default webAlert;
