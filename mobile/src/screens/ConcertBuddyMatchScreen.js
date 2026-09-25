import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Dimensions, ScrollView, PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import ConfettiOverlay from '../components/ConfettiOverlay';
import EventImage from '../components/EventImage';
import EventCard from '../components/EventCard';
import { genreAccent } from '../utils/gradients';
import { parseEventDate } from '../utils/time';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;

const AVATAR_GRADIENTS = [
  ['#E94560', '#7C3AED'],
  ['#00D4AA', '#3B82F6'],
  ['#F5A623', '#E94560'],
  ['#7C3AED', '#00D4AA'],
  ['#3B82F6', '#E94560'],
];

function compatInfo(score, t) {
  if (score >= 80) return { label: t('buddy_compat_great'), color: '#00D4AA' };
  if (score >= 50) return { label: t('buddy_compat_good'), color: '#F5A623' };
  if (score > 0) return { label: t('buddy_compat_diff'), color: '#A78BFA' };
  return { label: t('buddy_compat_explore'), color: '#A0A0B0' };
}

function Avatar({ user, size, styles, index = 0, ring }) {
  const gradient = AVATAR_GRADIENTS[(user?.userId ?? index) % AVATAR_GRADIENTS.length];
  return (
    <LinearGradient
      colors={gradient}
      style={[{ width: size, height: size, borderRadius: size / 2 }, styles.avatar, ring && styles.avatarRing]}
    >
      {user?.profileImageUrl ? (
        <Image source={{ uri: user.profileImageUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      ) : (
        <Text style={[styles.avatarLetter, { fontSize: size * 0.4 }]}>{user?.username?.charAt(0).toUpperCase()}</Text>
      )}
    </LinearGradient>
  );
}

// ── Eşleşme ekranı ────────────────────────────────────────────────────────────
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

  return (
    <Animated.View style={[styles.matchOverlay, { opacity: opacityAnim }]}>
      <LinearGradient colors={['#0A0A14F2', '#2A0A2EF2']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.matchContent, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.matchAvatars}>
          <Avatar user={{ userId: session.userId, username: session.username }} size={84} styles={styles} ring />
          <View style={styles.matchLink}>
            <Ionicons name="musical-notes" size={20} color="#fff" />
          </View>
          <Avatar user={matchedUser} size={84} styles={styles} index={1} ring />
        </View>
        <Text style={styles.matchTitle}>{t('buddy_match_title')}</Text>
        <Text style={styles.matchSub}>{t('buddy_match_sub', { username: matchedUser.username })}</Text>
        {shared ? (
          <View style={styles.matchEventPill}>
            <Ionicons name="ticket" size={14} color="#fff" />
            <Text style={styles.matchEventText} numberOfLines={1}>{shared.name}</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.matchPrimary}
          onPress={() => {
            onClose();
            navigation.navigate('Chat', {
              userId: matchedUser.userId,
              username: matchedUser.username,
              profileImageUrl: matchedUser.profileImageUrl,
              sharedEventName: shared?.name ?? null,
            });
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
          <Text style={styles.matchPrimaryText}>{t('buddy_send_message')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.matchSecondary}
          onPress={() => { onClose(); navigation.navigate('UserProfile', { userId: matchedUser.userId }); }}
          activeOpacity={0.85}
        >
          <Text style={styles.matchSecondaryText}>{t('buddy_view_profile')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.matchSkip}>
          <Text style={styles.matchSkipText}>{t('buddy_continue')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ── Ana ekran ─────────────────────────────────────────────────────────────────
export default function ConcertBuddyMatchScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t, tu, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-GB' : 'tr-TR';
  const fromEventName = route?.params?.eventName ?? null;
  const confettiRef = useRef(null);

  const [cards, setCards] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('discover');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchedUser, setMatchedUser] = useState(null);
  const [swiping, setSwiping] = useState(false);
  const [nearby, setNearby] = useState([]);

  const pan = useRef(new Animated.ValueXY()).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  // panResponder bir kez oluşturulur; en güncel flyCard'a ref üzerinden eriş (stale closure önler)
  const flyCardRef = useRef(null);

  const rotate = pan.x.interpolate({ inputRange: [-width / 2, 0, width / 2], outputRange: ['-10deg', '0deg', '10deg'], extrapolate: 'clamp' });
  const likeOpacity = pan.x.interpolate({ inputRange: [0, 80], outputRange: [0, 1], extrapolate: 'clamp' });
  const passOpacity = pan.x.interpolate({ inputRange: [-80, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const SWIPE_THRESHOLD = 100;
  const SWIPE_VELOCITY = 0.3;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        const { dx, vx } = gesture;
        if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(vx) > SWIPE_VELOCITY) {
          flyCardRef.current?.(dx > 0);
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, tension: 80, friction: 8, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cardsRes, matchesRes] = await Promise.all([API.get('/buddy/discover'), API.get('/buddy/matches')]);
      setCards(cardsRes.data);
      setMatches(matchesRes.data);
      setCurrentIndex(0);
    } catch (err) {
      console.log('Buddy fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const noMoreCards = !loading && currentIndex >= cards.length;
  // Aday yoksa: şehirdeki yaklaşan konserler (Gidiyorum deyince aday gelir)
  useEffect(() => {
    if (!noMoreCards || nearby.length) return;
    const params = ['limit=3', 'upcoming=true'];
    if (session.userCity) params.push(`city=${encodeURIComponent(session.userCity)}`);
    API.get(`/events?${params.join('&')}`)
      .then(res => setNearby(Array.isArray(res.data) ? res.data.slice(0, 3) : []))
      .catch(() => {});
  }, [noMoreCards]);

  const currentCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];

  const sendSwipe = useCallback(async (liked, card) => {
    try {
      const res = await API.post('/buddy/swipe', { targetId: card.userId, liked });
      if (res.data.matched) {
        setMatchedUser(res.data.matchedUser);
        setMatches(prev => [...prev, res.data.matchedUser]);
        confettiRef.current?.fire();
      }
    } catch (err) {
      console.log('Swipe error:', err.message);
    } finally {
      pan.setValue({ x: 0, y: 0 });
      cardOpacity.setValue(1);
      setSwiping(false);
      setCurrentIndex(prev => prev + 1);
    }
  }, [pan, cardOpacity]);

  const flyCard = useCallback((liked) => {
    if (swiping || !cards[currentIndex]) return;
    setSwiping(true);
    const card = cards[currentIndex];
    Animated.parallel([
      Animated.timing(pan, { toValue: { x: liked ? width * 1.4 : -width * 1.4, y: liked ? -60 : -20 }, duration: 350, useNativeDriver: false }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start(() => sendSwipe(liked, card));
  }, [swiping, cards, currentIndex, pan, cardOpacity, sendSwipe]);

  flyCardRef.current = flyCard;

  const dateParts = (iso) => {
    const d = parseEventDate(iso);
    return { day: d.getDate(), month: d.toLocaleDateString(locale, { month: 'short' }).replace('.', '').toLocaleUpperCase(locale) };
  };

  const renderCard = (card, isBack = false) => {
    if (!card) return null;
    const genres = card.favoriteGenres ? card.favoriteGenres.split(',').map(g => g.trim()).filter(Boolean) : [];
    const score = card.genreMatchScore || 0;
    const compat = compatInfo(score, t);
    const shared = card.sharedEvents || [];
    const first = shared[0];
    const bannerItem = first
      ? { id: first.id, name: first.artistName || first.name, artistName: first.artistName, imageUrl: first.imageUrl || null }
      : { id: card.userId, name: card.username };

    const animatedStyle = isBack
      ? styles.cardBack
      : { opacity: cardOpacity, transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] };

    return (
      <Animated.View style={[styles.card, animatedStyle]} {...(!isBack ? panResponder.panHandlers : {})}>
        {/* Üst: ortak konserin görseli */}
        <EventImage key={bannerItem.id} item={bannerItem} style={styles.banner} initialsSize={30} showInitials={false}>
          <LinearGradient colors={['rgba(6,6,18,0.8)', 'rgba(6,6,18,0.15)', 'rgba(6,6,18,0.55)']} style={StyleSheet.absoluteFill} />
          {first ? (
            <View style={styles.bannerText}>
              <Text style={styles.bannerLabel}>{tu('buddy_same_concert')}</Text>
              <Text style={styles.bannerName} numberOfLines={1}>{first.name}</Text>
            </View>
          ) : null}
          {first ? (
            <View style={styles.bannerDate}>
              <Text style={styles.bannerDay}>{dateParts(first.eventDate).day}</Text>
              <Text style={styles.bannerMonth}>{dateParts(first.eventDate).month}</Text>
            </View>
          ) : null}
        </EventImage>

        {!isBack && (
          <>
            <Animated.View style={[styles.swipeTag, styles.swipeTagLike, { opacity: likeOpacity }]}>
              <Ionicons name="people" size={20} color="#00D4AA" />
              <Text style={[styles.swipeTagText, { color: '#00D4AA' }]}>{t('buddy_swipe_yes')}</Text>
            </Animated.View>
            <Animated.View style={[styles.swipeTag, styles.swipeTagPass, { opacity: passOpacity }]}>
              <Ionicons name="close" size={20} color="#E94560" />
              <Text style={[styles.swipeTagText, { color: '#E94560' }]}>{t('buddy_swipe_no')}</Text>
            </Animated.View>
          </>
        )}

        <View style={styles.cardBody}>
          <View style={styles.identityRow}>
            <View style={styles.avatarLift}>
              <Avatar user={card} size={76} styles={styles} ring />
            </View>
            <View style={styles.identityText}>
              <Text style={styles.username} numberOfLines={1}>@{card.username}</Text>
              {card.city ? (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{card.city}</Text>
                </View>
              ) : null}
              <View style={[styles.compatPill, { backgroundColor: compat.color + '22' }]}>
                <View style={[styles.compatDot, { backgroundColor: compat.color }]} />
                <Text style={[styles.compatText, { color: compat.color }]}>
                  {score > 0 ? t('buddy_match_score', { score }) : compat.label}
                </Text>
              </View>
            </View>
          </View>

          {card.bio ? <Text style={styles.bio} numberOfLines={2}>“{card.bio.replace(/\s+/g, ' ').trim()}”</Text> : null}

          {genres.length > 0 && (
            <View style={styles.genreWrap}>
              {genres.slice(0, 4).map(g => {
                const c = genreAccent(g);
                return (
                  <View key={g} style={[styles.genreChip, { backgroundColor: c + '26', borderColor: c + '66' }]}>
                    <Text style={[styles.genreChipText, { color: c }]}>{g}</Text>
                  </View>
                );
              })}
              {genres.length > 4 ? <Text style={styles.moreGenres}>+{genres.length - 4}</Text> : null}
            </View>
          )}

          {shared.length > 0 && (
            <View style={styles.sharedBox}>
              <Text style={styles.sharedTitle}>{tu('buddy_shared')}</Text>
              {shared.slice(0, 2).map(ev => {
                const d = dateParts(ev.eventDate);
                return (
                  <View key={ev.id} style={styles.sharedRow}>
                    <View style={styles.sharedDate}>
                      <Text style={styles.sharedDay}>{d.day}</Text>
                      <Text style={styles.sharedMonth}>{d.month}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sharedName} numberOfLines={1}>{ev.name}</Text>
                      {ev.artistName && ev.artistName !== ev.name ? (
                        <Text style={styles.sharedArtist} numberOfLines={1}>{ev.artistName}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
              {shared.length > 2 && (
                <Text style={styles.sharedMore}>+{shared.length - 2} {t('buddy_more_events')}</Text>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  const EmptyPanel = ({ icon, title, sub, children }) => (
    <View style={styles.emptyCard}>
      <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color="#fff" />
      </LinearGradient>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
      {children}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* BAŞLIK */}
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('buddy_title')}</Text>
            <Text style={styles.headerSub}>{t('buddy_subtitle')}</Text>
          </View>
        </View>
        {fromEventName && (
          <View style={styles.eventCtx}>
            <Ionicons name="ticket-outline" size={13} color={colors.primary} />
            <Text style={styles.eventCtxText} numberOfLines={1}>{fromEventName}</Text>
          </View>
        )}
        <View style={styles.tabs}>
          {[
            ['discover', 'compass', t('buddy_discover'), cards.length - currentIndex],
            ['matches', 'people', t('buddy_matches'), matches.length],
          ].map(([key, icon, label, count]) => {
            const active = activeTab === key;
            return (
              <TouchableOpacity key={key} style={[styles.tab, active && styles.tabActive]} onPress={() => setActiveTab(key)} activeOpacity={0.85}>
                <Ionicons name={active ? icon : `${icon}-outline`} size={16} color={active ? '#fff' : colors.textSecondary} />
                <Text style={[styles.tabText, { color: active ? '#fff' : colors.textSecondary }]}>{label}</Text>
                {count > 0 ? (
                  <View style={[styles.tabCount, active && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, active && { color: colors.primary }]}>{count}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : activeTab === 'discover' ? (
        noMoreCards ? (
          <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
            <EmptyPanel icon="people" title={t('buddy_empty_title')} sub={t('buddy_empty_sub')}>
              <View style={styles.emptyActions}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('MainApp', { screen: 'Events' })}
                  style={styles.primaryBtn}
                  activeOpacity={0.85}
                >
                  <Ionicons name="ticket-outline" size={17} color="#fff" />
                  <Text style={styles.primaryBtnText}>{t('buddy_pick_concert')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={fetchAll} style={styles.outlineBtn} activeOpacity={0.8}>
                  <Ionicons name="refresh" size={17} color={colors.text} />
                </TouchableOpacity>
              </View>
            </EmptyPanel>
            {nearby.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>{t('buddy_nearby')}</Text>
                {nearby.map(e => (
                  <EventCard key={e.id} item={e} variant="row" onPress={() => openEvent(navigation, e.id)} />
                ))}
              </>
            )}
          </ScrollView>
        ) : (
          <>
            <View style={styles.cardArea}>
              {nextCard && renderCard(nextCard, true)}
              {renderCard(currentCard)}
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.passBtn} onPress={() => flyCard(false)} disabled={swiping} activeOpacity={0.8}>
                <Ionicons name="close" size={30} color="#E94560" />
              </TouchableOpacity>
              <Text style={styles.counter}>{currentIndex + 1} / {cards.length}</Text>
              <TouchableOpacity onPress={() => flyCard(true)} disabled={swiping} activeOpacity={0.85}>
                <LinearGradient colors={['#00D4AA', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.likeBtn}>
                  <Ionicons name="people" size={20} color="#fff" />
                  <Text style={styles.likeBtnText}>{t('buddy_like')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )
      ) : (
        <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          {matches.length === 0 ? (
            <EmptyPanel icon="chatbubbles" title={t('buddy_no_matches')} sub={t('buddy_no_matches_sub')} />
          ) : (
            matches.map((m, i) => (
              <TouchableOpacity
                key={m.userId}
                style={styles.matchRow}
                onPress={() => navigation.navigate('UserProfile', { userId: m.userId })}
                activeOpacity={0.85}
              >
                <Avatar user={m} size={54} styles={styles} index={i} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.matchName}>@{m.username}</Text>
                  {m.sharedEvents?.length > 0 ? (
                    <View style={styles.metaRow}>
                      <Ionicons name="ticket" size={12} color={colors.primary} />
                      <Text style={styles.matchEvent} numberOfLines={1}>
                        {m.sharedEvents[0].name}{m.sharedEvents.length > 1 ? ` +${m.sharedEvents.length - 1}` : ''}
                      </Text>
                    </View>
                  ) : m.city ? (
                    <View style={styles.metaRow}>
                      <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.metaText}>{m.city}</Text>
                    </View>
                  ) : null}
                  {m.favoriteGenres ? (
                    <Text style={styles.matchGenres} numberOfLines={1}>{m.favoriteGenres.split(',').slice(0, 3).join(' · ')}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Chat', {
                    userId: m.userId, username: m.username, profileImageUrl: m.profileImageUrl,
                    sharedEventName: m.sharedEvents?.[0]?.name ?? null,
                  })}
                  hitSlop={8}
                  activeOpacity={0.85}
                  style={styles.chatBtn}
                >
                  <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

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
    header: { paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, gap: 12 },
    headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBtn: {
      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    headerTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
    headerSub: { color: colors.textSecondary, fontSize: 12.5, marginTop: 1 },
    eventCtx: {
      alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
      backgroundColor: colors.primary + '1F',
    },
    eventCtxText: { color: colors.primary, fontSize: 12.5, fontWeight: '800', maxWidth: 260 },
    tabs: {
      flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    tab: { flex: 1, height: 38, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 13.5, fontWeight: '800' },
    tabCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border },
    tabCountActive: { backgroundColor: '#fff' },
    tabCountText: { color: colors.textSecondary, fontSize: 11, fontWeight: '900' },

    // Kart
    cardArea: { flex: 1, alignItems: 'center', paddingTop: 14 },
    card: {
      position: 'absolute', top: 14, width: CARD_WIDTH, borderRadius: 26, overflow: 'hidden',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 10,
    },
    cardBack: { transform: [{ scale: 0.94 }, { translateY: 14 }], opacity: 0.55 },
    banner: { width: '100%', height: 124 },
    bannerText: { position: 'absolute', left: 16, right: 80, top: 14 },
    bannerLabel: { color: '#FFD166', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
    bannerName: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 2 },
    bannerDate: {
      position: 'absolute', right: 14, top: 14, minWidth: 48, paddingVertical: 5, borderRadius: 12,
      alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)',
    },
    bannerDay: { color: '#111', fontSize: 18, lineHeight: 20, fontWeight: '900' },
    bannerMonth: { color: '#E94560', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
    swipeTag: {
      position: 'absolute', top: 18, zIndex: 5, flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 3, backgroundColor: 'rgba(6,6,18,0.75)',
    },
    swipeTagLike: { left: 16, borderColor: '#00D4AA', transform: [{ rotate: '-12deg' }] },
    swipeTagPass: { right: 16, borderColor: '#E94560', transform: [{ rotate: '12deg' }] },
    swipeTagText: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },

    cardBody: { paddingHorizontal: 18, paddingBottom: 18 },
    identityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    avatarLift: { marginTop: -38 },
    avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    avatarRing: { borderWidth: 4, borderColor: colors.card },
    avatarLetter: { color: '#fff', fontWeight: '900' },
    identityText: { flex: 1, paddingTop: 10 },
    username: { color: colors.text, fontSize: 20, fontWeight: '900' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    metaText: { color: colors.textSecondary, fontSize: 12.5 },
    compatPill: {
      alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6,
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    },
    compatDot: { width: 7, height: 7, borderRadius: 4 },
    compatText: { fontSize: 12, fontWeight: '900' },
    bio: { color: colors.text, fontSize: 14, lineHeight: 20, fontStyle: 'italic', marginTop: 12, opacity: 0.9 },
    genreWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, alignItems: 'center' },
    genreChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
    genreChipText: { fontSize: 11.5, fontWeight: '800' },
    moreGenres: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
    sharedBox: { marginTop: 14, padding: 12, borderRadius: 16, backgroundColor: colors.background },
    sharedTitle: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.1, marginBottom: 8 },
    sharedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
    sharedDate: { width: 40, alignItems: 'center', paddingVertical: 3, borderRadius: 9, backgroundColor: colors.card },
    sharedDay: { color: colors.text, fontSize: 14, fontWeight: '900', lineHeight: 16 },
    sharedMonth: { color: colors.primary, fontSize: 9, fontWeight: '900' },
    sharedName: { color: colors.text, fontSize: 13.5, fontWeight: '800' },
    sharedArtist: { color: colors.textSecondary, fontSize: 12 },
    sharedMore: { color: colors.primary, fontSize: 12, fontWeight: '800', marginTop: 4 },

    // Eylemler
    actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 10, paddingBottom: 34 },
    passBtn: {
      width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.card, borderWidth: 1.5, borderColor: '#E9456055',
    },
    counter: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
    likeBtn: {
      height: 64, paddingHorizontal: 24, borderRadius: 32, flexDirection: 'row', alignItems: 'center', gap: 8,
      shadowColor: '#00D4AA', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
    },
    likeBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

    // Boş durum
    emptyCard: {
      alignItems: 'center', padding: 22, borderRadius: 22,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    emptyTitle: { color: colors.text, fontSize: 19, fontWeight: '900', marginBottom: 6, textAlign: 'center' },
    emptySub: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    emptyActions: { flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' },
    primaryBtn: {
      flex: 1, height: 50, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: colors.primary,
    },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
    outlineBtn: {
      width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 22, marginBottom: 12 },

    // Bağlantılar
    matchRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10,
      borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    matchName: { color: colors.text, fontSize: 15.5, fontWeight: '900' },
    matchEvent: { color: colors.primary, fontSize: 12.5, fontWeight: '800', flex: 1 },
    matchGenres: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    chatBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },

    // Eşleşme ekranı
    matchOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, justifyContent: 'center', alignItems: 'center' },
    matchContent: { alignItems: 'center', paddingHorizontal: 28, width: '100%' },
    matchAvatars: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
    matchLink: {
      width: 44, height: 44, borderRadius: 22, marginHorizontal: -8, zIndex: 2,
      alignItems: 'center', justifyContent: 'center', backgroundColor: '#E94560', borderWidth: 3, borderColor: '#1A0A24',
    },
    matchTitle: { fontSize: 28, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 8 },
    matchSub: { fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22, marginBottom: 14 },
    matchEventPill: {
      flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 24,
    },
    matchEventText: { color: '#fff', fontSize: 13, fontWeight: '800', flexShrink: 1 },
    matchPrimary: {
      alignSelf: 'stretch', height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: '#E94560', marginBottom: 10,
    },
    matchPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '900' },
    matchSecondary: {
      alignSelf: 'stretch', height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    },
    matchSecondaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    matchSkip: { padding: 14 },
    matchSkipText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700' },
  });
}
