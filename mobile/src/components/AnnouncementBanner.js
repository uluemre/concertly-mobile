import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { useAppConfig } from '../context/AppConfigContext';

const DISMISSED_KEY = 'announcementDismissed';
const ICONS = { info: 'megaphone-outline', warning: 'warning-outline', success: 'checkmark-circle-outline' };

/**
 * Adminin yazdığı duyuru (ana sayfanın üstünde). Kullanıcı kapatabilir; admin metni
 * değiştirince sürüm artar ve bant yeniden görünür.
 */
export default function AnnouncementBanner() {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const { announcement } = useAppConfig();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [dismissed, setDismissed] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then(v => setDismissed(v ? Number(v) : 0)).catch(() => setDismissed(0));
  }, []);

  if (!announcement || dismissed === null || dismissed >= announcement.version) return null;
  const text = (lang === 'en' ? announcement.textEn : announcement.textTr) || announcement.textTr || announcement.textEn;
  if (!text) return null;

  const tone = ICONS[announcement.tone] ? announcement.tone : 'info';
  const tint = tone === 'warning' ? colors.secondary : tone === 'success' ? colors.accent : colors.primary;

  const close = () => {
    setDismissed(announcement.version);
    AsyncStorage.setItem(DISMISSED_KEY, String(announcement.version)).catch(() => {});
  };
  const open = () => {
    if (announcement.link) Linking.openURL(announcement.link).catch(() => {});
  };

  return (
    <View style={[styles.banner, { borderColor: `${tint}66`, backgroundColor: `${tint}14` }]}>
      <Ionicons name={ICONS[tone]} size={18} color={tint} style={styles.icon} />
      <TouchableOpacity
        style={styles.body}
        onPress={open}
        disabled={!announcement.link}
        activeOpacity={0.8}
        accessibilityRole={announcement.link ? 'link' : 'text'}
      >
        <Text style={styles.text}>{text}</Text>
        {announcement.link ? <Text style={[styles.more, { color: tint }]}>{t('announcement_open')}</Text> : null}
      </TouchableOpacity>
      <TouchableOpacity onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}>
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      marginHorizontal: 16, marginTop: 8, marginBottom: 4,
      borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    },
    icon: { marginTop: 1 },
    body: { flex: 1 },
    text: { color: colors.text, fontSize: 14, lineHeight: 20 },
    more: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  });
}
