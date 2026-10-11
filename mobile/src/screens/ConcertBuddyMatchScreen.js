import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Dimensions, ScrollView, PanResponder, Switch, Alert, Platform, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, fonts } from '../theme';
import { ListSkeletonPage } from '../components/SkeletonLoader';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import ConfettiOverlay from '../components/ConfettiOverlay';
import EventImage from '../components/EventImage';
import EventCard from '../components/EventCard';
import { getGenreGradient } from '../utils/gradients';
import { parseEventDate } from '../utils/time';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';
import { useReport, confirmBlock } from '../components/ReportSheet';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY = 0.3;
const SAFETY_KEY = 'buddy_safety_seen';
const LIKE = '#00D4AA';
const PASS = '#E94560';
// Tam ekran kartta fotoğrafın altındaki bilgi bloğunun alt boşluğu (güvenlik notu sığsın)
const HERO_BOTTOM_SPACE = 28;

function compatColor(score) {
  if (score >= 60) return '#00D4AA';
  if (score >= 30) return '#F5A623';
  if (score > 0) return '#A78BFA';
  return '#A0A0B0';
}

function Avatar({ user, size, styles, ring }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2 }, styles.avatar, ring && styles.avatarRing]}>
      {user?.profileImageUrl ? (
        <Image source={{ uri: user.profileImageUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      ) : (
        <Text style={[styles.avatarLetter, { fontSize: size * 0.4 }]}>{user?.username?.charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

// ── Kaydırılabilir kart kabuğu ──────────────────────────────────────────────
// Her kart kendi konumunu tutar. Parmak hareketi PanResponder ile JS'de alınır ve
// Reanimated paylaşımlı değerlerine yazılır; dönüş/eğim/etiket stilleri ile bırakma
// animasyonları UI thread'inde çalışır (JS yalnızca dokunma olaylarını taşır).
// Öndeki kart sürüklenir; arkadaki kart `dragX`'e göre büyür. Kart değişince yeni
// öndeki kartın konumu zaten sıfırdır, geri alınan kart da sıfırdan açılır.
// Ekran genişliği modül yüklenirken alınır: uygulama yalnızca dikey (app.json).
const SPRING_BACK = { damping: 15, stiffness: 180 };

function SwipeShell({ isBack, dragX, flyRef, onFling, style, tags, children }) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const onFlingRef = useRef(onFling);
  onFlingRef.current = onFling;
  // Uçuş başladıktan sonra yeni sürükleme alınmaz: pan x'e yazınca withTiming iptal
  // olur, done hiç çağrılmaz ve deste "swiping" durumunda kilitli kalırdı.
  const flyingRef = useRef(false);

  const springBack = useCallback(() => {
    x.value = withSpring(0, SPRING_BACK);
    y.value = withSpring(0, SPRING_BACK);
    dragX.value = withSpring(0, SPRING_BACK);
  }, [x, y, dragX]);

  const fly = useCallback((liked, done) => {
    const to = liked ? width * 1.5 : -width * 1.5;
    flyingRef.current = true;
    dragX.value = withTiming(liked ? width : -width, { duration: 280 });
    y.value = withTiming(30, { duration: 280 });
    // done animasyon kesilse bile çağrılır: kayıt gönderilir, deste kilitlenmez
    x.value = withTiming(to, { duration: 280 }, () => {
      scheduleOnRN(done);
    });
  }, [x, y, dragX]);

  useEffect(() => {
    if (isBack) return undefined;
    flyRef.current = fly;
    return () => { if (flyRef.current === fly) flyRef.current = null; };
  }, [isBack, fly, flyRef]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    // Kartın içi dikey kaydırılır (detaylar). Yatay hareketi yakalama aşamasında kart
    // alır ki içteki ScrollView ondan önce davranmasın; dikey hareket ScrollView'da kalır.
    onMoveShouldSetPanResponderCapture: (_, g) => !flyingRef.current && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => {
      x.value = g.dx;
      y.value = g.dy;
      dragX.value = g.dx;
    },
    onPanResponderRelease: (_, { dx, vx }) => {
      const far = Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(vx) > SWIPE_VELOCITY;
      // Ekran başka bir kaydırmayı bitirirken gelen fırlatma reddedilir: kart yerine döner
      if (!far || !onFlingRef.current?.(dx > 0)) springBack();
    },
    onPanResponderTerminate: springBack,
  }), [x, y, dragX, springBack]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-width / 2, 0, width / 2], [-9, 0, 9], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: 0.9,
    transform: [{ scale: interpolate(dragX.value, [-width / 2, 0, width / 2], [1, 0.95, 1], Extrapolation.CLAMP) }],
  }));
  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));
  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-80, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Reanimated.View style={[style, isBack ? backStyle : frontStyle]} {...(!isBack ? panResponder.panHandlers : {})}>
      {children}
      {!isBack && tags && (
        <>
          <Reanimated.View pointerEvents="none" style={[tags.likeStyle, likeStyle]}>{tags.like}</Reanimated.View>
          <Reanimated.View pointerEvents="none" style={[tags.passStyle, passStyle]}>{tags.pass}</Reanimated.View>
        </>
      )}
    </Reanimated.View>
  );
}

