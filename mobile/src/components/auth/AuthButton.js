// Kimlik doğrulama butonları: ana (düz marka rengi) ve ikincil (çerçeveli) / bağlantı.
// Yüklenirken buton yerinde kalır, içinde spinner döner ve basılamaz.
import React, { useMemo } from 'react';
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';

export default function AuthButton({
  title, onPress, loading = false, disabled = false, variant = 'primary', style, accessibilityHint,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const inactive = disabled || loading;

  const a11y = {
    accessibilityRole: 'button',
    accessibilityLabel: title,
    accessibilityHint,
    accessibilityState: { disabled: inactive, busy: loading },
  };

  if (variant === 'link') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={inactive}
        style={[styles.link, style]}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        {...a11y}
      >
        <Text style={[styles.linkText, inactive && { color: colors.textSecondary }]}>{title}</Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'secondary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={inactive}
        activeOpacity={0.85}
        style={[styles.base, styles.secondary, inactive && styles.dim, style]}
        {...a11y}
      >
        {loading
          ? <ActivityIndicator color={colors.primary} />
          : <Text style={[styles.text, { color: colors.text }]}>{title}</Text>}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.85}
      style={[inactive && styles.dim, style]}
      {...a11y}
    >
      <View style={[styles.base, styles.primary]}>
        <View style={styles.row}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.text}>{title}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    base: {
      minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 20,
    },
    primary: { backgroundColor: colors.primary },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    text: { color: '#fff', fontSize: 16, fontWeight: '700' },
    secondary: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
    dim: { opacity: 0.6 },
    link: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    linkText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  });
}
