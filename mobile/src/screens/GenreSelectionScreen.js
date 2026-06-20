import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import GenreChip from '../components/GenreChip';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import CityPicker from '../components/CityPicker';

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

export default function GenreSelectionScreen({ navigation, route }) {
  const editMode = route.params?.editMode ?? false;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t } = useLanguage();

  const initialGenres = editMode && session.favoriteGenres
    ? session.favoriteGenres.split(',').map(g => g.trim()).filter(Boolean)
    : [];
  const [selectedGenres, setSelectedGenres] = useState(initialGenres);
  const [selectedCity, setSelectedCity] = useState(session.userCity || null);
  const buttonPulse = useRef(new Animated.Value(1)).current;

  const canContinue = selectedGenres.length >= 3 && !!selectedCity;

  const toggleGenre = (genre) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  useEffect(() => {
    let anim = null;
    if (canContinue) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(buttonPulse, { toValue: 1.04, duration: 800, useNativeDriver: true }),
          Animated.timing(buttonPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      anim.start();
    } else {
      buttonPulse.setValue(1);
    }
    return () => { anim?.stop(); };
  }, [canContinue]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.inner} contentContainerStyle={styles.innerContent} showsVerticalScrollIndicator={false}>
        {editMode ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{t('back')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepDot} />
          </View>
        )}

        {/* ŞEHİR */}
        <Text style={styles.cityLabel}>{t('onb_city_label')}</Text>
        <Text style={styles.cityHint}>{t('onb_city_hint')}</Text>
        <View style={styles.cityPickerWrap}>
          <CityPicker
            value={selectedCity}
            onChange={setSelectedCity}
            colors={colors}
            t={t}
          />
        </View>

        <Text style={styles.title}>{t('genre_title')}</Text>
        <Text style={styles.subtitle}>
          {selectedGenres.length >= 3
            ? t('genre_sub_enough', { count: selectedGenres.length })
            : t('genre_sub_need')}
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
      </ScrollView>

      <View style={styles.bottomBar}>
        <Text style={styles.countText}>
          {!selectedCity
            ? t('onb_need_city')
            : selectedGenres.length === 0
            ? t('genre_count_none')
            : t('genre_sub_enough', { count: selectedGenres.length })}
        </Text>
        <Animated.View style={{ transform: [{ scale: buttonPulse }], width: '100%' }}>
          <TouchableOpacity
            disabled={!canContinue}
            onPress={() => navigation.navigate('ArtistSelection', {
              selectedGenres,
              selectedCity,
              editMode,
            })}
          >
            <LinearGradient
              colors={canContinue ? ['#E94560', '#7C3AED'] : ['#2A2A3E', '#2A2A3E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.button, !canContinue && styles.buttonDisabled]}
            >
              <Text style={[styles.buttonText, !canContinue && styles.buttonTextDisabled]}>
                {canContinue ? t('genre_continue') : t('genre_need_more')}
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
    innerContent: {
      paddingBottom: 24,
    },
    cityLabel: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 4,
    },
    cityHint: {
      color: colors.textSecondary,
      fontSize: 13,
      marginBottom: 14,
    },
    cityPickerWrap: {
      marginBottom: 28,
    },
    backBtn: { marginBottom: 24 },
    backText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
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
