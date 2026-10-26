import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';

/** Compact, explicit bulk actions for a pending admin queue. */
export default function AdminBulkReviewBar({ count, busy, colors, t, onApprove, onReject }) {
  if (!count) return null;
  return (
    <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.count, { color: colors.textSecondary }]}>{t('admin_bulk_pending_count', { count })}</Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.accent }]}
        onPress={onApprove}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.buttonText}>{t('admin_bulk_approve_all')}</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={onReject}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.buttonText}>{t('admin_bulk_reject_all')}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 10, marginBottom: 6,
    padding: 10, borderWidth: 1, borderRadius: 14,
  },
  count: { flex: 1, fontSize: 11, fontWeight: '700' },
  button: { minHeight: 38, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
