// Ortak şikâyet alt sayfası. Eskiden her ekran 3 neden + iptal ile 4 düğmeli bir
// Alert açıyordu; Android Alert en fazla 3 düğme gösterir ve "İptal" düşüyordu.
// Kullanım: const { openReport, reportSheet } = useReport(); ... {reportSheet}
import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { apiErrorMessage } from '../utils/communityErrors';

export const MODAL_AFTER_ALERT_MS = 300;

const REASONS = [
  { code: 'SPAM', key: 'mod_reason_spam', icon: 'megaphone-outline' },
  { code: 'HARASSMENT', key: 'mod_reason_harassment', icon: 'hand-left-outline' },
  { code: 'INAPPROPRIATE', key: 'mod_reason_inappropriate', icon: 'eye-off-outline' },
];

export function ReportSheet({ visible, onClose, onPick, sending }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('close')}
      />
      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">{t('mod_reason_title')}</Text>
        {REASONS.map(r => (
          <TouchableOpacity
            key={r.code}
            style={styles.row}
            onPress={() => onPick(r.code)}
            disabled={sending}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!sending }}
          >
            <Ionicons name={r.icon} size={20} color={colors.textSecondary} />
            <Text style={styles.rowText}>{t(r.key)}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.cancel} onPress={onClose} accessibilityRole="button">
          {sending
            ? <ActivityIndicator color={colors.textSecondary} />
            : <Text style={styles.cancelText}>{t('mod_cancel')}</Text>}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

/**
 * Şikâyet akışı: openReport(targetType, targetId, onDone?) sayfayı açar, seçilen
 * nedenle POST /reports atar ve sonucu bildirir. reportSheet ekranda bir kez çizilir.
 */
export function useReport() {
  const { t } = useLanguage();
  const [target, setTarget] = useState(null); // { targetType, targetId, onDone }
  const [sending, setSending] = useState(false);

  // Çoğunlukla bir Alert menüsünden açılır; iOS kapanmakta olan Alert'in üstüne
  // Modal sunamaz, bu yüzden kısa bir gecikme.
  const openReport = useCallback((targetType, targetId, onDone) => {
    setTimeout(() => setTarget({ targetType, targetId, onDone }), MODAL_AFTER_ALERT_MS);
  }, []);

  const close = useCallback(() => { if (!sending) setTarget(null); }, [sending]);

  const pick = useCallback(async (reason) => {
    if (!target || sending) return;
    setSending(true);
    try {
      await API.post('/reports', { targetType: target.targetType, targetId: target.targetId, reason });
      const done = target.onDone;
      setTarget(null);
      // iOS: kapanmakta olan Modal'ın üstünde Alert açılmıyor; sayfa insin, sonra göster
      setTimeout(() => Alert.alert(t('mod_reported_title'), t('mod_reported_msg')), 350);
      done?.();
    } catch (err) {
      Alert.alert('', apiErrorMessage(err, t, 'mod_error'));
    } finally {
      setSending(false);
    }
  }, [target, sending, t]);

  const reportSheet = (
    <ReportSheet visible={!!target} onClose={close} onPick={pick} sending={sending} />
  );
  return { openReport, reportSheet };
}

/** Engelleme onayı + istek. Başarılıysa onBlocked çağrılır. */
export function confirmBlock(t, userId, onBlocked) {
  Alert.alert(t('mod_block_title'), t('mod_block_msg'), [
    { text: t('mod_cancel'), style: 'cancel' },
    {
      text: t('mod_block'), style: 'destructive', onPress: async () => {
        try {
          await API.post(`/users/${userId}/block`);
          Alert.alert('', t('mod_blocked_msg'));
          onBlocked?.();
        } catch {
          Alert.alert('', t('mod_error'));
        }
      },
    },
  ]);
}

function createStyles(colors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
      backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22,
      paddingHorizontal: 20, paddingTop: 10, borderWidth: 1, borderColor: colors.border,
    },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
    title: { fontFamily: fonts.headingBold, fontSize: 17, color: colors.text, marginBottom: 8 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    rowText: { fontSize: 15, color: colors.text, flex: 1 },
    cancel: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
    cancelText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  });
}
