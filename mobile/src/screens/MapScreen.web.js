import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';

// react-native-maps has no web implementation.  Metro resolves this file only
// for the web bundle, while iOS and Android keep using MapScreen.js.
export default function MapScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useLanguage();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/events')
      .then(({ data }) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <Text style={styles.title}>{t('map_title')}</Text>
        <Text style={styles.subtitle}>{t('map_events_count', { count: events.length })}</Text>
        <Text style={styles.notice}>Interactive map view is available in the iOS and Android app.</Text>
      </LinearGradient>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {events.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.card}
              onPress={() => navigation.navigate('EventDetail', { event })}
              accessibilityRole="button"
            >
              <Text style={styles.name}>{event.name}</Text>
              {!!event.artistName && <Text style={styles.detail}>{event.artistName}</Text>}
              {!!event.venueName && <Text style={styles.detail}>{event.venueName}</Text>}
            </TouchableOpacity>
          ))}
          {!events.length && <Text style={styles.empty}>{t('map_loading')}</Text>}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 18 },
    title: { color: colors.text, fontSize: 24, fontWeight: '800' },
    subtitle: { color: colors.textSecondary, marginTop: 4 },
    notice: { color: colors.textSecondary, fontSize: 12, marginTop: 12 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 16, gap: 10 },
    card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 16 },
    name: { color: colors.text, fontSize: 16, fontWeight: '700' },
    detail: { color: colors.textSecondary, marginTop: 4 },
    empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 24 },
  });
}
