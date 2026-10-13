import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../../services/api';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import { splitGenres } from './buddyUtils';

const SAFETY_KEY = 'buddy_safety_seen';

// Konser arkadaşı ekranının sunucu tarafı: deste, eşleşmeler, konserlerim, kaydırma,
// geri alma, arama aç/kapa ve eşleşme kaldırma. Arayüz bileşenleri yalnızca bunu okur.
export function useBuddyMatch({ t, initialEventId, userCity }) {
  const [cards, setCards] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [likesReceived, setLikesReceived] = useState(0);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  // İlk yükleme başarısızsa yanlış boş durum yerine "bağlantı kurulamadı" paneli
  const [loadError, setLoadError] = useState(false);
  const [eventFilter, setEventFilter] = useState(initialEventId ?? null);
  const [genreFilter, setGenreFilter] = useState([]);
  const [removed, setRemoved] = useState(() => new Set());
  const [lastSwipe, setLastSwipe] = useState(null); // { card, liked }
  const [matchedUser, setMatchedUser] = useState(null);
  const [swiping, setSwiping] = useState(false);
  const [nearby, setNearby] = useState([]);
  const [toggling, setToggling] = useState(null);
  const [showSafety, setShowSafety] = useState(false);
  const swipingRef = useRef(false);
  swipingRef.current = swiping;

  useEffect(() => {
    AsyncStorage.getItem(SAFETY_KEY).then(v => setShowSafety(v !== '1')).catch(() => {});
  }, []);
  const dismissSafety = useCallback(() => {
    setShowSafety(false);
    AsyncStorage.setItem(SAFETY_KEY, '1').catch(() => {});
  }, []);

  // reset: yalnızca kullanıcı açıkça yenilediğinde kaydırılanlar ve geri al sıfırlanır.
  // Odak yenilemesinde (profil/sohbetten dönüş) korunur: aksi hâlde geri al kayboluyor,
  // uçuştaki kaydırmanın kartı desteye geri dönüyordu.
  const fetchAll = useCallback(async ({ reset = false } = {}) => {
    try {
      const [d, m] = await Promise.all([API.get('/buddy/discover'), API.get('/buddy/matches')]);
      setCards(d.data?.cards || []);
      setMyEvents(d.data?.myEvents || []);
      setLikesReceived(d.data?.likesReceived || 0);
      setMatches(m.data || []);
      setLoadError(false);
      if (reset) {
        setRemoved(new Set());
        setLastSwipe(null);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchAll({ reset: true });
  }, [fetchAll]);

  // Bir kart uçarken gelen odak yenilemesi ertelenir (yarış: aynı kişiye ikinci kaydırma)
  useFocusEffect(useCallback(() => { if (!swipingRef.current) fetchAll(); }, [fetchAll]));

  const lookingEvents = useMemo(() => myEvents.filter(e => e.lookingForBuddy), [myEvents]);
  // Seçili konser artık listede yoksa (arama kapatıldı) filtre kalkar
  const activeEvent = eventFilter && lookingEvents.some(e => e.id === eventFilter) ? eventFilter : null;

  // Filtre seçenekleri destedeki kişilerin türlerinden gelir
  const genreOptions = useMemo(() => {
    const all = new Map();
    cards.forEach(c => splitGenres(c.favoriteGenres).forEach(g => {
      const key = g.toLocaleLowerCase('tr-TR');
      if (!all.has(key)) all.set(key, g);
    }));
    return [...all.values()].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [cards]);

  const deck = useMemo(() => cards.filter((c) => {
    if (removed.has(c.userId)) return false;
    if (activeEvent && !(c.sharedEvents || []).some(ev => ev.id === activeEvent)) return false;
    if (genreFilter.length) {
      const genres = splitGenres(c.favoriteGenres).map(g => g.toLocaleLowerCase('tr-TR'));
      if (!genreFilter.some(g => genres.includes(g.toLocaleLowerCase('tr-TR')))) return false;
    }
    return true;
  }), [cards, removed, activeEvent, genreFilter]);

  const activeFilterCount = (activeEvent ? 1 : 0) + genreFilter.length;
  const clearFilters = useCallback(() => {
    setEventFilter(null);
    setGenreFilter([]);
  }, []);

  const newMatches = useMemo(() => matches.filter(m => !m.hasConversation), [matches]);
  const chats = useMemo(() => matches.filter(m => m.hasConversation), [matches]);

  // Deste bitince: şehirdeki yaklaşan konserler
  const deckEmpty = !loading && deck.length === 0;
  useEffect(() => {
    if (!deckEmpty || nearby.length) return;
    const params = ['limit=3', 'upcoming=true'];
    if (userCity) params.push(`city=${encodeURIComponent(userCity)}`);
    API.get(`/events?${params.join('&')}`)
      .then(res => setNearby(Array.isArray(res.data) ? res.data.slice(0, 3) : []))
      .catch(() => {});
  }, [deckEmpty, nearby.length, userCity]);

  // ── Kaydırma ───────────────────────────────────────────────────────────────
  // Kart desteden hemen kalkar; kayıt sunucuya ulaşmazsa geri gelir.
  const sendSwipe = useCallback(async (card, liked) => {
    setRemoved(prev => new Set(prev).add(card.userId));
    setSwiping(false);
    try {
      const res = await API.post('/buddy/swipe', { targetId: card.userId, liked });
      if (res.data.matched) {
        setLastSwipe(null); // eşleşme geri alınamaz
        hapticSuccess();
        // Sunucunun eşleşme özetinde uyum yoksa karttakini kullan (modalda gösteriliyor)
        const matched = { compatibility: card.compatibility, ...res.data.matchedUser };
        setMatchedUser(matched);
        setMatches(prev => [{ ...matched, hasConversation: false }, ...prev.filter(m => m.userId !== matched.userId)]);
        return 'matched';
      }
      setLastSwipe({ card, liked });
      return 'saved';
    } catch (err) {
      setLastSwipe(null);
      const status = err?.response?.status;
      // Kalıcı istemci hataları (uygun değil, engel, eşleşme kaldırılmış, geçersiz):
      // kartı geri getirmek aynı hatayı tekrarlatır; kart desteden kalkar.
      // Ağ hatası, zaman aşımı, 5xx ve 429'da kayıt ulaşmamıştır: kart geri gelir.
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
        Alert.alert('', t('buddy_swipe_unavailable'));
      } else {
        setRemoved(prev => { const n = new Set(prev); n.delete(card.userId); return n; });
        Alert.alert('', t('buddy_swipe_failed'));
      }
      return 'failed';
    }
  }, [t]);

  // Deste kartı uçmaya başlamadan önce çağrılır; false dönerse kart yerine döner
  const beginSwipe = useCallback(() => {
    if (swipingRef.current) return false;
    swipingRef.current = true;
    setSwiping(true);
    hapticLight();
    return true;
  }, []);

  const undo = useCallback(async () => {
    if (!lastSwipe) return;
    const { card } = lastSwipe;
    setLastSwipe(null);
    hapticLight();
    try {
      await API.post('/buddy/undo', { targetId: card.userId });
      setRemoved(prev => { const n = new Set(prev); n.delete(card.userId); return n; });
      // Arada odak yenilemesi olduysa sunucu kartı listeden çıkarmıştır: geri ekle
      setCards(prev => (prev.some(c => c.userId === card.userId) ? prev : [card, ...prev]));
    } catch (err) {
      if (err?.response?.data?.message === 'UNDO_EXPIRED') {
        Alert.alert('', t('buddy_undo_expired'));
      } else {
        setLastSwipe(lastSwipe); // tekrar denenebilsin
        Alert.alert('', t('buddy_undo_failed'));
      }
    }
  }, [lastSwipe, t]);

  // ── Arkadaş arama aç / kapa ───────────────────────────────────────────────
  const toggleLooking = useCallback(async (ev) => {
    if (toggling) return;
    setToggling(ev.id);
    hapticLight();
    const next = !ev.lookingForBuddy;
    setMyEvents(prev => prev.map(e => (e.id === ev.id ? { ...e, lookingForBuddy: next } : e)));
    try {
      if (next) await API.post(`/events/${ev.id}/buddies`, { message: null });
      else await API.delete(`/events/${ev.id}/buddies`);
      await fetchAll();
    } catch (err) {
      setMyEvents(prev => prev.map(e => (e.id === ev.id ? { ...e, lookingForBuddy: !next } : e)));
      Alert.alert(err?.response?.data?.message === 'EVENT_NOT_JOINABLE' ? t('buddy_event_not_joinable') : t('buddy_toggle_failed'));
    } finally {
      setToggling(null);
    }
  }, [toggling, fetchAll, t]);

  // ── Eşleşmeyi kaldır / engel sonrası ──────────────────────────────────────
  const unmatch = useCallback(async (userId) => {
    setMatches(prev => prev.filter(x => x.userId !== userId));
    try {
      await API.delete(`/buddy/matches/${userId}`);
    } catch {
      Alert.alert('', t('buddy_unmatch_failed'));
      fetchAll();
    }
  }, [fetchAll, t]);

  const removeUser = useCallback((userId) => {
    setRemoved(prev => new Set(prev).add(userId));
    setMatches(prev => prev.filter(x => x.userId !== userId));
  }, []);

  const statusOf = useCallback((userId) => {
    if (matches.some(m => m.userId === userId)) return 'matched';
    if (removed.has(userId)) return 'seen';
    return 'open';
  }, [matches, removed]);

  return {
    loading,
    loadError,
    cards,
    deck,
    myEvents,
    lookingEvents,
    likesReceived,
    matches,
    newMatches,
    chats,
    nearby,
    lastSwipe,
    matchedUser,
    dismissMatch: () => setMatchedUser(null),
    swiping,
    toggling,
    showSafety,
    dismissSafety,
    activeEvent,
    setEventFilter,
    genreFilter,
    setGenreFilter,
    genreOptions,
    activeFilterCount,
    clearFilters,
    refresh,
    beginSwipe,
    sendSwipe,
    undo,
    toggleLooking,
    unmatch,
    removeUser,
    statusOf,
  };
}
