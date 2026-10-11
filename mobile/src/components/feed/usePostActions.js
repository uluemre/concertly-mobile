// Gönderinin "⋯" menüsü: sahibi için Düzenle/Sil, diğerleri için Şikâyet/Engelle.
// Akış kartı (PostCard) ve gönderi detayı (PostDetail) aynı davranışı paylaşır.
// Dönen `actionElements` ekranda bir kez çizilmeli (şikâyet sayfası + düzenleme).
import React, { useState } from 'react';
import { Alert } from 'react-native';
import API from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { useReport, confirmBlock, MODAL_AFTER_ALERT_MS } from '../ReportSheet';
import PostEditModal from './PostEditModal';

export default function usePostActions({ post, currentUserId, onDeleted, onEdited, onBlocked }) {
  const { t } = useLanguage();
  const { openReport, reportSheet } = useReport();
  const [editing, setEditing] = useState(false);
  const isOwner = !!post && post.userId === currentUserId;

  const confirmDelete = () => {
    Alert.alert(t('profile_post_delete_title'), t('profile_post_delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: async () => {
          try {
            await API.delete(`/posts/${post.id}`);
            onDeleted?.(post.id);
          } catch {
            Alert.alert(t('error'), t('profile_post_delete_error'));
          }
        },
      },
    ]);
  };

  const openOptions = () => {
    if (!post) return;
    if (isOwner) {
      Alert.alert(t('profile_post_actions'), null, [
        { text: t('edit'), onPress: () => setTimeout(() => setEditing(true), MODAL_AFTER_ALERT_MS) },
        { text: t('delete'), style: 'destructive', onPress: confirmDelete },
        { text: t('cancel'), style: 'cancel' },
      ]);
    } else {
      Alert.alert(t('mod_options_title'), null, [
        { text: t('mod_report'), onPress: () => openReport('POST', post.id) },
        { text: t('mod_block'), style: 'destructive', onPress: () => confirmBlock(t, post.userId, () => onBlocked?.(post.userId)) },
        { text: t('mod_cancel'), style: 'cancel' },
      ]);
    }
  };

  const actionElements = (
    <>
      {reportSheet}
      {isOwner && (
        <PostEditModal
          visible={editing}
          post={post}
          onClose={() => setEditing(false)}
          onSaved={(updated) => onEdited?.(post.id, updated)}
        />
      )}
    </>
  );

  return { openOptions, actionElements, isOwner };
}
