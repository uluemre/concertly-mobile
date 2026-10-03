import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { apiErrorMessage } from '../utils/communityErrors';

export default function FollowRequestsScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  // Satır başına devam eden istek: çift dokunuş yok sayılır
  const [busyIds, setBusyIds] = useState({});
  const busyRef = useRef(new Set());

  const fetchRequests = async () => {
    try {
      const res = await API.get('/users/me/follow-requests');
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      Alert.alert(t('error'), apiErrorMessage(err, t, 'follow_requests_load_error'));
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchRequests(); }, []));

  const respond = async (item, accept) => {
    if (busyRef.current.has(item.id)) return;
    busyRef.current.add(item.id);
    setBusyIds((prev) => ({ ...prev, [item.id]: true }));
    try {
      if (accept) await API.post(`/users/me/follow-requests/${item.id}/accept`);
      else await API.delete(`/users/me/follow-requests/${item.id}`);
      setRequests((prev) => prev.filter((r) => r.id !== item.id));
    } catch (err) {
      Alert.alert(t('error'), apiErrorMessage(err, t, 'follow_action_error'));
      fetchRequests(); // istek başka yerden iptal edilmiş olabilir
    } finally {
      busyRef.current.delete(item.id);
      setBusyIds((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  const renderItem = ({ item }) => {
    const busy = !!busyIds[item.id];
    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.rowMain}
          onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
          activeOpacity={0.8}
        >
          {item.profileImageUrl ? (
            <Image source={{ uri: item.profileImageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={22} color={colors.textSecondary} />
            </View>
          )}
          <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
        </TouchableOpacity>
        {busy ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.busy} />
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => respond(item, true)} activeOpacity={0.8}>
              <Text style={styles.acceptText}>{t('follow_request_accept')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => respond(item, false)} activeOpacity={0.8}>
              <Text style={styles.rejectText}>{t('follow_request_reject')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('follow_requests_title')}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={requests.length === 0 && styles.emptyContainer}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="person-add-outline" size={48} color={colors.textSecondary} style={styles.emptyEmoji} />
              <Text style={styles.emptyText}>{t('follow_requests_empty')}</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 40, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },

    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarPlaceholder: {
      width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center',
    },
    username: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '700', color: colors.text },
    actions: { flexDirection: 'row', gap: 8 },
    busy: { paddingHorizontal: 24 },
    acceptBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.primary },
    acceptText: { fontSize: 13, fontWeight: '600', color: '#fff' },
    rejectBtn: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
      borderWidth: 1.5, borderColor: colors.border,
    },
    rejectText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

    separator: { height: 1, backgroundColor: colors.border, marginLeft: 76 },
    emptyContainer: { flex: 1, justifyContent: 'center' },
    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyEmoji: { marginBottom: 12 },
    emptyText: { fontSize: 15, color: colors.textSecondary },
  });
}
