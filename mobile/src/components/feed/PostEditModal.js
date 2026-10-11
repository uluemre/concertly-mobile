// Gönderi metnini düzenleme alt sayfası (akış kartı ve gönderi detayı ortak kullanır).
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { KeyboardAvoidingView } from '../keyboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fonts } from '../../theme';
import { useLanguage } from '../../context/LanguageContext';
import API from '../../services/api';
import { apiErrorMessage } from '../../utils/communityErrors';

export default function PostEditModal({ visible, post, onClose, onSaved }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [text, setText] = useState(post?.content || '');
  const [saving, setSaving] = useState(false);

  // Her açılışta güncel metinle başla
  useEffect(() => { if (visible) setText(post?.content || ''); }, [visible, post?.id, post?.content]);

  const trimmed = text.trim();
  // Görsel gönderisinin yazısı silinebilir; metin/anket gönderisi boş bırakılamaz
  const canSave = !saving && trimmed !== (post?.content || '').trim()
    && (trimmed.length > 0 || post?.postType === 'IMAGE');

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await API.patch(`/posts/${post.id}`, { content: trimmed });
      onSaved?.(res.data);
      onClose();
    } catch (err) {
      Alert.alert(t('error'), apiErrorMessage(err, t, 'profile_edit_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} />
      <KeyboardAvoidingView behavior="padding" style={styles.wrapper}>
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
          <Text style={styles.title} accessibilityRole="header">{t('profile_edit_title')}</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            maxLength={500}
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={t('profile_edit_title')}
          />
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.border }]} onPress={onClose} accessibilityRole="button">
              <Text style={[styles.btnText, { color: colors.text }]}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, opacity: canSave ? 1 : 0.45 }]}
              onPress={save}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
            >
              <Text style={[styles.btnText, { color: '#fff' }]}>{saving ? t('profile_edit_saving') : t('profile_edit_save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    wrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    sheet: {
      backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20,
      borderWidth: 1, borderColor: colors.border,
    },
    title: { fontFamily: fonts.headingBold, fontSize: 16, color: colors.text, marginBottom: 14 },
    input: {
      borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, minHeight: 100, maxHeight: 220,
      textAlignVertical: 'top', marginBottom: 14,
      color: colors.text, borderColor: colors.border, backgroundColor: colors.background,
    },
    actions: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: 15, fontWeight: '700' },
  });
}
