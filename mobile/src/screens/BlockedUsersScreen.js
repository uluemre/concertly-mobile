import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, Alert,
} from 'react-native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';

export default function BlockedUsersScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState(null);

  useEffect(() => {
    fetchBlocked();
  }, []);

  const fetchBlocked = async () => {
    try {
      const res = await API.get('/users/blocked');
      setUsers(res.data);
    } catch {
      Alert.alert(t('error'), t('mod_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = (user) => {
    Alert.alert(t('blocked_unblock_title'), t('blocked_unblock_msg'), [
      { text: t('mod_cancel'), style: 'cancel' },
      {
        text: t('mod_unblock'), onPress: async () => {
          setPendingId(user.id);
          try {
            await API.delete(`/users/${user.id}/block`);
            setUsers(prev => prev.filter(u => u.id !== user.id));
          } catch {
            Alert.alert(t('error'), t('mod_error'));
          } finally {
            setPendingId(null);
          }
        },
      },
    ]);
  };

  const renderUser = ({ item }) => (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.userInfo}
        onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
        activeOpacity={0.8}
      >
        {item.profileImageUrl ? (
          <Image source={{ uri: item.profileImageUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.username}>@{item.username}</Text>
          {item.city ? <Text style={styles.city}>{item.city}</Text> : null}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.unblockBtn}
        onPress={() => handleUnblock(item)}
        disabled={pendingId === item.id}
        activeOpacity={0.8}
      >
        {pendingId === item.id
          ? <ActivityIndicator size="small" color={colors.primary} />
          : <Text style={styles.unblockBtnText}>{t('mod_unblock')}</Text>}
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('blocked_title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={users}
        keyExtractor={item => String(item.id)}
        renderItem={renderUser}
        contentContainerStyle={users.length === 0 && styles.emptyContainer}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🚫</Text>
            <Text style={styles.emptyText}>{t('blocked_empty')}</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 56,
      paddingBottom: 16,
      paddingHorizontal: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { width: 40, alignItems: 'center' },
    backText: { fontSize: 24, color: colors.text },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarPlaceholder: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center',
    },
    avatarEmoji: { fontSize: 22 },
    info: { flex: 1, marginLeft: 12 },
    username: { fontSize: 15, fontWeight: '700', color: colors.text },
    city: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

    unblockBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.primary,
      minWidth: 96,
      alignItems: 'center',
    },
    unblockBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },

    separator: { height: 1, backgroundColor: colors.border, marginLeft: 76 },
    emptyContainer: { flex: 1, justifyContent: 'center' },
    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 15, color: colors.textSecondary },
  });
}
