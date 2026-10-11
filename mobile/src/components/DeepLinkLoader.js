import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { DetailSkeletonPage, PostSkeletonPage, ProfileSkeletonPage } from './SkeletonLoader';

/**
 * Paylaşılan bir linkten ya da bildirimden gelen ekranlar, içeriği id ile
 * sunucudan çeker. Bu bileşen o kısa bekleme (ve içerik silinmişse hata)
 * durumunu gösterir. Beklerken açılacak ekrana benzeyen bir iskelet çizilir
 * (variant: detail | post | profile).
 */
export default function DeepLinkLoader({ error, onBack, variant = 'detail' }) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  if (!error) {
    if (variant === 'post') return <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 56 }}><PostSkeletonPage /></View>;
    if (variant === 'profile') return <ProfileSkeletonPage />;
    return <DetailSkeletonPage />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Ionicons name="search-outline" size={44} color={colors.textSecondary} style={styles.emoji} />
      <Text style={[styles.title, { color: colors.text }]}>{t('deeplink_missing_title')}</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>{t('deeplink_missing_sub')}</Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={onBack}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{t('deeplink_go_back')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emoji: { marginBottom: 14 },
  title: { fontSize: 18, fontFamily: fonts.heading, marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  button: { paddingHorizontal: 26, paddingVertical: 13, borderRadius: 12 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
