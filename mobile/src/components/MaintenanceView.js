import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { useAppConfig } from '../context/AppConfigContext';

/**
 * Bakım modunda admin olmayan herkesin gördüğü ekran. Adminin mesajı (dile göre) gösterilir;
 * "Tekrar dene" ayarları yeniden okur. Oturumu olmayanlar için alttaki küçük bağlantı giriş
 * ekranını açar (admin bakımdayken de giriş yapabilsin).
 */
export default function MaintenanceView({ onAdminLogin }) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const { maintenance, refresh } = useAppConfig();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [checking, setChecking] = useState(false);

  const custom = (lang === 'en' ? maintenance.messageEn : maintenance.messageTr)
    || maintenance.messageTr || maintenance.messageEn;

  const retry = async () => {
    setChecking(true);
    await refresh({ force: true });
    setChecking(false);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name="build-outline" size={34} color={colors.primary} />
        </View>
        <Text style={styles.title} accessibilityRole="header">{t('maintenance_title')}</Text>
        <Text style={styles.sub}>{custom || t('maintenance_sub')}</Text>
        <TouchableOpacity onPress={retry} style={styles.btn} activeOpacity={0.85} disabled={checking} accessibilityRole="button">
          {checking
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>{t('retry')}</Text>}
        </TouchableOpacity>
      </View>
      {onAdminLogin ? (
        <TouchableOpacity onPress={onAdminLogin} hitSlop={10} accessibilityRole="button">
          <Text style={styles.admin}>{t('maintenance_admin_login')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    icon: {
      width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center',
      backgroundColor: `${colors.primary}1F`, marginBottom: 20,
    },
    title: { color: colors.text, fontFamily: fonts.heading, fontSize: 26, textAlign: 'center' },
    sub: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10 },
    btn: {
      marginTop: 26, backgroundColor: colors.primary, borderRadius: 14, minWidth: 160,
      alignItems: 'center', paddingHorizontal: 22, paddingVertical: 13,
    },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    admin: { color: colors.textSecondary, fontSize: 12, textDecorationLine: 'underline' },
  });
}
