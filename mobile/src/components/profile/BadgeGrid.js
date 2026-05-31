import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function BadgeGrid({ badges }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.grid}>
      {badges.map(item => (
        <View key={item.id} style={[styles.card, !item.earned && styles.cardLocked]}>
          <LinearGradient
            colors={item.earned ? ['#7C3AED', '#E94560'] : ['#444', '#333']}
            style={styles.iconBg}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={[styles.icon, !item.earned && styles.iconLocked]}>
              {item.earned ? item.icon : '🔒'}
            </Text>
          </LinearGradient>
          <Text style={[styles.name, !item.earned && styles.textLocked]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.desc, !item.earned && styles.textLocked]} numberOfLines={2}>
            {item.description}
          </Text>
          {item.earned ? (
            <Text style={styles.date}>
              {new Date(item.earnedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
            </Text>
          ) : item.required > 0 && (
            <View style={styles.progressWrap}>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${Math.round((item.progress / item.required) * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>{item.progress}/{item.required}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    card: {
      width: CARD_WIDTH, backgroundColor: colors.card,
      borderRadius: 16, padding: 14, alignItems: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    cardLocked: { opacity: 0.55 },
    iconBg: {
      width: 56, height: 56, borderRadius: 28,
      justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    },
    icon: { fontSize: 26 },
    iconLocked: { opacity: 0.7 },
    name: { fontSize: 13, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 4 },
    textLocked: { color: colors.textSecondary },
    desc: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', lineHeight: 15, marginBottom: 6 },
    date: { fontSize: 10, color: colors.primary, fontWeight: '700' },
    progressWrap: { width: '100%', alignItems: 'center', gap: 3 },
    progressBg: { width: '100%', height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: 4, backgroundColor: '#7C3AED', borderRadius: 2 },
    progressText: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  });
}
