// Kayıttan sonra e-postaya gelen 6 haneli kodu girme ekranı.
// Kod doğruysa sunucu doğrudan oturum açar (login ile aynı yanıt).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function VerifyEmailScreen({ navigation, route }) {
  const { email, justSent = true } = route.params ?? {};
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { login } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(justSent ? RESEND_SECONDS : 0);
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
      Alert.alert(t('error'), t(key));
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
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
    <LinearGradient colors={[colors.background, colors.card, colors.cardAlt]} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ {t('back')}</Text>
        </TouchableOpacity>

        <Text style={styles.emoji}>📬</Text>
        <Text style={[styles.title, { color: colors.text }]}>{t('verify_title')}</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          {t('verify_subtitle')}{'\n'}
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{email}</Text>
        </Text>

        {/* Görünmez tek input + 6 kutu: yapıştırma ve SMS/e-posta otomatik doldurma çalışır */}
        <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={styles.boxes}>
          {Array.from({ length: CODE_LENGTH }).map((_, i) => {
            const active = i === digits.length && !loading;
            return (
              <View
                key={i}
                style={[
                  styles.box,
                  { backgroundColor: colors.card, borderColor: active ? colors.primary : colors.border },
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
          style={styles.hiddenInput}
        />

        <TouchableOpacity
          onPress={() => handleVerify()}
          disabled={loading || code.length !== CODE_LENGTH}
          activeOpacity={0.85}
          style={{ opacity: code.length === CODE_LENGTH ? 1 : 0.5 }}
        >
          <LinearGradient colors={['#F5A623', '#E94560']} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{t('verify_btn')}</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} disabled={cooldown > 0} style={styles.resend}>
          <Text style={[styles.resendText, { color: cooldown > 0 ? colors.textSecondary : colors.secondary }]}>
            {cooldown > 0 ? t('verify_resend_in').replace('{s}', String(cooldown)) : t('verify_resend')}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('verify_spam_hint')}</Text>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    inner: { flex: 1, padding: 24, justifyContent: 'center' },
    back: { position: 'absolute', top: 56, left: 24, zIndex: 1 },
    backText: { fontSize: 16, fontWeight: '700' },
    emoji: { fontSize: 56, textAlign: 'center', marginBottom: 12 },
    title: { fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
    sub: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
    boxes: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 8 },
    box: {
      flex: 1, aspectRatio: 0.85, maxWidth: 56, borderRadius: 14, borderWidth: 2,
      alignItems: 'center', justifyContent: 'center',
    },
    boxText: { fontSize: 26, fontWeight: '800' },
    hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
    btn: { padding: 16, borderRadius: 12, alignItems: 'center' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    resend: { alignItems: 'center', marginTop: 20, padding: 8 },
    resendText: { fontSize: 14, fontWeight: '700' },
    hint: { fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18, color: colors.textSecondary },
  });
}
