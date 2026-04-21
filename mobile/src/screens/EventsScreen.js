import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { colors } from '../theme';

export default function EventsScreen({ navigation }) {
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
        <Text style={styles.headerTitle}>🎵 Etkinlikler</Text>
        <Text style={styles.headerSub}>{events.length} etkinlik bulundu</Text>
      </LinearGradient>

      <FlatList
        data={events}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('EventDetail', { event: item })}
            activeOpacity={0.85}
          >
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.dateBox}>
                  <Text style={styles.dateDay}>
                    {new Date(item.eventDate).getDate()}
                  </Text>
                  <Text style={styles.dateMonth}>
                    {new Date(item.eventDate).toLocaleDateString('tr-TR', { month: 'short' })}
                  </Text>
                </LinearGradient>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                <View style={styles.cardTags}>
                  {item.artistName && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>🎤 {item.artistName}</Text>
                    </View>
                  )}
                  {item.venueName && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>📍 {item.venueCity}</Text>
                    </View>
                  )}
                </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 24 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: colors.text },
  headerSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLeft: { alignItems: 'center' },
  dateBox: {
    width: 52,
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  dateMonth: { fontSize: 11, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' },
  cardRight: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  cardTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { backgroundColor: '#2A2A3E', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 11, color: colors.textSecondary },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { color: colors.textSecondary, fontSize: 16 },
});