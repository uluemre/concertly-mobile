// Kayıttan sonra e-postaya gelen 6 haneli kodu girme ekranı.
// Kod doğruysa sunucu doğrudan oturum açar (login ile aynı yanıt).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { goBackOrFallback } from '../navigation/navHelpers';
import AuthLayout from '../components/auth/AuthLayout';
import AuthButton from '../components/auth/AuthButton';
import { AUTH_ERROR_COLOR } from '../components/auth/AuthInput';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function VerifyEmailScreen({ navigation, route }) {
  const { email, justSent = true, changeEmail = false } = route.params ?? {};
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { login } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(justSent ? RESEND_SECONDS : 0);
  // Yalnız sunum: Alert mesajı ayrıca kutuların altında da gösterilir
  const [codeError, setCodeError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = async (value = code) => {
    if (value.length !== CODE_LENGTH || loading) return;
    setLoading(true);
    try {
      if (changeEmail) {
        // Oturum açık: kimlikli uç nokta (204, token yok; oturumlar iptal edilmez)
        await API.post('/users/me/verify-email', { code: value });
        Alert.alert(t('verify_changed_title'), t('verify_changed_msg'), [
          { text: t('confirm'), onPress: () => goBackOrFallback(navigation) },
        ]);
        return;
      }
      const res = await API.post('/auth/verify-email', { email, code: value });
      const onboarded = !!res.data.onboardingCompleted;
      await login({ ...res.data, onboardingCompleted: onboarded });
      navigation.reset({ index: 0, routes: [{ name: onboarded ? 'MainApp' : 'GenreSelection' }] });
    } catch (err) {
      const reason = err?.response?.data?.message;
      const key = reason === 'CODE_EXPIRED' ? 'verify_code_expired'
        : reason === 'CODE_ATTEMPTS_EXCEEDED' ? 'verify_too_many'
        : err?.response ? 'verify_code_invalid'
        : 'verify_network_error';
      setCodeError(t(key));
      Alert.alert(t('error'), t(key));
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (codeError) setCodeError(null);
    setCode(digits);
    if (digits.length === CODE_LENGTH) handleVerify(digits);
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setCooldown(RESEND_SECONDS);
    try {
      await API.post('/auth/resend-verification', { email });
      Alert.alert(t('verify_resent_title'), t('verify_resent_sub'));
    } catch {
      setCooldown(0);
      Alert.alert(t('error'), t('verify_network_error'));
    }
  };

  const digits = code.split('');

  return (
    <AuthLayout
      icon="mail-unread-outline"
      title={t('verify_title')}
      subtitle={(
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          {t('verify_subtitle')}{'\n'}
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{email}</Text>
        </Text>
      )}
      onBack={() => goBackOrFallback(navigation, 'Login')}
      backLabel={t('back')}
    >
      {/* Görünmez tek input + 6 kutu: yapıştırma ve SMS/e-posta otomatik doldurma çalışır */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => inputRef.current?.focus()}
        style={styles.boxes}
        accessibilityRole="button"
        accessibilityLabel={t('verify_code_a11y', { n: digits.length, max: CODE_LENGTH })}
      >
        {Array.from({ length: CODE_LENGTH }).map((_, i) => {
          const active = i === digits.length && !loading;
          return (
            <View
              key={i}
              style={[
                styles.box,
                {
                  backgroundColor: colors.card,
                  borderColor: codeError ? AUTH_ERROR_COLOR : active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.boxText, { color: colors.text }]}>{digits[i] ?? ''}</Text>
            </View>
          );
        })}
      </TouchableOpacity>
      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        autoFocus
        returnKeyType="done"
        style={styles.hiddenInput}
      />
      {codeError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">{codeError}</Text>
      ) : null}

      <AuthButton
        title={t('verify_btn')}
        onPress={() => handleVerify()}
        loading={loading}
        disabled={code.length !== CODE_LENGTH}
      />

      <AuthButton
        variant="link"
        title={cooldown > 0 ? t('verify_resend_in').replace('{s}', String(cooldown)) : t('verify_resend')}
        onPress={handleResend}
        disabled={cooldown > 0}
        style={styles.resend}
      />

      <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('verify_spam_hint')}</Text>
    </AuthLayout>
  );
}

function createStyles() {
  return StyleSheet.create({
    sub: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
    boxes: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12, gap: 8 },
    box: {
      flex: 1, aspectRatio: 0.85, maxWidth: 56, borderRadius: 14, borderWidth: 2,
      alignItems: 'center', justifyContent: 'center',
    },
    boxText: { fontSize: 26, fontWeight: '800' },
    hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
    error: { color: AUTH_ERROR_COLOR, fontSize: 12, textAlign: 'center', marginBottom: 12, lineHeight: 16 },
    resend: { marginTop: 12 },
    hint: { fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  });
}
