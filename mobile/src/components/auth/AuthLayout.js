// Kimlik doğrulama ekranlarının ortak iskeleti: düz arka plan, safe area,
// klavye açıkken kaydırılabilir içerik, isteğe bağlı geri butonu ve başlık alanı.
import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from '../keyboard';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

export default function AuthLayout({
  title, subtitle, icon, showLogo = false, onBack, backLabel, children, footer,
  // İsteğe bağlı (varsayılanlar diğer ekranları değiştirmez): logo boyutu ve
  // geri butonu olmayan ekranlarda üstte bırakılan boşluk
  logoSize = 88, topGap = 44,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {/* Klavye: KeyboardAvoidingView YOK. Kapsayıcı küçülüp içerik yeniden ortalanınca
          odaktaki kutu "kayıyordu". Kaydırma görünümü odaktaki kutuyu klavyenin üstüne tek
          hareketle getirir; Android'de de (SDK 57 kenardan kenara: pencere artık klavyeye
          göre küçülmüyor). Bkz. components/keyboard. */}
        <KeyboardAwareScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
          ]}
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              // Mutlak konumlu öğe kapsayıcının paddingTop'unu yok sayar; safe area'yı burada ekle
              style={[styles.back, { top: insets.top + 4 }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ) : null}

          <View style={[styles.body, { paddingTop: onBack ? 44 : topGap }]}>
            <View style={styles.header}>
              {showLogo ? (
                <Image
                  source={require('../../../assets/icon.png')}
                  style={[styles.logo, { width: logoSize, height: logoSize }]}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                  accessible={false}
                />
              ) : icon ? (
                <View style={styles.iconBadge}>
                  <Ionicons name={icon} size={30} color="#fff" />
                </View>
              ) : null}
              {title ? (
                <Text style={styles.title} accessibilityRole="header">{title}</Text>
              ) : null}
              {subtitle ? (typeof subtitle === 'string'
                ? <Text style={styles.subtitle}>{subtitle}</Text>
                : subtitle) : null}
            </View>

            {children}
          </View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAwareScrollView>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    // flexGrow + justifyContent: kısa içerik ortalanır, uzun içerik (küçük ekran/klavye) kayar
    scroll: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center' },
    back: {
      position: 'absolute', left: 16, top: 0, zIndex: 1,
      width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    },
    body: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingTop: 44 },
    header: { alignItems: 'center', marginBottom: 28 },
    logo: { width: 88, height: 88, marginBottom: 12 },
    iconBadge: {
      width: 64, height: 64, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      backgroundColor: colors.primary,
    },
    title: {
      fontSize: 26, fontWeight: '800', color: colors.text,
      textAlign: 'center', marginBottom: 6,
    },
    subtitle: {
      fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center',
    },
    footer: { width: '100%', maxWidth: 440, alignSelf: 'center', marginTop: 24, alignItems: 'center' },
  });
}
