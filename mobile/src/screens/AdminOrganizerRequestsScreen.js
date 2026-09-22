import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Linking, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import API from '../services/api';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';

/**
 * Organizatör/mekan/menajer başvuruları (admin).
 *
 * Onaylanan hesap etkinliklerini onay beklemeden yayınlayabilir — bu yüzden
 * kimlik doğrulaması (site/Instagram) elle inceleniyor.
 */
export default function AdminOrganizerRequestsScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await API.get('/admin/organizer-requests');
      setRequests(res.data || []);
    } catch {
      Alert.alert(t('error'), t('admin_organizer_load_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { fetchRequests(); }, [fetchRequests]));

  const decide = async (item, approve) => {
    setBusyId(item.id);
    try {
      const path = approve ? 'approve' : 'reject';
      await API.post(`/admin/organizer-requests/${item.id}/${path}`, approve ? {} : { note: null });
      setRequests((prev) => prev.filter((r) => r.id !== item.id));
    } catch {
      Alert.alert(t('error'), t('admin_organizer_action_error'));
    } finally {
      setBusyId(null);
    }
  };

  const openLink = (url) => {
    if (!url) return;
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(normalized).catch(() => {});
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.org}>{item.organizationName}</Text>
      <Text style={styles.meta}>@{item.username} · {item.type}</Text>

      {item.message ? <Text style={styles.message}>{item.message}</Text> : null}

      <View style={styles.linkRow}>
        {item.website ? (
          <TouchableOpacity style={styles.linkChip} onPress={() => openLink(item.website)}>
            <Text style={styles.linkChipText}>🌐 {t('admin_organizer_website')}</Text>
          </TouchableOpacity>
        ) : null}
        {item.instagram ? (
          <TouchableOpacity style={styles.linkChip} onPress={() => openLink(item.instagram)}>
            <Text style={styles.linkChipText}>📷 Instagram</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.reject]}
          onPress={() => decide(item, false)}
          disabled={busyId === item.id}
          activeOpacity={0.85}
        >
          <Text style={[styles.actionText, styles.rejectText]}>{t('admin_organizer_reject')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.approve]}
          onPress={() => decide(item, true)}
          disabled={busyId === item.id}
          activeOpacity={0.85}
        >
          <Text style={styles.actionText}>{t('admin_organizer_approve')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_organizer_title')}</Text>
        <Text style={styles.headerSub}>{t('admin_organizer_subtitle')}</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchRequests(); }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyText}>{t('admin_organizer_empty')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingTop: 56, paddingBottom: 22, paddingHorizontal: 20 },
    backButton: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
      marginBottom: 16,
    },
    backText: { fontSize: 14, color: '#fff', fontWeight: '700' },
    headerTitle: { fontSize: 24, fontWeight: '900', color: '#fff' },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
    listContent: { padding: 16, paddingBottom: 40 },
    card: {
      backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    org: { color: colors.text, fontSize: 17, fontWeight: '800' },
    meta: { color: colors.textSecondary, fontSize: 12.5, marginTop: 4 },
    message: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 19, marginTop: 10 },
    linkRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
    linkChip: {
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
      backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    },
    linkChipText: { color: colors.text, fontSize: 12.5, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    actionBtn: { flex: 1, paddingVertical: 11, borderRadius: 11, alignItems: 'center' },
    approve: { backgroundColor: '#00D4AA' },
    reject: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
    actionText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
    rejectText: { color: colors.text },
    empty: { alignItems: 'center', paddingTop: 70 },
    emptyEmoji: { fontSize: 44, marginBottom: 12 },
    emptyText: { color: colors.textSecondary, fontSize: 15 },
  });
