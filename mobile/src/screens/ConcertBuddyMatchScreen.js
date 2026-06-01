import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Dimensions, ScrollView, Image, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';

const { width, height } = Dimensions.get('window');

const GENRE_COLORS = {
  'Rock': '#E94560', 'Metal': '#7C3AED', 'Pop': '#F5A623',
  'Rap': '#3B82F6', 'Elektronik': '#00D4AA', 'Caz': '#F59E0B',
  'Indie': '#8B5CF6', 'Alternatif Rock': '#EC4899', 'Festival': '#10B981',
};

const CARD_GRADIENTS = [
  ['#E94560', '#7C3AED'],
  ['#00D4AA', '#3B82F6'],
  ['#F5A623', '#E94560'],
  ['#7C3AED', '#00D4AA'],
  ['#3B82F6', '#E94560'],
];

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function genreScore(score) {
  if (score >= 80) return { label: 'Mükemmel uyum 🔥', color: '#00D4AA' };
  if (score >= 50) return { label: 'İyi uyum ✨', color: '#F5A623' };
  if (score > 0) return { label: 'Farklı tatlar 🎵', color: '#7C3AED' };
  return { label: 'Keşfet 🎭', color: '#A0A0B0' };
}

// ── Eşleşme Animasyonu ────────────────────────────────────────────────────────
function MatchOverlay({ matchedUser, onClose, navigation }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.matchOverlay, { opacity: opacityAnim }]}>
      <LinearGradient colors={['#0A0A14EE', '#1A0A2EEE']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.matchContent, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.matchEmoji}>🎵</Text>
        <Text style={styles.matchTitle}>Konser Arkadaşı Buldun!</Text>
        <Text style={styles.matchSub}>
          Sen ve @{matchedUser.username} birbirinizi beğendi.{'\n'}Hadi birlikte konsere gidin!
        </Text>
        <View style={styles.matchAvatars}>
          <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.matchAvatar}>
            <Text style={styles.matchAvatarText}>Sen</Text>
          </LinearGradient>
          <Text style={styles.matchHeart}>❤️</Text>
          <LinearGradient colors={['#00D4AA', '#3B82F6']} style={styles.matchAvatar}>
            <Text style={styles.matchAvatarText}>
              {matchedUser.username?.charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
        </View>
        <TouchableOpacity
          style={styles.matchProfileBtn}
          onPress={() => { onClose(); navigation.navigate('UserProfile', { userId: matchedUser.userId }); }}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.matchProfileBtnGrad}>
            <Text style={styles.matchProfileBtnText}>Profili Gör →</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.matchSkipBtn}>
          <Text style={styles.matchSkipText}>Devam Et</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ── Ana Ekran ─────────────────────────────────────────────────────────────────
