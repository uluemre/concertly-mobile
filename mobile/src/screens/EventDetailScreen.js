import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';

export default function EventDetailScreen({ route, navigation }) {
  const { event } = route.params;

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.heroSection}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.heroEmoji}>🎪</Text>
        <Text style={styles.heroTitle}>{event.name}</Text>
        <View style={styles.approvedBadge}>
          <Text style={styles.approvedText}>
            {event.isApproved ? '✅ Onaylandı' : '⏳ Onay Bekliyor'}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>📋 Etkinlik Hakkında</Text>
          <Text style={styles.description}>{event.description}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>📅 Tarih & Saat</Text>
          <Text style={styles.infoValue}>
            {new Date(event.eventDate).toLocaleDateString('tr-TR', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </Text>
          <Text style={styles.infoValueSub}>
            🕐 {new Date(event.eventDate).toLocaleTimeString('tr-TR', {
              hour: '2-digit', minute: '2-digit'
            })}
          </Text>
        </View>

        {event.artistName && (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>🎤 Sanatçı</Text>
            <Text style={styles.infoValue}>{event.artistName}</Text>
          </View>
        )}

        {event.venueName && (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>📍 Mekan</Text>
            <Text style={styles.infoValue}>{event.venueName}</Text>
            <Text style={styles.infoValueSub}>{event.venueCity}, {event.venueCountry}</Text>
          </View>
        )}

        <TouchableOpacity>
          <LinearGradient
            colors={['#F5A623', '#E94560']}
            style={styles.actionButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.actionButtonText}>🎟️ Etkinliğe Katıl</Text>
          </LinearGradient>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heroSection: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  backButton: { alignSelf: 'flex-start', marginBottom: 20 },
  backText: { fontSize: 16, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  heroEmoji: { fontSize: 64, marginBottom: 12 },
  heroTitle: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 12 },
  approvedBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  approvedText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  content: { padding: 16, gap: 12 },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  description: { fontSize: 15, color: colors.text, lineHeight: 22 },
  infoValue: { fontSize: 16, color: colors.text, fontWeight: '600' },
  infoValueSub: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  actionButton: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});