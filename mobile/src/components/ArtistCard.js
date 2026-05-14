import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ArtistCard({ artist, selected, onToggle, index }) {
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        delay: index * 70,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        delay: index * 70,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.93, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    onToggle(artist.id);
  };

  const firstLetter = (artist.name || '?').charAt(0).toUpperCase();

  return (
    <Animated.View style={{
      transform: [{ translateY }, { scale }],
      opacity,
      width: '48%',
    }}>
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress}>
        <View style={[styles.card, selected && styles.cardSelected]}>
          {artist.imageUrl ? (
            <Image source={{ uri: artist.imageUrl }} style={styles.image} />
          ) : (
            <LinearGradient
              colors={['#1A1A2E', '#2A2A3E']}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{firstLetter}</Text>
            </LinearGradient>
          )}

          <Text style={styles.name} numberOfLines={1}>{artist.name}</Text>

          {artist.genre && (
            <View style={styles.genrePill}>
              <Text style={styles.genreText}>{artist.genre}</Text>
            </View>
          )}

          {selected && (
            <View style={styles.checkOverlay}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: '#E94560',
    borderWidth: 2,
    shadowColor: '#E94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: {
    color: '#E94560',
    fontSize: 28,
    fontWeight: '900',
  },
  name: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  genrePill: {
    backgroundColor: 'rgba(233,69,96,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  genreText: {
    color: '#E94560',
    fontSize: 10,
    fontWeight: '700',
  },
  checkOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E94560',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
});
