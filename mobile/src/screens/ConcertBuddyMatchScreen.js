import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Dimensions, ScrollView, PanResponder, Switch, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme';
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

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY = 0.3;
const SAFETY_KEY = 'buddy_safety_seen';
const LIKE = '#00D4AA';
const PASS = '#E94560';

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

  useEffect(() => {
    AsyncStorage.getItem(SAFETY_KEY).then(v => setShowSafety(v !== '1')).catch(() => {});
  }, []);
  const dismissSafety = () => {
    setShowSafety(false);
    AsyncStorage.setItem(SAFETY_KEY, '1').catch(() => {});
  };

  const fetchAll = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([API.get('/buddy/discover'), API.get('/buddy/matches')]);
      setCards(d.data?.cards || []);
      setMyEvents(d.data?.myEvents || []);
      setLikesReceived(d.data?.likesReceived || 0);
      setMatches(m.data || []);
      setRemoved(new Set());
      setLastSwipe(null);
    } catch (err) {
      console.log('Buddy fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

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
  const pan = useRef(new Animated.ValueXY()).current;
  const flyCardRef = useRef(null);
  const rotate = pan.x.interpolate({ inputRange: [-width / 2, 0, width / 2], outputRange: ['-9deg', '0deg', '9deg'], extrapolate: 'clamp' });
  const likeOpacity = pan.x.interpolate({ inputRange: [0, 80], outputRange: [0, 1], extrapolate: 'clamp' });
  const passOpacity = pan.x.interpolate({ inputRange: [-80, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const nextScale = pan.x.interpolate({ inputRange: [-width / 2, 0, width / 2], outputRange: [1, 0.95, 1], extrapolate: 'clamp' });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, { dx, vx }) => {
        if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(vx) > SWIPE_VELOCITY) {
          flyCardRef.current?.(dx > 0);
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, tension: 80, friction: 8, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const sendSwipe = useCallback(async (liked, card) => {
    setRemoved(prev => new Set(prev).add(card.userId));
    pan.setValue({ x: 0, y: 0 });
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
      console.log('Swipe error:', err.message);
      setLastSwipe(null);
    }
  }, [pan]);

  const flyCard = useCallback((liked) => {
    if (swiping || !currentCard) return;
    setSwiping(true);
    hapticLight();
    const card = currentCard;
    Animated.timing(pan, {
      toValue: { x: liked ? width * 1.5 : -width * 1.5, y: 30 },
      duration: 280,
      useNativeDriver: false,
    }).start(() => sendSwipe(liked, card));
  }, [swiping, currentCard, pan, sendSwipe]);
  flyCardRef.current = flyCard;

  const undo = async () => {
    if (!lastSwipe) return;
    const { card } = lastSwipe;
    setLastSwipe(null);
    hapticLight();
    try {
      await API.post('/buddy/undo', { targetId: card.userId });
      setRemoved(prev => { const n = new Set(prev); n.delete(card.userId); return n; });
    } catch (err) {
      console.log('Undo error:', err.message);
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
      Alert.alert(t('buddy_toggle_failed'));
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
              try { await API.delete(`/buddy/matches/${m.userId}`); } catch { fetchAll(); }
            },
          },
        ]),
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

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

    const animatedStyle = isBack
      ? { transform: [{ scale: nextScale }], opacity: 0.9 }
      : { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] };

    return (
      <Animated.View
        key={card.userId}
        style={[styles.card, animatedStyle]}
        {...(!isBack ? panResponder.panHandlers : {})}
      >
        {/* Üst: kişinin fotoğrafı (yoksa sevdiği türün rengi + baş harf) */}
        <View style={styles.hero}>
          {card.profileImageUrl ? (
            <Image source={{ uri: card.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
          ) : (
            <LinearGradient colors={getGenreGradient(genres[0])} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.heroFallback]}>
              <Text style={styles.heroInitial}>{card.username?.charAt(0).toUpperCase()}</Text>
            </LinearGradient>
          )}
          <LinearGradient colors={['rgba(6,6,18,0)', 'rgba(6,6,18,0.85)']} style={styles.heroShade} />

          <View style={[styles.compatBadge, { borderColor: cColor }]}>
            <Text style={[styles.compatValue, { color: cColor }]}>%{score}</Text>
            <Text style={styles.compatLabel}>{t('buddy_compat_label')}</Text>
          </View>

          <View style={styles.heroText}>
            <Text style={styles.heroName} numberOfLines={1}>@{card.username}</Text>
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
          </View>

          {!isBack && (
            <>
              <Animated.View style={[styles.swipeTag, styles.swipeTagLike, { opacity: likeOpacity }]}>
                <Text style={[styles.swipeTagText, { color: LIKE }]}>{tu('buddy_swipe_yes')}</Text>
              </Animated.View>
              <Animated.View style={[styles.swipeTag, styles.swipeTagPass, { opacity: passOpacity }]}>
                <Text style={[styles.swipeTagText, { color: PASS }]}>{tu('buddy_swipe_no')}</Text>
              </Animated.View>
            </>
          )}
        </View>

        <View style={styles.cardBody}>
          {/* Birlikte gidebileceğiniz konser */}
          {focus ? (
            <TouchableOpacity style={styles.eventRow} onPress={() => openEvent(navigation, focus.id)} activeOpacity={0.8}>
              <EventImage key={focus.id} item={{ ...focus, name: focus.artistName || focus.name }} style={styles.eventThumb} initialsSize={14}>
                <View style={styles.eventDate}>
                  <Text style={styles.eventDay}>{dateParts(focus.eventDate).day}</Text>
                  <Text style={styles.eventMonth}>{dateParts(focus.eventDate).month}</Text>
                </View>
              </EventImage>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventLabel}>{tu('buddy_going_together')}</Text>
                <Text style={styles.eventName} numberOfLines={1}>{focus.name}</Text>
                <Text style={styles.eventMeta} numberOfLines={1}>
                  {[focus.venueName, shared.length > 1 ? t('buddy_more_concerts', { count: shared.length - 1 }) : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {focus?.message ? (
            <View style={styles.quote}>
              <Ionicons name="chatbubble-ellipses" size={14} color={colors.primary} />
              <Text style={styles.quoteText} numberOfLines={2}>{focus.message}</Text>
            </View>
          ) : null}

          <View style={styles.reasons}>
            {reasons.map(r => (
              <View key={r.icon} style={[styles.reason, r.strong && styles.reasonStrong]}>
                <Ionicons name={r.icon} size={12} color={r.strong ? colors.primary : colors.textSecondary} />
                <Text style={[styles.reasonText, r.strong && { color: colors.text }]} numberOfLines={1}>{r.text}</Text>
              </View>
            ))}
          </View>

          {card.bio ? <Text style={styles.bio} numberOfLines={2}>{card.bio.replace(/\s+/g, ' ').trim()}</Text> : null}
        </View>
      </Animated.View>
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

        {currentCard ? (
          <>
            {likesReceived > 0 && (
              <View style={styles.likesBanner}>
                <Ionicons name="heart" size={14} color={PASS} />
                <Text style={styles.likesText}>{t('buddy_likes_banner', { count: likesReceived })}</Text>
              </View>
            )}
            <View style={styles.cardArea}>
              {nextCard && renderCard(nextCard, true)}
              {renderCard(currentCard)}
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.smallBtn, !lastSwipe && { opacity: 0.35 }]}
                onPress={undo}
                disabled={!lastSwipe}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('buddy_undo')}
              >
                <Ionicons name="arrow-undo" size={20} color="#F5A623" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.passBtn} onPress={() => flyCard(false)} disabled={swiping} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('buddy_pass')}>
                <Ionicons name="close" size={32} color={PASS} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.likeBtn} onPress={() => flyCard(true)} disabled={swiping} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('buddy_like')}>
                <Ionicons name="people" size={22} color="#fff" />
                <Text style={styles.likeBtnText}>{t('buddy_like')}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
            <Panel icon="hourglass" title={t('buddy_done_title')} sub={t('buddy_done_sub', { count: lookingEvents.length })}>
              <View style={styles.panelActions}>
                <TouchableOpacity onPress={() => setActiveTab('concerts')} style={styles.primaryBtn} activeOpacity={0.85}>
                  <Ionicons name="toggle" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>{t('buddy_tab_concerts')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setLoading(true); fetchAll(); }} style={styles.outlineBtn} activeOpacity={0.8} accessibilityLabel={t('buddy_refresh')}>
                  <Ionicons name="refresh" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
              {lastSwipe ? (
                <TouchableOpacity onPress={undo} style={styles.undoLink}>
                  <Ionicons name="arrow-undo" size={14} color="#F5A623" />
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
        )}
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
                  <TouchableOpacity key={m.userId} style={styles.newItem} onPress={() => openChat(m)} onLongPress={() => openMatchMenu(m)} activeOpacity={0.85}>
                    <View style={styles.newRing}>
                      <Avatar user={m} size={64} styles={styles} />
                    </View>
                    <Text style={styles.newName} numberOfLines={1}>{m.username}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
          {chats.length > 0 && <Text style={styles.sectionTitle}>{t('buddy_conversations')}</Text>}
          {(chats.length ? chats : newMatches).map(m => (
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
              <TouchableOpacity onPress={() => openMatchMenu(m)} hitSlop={10} style={styles.moreBtn} accessibilityLabel={t('buddy_unmatch')}>
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
                  accessibilityLabel={t('detail_buddy_title')}
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.iconBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('back')}>
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

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
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
    headerTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
    headerSub: { color: colors.textSecondary, fontSize: 12.5, marginTop: 1 },
    tabs: {
      flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    tab: { flex: 1, height: 38, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 4 },
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

    // Güvenlik / beğeni
    safety: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 16, marginBottom: 8,
      padding: 12, borderRadius: 14, backgroundColor: colors.accent + '14', borderWidth: 1, borderColor: colors.accent + '40',
    },
    safetyTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
    safetySub: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
    likesBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center',
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: PASS + '1A', marginBottom: 4,
    },
    likesText: { color: colors.text, fontSize: 12.5, fontWeight: '800' },

    // Kart
    cardArea: { flex: 1, marginHorizontal: 16, marginTop: 6 },
    card: {
      ...StyleSheet.absoluteFillObject, borderRadius: 26, overflow: 'hidden',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 10,
    },
    hero: { flex: 1, minHeight: 180, justifyContent: 'flex-end', backgroundColor: colors.cardAlt },
    heroFallback: { alignItems: 'center', justifyContent: 'center' },
    heroInitial: { color: 'rgba(255,255,255,0.9)', fontSize: 96, fontWeight: '900' },
    heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
    heroText: { padding: 16 },
    heroName: { color: '#fff', fontSize: 26, fontWeight: '900' },
    heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
    heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    heroMetaText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' },
    compatBadge: {
      position: 'absolute', top: 14, right: 14, width: 62, height: 62, borderRadius: 31, borderWidth: 3,
      alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,6,18,0.7)',
    },
    compatValue: { fontSize: 17, fontWeight: '900', lineHeight: 19 },
    compatLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 9.5, fontWeight: '800' },
    swipeTag: {
      position: 'absolute', top: 22, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, borderWidth: 3,
      backgroundColor: 'rgba(6,6,18,0.55)',
    },
    swipeTagLike: { left: 18, borderColor: LIKE, transform: [{ rotate: '-14deg' }] },
    swipeTagPass: { left: 18, borderColor: PASS, transform: [{ rotate: '-14deg' }] },
    swipeTagText: { fontSize: 22, fontWeight: '900', letterSpacing: 1.5 },

    cardBody: { padding: 14, gap: 10 },
    eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    eventThumb: { width: 54, height: 54, borderRadius: 12 },
    eventDate: {
      position: 'absolute', left: 4, top: 4, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6,
      backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center',
    },
    eventDay: { color: '#fff', fontSize: 12, fontWeight: '900', lineHeight: 13 },
    eventMonth: { color: '#fff', fontSize: 7.5, fontWeight: '800' },
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
    bio: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },

    // Eylemler
    actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 14, paddingBottom: 30 },
    smallBtn: {
      width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    passBtn: {
      width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.card, borderWidth: 1.5, borderColor: PASS + '66',
    },
    likeBtn: {
      height: 62, paddingHorizontal: 22, borderRadius: 31, flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: LIKE,
    },
    likeBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '900' },

    // Panel (boş durumlar)
    panel: {
      alignItems: 'center', padding: 22, borderRadius: 22,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    panelIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 14, backgroundColor: colors.primary },
    panelTitle: { color: colors.text, fontSize: 19, fontWeight: '900', marginBottom: 6, textAlign: 'center' },
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
    undoLinkText: { color: '#F5A623', fontSize: 13.5, fontWeight: '800' },
    sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 18, marginBottom: 12 },

    // Eşleşmeler
    newRow: { gap: 14, paddingBottom: 4 },
    newItem: { alignItems: 'center', width: 72 },
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
    matchTitle: { fontSize: 28, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 8 },
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
