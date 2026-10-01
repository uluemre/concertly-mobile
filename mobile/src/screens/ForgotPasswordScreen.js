import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '../services/api';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { goBackOrFallback } from '../navigation/navHelpers';
import { isValidEmail, normalizeEmail } from '../utils/email';
import AuthLayout from '../components/auth/AuthLayout';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';

export default function ForgotPasswordScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  // Yalnız sunum: Alert mesajı ayrıca alanın altında da gösterilir
  const [error, setError] = useState(null);

  const handleSend = async () => {
    if (loading) return;
    setError(null);
    if (!email.trim()) {
      setError(t('forgot_email_required'));
      Alert.alert(t('error'), t('forgot_email_required'));
      return;
    }
    if (!isValidEmail(email)) {
      setError(t('email_invalid'));
      Alert.alert(t('error'), t('email_invalid'));
      return;
    }
    setLoading(true);
    try {
      await API.post('/auth/forgot-password', { email: normalizeEmail(email) });
      setSent(true);
    } catch (err) {
      // Sunucu kayıtlı olsun olmasın aynı yanıtı verir; buraya düşen hata "hesap yok"
      // değil, bağlantı ya da sunucu sorunudur (N-22)
      const status = err?.response?.status;
      Alert.alert(t('error'), t(
        status === 429 ? 'auth_too_many'
          : !err?.response ? 'verify_network_error'
          : 'forgot_generic_error'
      ));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={sent ? 'mail-open-outline' : 'key-outline'}
      title={sent ? t('forgot_sent_title') : t('forgot_title')}
      subtitle={sent ? t('forgot_sent_sub') : t('forgot_subtitle')}
      onBack={() => goBackOrFallback(navigation, 'Login')}
      backLabel={t('back')}
    >
      {!sent ? (
        <>
          <AuthInput
            label={t('email')}
            icon="mail-outline"
            placeholder={t('forgot_email_placeholder')}
            value={email}
            onChangeText={(v) => { setEmail(v); if (error) setError(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={handleSend}
            error={error}
          />
          <AuthButton title={t('forgot_send_btn')} onPress={handleSend} loading={loading} style={styles.submit} />
        </>
      ) : (
        <>
          <View style={[styles.sentTo, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.accent || colors.primary} />
            <Text style={[styles.sentToText, { color: colors.text }]} numberOfLines={1}>
              {normalizeEmail(email)}
            </Text>
          </View>
          <AuthButton
            title={t('forgot_enter_code_btn')}
            onPress={() => navigation.navigate('ResetPassword', { email: normalizeEmail(email) })}
          />
        </>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  submit: { marginTop: 6 },
  sentTo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 52, marginBottom: 16,
  },
  sentToText: { flex: 1, fontSize: 15, fontWeight: '600' },
});
