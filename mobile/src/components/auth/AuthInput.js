// Etiketli, ikonlu input: odak/hata durumu, alt yardım/hata metni ve şifre göster/gizle.
import React, { forwardRef, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useLanguage } from '../../context/LanguageContext';

export const AUTH_ERROR_COLOR = '#FF5A6E';

const AuthInput = forwardRef(function AuthInput(
  { label, icon, error, hint, secure = false, style, onFocus, onBlur, ...inputProps },
  ref,
) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const borderColor = error ? AUTH_ERROR_COLOR : focused ? colors.primary : colors.border;

  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.field, { borderColor }]}>
        {icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={error ? AUTH_ERROR_COLOR : focused ? colors.primary : colors.textSecondary}
            style={styles.icon}
          />
        ) : null}
        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={secure && hidden}
          accessibilityLabel={label || inputProps.placeholder}
          accessibilityHint={error || hint || undefined}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...inputProps}
        />
        {secure ? (
          <TouchableOpacity
            onPress={() => setHidden(h => !h)}
            style={styles.eye}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={t(hidden ? 'auth_show_password' : 'auth_hide_password')}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

export default AuthInput;

function createStyles(colors) {
  return StyleSheet.create({
    wrap: { marginBottom: 14 },
    label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6, marginLeft: 2 },
    field: {
      flexDirection: 'row', alignItems: 'center',
      minHeight: 52, borderRadius: 14, borderWidth: 1.5,
      backgroundColor: colors.card, paddingHorizontal: 14,
    },
    icon: { marginRight: 10 },
    input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 12 },
    eye: { width: 44, height: 44, marginRight: -10, alignItems: 'center', justifyContent: 'center' },
    error: { color: AUTH_ERROR_COLOR, fontSize: 12, marginTop: 6, marginLeft: 2, lineHeight: 16 },
    hint: { color: colors.textSecondary, fontSize: 12, marginTop: 6, marginLeft: 2, lineHeight: 16 },
  });
}
