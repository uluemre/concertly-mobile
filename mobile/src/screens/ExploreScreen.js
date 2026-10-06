import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Animated, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - 48) / 2;

// tint: tema rengi anahtarı (colors[tint]) — kartlar düz, rengi yalnızca ikon taşır.
// Mor (purple) yardımcı renk olarak tek kartta.
const MENU_ITEM_DEFS = [
  { id: 1, titleKey: 'menu_communities', subKey: 'menu_communities_sub', icon: 'people-outline', tint: 'accent', screen: 'Communities', available: true },
  { id: 7, titleKey: 'menu_map_item', subKey: 'menu_map_item_sub', icon: 'map-outline', tint: 'accent', screen: 'Map', available: true },
  { id: 4, titleKey: 'menu_buddy_item', subKey: 'menu_buddy_item_sub', icon: 'person-add-outline', tint: 'secondary', screen: 'ConcertBuddyMatch', available: true },
  { id: 11, titleKey: 'menu_passport', subKey: 'menu_passport_sub', icon: 'ticket-outline', tint: 'purple', screen: 'ConcertPassport', available: true },
  { id: 9, titleKey: 'menu_games', subKey: 'menu_games_sub', icon: 'game-controller-outline', tint: 'primary', screen: 'Games', available: true },
  // Eksik konserleri kullanıcı bildirebilsin — Ticketmaster dışı veri kanalı
  { id: 12, titleKey: 'menu_suggest_event', subKey: 'menu_suggest_event_sub', icon: 'add-circle-outline', tint: 'secondary', screen: 'SuggestEvent', available: true },
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
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${isSetupCard ? t('menu_tap_to_start') : item.subtitle}`}
      >
        <View style={[styles.card, !item.available && styles.cardUnavailable]}>
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

          <Ionicons
            name={item.icon}
            size={30}
            color={item.available ? colors[item.tint] || colors.primary : colors.textSecondary}
            style={styles.cardIcon}
          />
          <Text style={[styles.cardTitle, !item.available && styles.cardTitleMuted]}>
            {item.title}
          </Text>
          <Text style={[styles.cardSubtitle, !item.available && styles.cardSubtitleMuted]}>
            {isSetupCard ? t('menu_tap_to_start') : item.subtitle}
          </Text>

          {item.available && (
            <View style={styles.arrowContainer}>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </View>
          )}
        </View>
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
  icon: 'settings-outline', tint: 'textSecondary',
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
      <View style={styles.header}>
        <Animated.View style={{ opacity: headerOpacity, transform: [{ translateY: headerAnim }] }}>
          <Text style={styles.headerLabel}>Concertly</Text>
          <Text style={styles.headerTitle}>{t('explore_title')}</Text>
          <Text style={styles.headerSub}>{t('explore_subtitle')}</Text>
        </Animated.View>
      </View>

      <View style={styles.grid}>
        {visibleItems.map((item, index) => (
          <AnimatedCard
            key={item.id}
            item={item}
            index={index}
            navigation={navigation}
            styles={styles}
            colors={colors}
            isSetupCard={item.id === 10 && !hasMusicProfile}
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
    },
    card: {
      width: '100%',
      height: CARD_SIZE,
      padding: 18,
      justifyContent: 'flex-end',
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
    },
    cardUnavailable: { backgroundColor: colors.cardAlt },
    badge: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: colors.cardAlt,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
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
      borderColor: colors.primary,
    },
    shimmerBar: {
      position: 'absolute',
      top: -20,
      bottom: -20,
      width: 48,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    setupBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    // Marka renginin üstündeki yazı her iki temada da beyaz kalır
    setupBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

    cardIcon: { marginBottom: 10 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 3 },
    cardTitleMuted: { color: colors.text },
    cardSubtitle: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
    cardSubtitleMuted: { color: colors.textSecondary },
    arrowContainer: { marginTop: 10 },

    footer: { alignItems: 'center', marginTop: 28, paddingHorizontal: 24 },
    footerText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  });
}
