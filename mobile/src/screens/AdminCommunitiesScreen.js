import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API, { getErrorMessage } from '../services/api';

function waitingLabel(createdAt, t) {
  if (!createdAt) return '';
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  return days <= 0 ? t('admin_communities_waiting_today') : t('admin_communities_waiting_days', { days });
}

export default function AdminCommunitiesScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await API.get('/admin/communities/pending');
      setPending(res.data);
    } catch (err) {
      Alert.alert(t('error'), getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { fetchPending(); }, [fetchPending]));

  const review = async (id, action) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await API.post(`/admin/communities/${id}/${action}`);
      setPending(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      Alert.alert(t('error'), getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPending(); }} tintColor={colors.primary} />
      }
    >
      <LinearGradient colors={['#0A0A14', '#1a0a2e', '#0A0A14']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_communities_title')}</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      ) : pending.length === 0 ? (
        <Text style={styles.empty}>{t('admin_communities_empty')}</Text>
      ) : pending.map(c => (
        <View key={c.id} style={styles.card}>
          <View style={styles.cardTop}>
            <LinearGradient colors={[c.gradientStart || '#7C3AED', c.gradientEnd || '#E94560']} style={styles.art}>
              <Text style={styles.emoji}>{c.emoji}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.meta}>
                {c.city ? `${c.city} · ` : ''}{c.type} · {c.visibility}
              </Text>
              <Text style={styles.by}>
                {c.ownerUsername ? t('admin_communities_by', { user: c.ownerUsername }) : ''} · {waitingLabel(c.createdAt, t)}
              </Text>
            </View>
          </View>

          {!!c.description && <Text style={styles.desc} numberOfLines={3}>{c.description}</Text>}

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => review(c.id, 'approve')}
              disabled={busyId === c.id}
              style={[styles.btn, styles.approveBtn]}
              activeOpacity={0.85}
            >
              <Text style={styles.approveText}>✓ {t('admin_communities_approve')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => review(c.id, 'reject')}
              disabled={busyId === c.id}
              style={[styles.btn, styles.rejectBtn]}
              activeOpacity={0.85}
            >
              <Text style={styles.rejectText}>✕ {t('admin_communities_reject')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 22 },
    backButton: { alignSelf: 'flex-start', marginBottom: 12 },
    backText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    headerTitle: { color: colors.text, fontSize: 26, fontWeight: '900' },
    empty: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 60 },
    card: {
      marginHorizontal: 16, marginTop: 14, padding: 14,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    },
    cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    art: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    emoji: { fontSize: 26 },
    name: { color: colors.text, fontSize: 16, fontWeight: '800' },
    meta: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
    by: { color: colors.textSecondary, fontSize: 11, marginTop: 3 },
    desc: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 12 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
    approveBtn: { backgroundColor: '#00D4AA', borderColor: '#00D4AA' },
    approveText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    rejectBtn: { backgroundColor: 'transparent', borderColor: '#E94560' },
    rejectText: { color: '#E94560', fontSize: 14, fontWeight: '800' },
  });
}
