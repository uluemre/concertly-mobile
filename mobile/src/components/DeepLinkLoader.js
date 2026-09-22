import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';

/**
 * Paylaşılan bir linkten ya da bildirimden gelen ekranlar, içeriği id ile
 * sunucudan çeker. Bu bileşen o kısa bekleme (ve içerik silinmişse hata)
 * durumunu gösterir.
 */
export default function DeepLinkLoader({ error, onBack }) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {error ? (
        <>
          <Text style={styles.emoji}>🔍</Text>
          <Text style={[styles.title, { color: colors.text }]}>{t('deeplink_missing_title')}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>{t('deeplink_missing_sub')}</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={onBack}
          >
            <Text style={styles.buttonText}>{t('deeplink_go_back')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <ActivityIndicator size="large" color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emoji: { fontSize: 44, marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  button: { paddingHorizontal: 26, paddingVertical: 13, borderRadius: 12 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
