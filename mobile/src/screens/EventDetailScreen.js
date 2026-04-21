import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity
} from 'react-native';

export default function EventDetailScreen({ route, navigation }) {
  const { event } = route.params;

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Geri</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.eventName}>{event.name}</Text>
        <Text style={styles.eventDesc}>{event.description}</Text>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>📅</Text>
          <Text style={styles.infoText}>
            {new Date(event.eventDate).toLocaleDateString('tr-TR', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </Text>
        </View>

        {event.artistName && (
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🎤</Text>
            <Text style={styles.infoText}>{event.artistName}</Text>
          </View>
        )}

        {event.venueName && (
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>{event.venueName} / {event.venueCity}</Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {event.isApproved ? '✅ Onaylandı' : '⏳ Onay Bekliyor'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  backButton: { padding: 16, paddingTop: 50 },
  backText: { fontSize: 16, color: '#6C63FF', fontWeight: '600' },
  card: { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 20, elevation: 2 },
  eventName: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  eventDesc: { fontSize: 15, color: '#666', lineHeight: 22 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  infoIcon: { fontSize: 20, marginRight: 10 },
  infoText: { fontSize: 15, color: '#444', flex: 1 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#f0eeff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: '#6C63FF', fontWeight: '600' },
});