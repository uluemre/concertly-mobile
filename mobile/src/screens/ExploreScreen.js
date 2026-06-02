import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Animated, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - 48) / 2;

const MENU_ITEM_DEFS = [
  { id: 1, titleKey: 'menu_communities',   subKey: 'menu_communities_sub',   emoji: '👥', gradient: ['#00D4AA', '#7C3AED'], screen: 'Communities',       available: true  },
  { id: 2, titleKey: 'menu_events_item',   subKey: 'menu_events_item_sub',   emoji: '🎵', gradient: ['#E94560', '#7C3AED'], screen: 'Events',            available: true  },
  { id: 3, titleKey: 'menu_feed_item',     subKey: 'menu_feed_item_sub',     emoji: '🔥', gradient: ['#F5A623', '#E94560'], screen: 'FeedTab',           available: true  },
  { id: 6, titleKey: 'menu_music_profile', subKey: 'menu_music_profile_sub', emoji: '✨', gradient: ['#7C3AED', '#E94560'], screen: 'MusicProfile',      available: true  },
  { id: 7, titleKey: 'menu_map_item',      subKey: 'menu_map_item_sub',      emoji: '🗺️', gradient: ['#00D4AA', '#00A8FF'], screen: 'Map',               available: true  },
  { id: 4, titleKey: 'menu_buddy_item',    subKey: 'menu_buddy_item_sub',    emoji: '🎸', gradient: ['#E94560', '#F5A623'], screen: 'ConcertBuddyMatch', available: true  },
  { id: 5, titleKey: 'menu_live_rooms',    subKey: 'menu_live_rooms_sub',    emoji: '💬', gradient: ['#FF6B35', '#F7C59F'], screen: null,                available: false },
  { id: 8, titleKey: 'menu_ticket_alerts', subKey: 'menu_ticket_alerts_sub', emoji: '🔔', gradient: ['#1a1a2e', '#0f3460'], screen: null,                available: false },
];

function AnimatedCard({ item, index, navigation, styles, colors, isSetupCard }) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.35)).current;
  const shimmerX = useRef(new Animated.Value(-CARD_SIZE - 50)).current;
  const shimmerTimer = useRef(null);

  const startShimmer = useCallback(() => {
    shimmerX.setValue(-CARD_SIZE - 50);
    Animated.timing(shimmerX, {
      toValue: CARD_SIZE + 50,
      duration: 650,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        shimmerTimer.current = setTimeout(startShimmer, 2800);
      }
    });
  }, [shimmerX]);

  useEffect(() => {
    let glowLoop = null;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: index * 80,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        delay: index * 80,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (isSetupCard) {
        startShimmer();
        glowLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(glowOpacity, { toValue: 1, duration: 1400, useNativeDriver: true }),
            Animated.timing(glowOpacity, { toValue: 0.35, duration: 1400, useNativeDriver: true }),
          ])
        );
        glowLoop.start();
      }
    });

    return () => {
      if (shimmerTimer.current) clearTimeout(shimmerTimer.current);
      glowLoop?.stop();
    };
  }, [isSetupCard, startShimmer]);

  const { t } = useLanguage();

  const handlePress = () => {
    if (!item.available) {
      Alert.alert(
        t('explore_coming_soon'),
        `${item.title}${t('explore_coming_soon_msg')}`,
        [{ text: t('confirm') }]
      );
      return;
    }
    if (isSetupCard) {
      navigation.navigate('GenreSelection');
      return;
    }
    navigation.navigate(item.screen);
  };

  return (
    <Animated.View style={[
      styles.cardWrapper,
      { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
    ]}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.82}
        style={styles.cardTouchable}
      >
        <LinearGradient
          colors={item.available ? item.gradient : [colors.cardAlt, colors.card]}
          style={styles.card}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardCircle} />

          {isSetupCard && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.shimmerBar,
                { transform: [{ translateX: shimmerX }, { rotate: '25deg' }] },
              ]}
            />
          )}

          {!item.available && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('menu_coming_soon_badge')}</Text>
            </View>
          )}

          {isSetupCard && (
            <View style={styles.setupBadge}>
              <Text style={styles.setupBadgeText}>{t('menu_create_badge')}</Text>
            </View>
          )}

          <Text style={styles.cardEmoji}>{item.emoji}</Text>
          <Text style={[styles.cardTitle, !item.available && styles.cardTitleMuted]}>
            {item.title}
          </Text>
          <Text style={[styles.cardSubtitle, !item.available && styles.cardSubtitleMuted]}>
            {isSetupCard ? t('menu_tap_to_start') : item.subtitle}
          </Text>

          {item.available && (
            <View style={styles.arrowContainer}>
              <Text style={styles.arrow}>→</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {isSetupCard && (
        <Animated.View
          pointerEvents="none"
          style={[styles.glowRing, { opacity: glowOpacity }]}
        />
      )}
    </Animated.View>
  );
}

