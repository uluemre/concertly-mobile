import { CommonActions } from '@react-navigation/native';

/**
 * Etkinlik sayfasını açar. Web adresinde yalnızca id görünür (/event/123);
 * elimizde tam etkinlik nesnesi varsa ön izleme olarak geçer (sayfa beklemeden
 * açılır), linking bu nesneyi URL'ye yazmaz. Yalnızca id verilirse sayfa
 * etkinliği sunucudan çeker — kısmi nesneler (ör. {id, name}) için bunu kullanın.
 */
export function openEvent(navigation, eventOrId) {
  const isObject = eventOrId !== null && typeof eventOrId === 'object';
  const eventId = isObject ? eventOrId.id : eventOrId;
  if (eventId === undefined || eventId === null || eventId === '') return;
  navigation.navigate('EventDetail', isObject ? { eventId, event: eventOrId } : { eventId });
}

/**
 * Topluluk silindikten / topluluktan ayrıldıktan sonra Topluluklar listesine döner.
 * Listesi yığında varsa oraya kadar geri çıkar (v7'de navigate yeni kopya iterdi);
 * yoksa (linkten gelindiyse) yığın sıfırlanır, böylece "Geri" eski topluluğa dönmez.
 */
export function backToCommunities(navigation) {
  const routes = navigation.getState?.()?.routes || [];
  if (routes.some(r => r.name === 'Communities') && navigation.popTo) {
    navigation.popTo('Communities');
    return;
  }
  navigation.dispatch(CommonActions.reset({
    index: 1,
    routes: [{ name: 'MainApp' }, { name: 'Communities' }],
  }));
}

/**
 * Geri gidilecek ekran varsa geri döner; yoksa (sayfa linkten / yenilemeyle
 * doğrudan açılmışsa) kullanıcı çıkışsız kalmasın diye `fallback` ekranına gider.
 * Sıfırlama kök navigator'da yapılır: sekme içindeki ekranlardan da çalışır.
 */
export function goBackOrFallback(navigation, fallback = 'MainApp') {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  let root = navigation;
  while (root.getParent?.()) root = root.getParent();
  root.dispatch(CommonActions.reset({ index: 0, routes: [{ name: fallback }] }));
}
