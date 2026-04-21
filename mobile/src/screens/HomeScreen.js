import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { colors } from '../theme';

const gradientSets = [
  ['#E94560', '#7C3AED'],
  ['#F5A623', '#E94560'],
  ['#00D4AA', '#7C3AED'],
  ['#7C3AED', '#E94560'],
];

export default function HomeScreen() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = () => {
    return API.get('/events')
      .then(res => setEvents(res.data))
      .catch(err => console.log('Hata:', err.message));
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
      <LinearGradient colors={['#0F0F1A', '#1A1A2E']} style={styles.header}>
        <Text style={styles.headerEmoji}>🎪</Text>
        <Text style={styles.headerTitle}>Concertly</Text>
        <Text style={styles.headerSub}>Yaklaşan etkinlikler</Text>
      </LinearGradient>

      <FlatList
        data={events}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        renderItem={({ item, index }) => (
          <LinearGradient
            colors={gradientSets[index % gradientSets.length]}
            style={styles.card}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.cardEmoji}>🎵</Text>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardDate}>
                📅 {new Date(item.eventDate).toLocaleDateString('tr-TR')}
              </Text>
              {item.venueName && (
                <Text style={styles.cardVenue}>📍 {item.venueCity}</Text>
              )}
            </View>
          </LinearGradient>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  headerEmoji: { fontSize: 32, marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: colors.text },
  headerSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  list: { padding: 16, gap: 16 },
  card: {
    borderRadius: 20,
    padding: 20,
    elevation: 4,
  },
  cardEmoji: { fontSize: 32, marginBottom: 8 },
  cardName: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  cardDate: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  cardVenue: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { color: colors.textSecondary, fontSize: 16 },
});