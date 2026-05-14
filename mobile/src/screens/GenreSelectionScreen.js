import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import GenreChip from '../components/GenreChip';

const GENRES = [
  { name: 'Rock', emoji: '🎸', accent: '#E94560' },
  { name: 'Pop', emoji: '🎤', accent: '#F5A623' },
  { name: 'Rap', emoji: '🎯', accent: '#00D4AA' },
  { name: 'Arabesk', emoji: '🎻', accent: '#7C3AED' },
  { name: 'Metal', emoji: '🤘', accent: '#E94560' },
  { name: 'Indie', emoji: '🎸', accent: '#00D4AA' },
  { name: 'Jazz', emoji: '🎷', accent: '#F5A623' },
  { name: 'Techno', emoji: '🎛️', accent: '#00D4AA' },
  { name: 'Electronic', emoji: '🎧', accent: '#7C3AED' },
  { name: 'K-Pop', emoji: '🌟', accent: '#E94560' },
  { name: 'Alternatif Rock', emoji: '🎸', accent: '#F5A623' },
  { name: 'Türkçe Rock', emoji: '🎸', accent: '#E94560' },
  { name: 'Lo-fi', emoji: '🎵', accent: '#00D4AA' },
  { name: 'Classical', emoji: '🎻', accent: '#7C3AED' },
];

export default function GenreSelectionScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const buttonPulse = useRef(new Animated.Value(1)).current;

  const canContinue = selectedGenres.length >= 3;

  const toggleGenre = (genre) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  useEffect(() => {
    if (canContinue) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(buttonPulse, { toValue: 1.04, duration: 800, useNativeDriver: true }),
          Animated.timing(buttonPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      buttonPulse.setValue(1);
    }
  }, [canContinue]);

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={styles.stepDot} />
        </View>

        <Text style={styles.title}>Hangi müzik türlerini seviyorsun?</Text>
        <Text style={styles.subtitle}>
          {canContinue
            ? `${selectedGenres.length}/14 tür seçildi`
            : 'En az 3 tür seçmelisin'}
        </Text>

        <View style={styles.genreGrid}>
          {GENRES.map((g, i) => (
            <GenreChip
              key={g.name}
              genre={g.name}
              emoji={g.emoji}
              selected={selectedGenres.includes(g.name)}
              onToggle={toggleGenre}
              index={i}
              accentColor={g.accent}
            />
          ))}
        </View>
      </View>

      <View style={styles.bottomBar}>
        <Text style={styles.countText}>
          {selectedGenres.length === 0
            ? 'Henüz tür seçmedin'
            : `${selectedGenres.length}/14 tür seçildi`}
        </Text>
        <Animated.View style={{ transform: [{ scale: buttonPulse }], width: '100%' }}>
          <TouchableOpacity
            disabled={!canContinue}
            onPress={() => navigation.navigate('ArtistSelection', {
              selectedGenres,
            })}
          >
            <LinearGradient
              colors={canContinue ? ['#E94560', '#7C3AED'] : ['#2A2A3E', '#2A2A3E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.button, !canContinue && styles.buttonDisabled]}
            >
              <Text style={[styles.buttonText, !canContinue && styles.buttonTextDisabled]}>
                {canContinue ? 'Devam Et' : 'En az 3 tür seç'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner: {
      flex: 1,
      paddingTop: 60,
      paddingHorizontal: 20,
    },
    stepIndicator: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 24,
    },
    stepDot: {
      width: 32,
      height: 4,
      borderRadius: 2,
      backgroundColor: '#2A2A3E',
    },
    stepDotActive: {
      backgroundColor: '#E94560',
      width: 48,
    },
    title: {
      color: colors.text,
      fontSize: 32,
      fontWeight: 'bold',
      marginBottom: 8,
      lineHeight: 40,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      marginBottom: 28,
    },
    genreGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    bottomBar: {
      paddingHorizontal: 20,
      paddingBottom: 36,
      paddingTop: 12,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    countText: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 10,
    },
    button: {
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: 'center',
      width: '100%',
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    buttonTextDisabled: {
      color: '#666',
    },
  });
}