// ── Eşleşme anı ──────────────────────────────────────────────────────────────
function MatchOverlay({ matchedUser, onClose, navigation, t, styles, session }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const shared = matchedUser.sharedEvents?.[0];
  const openChat = (initialText) => {
    onClose();
    navigation.navigate('Chat', {
      userId: matchedUser.userId,
      username: matchedUser.username,
      profileImageUrl: matchedUser.profileImageUrl,
      sharedEventName: shared?.name ?? null,
      initialText,
    });
  };
  const icebreakers = [t('buddy_ice_1'), t('buddy_ice_2'), t('buddy_ice_3')];

  return (
    <Animated.View style={[styles.matchOverlay, { opacity: opacityAnim }]}>
      <LinearGradient colors={['#0A0A14F5', '#2A0A2EF5']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.matchContent, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.matchAvatars}>
          <Avatar user={{ userId: session.userId, username: session.username }} size={84} styles={styles} ring />
          <View style={styles.matchLink}>
            <Ionicons name="musical-notes" size={20} color="#fff" />
          </View>
          <Avatar user={matchedUser} size={84} styles={styles} ring />
        </View>
        <Text style={styles.matchTitle}>{t('buddy_match_title')}</Text>
        <Text style={styles.matchSub}>{t('buddy_match_sub', { username: matchedUser.username })}</Text>
        {shared ? (
          <View style={styles.matchEventPill}>
            <Ionicons name="ticket" size={14} color="#fff" />
            <Text style={styles.matchEventText} numberOfLines={1}>{shared.name}</Text>
          </View>
        ) : null}

        <Text style={styles.iceTitle}>{t('buddy_icebreaker_title')}</Text>
        {icebreakers.map(text => (
          <TouchableOpacity key={text} style={styles.iceChip} onPress={() => openChat(text)} activeOpacity={0.85}>
            <Text style={styles.iceChipText}>{text}</Text>
            <Ionicons name="arrow-forward" size={15} color="#fff" />
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.matchPrimary} onPress={() => openChat(undefined)} activeOpacity={0.85}>
          <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
          <Text style={styles.matchPrimaryText}>{t('buddy_send_message')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.matchSkip}>
          <Text style={styles.matchSkipText}>{t('buddy_continue')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ── Ana ekran ────────────────────────────────────────────────────────────────
export default function ConcertBuddyMatchScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t, tu, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-GB' : 'tr-TR';
  const confettiRef = useRef(null);

  const [cards, setCards] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [likesReceived, setLikesReceived] = useState(0);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(route?.params?.tab || 'discover');
  const [eventFilter, setEventFilter] = useState(route?.params?.eventId ?? null);
  const [removed, setRemoved] = useState(() => new Set());
  const [lastSwipe, setLastSwipe] = useState(null); // { card, liked }
  const [matchedUser, setMatchedUser] = useState(null);
  const [swiping, setSwiping] = useState(false);
  const [nearby, setNearby] = useState([]);
  const [toggling, setToggling] = useState(null);
  const [showSafety, setShowSafety] = useState(false);
  // İlk yükleme başarısızsa yanlış boş durum yerine "bağlantı kurulamadı" paneli
  const [loadError, setLoadError] = useState(false);
  const [cardH, setCardH] = useState(0);
  const insets = useSafeAreaInsets();
  const swipingRef = useRef(false);
  swipingRef.current = swiping;
  const { openReport, reportSheet } = useReport();

  useEffect(() => {
    AsyncStorage.getItem(SAFETY_KEY).then(v => setShowSafety(v !== '1')).catch(() => {});
  }, []);
  const dismissSafety = () => {
    setShowSafety(false);
    AsyncStorage.setItem(SAFETY_KEY, '1').catch(() => {});
  };

  // reset: yalnızca kullanıcı açıkça yenilediğinde (yenile düğmesi) kaydırılanlar ve
  // geri al sıfırlanır. Odak yenilemesinde (profil/sohbetten dönüş) korunur: aksi hâlde
  // geri al kayboluyor, uçuştaki kaydırmanın kartı desteye geri dönüyordu.
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

  // Bir kart uçarken gelen odak yenilemesi ertelenir (yarış: aynı kişiye ikinci kaydırma)
  useFocusEffect(useCallback(() => { if (!swipingRef.current) fetchAll(); }, [fetchAll]));

  const lookingEvents = useMemo(() => myEvents.filter(e => e.lookingForBuddy), [myEvents]);
  // Seçili konser artık listede yoksa (arama kapatıldı) filtre kalkar
  const activeFilter = eventFilter && lookingEvents.some(e => e.id === eventFilter) ? eventFilter : null;

  const deck = useMemo(() => cards.filter(c =>
    !removed.has(c.userId)
    && (!activeFilter || (c.sharedEvents || []).some(ev => ev.id === activeFilter))), [cards, removed, activeFilter]);
  const currentCard = deck[0];
  const nextCard = deck[1];
  const newMatches = matches.filter(m => !m.hasConversation);
  const chats = matches.filter(m => m.hasConversation);

  // Deste bitince: şehirdeki yaklaşan konserler
  useEffect(() => {
    if (loading || currentCard || nearby.length) return;
    const params = ['limit=3', 'upcoming=true'];
    if (session.userCity) params.push(`city=${encodeURIComponent(session.userCity)}`);
    API.get(`/events?${params.join('&')}`)
      .then(res => setNearby(Array.isArray(res.data) ? res.data.slice(0, 3) : []))
      .catch(() => {});
  }, [loading, currentCard]);

  // ── Kaydırma ───────────────────────────────────────────────────────────────
  const dragX = useSharedValue(0); // öndeki kartın yatay konumu (arka kartın büyümesi için)
  const flyRef = useRef(null);     // öndeki kartın fırlatma fonksiyonu

  // Yeni arka kart küçük boyuna yumuşakça otursun
  useEffect(() => {
    dragX.value = withTiming(0, { duration: 200 });
  }, [currentCard?.userId, dragX]);

  const sendSwipe = useCallback(async (liked, card) => {
    setRemoved(prev => new Set(prev).add(card.userId));
    setSwiping(false);
    try {
      const res = await API.post('/buddy/swipe', { targetId: card.userId, liked });
      if (res.data.matched) {
        setLastSwipe(null); // eşleşme geri alınamaz
        hapticSuccess();
        setMatchedUser(res.data.matchedUser);
        setMatches(prev => [{ ...res.data.matchedUser, hasConversation: false }, ...prev]);
        confettiRef.current?.fire();
      } else {
        setLastSwipe({ card, liked });
      }
    } catch (err) {
      setLastSwipe(null);
      const status = err?.response?.status;
      // Kalıcı istemci hataları (uygun değil, engel, eşleşme kaldırılmış, geçersiz):
      // kartı geri getirmek aynı hatayı tekrarlatır; kart desteden kalkar.
      // Ağ hatası, zaman aşımı, 5xx ve 429'da kayıt ulaşmamıştır: kart geri gelir.
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
        Alert.alert('', t('buddy_swipe_unavailable'));
      } else {
        // Kayıt sunucuya ulaşmadı: kart desteye geri döner, kullanıcı tekrar dener
        setRemoved(prev => { const n = new Set(prev); n.delete(card.userId); return n; });
        Alert.alert('', t('buddy_swipe_failed'));
      }
    }
  }, [t]);

  // true dönerse kart uçar; false ise (zaten bir kart uçuyor) kart yerine döner
  const flyCard = useCallback((liked) => {
    if (swiping || !currentCard || !flyRef.current) return false;
    setSwiping(true);
    hapticLight();
    const card = currentCard;
    flyRef.current(liked, () => sendSwipe(liked, card));
    return true;
  }, [swiping, currentCard, sendSwipe]);

  const undo = async () => {
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
  };

  // ── Arkadaş arama aç / kapa ───────────────────────────────────────────────
  const toggleLooking = async (ev) => {
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
  };

  // ── Eşleşmeyi kaldır ──────────────────────────────────────────────────────
  const openMatchMenu = (m) => {
    Alert.alert(`@${m.username}`, undefined, [
      { text: t('buddy_view_profile'), onPress: () => navigation.navigate('UserProfile', { userId: m.userId }) },
      {
        text: t('buddy_unmatch'),
        style: 'destructive',
        onPress: () => Alert.alert(t('buddy_unmatch'), t('buddy_unmatch_confirm', { username: m.username }), [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('buddy_unmatch'),
            style: 'destructive',
            onPress: async () => {
              setMatches(prev => prev.filter(x => x.userId !== m.userId));
              try {
                await API.delete(`/buddy/matches/${m.userId}`);
              } catch {
                Alert.alert('', t('buddy_unmatch_failed'));
                fetchAll();
              }
            },
          },
        ]),
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  // Deste kartı "⋯": eşleşmeden önce de profil, şikâyet ve engel (güvenlik metninin
  // vaadi). Android Alert en fazla 3 düğme gösterir: iptal yalnız iOS'ta, Android'de
  // dışarı dokunarak kapanır.
  const openCardMenu = (card) => {
    const buttons = [
      { text: t('buddy_view_profile'), onPress: () => navigation.navigate('UserProfile', { userId: card.userId }) },
      { text: t('mod_report'), onPress: () => openReport('USER', card.userId) },
      {
        text: t('mod_block'), style: 'destructive',
        onPress: () => confirmBlock(t, card.userId, () => {
          setRemoved(prev => new Set(prev).add(card.userId));
          setMatches(prev => prev.filter(x => x.userId !== card.userId));
        }),
      },
    ];
    if (Platform.OS === 'ios') buttons.push({ text: t('mod_cancel'), style: 'cancel' });
    Alert.alert(`@${card.username}`, undefined, buttons, { cancelable: true });
  };

  const explainCompat = () => Alert.alert(t('buddy_compat_explain_title'), t('buddy_compat_explain_msg'));

  const openChat = (m) => navigation.navigate('Chat', {
    userId: m.userId, username: m.username, profileImageUrl: m.profileImageUrl,
    sharedEventName: m.sharedEvents?.[0]?.name ?? null,
  });

  const dateParts = (iso) => {
    const d = parseEventDate(iso);
    return { day: d.getDate(), month: d.toLocaleDateString(locale, { month: 'short' }).replace('.', '').toLocaleUpperCase(locale) };
  };
  const shortDate = (iso) => parseEventDate(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  // ── Kart ───────────────────────────────────────────────────────────────────
  const swipeTags = {
    likeStyle: [styles.swipeTag, styles.swipeTagLike],
    passStyle: [styles.swipeTag, styles.swipeTagPass],
    like: <Text style={[styles.swipeTagText, { color: LIKE }]}>{tu('buddy_swipe_yes')}</Text>,
    pass: <Text style={[styles.swipeTagText, { color: PASS }]}>{tu('buddy_swipe_no')}</Text>,
  };

  const renderCard = (card, isBack = false) => {
    if (!card) return null;
    const score = card.compatibility ?? card.genreMatchScore ?? 0;
    const cColor = compatColor(score);
    const shared = card.sharedEvents || [];
    const focus = (activeFilter && shared.find(ev => ev.id === activeFilter)) || shared[0];
    const genres = card.favoriteGenres ? card.favoriteGenres.split(',').map(g => g.trim()).filter(Boolean) : [];
    const reasons = [];
    if (card.sharedArtists?.length) reasons.push({ icon: 'mic', text: card.sharedArtists.join(', '), strong: true });
    if (card.pastConcertsTogether > 0) reasons.push({ icon: 'ticket', text: t('buddy_reason_together', { count: card.pastConcertsTogether }), strong: true });
    if (card.sharedGenres?.length) reasons.push({ icon: 'musical-notes', text: card.sharedGenres.join(', ') });
    if (card.sameCity) reasons.push({ icon: 'location', text: t('buddy_reason_city') });
    if (reasons.length === 0) reasons.push({ icon: 'sparkles', text: t('buddy_reason_new') });

    const heroH = cardH || Dimensions.get('window').height;
    const concerts = card.recentConcerts || [];
    const artists = card.topArtists || [];
    const sharedArtistSet = new Set(card.sharedArtists || []);
    const sharedGenreSet = new Set((card.sharedGenres || []).map(g => g.toLowerCase()));
    const bio = card.bio ? card.bio.trim() : '';
    const section = (icon, title, body) => (
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Ionicons name={icon} size={14} color={colors.primary} />
          <Text style={styles.sectionLabel}>{title}</Text>
        </View>
        {body}
      </View>
    );
    const eventRow = (ev) => (
      <TouchableOpacity key={ev.id} style={styles.eventRow} onPress={() => openEvent(navigation, ev.id)} activeOpacity={0.8} disabled={isBack}>
        <EventImage item={{ ...ev, name: ev.artistName || ev.name }} style={styles.eventThumb} initialsSize={14}>
          <View style={styles.eventDate}>
            <Text style={styles.eventDay}>{dateParts(ev.eventDate).day}</Text>
            <Text style={styles.eventMonth}>{dateParts(ev.eventDate).month}</Text>
          </View>
        </EventImage>
        <View style={{ flex: 1 }}>
          <Text style={styles.eventName} numberOfLines={1}>{ev.artistName || ev.name}</Text>
          <Text style={styles.eventMeta} numberOfLines={1}>
            {[ev.venueName, ev.venueCity].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    );
    const chip = (key, label, strong, icon) => (
      <View key={key} style={[styles.reason, strong && styles.reasonStrong]}>
        {icon ? <Ionicons name={icon} size={12} color={strong ? colors.primary : colors.textSecondary} /> : null}
        <Text style={[styles.reasonText, strong && { color: colors.text }]} numberOfLines={2}>{label}</Text>
      </View>
    );

    return (
      <SwipeShell
        key={card.userId}
        isBack={isBack}
        style={styles.card}
        dragX={dragX}
        flyRef={flyRef}
        onFling={flyCard}
        tags={swipeTags}
      >
        {/* Tam ekran profil: üstte fotoğraf, aşağı kaydırınca detaylar */}
        <ScrollView
          scrollEnabled={!isBack}
          pointerEvents={isBack ? 'none' : 'auto'}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          nestedScrollEnabled
        >
          <View style={[styles.hero, { height: heroH }]}>
            {card.profileImageUrl ? (
              <Image source={{ uri: card.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
            ) : (
              <LinearGradient colors={getGenreGradient(genres[0])} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.heroFallback]}>
                <Text style={styles.heroInitial}>{card.username?.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            )}
            <LinearGradient colors={['rgba(6,6,18,0)', 'rgba(6,6,18,0.9)']} style={styles.heroShade} />

            <LinearGradient colors={['rgba(6,6,18,0.55)', 'rgba(6,6,18,0)']} style={[styles.heroTopShade, { height: insets.top + 90 }]} pointerEvents="none" />
            <View style={[styles.heroText, { paddingBottom: insets.bottom + HERO_BOTTOM_SPACE }]}>
              <View style={styles.heroNameRow}>
                <Text
                  style={[styles.heroName, { flex: 1 }]}
                  numberOfLines={1}
                  accessibilityHint={t('buddy_swipe_a11y_hint')}
                  accessibilityActions={isBack ? undefined : [
                    { name: 'like', label: t('buddy_like') },
                    { name: 'pass', label: t('buddy_pass') },
                  ]}
                  onAccessibilityAction={(e) => flyCard(e.nativeEvent.actionName === 'like')}
                >
                  @{card.username}
                </Text>
                <TouchableOpacity
                  style={[styles.compatPill, { borderColor: cColor }]}
                  onPress={explainCompat}
                  disabled={isBack}
                  activeOpacity={0.8}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('buddy_compat_label')} %${score}`}
                  accessibilityHint={t('buddy_compat_explain_title')}
                >
                  <Text style={[styles.compatValue, { color: cColor }]}>%{score}</Text>
                  <Text style={styles.compatLabel}>{t('buddy_compat_label')}</Text>
                </TouchableOpacity>
                {!isBack && (
                  <TouchableOpacity
                    style={styles.cardMenuBtn}
                    onPress={() => openCardMenu(card)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('mod_options_title')}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.heroMetaRow}>
                {card.city ? (
                  <View style={styles.heroMeta}>
                    <Ionicons name="location" size={13} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.heroMetaText}>{card.city}</Text>
                  </View>
                ) : null}
                {card.concertCount > 0 ? (
                  <View style={styles.heroMeta}>
                    <Ionicons name="ticket" size={13} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.heroMetaText}>{t('buddy_concert_count', { count: card.concertCount })}</Text>
                  </View>
                ) : null}
              </View>
              {focus ? (
                <View style={styles.heroEvent}>
                  <Ionicons name="musical-notes" size={13} color="#fff" />
                  <Text style={styles.heroEventText} numberOfLines={1}>
                    {`${focus.artistName || focus.name} · ${shortDate(focus.eventDate)}`}
                    {shared.length > 1 ? `  ${t('buddy_more_concerts', { count: shared.length - 1 })}` : ''}
                  </Text>
                </View>
              ) : null}
              <View style={styles.scrollHint} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.75)" />
                <Text style={styles.scrollHintText}>{t('buddy_scroll_hint')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardBody}>
            {/* Birlikte gidebileceğiniz konserler */}
            {shared.length > 0 && section('people', tu('buddy_going_together'), (
              <>
                {focus?.message ? (
                  <View style={styles.quote}>
                    <Ionicons name="chatbubble-ellipses" size={14} color={colors.primary} />
                    <Text style={styles.quoteText}>{focus.message}</Text>
                  </View>
                ) : null}
                {shared.map(eventRow)}
              </>
            ))}

            {section('sparkles', tu('buddy_section_why'), (
              <View style={styles.reasons}>
                {reasons.map(r => chip(r.icon, r.text, r.strong, r.icon))}
              </View>
            ))}

            {bio ? section('person', tu('buddy_section_about'), <Text style={styles.bio}>{bio}</Text>) : null}

            {genres.length > 0 && section('musical-notes', tu('buddy_section_genres'), (
              <View style={styles.reasons}>
                {genres.map(g => chip(g, g, sharedGenreSet.has(g.toLowerCase())))}
              </View>
            ))}

            {artists.length > 0 && section('mic', tu('buddy_section_artists'), (
              <View style={styles.reasons}>
                {artists.map(a => chip(a, a, sharedArtistSet.has(a), sharedArtistSet.has(a) ? 'heart' : null))}
              </View>
            ))}

            {concerts.length > 0 && section('ticket', tu('buddy_section_went'), concerts.map(eventRow))}
          </View>
        </ScrollView>
      </SwipeShell>
    );
  };

  const Panel = ({ icon, title, sub, children }) => (
    <View style={styles.panel}>
      <View style={styles.panelIcon}>
        <Ionicons name={icon} size={26} color="#fff" />
      </View>
      <Text style={styles.panelTitle}>{title}</Text>
      {sub ? <Text style={styles.panelSub}>{sub}</Text> : null}
      {children}
    </View>
  );

  // ── Sekmeler ───────────────────────────────────────────────────────────────
  const renderDiscover = () => {
    if (loadError && cards.length === 0 && myEvents.length === 0) {
      return (
        <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <Panel icon="cloud-offline" title={t('load_failed')} sub={t('buddy_load_failed_sub')}>
            <TouchableOpacity
              onPress={() => { setLoading(true); fetchAll({ reset: true }); }}
              style={[styles.primaryBtn, { alignSelf: 'stretch', marginTop: 18 }]}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>{t('retry')}</Text>
            </TouchableOpacity>
          </Panel>
        </ScrollView>
      );
    }
    if (lookingEvents.length === 0) {
      return (
        <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <Panel icon="people" title={t('buddy_not_looking_title')} sub={t('buddy_not_looking_sub')}>
            <TouchableOpacity
              onPress={() => (myEvents.length ? setActiveTab('concerts') : navigation.navigate('MainApp', { screen: 'Events' }))}
              style={[styles.primaryBtn, { alignSelf: 'stretch', marginTop: 18 }]}
              activeOpacity={0.85}
            >
              <Ionicons name={myEvents.length ? 'toggle' : 'ticket-outline'} size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>{myEvents.length ? t('buddy_open_concerts') : t('buddy_browse')}</Text>
            </TouchableOpacity>
          </Panel>
        </ScrollView>
      );
    }
    // Tinder gibi: kart tüm ekranı kaplar, yalnızca kaydırılır. Üstte geri, geri al,
    // Eşleşmeler ve Konserlerim simgeleri yüzer.
    if (currentCard) {
      const roundBtn = (icon, onPress, label, badge) => (
        <TouchableOpacity style={styles.floatBtn} onPress={onPress} hitSlop={6} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={label}>
          <Ionicons name={icon} size={20} color="#fff" />
          {badge > 0 ? (
            <View style={styles.floatBadge}>
              <Text style={styles.floatBadgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      );
      return (
        <View style={{ flex: 1 }}>
          <View style={StyleSheet.absoluteFill} onLayout={(e) => setCardH(e.nativeEvent.layout.height)}>
            {nextCard && renderCard(nextCard, true)}
            {renderCard(currentCard)}
          </View>

          <View style={[styles.floatTop, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <View style={styles.floatBar} pointerEvents="box-none">
              {roundBtn('chevron-back', () => goBackOrFallback(navigation), t('a11y_back'))}
              <View style={{ flex: 1 }} pointerEvents="none" />
              {lastSwipe ? roundBtn('arrow-undo', undo, t('buddy_undo')) : null}
              {roundBtn('chatbubbles', () => setActiveTab('matches'), t('buddy_matches'), newMatches.length)}
              {roundBtn('ticket', () => setActiveTab('concerts'), t('buddy_tab_concerts'))}
            </View>
            {lookingEvents.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.floatFilterRow} style={styles.filterScroll}>
                {[{ id: null, label: t('buddy_filter_all') }, ...lookingEvents.map(e => ({ id: e.id, label: `${e.artistName || e.name} · ${shortDate(e.eventDate)}` }))].map(f => {
                  const active = activeFilter === f.id;
                  return (
                    <TouchableOpacity
                      key={String(f.id)}
                      onPress={() => setEventFilter(f.id)}
                      style={[styles.floatChip, active && styles.floatChipActive]}
                      activeOpacity={0.85}
                      hitSlop={{ top: 8, bottom: 8 }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={styles.floatChipText} numberOfLines={1}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            {likesReceived > 0 && (
              <View style={styles.floatLikes} pointerEvents="none">
                <Ionicons name="heart" size={13} color={PASS} />
                <Text style={styles.floatLikesText}>{t('buddy_likes_banner', { count: likesReceived })}</Text>
              </View>
            )}
          </View>

          {showSafety && (
            <View style={[styles.safety, styles.safetyFloat, { bottom: insets.bottom + 12 }]}>
              <Ionicons name="shield-checkmark" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.safetyTitle}>{t('buddy_safety_title')}</Text>
                <Text style={styles.safetySub}>{t('buddy_safety_sub')}</Text>
              </View>
              <TouchableOpacity onPress={dismissSafety} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        {lookingEvents.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} style={styles.filterScroll}>
            {[{ id: null, label: t('buddy_filter_all') }, ...lookingEvents.map(e => ({ id: e.id, label: `${e.artistName || e.name} · ${shortDate(e.eventDate)}` }))].map(f => {
              const active = activeFilter === f.id;
              return (
                <TouchableOpacity
                  key={String(f.id)}
                  onPress={() => setEventFilter(f.id)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  activeOpacity={0.85}
                  hitSlop={{ top: 8, bottom: 8 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]} numberOfLines={1}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {showSafety && (
          <View style={styles.safety}>
            <Ionicons name="shield-checkmark" size={18} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.safetyTitle}>{t('buddy_safety_title')}</Text>
              <Text style={styles.safetySub}>{t('buddy_safety_sub')}</Text>
            </View>
            <TouchableOpacity onPress={dismissSafety} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Deste bitti (kart varken yukarıdaki tam ekran görünüm döner) */}
        <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <Panel icon="hourglass" title={t('buddy_done_title')} sub={t('buddy_done_sub', { count: lookingEvents.length })}>
            <View style={styles.panelActions}>
              <TouchableOpacity onPress={() => setActiveTab('concerts')} style={styles.primaryBtn} activeOpacity={0.85}>
                <Ionicons name="toggle" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>{t('buddy_tab_concerts')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setLoading(true); fetchAll({ reset: true }); }} style={styles.outlineBtn} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('buddy_refresh')}>
                <Ionicons name="refresh" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            {lastSwipe ? (
              <TouchableOpacity onPress={undo} style={styles.undoLink}>
                <Ionicons name="arrow-undo" size={14} color={colors.secondary} />
                <Text style={styles.undoLinkText}>{t('buddy_undo')}</Text>
              </TouchableOpacity>
            ) : null}
          </Panel>
          {nearby.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t('buddy_nearby')}</Text>
              {nearby.map(e => <EventCard key={e.id} item={e} variant="row" onPress={() => openEvent(navigation, e.id)} />)}
            </>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderMatches = () => (
    <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
      {matches.length === 0 ? (
        <Panel icon="chatbubbles" title={t('buddy_no_matches')} sub={t('buddy_no_matches_sub')} />
      ) : (
        <>
          {newMatches.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t('buddy_new_matches')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newRow}>
                {newMatches.map(m => (
                  <TouchableOpacity
                    key={m.userId}
                    style={styles.newItem}
                    onPress={() => openChat(m)}
                    onLongPress={() => openMatchMenu(m)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`@${m.username}`}
                    accessibilityActions={[{ name: 'menu', label: t('buddy_unmatch') }]}
                    onAccessibilityAction={(e) => e.nativeEvent.actionName === 'menu' && openMatchMenu(m)}
                  >
                    <View style={styles.newRing}>
                      <Avatar user={m} size={64} styles={styles} />
                    </View>
                    <TouchableOpacity
                      style={styles.newMore}
                      onPress={() => openMatchMenu(m)}
                      hitSlop={10}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      <Ionicons name="ellipsis-horizontal" size={14} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.newName} numberOfLines={1}>{m.username}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
          {/* Sohbeti olmayan eşleşmeler yalnızca üstteki şeritte görünür (eskiden iki kez) */}
          {chats.length > 0 && <Text style={styles.sectionTitle}>{t('buddy_conversations')}</Text>}
          {chats.map(m => (
            <TouchableOpacity key={m.userId} style={styles.matchRow} onPress={() => openChat(m)} activeOpacity={0.85}>
              <Avatar user={m} size={52} styles={styles} />
              <View style={{ flex: 1 }}>
                <Text style={styles.matchName} numberOfLines={1}>@{m.username}</Text>
                {m.sharedEvents?.length > 0 ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="ticket" size={12} color={colors.primary} />
                    <Text style={styles.matchEvent} numberOfLines={1}>
                      {m.sharedEvents[0].name}{m.sharedEvents.length > 1 ? ` +${m.sharedEvents.length - 1}` : ''}
                    </Text>
                  </View>
                ) : m.city ? (
                  <Text style={styles.metaText}>{m.city}</Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => openMatchMenu(m)} hitSlop={10} style={styles.moreBtn} accessibilityRole="button" accessibilityLabel={t('mod_options_title')}>
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </>
      )}
    </ScrollView>
  );

  const renderConcerts = () => (
    <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
      {myEvents.length === 0 ? (
        <Panel icon="ticket" title={t('buddy_concerts_empty_title')} sub={t('buddy_concerts_empty_sub')}>
          <TouchableOpacity
            onPress={() => navigation.navigate('MainApp', { screen: 'Events' })}
            style={[styles.primaryBtn, { alignSelf: 'stretch', marginTop: 18 }]}
            activeOpacity={0.85}
          >
            <Ionicons name="ticket-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>{t('buddy_browse')}</Text>
          </TouchableOpacity>
        </Panel>
      ) : (
        <>
          <Text style={styles.concertsHint}>{t('buddy_concerts_hint')}</Text>
          {myEvents.map(ev => (
            <View key={ev.id} style={[styles.concertRow, ev.lookingForBuddy && styles.concertRowOn]}>
              <TouchableOpacity style={styles.concertMain} onPress={() => openEvent(navigation, ev.id)} activeOpacity={0.8}>
                <EventImage key={ev.id} item={{ ...ev, name: ev.artistName || ev.name }} style={styles.concertThumb} initialsSize={14} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.concertName} numberOfLines={1}>{ev.name}</Text>
                  <Text style={styles.concertMeta} numberOfLines={1}>
                    {[shortDate(ev.eventDate), ev.venueName].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={[styles.concertCount, ev.buddyCount > 0 && { color: colors.accent }]}>
                    {ev.buddyCount > 0 ? t('buddy_looking_count', { count: ev.buddyCount }) : t('buddy_looking_none')}
                  </Text>
                </View>
              </TouchableOpacity>
              {toggling === ev.id ? (
                <ActivityIndicator color={colors.primary} style={{ width: 51 }} />
              ) : (
                <Switch
                  value={!!ev.lookingForBuddy}
                  onValueChange={() => toggleLooking(ev)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                  accessibilityLabel={t('a11y_buddy_switch', { name: ev.artistName || ev.name })}
                />
              )}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );

  const tabs = [
    ['discover', 'compass', t('buddy_discover'), deck.length],
    ['matches', 'chatbubbles', t('buddy_matches'), newMatches.length],
    ['concerts', 'ticket', t('buddy_tab_concerts'), lookingEvents.length],
  ];

  // Keşfet'te kart varken başlık ve sekmeler gizlenir, kart tüm ekranı kaplar
  const immersive = !loading && activeTab === 'discover' && !!currentCard && lookingEvents.length > 0;

  return (
    <View style={styles.container}>
      {immersive && <StatusBar barStyle="light-content" />}
      {!immersive && (
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.iconBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('buddy_title')}</Text>
            <Text style={styles.headerSub}>{t('buddy_subtitle')}</Text>
          </View>
        </View>
        <View style={styles.tabs}>
          {tabs.map(([key, icon, label, count]) => {
            const active = activeTab === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(key)}
                activeOpacity={0.85}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={active ? icon : `${icon}-outline`} size={15} color={active ? '#fff' : colors.textSecondary} />
                <Text style={[styles.tabText, { color: active ? '#fff' : colors.textSecondary }]} numberOfLines={1}>{label}</Text>
                {count > 0 ? (
                  <View style={[styles.tabCount, active && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, active && { color: colors.primary }]}>{count}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      )}

      {loading ? (
        <ListSkeletonPage rows={6} avatar="square" />
      ) : activeTab === 'discover' ? renderDiscover()
        : activeTab === 'matches' ? renderMatches()
        : renderConcerts()}

      {matchedUser && (
        <MatchOverlay
          matchedUser={matchedUser}
          onClose={() => setMatchedUser(null)}
          navigation={navigation}
          t={t}
          styles={styles}
          session={session}
        />
      )}
      <ConfettiOverlay ref={confettiRef} />
      {reportSheet}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollPad: { padding: 16, paddingBottom: 40 },

    // Başlık
    header: { paddingTop: 52, paddingBottom: 10, paddingHorizontal: 16, gap: 12 },
    headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBtn: {
      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    headerTitle: { color: colors.text, fontSize: 22, fontFamily: fonts.heading },
    headerSub: { color: colors.textSecondary, fontSize: 12.5, marginTop: 1 },
    tabs: {
      flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    tab: { flex: 1, minHeight: 44, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 4 },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 12.5, fontWeight: '800', flexShrink: 1 },
    tabCount: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border },
    tabCountActive: { backgroundColor: '#fff' },
    tabCountText: { color: colors.textSecondary, fontSize: 10.5, fontWeight: '900' },

    // Filtre
    filterScroll: { flexGrow: 0 },
    filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
    filterChip: {
      maxWidth: 220, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primary + '22', borderColor: colors.primary },
    filterText: { color: colors.textSecondary, fontSize: 12.5, fontWeight: '700' },
    filterTextActive: { color: colors.primary },

    // Güvenlik
    safety: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 16, marginBottom: 8,
      padding: 12, borderRadius: 14, backgroundColor: colors.accent + '14', borderWidth: 1, borderColor: colors.accent + '40',
    },
    safetyTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
    safetySub: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },

    // Kart
    card: {
      ...StyleSheet.absoluteFillObject, overflow: 'hidden',
      backgroundColor: colors.card,
      shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 10,
    },
    hero: { justifyContent: 'flex-end', backgroundColor: colors.cardAlt },
    heroFallback: { alignItems: 'center', justifyContent: 'center' },
    heroInitial: { color: 'rgba(255,255,255,0.9)', fontSize: 96, fontWeight: '900' },
    heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
    heroText: { padding: 16, paddingBottom: 12 },
    heroName: { color: '#fff', fontSize: 26, fontFamily: fonts.heading },
    heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
    heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    heroMetaText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' },
    heroEvent: {
      flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%',
      marginTop: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)',
    },
    heroEventText: { color: '#fff', fontSize: 12.5, fontWeight: '800', flexShrink: 1 },
    scrollHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12 },
    scrollHintText: { color: 'rgba(255,255,255,0.75)', fontSize: 11.5, fontWeight: '700' },
    section: { gap: 10 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionLabel: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    heroTopShade: { position: 'absolute', top: 0, left: 0, right: 0 },
    heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    compatPill: {
      flexDirection: 'row', alignItems: 'baseline', gap: 4, paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 999, borderWidth: 2, backgroundColor: 'rgba(6,6,18,0.6)',
    },
    compatValue: { fontSize: 15, fontWeight: '900' },
    compatLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800' },
    cardMenuBtn: {
      width: 38, height: 38, borderRadius: 19,
      alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,6,18,0.6)',
    },

    // Tam ekran üst simgeler
    floatTop: { position: 'absolute', top: 0, left: 0, right: 0, gap: 8 },
    floatBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
    floatBtn: {
      width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(6,6,18,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    },
    floatBadge: {
      position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
      alignItems: 'center', justifyContent: 'center', backgroundColor: PASS,
    },
    floatBadgeText: { color: '#fff', fontSize: 10.5, fontWeight: '900' },
    floatFilterRow: { paddingHorizontal: 14, gap: 8 },
    floatChip: {
      maxWidth: 220, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
      backgroundColor: 'rgba(6,6,18,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    },
    floatChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    floatChipText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
    floatLikes: {
      flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center',
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(6,6,18,0.6)',
    },
    floatLikesText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
    safetyFloat: { position: 'absolute', left: 0, right: 0, backgroundColor: colors.card },
    swipeTag: {
      position: 'absolute', top: 130, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, borderWidth: 3,
      backgroundColor: 'rgba(6,6,18,0.55)',
    },
    swipeTagLike: { left: 18, borderColor: LIKE, transform: [{ rotate: '-14deg' }] },
    swipeTagPass: { left: 18, borderColor: PASS, transform: [{ rotate: '-14deg' }] },
    swipeTagText: { fontSize: 22, fontWeight: '900', letterSpacing: 1.5 },

    cardBody: { padding: 16, gap: 22 },
    eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    eventThumb: { width: 54, height: 54, borderRadius: 12 },
    eventDate: {
      position: 'absolute', left: 4, top: 4, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6,
      backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center',
    },
    eventDay: { color: '#fff', fontSize: 12, fontWeight: '900', lineHeight: 13 },
    // Küçük tarih rozetinin içinde; 11 pt sığmıyor, en okunur sınır 9.5
    eventMonth: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
    eventLabel: { color: colors.primary, fontSize: 10.5, fontWeight: '900', letterSpacing: 1 },
    eventName: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 1 },
    eventMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
    quote: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 12,
      backgroundColor: colors.background,
    },
    quoteText: { flex: 1, color: colors.text, fontSize: 13.5, lineHeight: 19, fontStyle: 'italic' },
    reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    reason: {
      flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%',
      paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.background,
    },
    reasonStrong: { backgroundColor: colors.primary + '1A' },
    reasonText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', flexShrink: 1 },
    bio: { color: colors.text, fontSize: 14, lineHeight: 20 },


    // Panel (boş durumlar)
    panel: {
      alignItems: 'center', padding: 22, borderRadius: 22,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    panelIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 14, backgroundColor: colors.primary },
    panelTitle: { color: colors.text, fontSize: 19, fontFamily: fonts.heading, marginBottom: 6, textAlign: 'center' },
    panelSub: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    panelActions: { flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' },
    primaryBtn: {
      flex: 1, minHeight: 50, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: colors.primary, paddingHorizontal: 14,
    },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
    outlineBtn: {
      width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    undoLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
    undoLinkText: { color: colors.secondary, fontSize: 13.5, fontWeight: '800' },
    sectionTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.heading, marginTop: 18, marginBottom: 12 },

    // Eşleşmeler
    newRow: { gap: 14, paddingBottom: 4 },
    newItem: { alignItems: 'center', width: 72 },
    newMore: {
      position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    newRing: { padding: 3, borderRadius: 38, borderWidth: 2, borderColor: colors.primary },
    newName: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 6, maxWidth: 72 },
    matchRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10,
      borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    matchName: { color: colors.text, fontSize: 15.5, fontWeight: '900' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    metaText: { color: colors.textSecondary, fontSize: 12.5, marginTop: 2 },
    matchEvent: { color: colors.primary, fontSize: 12.5, fontWeight: '800', flex: 1 },
    moreBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.cardAlt },
    avatarRing: { borderWidth: 4, borderColor: '#1A0A24' },
    avatarLetter: { color: colors.text, fontWeight: '900' },

    // Konserlerim
    concertsHint: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 12 },
    concertRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, marginBottom: 10,
      borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    concertRowOn: { borderColor: colors.primary + '88' },
    concertMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    concertThumb: { width: 52, height: 52, borderRadius: 12 },
    concertName: { color: colors.text, fontSize: 14.5, fontWeight: '800' },
    concertMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    concertCount: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', marginTop: 3 },

    // Eşleşme anı
    matchOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, justifyContent: 'center', alignItems: 'center' },
    matchContent: { alignItems: 'center', paddingHorizontal: 24, width: '100%' },
    matchAvatars: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    matchLink: {
      width: 44, height: 44, borderRadius: 22, marginHorizontal: -8, zIndex: 2,
      alignItems: 'center', justifyContent: 'center', backgroundColor: PASS, borderWidth: 3, borderColor: '#1A0A24',
    },
    matchTitle: { fontSize: 28, fontFamily: fonts.heading, color: '#fff', textAlign: 'center', marginBottom: 8 },
    matchSub: { fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22, marginBottom: 12 },
    matchEventPill: {
      flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 20,
    },
    matchEventText: { color: '#fff', fontSize: 13, fontWeight: '800', flexShrink: 1 },
    iceTitle: { alignSelf: 'flex-start', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 },
    iceChip: {
      alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, marginBottom: 8,
      backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    },
    iceChipText: { flex: 1, color: '#fff', fontSize: 13.5, fontWeight: '700', lineHeight: 18 },
    matchPrimary: {
      alignSelf: 'stretch', height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: PASS, marginTop: 8,
    },
    matchPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '900' },
    matchSkip: { padding: 14 },
    matchSkipText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700' },
  });
}
