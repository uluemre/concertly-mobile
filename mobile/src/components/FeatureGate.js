import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useAppConfig } from '../context/AppConfigContext';
import { goBackOrFallback } from '../navigation/navHelpers';

function FeatureOff({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.back} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name="construct-outline" size={30} color={colors.secondary} />
        </View>
        <Text style={styles.title} accessibilityRole="header">{t('feature_off_title')}</Text>
        <Text style={styles.sub}>{t('feature_off_sub')}</Text>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.btn} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.btnText}>{t('feature_off_back')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Admin panelinden kapatılabilen bir özelliğin ekranını sarar. Özellik kapalıysa (admin değilse)
 * ekran yerine "şu an kapalı" görünümü açılır; bildirim ya da paylaşım linkiyle gelinse de.
 * Modül düzeyinde bir kez çağrılmalı (render içinde çağrılırsa ekran her seferinde yeniden kurulur).
 */
export function withFeature(feature, Screen) {
  function Gated(props) {
    const { isOn } = useAppConfig();
    const { session } = useAuth();
    if (!isOn(feature) && !session.isAdmin) return <FeatureOff navigation={props.navigation} />;
    return <Screen {...props} />;
  }
  Gated.displayName = `withFeature(${feature})`;
  return Gated;
}

function createStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
    back: { width: 40, height: 40, justifyContent: 'center' },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 80 },
    icon: {
      width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 18,
    },
    title: { color: colors.text, fontFamily: fonts.heading, fontSize: 22, textAlign: 'center' },
    sub: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
    btn: { marginTop: 22, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