const ADMIN_ITEM_DEF = {
  id: 99, titleKey: 'menu_admin', subKey: 'menu_admin_sub',
  emoji: '⚙️', gradient: ['#1a1a2e', '#7C3AED'],
  screen: 'Admin', available: true, requiresAdmin: true,
};

export default function ExploreScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t } = useLanguage();
  const headerAnim = useRef(new Animated.Value(-30)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  const menuItems = useMemo(() =>
    MENU_ITEM_DEFS.map(d => ({ ...d, title: t(d.titleKey), subtitle: t(d.subKey) })),
    [t]
  );

  const hasMusicProfile = !!(session.favoriteGenres?.trim());
  const adminMenuItem = useMemo(() => ({ ...ADMIN_ITEM_DEF, title: t(ADMIN_ITEM_DEF.titleKey), subtitle: t(ADMIN_ITEM_DEF.subKey) }), [t]);
  const visibleItems = session.isAdmin
    ? [...menuItems, adminMenuItem]
    : menuItems;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }),
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <Animated.View style={{ opacity: headerOpacity, transform: [{ translateY: headerAnim }] }}>
          <Text style={styles.headerLabel}>Concertly</Text>
          <Text style={styles.headerTitle}>{t('explore_title')}</Text>
          <Text style={styles.headerSub}>{t('explore_subtitle')}</Text>
        </Animated.View>
      </LinearGradient>

      <View style={styles.grid}>
        {visibleItems.map((item, index) => (
          <AnimatedCard
            key={item.id}
            item={item}
            index={index}
            navigation={navigation}
            styles={styles}
            colors={colors}
            isSetupCard={item.id === 6 && !hasMusicProfile}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('menu_footer')}</Text>
      </View>
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: 32 },

    header: { paddingTop: 64, paddingBottom: 28, paddingHorizontal: 24 },
    headerLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
    headerTitle: { fontSize: 32, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
    headerSub: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 20, gap: 14 },

    cardWrapper: { width: CARD_SIZE },
    cardTouchable: {
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 12,
      elevation: 8,
    },
    card: {
      width: '100%',
      height: CARD_SIZE,
      padding: 18,
      justifyContent: 'flex-end',
      position: 'relative',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardCircle: {
      position: 'absolute',
      top: -30,
      right: -30,
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    badge: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    badgeText: { color: colors.textSecondary, fontSize: 10, fontWeight: '700' },

    glowRing: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 22,
      borderWidth: 2,
      borderColor: '#A855F7',
    },
    shimmerBar: {
      position: 'absolute',
      top: -20,
      bottom: -20,
      width: 48,
      backgroundColor: 'rgba(255,255,255,0.28)',
    },
    setupBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: 'rgba(168, 85, 247, 0.35)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(168, 85, 247, 0.6)',
    },
    setupBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

    cardEmoji: { fontSize: 36, marginBottom: 10 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 3 },
    cardTitleMuted: { color: colors.text },
    cardSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 16 },
    cardSubtitleMuted: { color: colors.textSecondary },
    arrowContainer: { marginTop: 10 },
    arrow: { color: 'rgba(255,255,255,0.9)', fontSize: 18, fontWeight: 'bold' },

    footer: { alignItems: 'center', marginTop: 28, paddingHorizontal: 24 },
    footerText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  });
}
