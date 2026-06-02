import React, { useEffect, useRef, createContext, useContext } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';

const { width } = Dimensions.get('window');

// Tek shared shimmer değeri — tüm kutular senkron kayar
const ShimmerContext = createContext(null);

export function ShimmerProvider({ children }) {
  const shimmerX = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, {
          toValue: width * 1.5,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerX, {
          toValue: -width,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <ShimmerContext.Provider value={shimmerX}>
      {children}
    </ShimmerContext.Provider>
  );
}

function SkeletonBox({ w, h, radius = 8, style }) {
  const { colors } = useTheme();
  const shimmerX = useContext(ShimmerContext);

  return (
    <View
      style={[
        {
          width: w,
          height: h,
          borderRadius: radius,
          backgroundColor: colors.cardAlt || '#1E1E2E',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {shimmerX && (
        <Animated.View
          style={{
            flex: 1,
            width: width * 0.45,
            transform: [{ translateX: shimmerX }],
          }}
        >
          <LinearGradient
            colors={['transparent', (colors.border || '#2A2A3E') + 'CC', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </View>
  );
}

// ── EventsScreen grid skeleton ────────────────────────────────────────────────
const CARD_W = (width - 48) / 2;

function EventCardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SkeletonBox w="100%" h={120} radius={0} />
      <View style={styles.eventBody}>
        <SkeletonBox w="85%" h={13} radius={6} style={{ marginBottom: 8 }} />
        <SkeletonBox w="60%" h={11} radius={6} style={{ marginBottom: 6 }} />
        <SkeletonBox w="40%" h={11} radius={6} />
      </View>
    </View>
  );
}

export function EventsSkeletonPage() {
  return (
    <ShimmerProvider>
      <View style={styles.eventsGrid}>
        {Array.from({ length: 6 }, (_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </View>
    </ShimmerProvider>
  );
}

// ── HomeScreen skeleton ───────────────────────────────────────────────────────
function FeaturedCardSkeleton() {
  const { colors } = useTheme();
  const FEAT_W = width * 0.74;
  return (
    <View style={[styles.featCard, { width: FEAT_W, backgroundColor: colors.card, borderColor: colors.border }]}>
      <SkeletonBox w="100%" h={150} radius={0} />
      <View style={styles.featBody}>
        <SkeletonBox w="75%" h={14} radius={6} style={{ marginBottom: 10 }} />
        <SkeletonBox w="50%" h={11} radius={6} />
      </View>
    </View>
  );
}

function EventRowSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.rowSkeleton, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SkeletonBox w={56} h={56} radius={10} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBox w="70%" h={13} radius={6} />
        <SkeletonBox w="45%" h={11} radius={6} />
      </View>
    </View>
  );
}

export function HomeSkeletonPage() {
  return (
    <ShimmerProvider>
      <View style={styles.homePage}>
        {/* Kategori chips */}
        <View style={styles.chips}>
          {[60, 72, 56, 68, 80].map((w, i) => (
            <SkeletonBox key={i} w={w} h={34} radius={20} />
          ))}
        </View>

        {/* Section title */}
        <SkeletonBox w={130} h={16} radius={6} style={{ marginBottom: 16 }} />

        {/* Featured cards */}
        <View style={styles.featRow}>
          <FeaturedCardSkeleton />
          <FeaturedCardSkeleton />
        </View>

        {/* Upcoming title */}
        <SkeletonBox w={170} h={16} radius={6} style={{ marginTop: 24, marginBottom: 16 }} />

        {/* Event rows */}
        {[0, 1, 2, 3].map(i => <EventRowSkeleton key={i} />)}
      </View>
    </ShimmerProvider>
  );
}

const styles = StyleSheet.create({
  // Events
  eventCard: {
    width: CARD_W,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  eventBody: { padding: 10 },
  eventsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: 14,
  },

  // Home
  homePage: { paddingHorizontal: 20 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  featRow: { flexDirection: 'row', gap: 12 },
  featCard: { borderRadius: 18, overflow: 'hidden', borderWidth: 1 },
  featBody: { padding: 12 },
  rowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
});
