import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, RefreshControl, FlatList, Dimensions, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const gradientSets = [
  ['#E94560', '#7C3AED'],
  ['#F5A623', '#E94560'],
  ['#00D4AA', '#7C3AED'],
  ['#7C3AED', '#F5A623'],
];

const eventEmojis = ['🎸', '🎤', '🥁', '🎹', '🎺', '🎻', '🎪', '🎭'];

export default function EventsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = () => {
    const city = global.userCity;
    const url = city ? `/events?city=${encodeURIComponent(city)}` : '/events';
    return API.get(url)
      .then(res => setEvents(res.data))
      .catch(err => {
        console.error('❌ Events Hatası:', err.response?.status, err.message, err.response?.data);
      });
  };

  useEffect(() => {
    fetchEvents().finally(() => setLoading(false));
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents().finally(() => setRefreshing(false));
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <Text style={styles.headerTitle}>🎟️ Etkinlikler</Text>
        <Text style={styles.headerSub}>{events.length} etkinlik bulundu</Text>
      </LinearGradient>

      <FlatList
        data={events}
        keyExtractor={item => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.cardWrapper}
            onPress={() => navigation.navigate('EventDetail', { event: item })}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={gradientSets[index % gradientSets.length]}
              style={styles.cardImage}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.cardEmoji}>
                {eventEmojis[index % eventEmojis.length]}
              </Text>
              <View style={styles.datePill}>
                <Text style={styles.datePillText}>
                  {new Date(item.eventDate).getDate()} {new Date(item.eventDate).toLocaleDateString('tr-TR', { month: 'short' })}
                </Text>
              </View>
            </LinearGradient>

            <View style={styles.cardBody}>
              <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
              {item.artistName && (
                <Text style={styles.cardArtist} numberOfLines={1}>🎤 {item.artistName}</Text>
              )}
              {item.venueCity && (
                <Text style={styles.cardCity} numberOfLines={1}>📍 {item.venueCity}</Text>
              )}
              <View style={[styles.statusDot, { backgroundColor: item.isApproved ? '#00D4AA' : '#F5A623' }]}>
                <Text style={styles.statusText}>{item.isApproved ? 'Onaylı' : 'Bekliyor'}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎭</Text>
            <Text style={styles.emptyText}>Henüz etkinlik yok</Text>
          </View>
        }
      />
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 24 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: colors.text },
    headerSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
    list: { padding: 16, paddingBottom: 32 },
    row: { justifyContent: 'space-between', marginBottom: 16 },

    cardWrapper: {
      width: CARD_WIDTH,
      backgroundColor: colors.card,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardImage: {
      width: '100%',
      height: 130,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    cardEmoji: { fontSize: 48 },
    datePill: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.4)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    datePillText: { color: '#fff', fontSize: 11, fontWeight: '700' },

    cardBody: { padding: 10 },
    cardName: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
    cardArtist: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
    cardCity: { fontSize: 11, color: colors.textSecondary, marginBottom: 6 },
    statusDot: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    statusText: { fontSize: 10, color: '#fff', fontWeight: '700' },

    empty: { alignItems: 'center', marginTop: 80 },
    emptyEmoji: { fontSize: 64, marginBottom: 16 },
    emptyText: { color: colors.textSecondary, fontSize: 16 },
  });
}