export default function ConcertBuddyMatchScreen({ navigation }) {
  const { colors } = useTheme();
  const { session } = useAuth();

  const [cards, setCards] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('discover'); // 'discover' | 'matches'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchedUser, setMatchedUser] = useState(null);
  const [swiping, setSwiping] = useState(false);

  const cardScale = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const likeAnim = useRef(new Animated.Value(0)).current;
  const passAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    fetchAll();
  }, []));

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cardsRes, matchesRes] = await Promise.all([
        API.get('/buddy/discover'),
        API.get('/buddy/matches'),
      ]);
      setCards(cardsRes.data);
      setMatches(matchesRes.data);
      setCurrentIndex(0);
    } catch (err) {
      console.log('Buddy fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];

  const animateSwipe = (liked) => {
    const anim = liked ? likeAnim : passAnim;
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();

    Animated.parallel([
      Animated.timing(cardScale, { toValue: 0.85, duration: 200, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(async () => {
      cardScale.setValue(1);
      cardOpacity.setValue(1);

      try {
        const res = await API.post('/buddy/swipe', {
          targetId: currentCard.userId,
          liked,
        });
        if (res.data.matched) {
          setMatchedUser(res.data.matchedUser);
          setMatches(prev => [...prev, res.data.matchedUser]);
        }
      } catch (err) {
        console.log('Swipe error:', err.message);
      } finally {
        setSwiping(false);
        setCurrentIndex(prev => prev + 1);
      }
    });
  };

  const handleSwipe = (liked) => {
    if (swiping || !currentCard) return;
    setSwiping(true);
    animateSwipe(liked);
  };

  const likeOverlayOpacity = likeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] });
  const passOverlayOpacity = passAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] });

  const renderCard = (card, isBack = false) => {
    if (!card) return null;
    const genres = card.favoriteGenres ? card.favoriteGenres.split(',').map(g => g.trim()).filter(Boolean) : [];
    const compat = genreScore(card.genreMatchScore || 0);

    return (
      <Animated.View
        style={[
          styles.card,
          isBack && styles.cardBack,
          !isBack && { opacity: cardOpacity, transform: [{ scale: cardScale }] },
        ]}
      >
        {/* Beğeni overlay */}
        {!isBack && (
          <>
            <Animated.View style={[styles.likeOverlay, { opacity: likeOverlayOpacity }]}>
              <Text style={styles.overlayText}>🎵 EVET</Text>
            </Animated.View>
            <Animated.View style={[styles.passOverlay, { opacity: passOverlayOpacity }]}>
              <Text style={styles.overlayText}>❌ PAS</Text>
            </Animated.View>
          </>
        )}

        {/* Avatar */}
        <LinearGradient
          colors={CARD_GRADIENTS[card.userId % CARD_GRADIENTS.length]}
          style={styles.cardAvatar}
        >
          {card.profileImageUrl ? (
            <Image source={{ uri: card.profileImageUrl }} style={styles.cardAvatarImg} />
          ) : (
            <Text style={styles.cardAvatarText}>
              {card.username?.charAt(0).toUpperCase()}
            </Text>
          )}
        </LinearGradient>

        {/* Uyum skoru */}
        <View style={[styles.compatBadge, { backgroundColor: compat.color + '22', borderColor: compat.color + '60' }]}>
          <Text style={[styles.compatText, { color: compat.color }]}>{compat.label}</Text>
        </View>

        {/* Kullanıcı bilgisi */}
        <Text style={styles.cardUsername}>@{card.username}</Text>
        {card.city ? <Text style={styles.cardCity}>📍 {card.city}</Text> : null}
        {card.bio ? <Text style={styles.cardBio} numberOfLines={2}>{card.bio}</Text> : null}

        {/* Türler */}
        {genres.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreRow}>
            {genres.slice(0, 4).map(g => (
              <View key={g} style={[styles.genreChip, { backgroundColor: (GENRE_COLORS[g] || '#7C3AED') + '30', borderColor: (GENRE_COLORS[g] || '#7C3AED') + '70' }]}>
                <Text style={[styles.genreChipText, { color: GENRE_COLORS[g] || '#7C3AED' }]}>{g}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Ortak konserler */}
        {card.sharedEvents?.length > 0 && (
          <View style={styles.sharedSection}>
            <Text style={styles.sharedTitle}>🎪 Ortak Konserler</Text>
            {card.sharedEvents.slice(0, 3).map(ev => (
              <View key={ev.id} style={styles.sharedEvent}>
                <Text style={styles.sharedEventName} numberOfLines={1}>{ev.name}</Text>
                <Text style={styles.sharedEventDate}>{formatDate(ev.eventDate)}</Text>
              </View>
            ))}
            {card.sharedEvents.length > 3 && (
              <Text style={styles.sharedMore}>+{card.sharedEvents.length - 3} etkinlik daha</Text>
            )}
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Geri</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>🎵 Konser Arkadaşı</Text>

        {/* Tab */}
        <View style={[styles.tabRow, { backgroundColor: colors.cardAlt }]}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'discover' && { backgroundColor: colors.primary }]}
            onPress={() => setActiveTab('discover')}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === 'discover' ? '#fff' : colors.textSecondary }]}>
              Keşfet
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'matches' && { backgroundColor: colors.primary }]}
            onPress={() => setActiveTab('matches')}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === 'matches' ? '#fff' : colors.textSecondary }]}>
              Eşleşmeler {matches.length > 0 ? `(${matches.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : activeTab === 'discover' ? (
        <>
          {/* Kart alanı */}
          <View style={styles.cardArea}>
            {currentIndex >= cards.length ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🎭</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Hepsi bu kadar!</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Daha fazla kişiyle eşleşmek için etkinliklere{'\n'}"Gidiyorum" ile katıl.
                </Text>
                <TouchableOpacity
                  onPress={fetchAll}
                  style={[styles.refreshBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.refreshBtnText}>Yenile</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Arka kart */}
                {nextCard && renderCard(nextCard, true)}
                {/* Öne kart */}
                {renderCard(currentCard)}
              </>
            )}
          </View>

          {/* Butonlar */}
          {currentIndex < cards.length && (
            <View style={styles.buttons}>
              <TouchableOpacity
                style={[styles.passBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleSwipe(false)}
                disabled={swiping}
                activeOpacity={0.8}
              >
                <Text style={styles.passBtnText}>❌</Text>
                <Text style={[styles.passBtnLabel, { color: colors.textSecondary }]}>Pas</Text>
              </TouchableOpacity>

              <View style={styles.counterWrap}>
                <Text style={[styles.counter, { color: colors.textSecondary }]}>
                  {currentIndex + 1} / {cards.length}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.likeBtn}
                onPress={() => handleSwipe(true)}
                disabled={swiping}
                activeOpacity={0.8}
              >
                <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.likeBtnGrad}>
                  <Text style={styles.likeBtnText}>🎵</Text>
                  <Text style={styles.likeBtnLabel}>Arkadaş</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        /* Eşleşmeler sekmesi */
        <ScrollView contentContainerStyle={styles.matchesList}>
          {matches.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💫</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Henüz eşleşme yok</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Keşfet sekmesinde konser arkadaşı bul!
              </Text>
            </View>
          ) : (
            matches.map((m, i) => (
              <TouchableOpacity
                key={m.userId}
                style={[styles.matchRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => navigation.navigate('UserProfile', { userId: m.userId })}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={CARD_GRADIENTS[i % CARD_GRADIENTS.length]}
                  style={styles.matchRowAvatar}
                >
                  {m.profileImageUrl ? (
                    <Image source={{ uri: m.profileImageUrl }} style={styles.matchRowAvatarImg} />
                  ) : (
                    <Text style={styles.matchRowAvatarText}>{m.username?.charAt(0).toUpperCase()}</Text>
                  )}
                </LinearGradient>
                <View style={styles.matchRowInfo}>
                  <Text style={[styles.matchRowUsername, { color: colors.text }]}>@{m.username}</Text>
                  {m.city ? <Text style={[styles.matchRowCity, { color: colors.textSecondary }]}>📍 {m.city}</Text> : null}
                  {m.favoriteGenres ? (
                    <Text style={[styles.matchRowGenres, { color: colors.textSecondary }]} numberOfLines={1}>
                      🎵 {m.favoriteGenres}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.matchRowChevron, { color: colors.textSecondary }]}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Eşleşme animasyonu */}
      {matchedUser && (
        <MatchOverlay
          matchedUser={matchedUser}
          onClose={() => setMatchedUser(null)}
          navigation={navigation}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, gap: 14 },
  backBtn: {},
  backText: { fontSize: 17, fontWeight: '700' },
  headerTitle: { fontSize: 22, fontWeight: '900' },

  tabRow: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  tabBtnText: { fontSize: 13, fontWeight: '700' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Kart alanı
  cardArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 20, paddingTop: 12,
  },
  card: {
    width: width - 40,
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#2A2A3E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    position: 'absolute',
  },
  cardBack: {
    transform: [{ scale: 0.94 }, { translateY: 12 }],
    opacity: 0.6,
  },

  // Overlay
  likeOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 24,
    backgroundColor: '#00D4AA',
    justifyContent: 'center', alignItems: 'center', zIndex: 5,
  },
  passOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 24,
    backgroundColor: '#E94560',
    justifyContent: 'center', alignItems: 'center', zIndex: 5,
  },
  overlayText: { fontSize: 28, fontWeight: '900', color: '#fff' },

  // Kart içeriği
  cardAvatar: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: 14, overflow: 'hidden',
  },
  cardAvatarImg: { width: 80, height: 80, borderRadius: 40 },
  cardAvatarText: { color: '#fff', fontSize: 32, fontWeight: '900' },

  compatBadge: {
    alignSelf: 'center', borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 12,
  },
  compatText: { fontSize: 12, fontWeight: '800' },

  cardUsername: { fontSize: 20, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 4 },
  cardCity: { fontSize: 13, color: '#A0A0B0', textAlign: 'center', marginBottom: 6 },
  cardBio: { fontSize: 13, color: '#C0C0D0', textAlign: 'center', lineHeight: 18, marginBottom: 10 },

  genreRow: { marginBottom: 14 },
  genreChip: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, marginRight: 6,
  },
  genreChipText: { fontSize: 11, fontWeight: '800' },

  sharedSection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, padding: 12,
  },
  sharedTitle: { fontSize: 12, fontWeight: '800', color: '#E94560', marginBottom: 8 },
  sharedEvent: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 4,
  },
  sharedEventName: { fontSize: 13, color: '#fff', fontWeight: '600', flex: 1 },
  sharedEventDate: { fontSize: 11, color: '#A0A0B0', marginLeft: 8 },
  sharedMore: { fontSize: 11, color: '#7C3AED', marginTop: 4, fontWeight: '700' },

  // Butonlar
  buttons: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 32, paddingBottom: 40, paddingTop: 16,
  },
  passBtn: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  passBtnText: { fontSize: 28 },
  passBtnLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  counterWrap: { alignItems: 'center' },
  counter: { fontSize: 13, fontWeight: '600' },
  likeBtn: {
    width: 80, height: 80, borderRadius: 40, overflow: 'hidden',
    shadowColor: '#E94560', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  likeBtnGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  likeBtnText: { fontSize: 30 },
  likeBtnLabel: { fontSize: 11, fontWeight: '800', color: '#fff', marginTop: 1 },

  // Boş durum
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  refreshBtn: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 16 },
  refreshBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Eşleşmeler listesi
  matchesList: { padding: 16, gap: 12 },
  matchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  matchRowAvatar: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  matchRowAvatarImg: { width: 52, height: 52, borderRadius: 26 },
  matchRowAvatarText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  matchRowInfo: { flex: 1 },
  matchRowUsername: { fontSize: 15, fontWeight: '800', marginBottom: 3 },
  matchRowCity: { fontSize: 12, marginBottom: 2 },
  matchRowGenres: { fontSize: 11 },
  matchRowChevron: { fontSize: 24, fontWeight: '300' },

  // Eşleşme overlay
  matchOverlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 100,
    justifyContent: 'center', alignItems: 'center',
  },
  matchContent: { alignItems: 'center', paddingHorizontal: 32 },
  matchEmoji: { fontSize: 72, marginBottom: 16 },
  matchTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 12, textAlign: 'center' },
  matchSub: { fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  matchAvatars: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 32 },
  matchAvatar: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
  },
  matchAvatarText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  matchHeart: { fontSize: 32 },
  matchProfileBtn: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 14 },
  matchProfileBtnGrad: { padding: 16, alignItems: 'center' },
  matchProfileBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  matchSkipBtn: { padding: 12 },
  matchSkipText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
});
