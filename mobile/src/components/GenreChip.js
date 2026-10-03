import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function GenreChip({ genre, emoji, selected, onToggle, index, accentColor }) {
  const scale = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      delay: index * 60,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (selected) {
      Animated.sequence([
        Animated.spring(pulse, { toValue: 0.92, useNativeDriver: true }),
        Animated.spring(pulse, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]).start();
    }
  }, [selected]);

  return (
    <Animated.View style={{ transform: [{ scale: Animated.multiply(scale, pulse) }] }}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onToggle(genre)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!selected }}
        accessibilityLabel={genre}
      >
        {/* emoji prop'u geriye dönük uyumluluk için alınır ama çizilmez */}
        {selected ? (
          <Animated.View style={[styles.chip, styles.chipSelected, { backgroundColor: accentColor }]}>
            <Ionicons name="checkmark" size={16} color="#fff" />
            <Text style={styles.label}>{genre}</Text>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.chip, styles.chipUnselected]}>
            <Ionicons name="add" size={16} color="#A0A0B0" />
            <Text style={[styles.label, styles.labelMuted]}>{genre}</Text>
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    margin: 4,
  },
  chipUnselected: {
    backgroundColor: '#1A1A2E',
    borderColor: '#2A2A3E',
  },
  chipSelected: {
    borderColor: 'rgba(255,255,255,0.2)',
  },
  label: { color: '#fff', fontSize: 14, fontWeight: '700' },
  labelMuted: { color: '#A0A0B0' },
});
