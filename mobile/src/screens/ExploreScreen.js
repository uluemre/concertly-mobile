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
    title: 'Topluluklar',
    subtitle: 'Müzik zevkine göre gruplar',
    emoji: '👥',
    gradient: ['#00D4AA', '#7C3AED'],
    screen: 'Communities',
    available: true,
  },
  {
    id: 2,
    title: 'Etkinlikler',
    subtitle: 'Konser ve festivalleri listele',
    emoji: '🎵',
    gradient: ['#E94560', '#7C3AED'],
    screen: 'Events',
    available: true,
  },
  {
    id: 3,
    title: 'Feed',
    subtitle: 'Postları ve trendleri gör',
    emoji: '🔥',
    gradient: ['#F5A623', '#E94560'],
    screen: 'FeedTab',
    available: true,
  },
  {
    id: 4,
    title: 'Konser Ekipleri',
    subtitle: 'Aynı konsere gidenleri bul',
    emoji: '🤝',
    gradient: ['#00A8FF', '#00D4AA'],
    screen: null,
    available: false,
  },
  {
    id: 5,
    title: 'Canlı Odalar',
    subtitle: 'Etkinlik günü sohbetleri',
    emoji: '💬',
    gradient: ['#FF6B35', '#F7C59F'],
    screen: null,
    available: false,
  },
  {
    id: 6,
    title: 'Müzik Profili',
    subtitle: 'Zevkine göre eşleşmeler',
    emoji: '✨',
    gradient: ['#7C3AED', '#E94560'],
    screen: null,
    available: false,
  },
];

function AnimatedCard({ item, index, navigation, styles, colors }) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
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
        'Yakında!',
        `${item.title} özelliği çok yakında geliyor.`,
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
          colors={item.available ? item.gradient : [colors.cardAlt, colors.card]}
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
  const headerAnim = useRef(new Animated.Value(-30)).current;
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
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <Animated.View style={{ opacity: headerOpacity, transform: [{ translateY: headerAnim }] }}>
          <Text style={styles.headerLabel}>Concertly</Text>
          <Text style={styles.headerTitle}>Menü</Text>
          <Text style={styles.headerSub}>
            Konser, post ve hesap araçlarına buradan ulaş
          </Text>
        </Animated.View>
      </LinearGradient>

      <View style={styles.grid}>
        {menuItems.map((item, index) => (
          <AnimatedCard
            key={item.id}
            item={item}
            index={index}
            navigation={navigation}
            styles={styles}
            colors={colors}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Yeni özellikler hazır oldukça burada açılacak</Text>
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

    cardEmoji: { fontSize: 36, marginBottom: 10 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 3 },
    cardTitleMuted: { color: colors.text },
    cardSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 16 },
    cardSubtitleMuted: { color: colors.textSecondary },
    arrowContainer: { marginTop: 10 },
    arrow: { color: 'rgba(255,255,255,0.9)', fontSize: 18, fontWeight: 'bold' },

    footer: { alignItems: 'center', marginTop: 28, paddingHorizontal: 24 },
    footerText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  });
}
