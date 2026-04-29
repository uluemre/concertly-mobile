import React, { useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Animated, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - 48) / 2;

const menuItems = [
  {
    id: 1,
    title: 'Etkinlikler',
    subtitle: 'Konserleri keşfet',
    emoji: '🎵',
    gradient: ['#E94560', '#7C3AED'],
    screen: 'Events',
    available: true,
  },
  {
    id: 2,
    title: 'Feed & Postlar',
    subtitle: 'Trending içerikler',
    emoji: '🔥',
    gradient: ['#F5A623', '#E94560'],
    screen: 'FeedTab',
    available: true,
  },
  {
    id: 3,
    title: 'Harita',
    subtitle: 'Yakınımdaki konserler',
    emoji: '🗺️',
    gradient: ['#00D4AA', '#0066FF'],
    screen: null,
    available: false,
  },
  {
    id: 4,
    title: 'Sanatçılar',
    subtitle: 'Favorilerini takip et',
    emoji: '🎤',
    gradient: ['#7C3AED', '#E94560'],
    screen: null,
    available: false,
  },
  {
    id: 5,
    title: 'Bildirimler',
    subtitle: 'Haberlerin burada',
    emoji: '🔔',
    gradient: ['#FF6B35', '#F7C59F'],
    screen: null,
    available: false,
  },
  {
    id: 6,
    title: 'Arkadaşlar',
    subtitle: 'Takip ettiklerin',
    emoji: '👥',
    gradient: ['#00D4AA', '#7C3AED'],
    screen: null,
    available: false,
  },
];

function AnimatedCard({ item, index, navigation, styles }) {
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
    ]).start();
  }, []);

  const handlePress = () => {
    if (!item.available) {
      Alert.alert(
        '🚧 Yakında!',
        `${item.title} özelliği çok yakında geliyor. Takipte kal! 🎉`,
        [{ text: 'Tamam' }]
      );
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
          colors={item.available ? item.gradient : ['#1E1E30', '#252538']}
          style={styles.card}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardCircle} />

          {!item.available && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Yakında</Text>
            </View>
          )}

          <Text style={styles.cardEmoji}>{item.emoji}</Text>
          <Text style={[styles.cardTitle, !item.available && styles.cardTitleMuted]}>
            {item.title}
          </Text>
          <Text style={[styles.cardSubtitle, !item.available && styles.cardSubtitleMuted]}>
            {item.subtitle}
          </Text>

          {item.available && (
            <View style={styles.arrowContainer}>
              <Text style={styles.arrow}>→</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ExploreScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const headerAnim    = useRef(new Animated.Value(-30)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

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
      {/* HEADER */}
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <Animated.View style={{ opacity: headerOpacity, transform: [{ translateY: headerAnim }] }}>
          <Text style={styles.headerLabel}>Hoş geldin 👋</Text>
          <Text style={styles.headerTitle}>Keşfet</Text>
          <Text style={styles.headerSub}>
            Concertly'nin tüm özelliklerine buradan ulaş
          </Text>
        </Animated.View>
      </LinearGradient>

      {/* GRID */}
      <View style={styles.grid}>
        {menuItems.map((item, index) => (
          <AnimatedCard
            key={item.id}
            item={item}
            index={index}
            navigation={navigation}
            styles={styles}
          />
        ))}
      </View>

      {/* ALT BİLGİ */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>🚀 Yeni özellikler her ay ekleniyor</Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 32 },

  header: { paddingTop: 64, paddingBottom: 28, paddingHorizontal: 24 },
  headerLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 4, letterSpacing: 0.5 },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: colors.text, marginBottom: 8, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 20, gap: 14 },

  cardWrapper: { width: CARD_SIZE },
  cardTouchable: {
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  card: {
    width: '100%', height: CARD_SIZE,
    padding: 18, justifyContent: 'flex-end',
    position: 'relative', overflow: 'hidden',
  },
  cardCircle: {
    position: 'absolute', top: -30, right: -30,
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  badge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  badgeText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  cardEmoji: { fontSize: 36, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 3 },
  cardTitleMuted: { color: 'rgba(255,255,255,0.45)' },
  cardSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 16 },
  cardSubtitleMuted: { color: 'rgba(255,255,255,0.3)' },
  arrowContainer: { marginTop: 10 },
  arrow: { color: 'rgba(255,255,255,0.9)', fontSize: 18, fontWeight: 'bold' },

  footer: { alignItems: 'center', marginTop: 28, paddingHorizontal: 24 },
  footerText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
});
