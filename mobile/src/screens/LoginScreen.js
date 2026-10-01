import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import API from '../services/api';
import { takePendingRoute } from '../navigation/pendingRoute';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import AuthLayout from '../components/auth/AuthLayout';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const { login } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Yalnız sunum: Alert mesajı ayrıca ilgili alanın altında da gösterilir
  const [errors, setErrors] = useState({});
  const passwordRef = useRef(null);

  const handleLogin = async () => {
    if (loading) return;
    setErrors({});
    // Baş/son boşluk (klavye önerisi, yapıştırma) giriş hatası sayılmasın (N-22)
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrors({
        email: !cleanEmail ? t('login_empty_error') : undefined,
        password: cleanEmail && !password ? t('login_empty_error') : undefined,
      });
      Alert.alert(t('error'), t('login_empty_error'));
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/auth/login', { email: cleanEmail, password });
      const pending = takePendingRoute(res.data.userId);
      await login(res.data);
      if (res.data.isAdmin) {
        navigation.replace('Admin');
      } else {
        navigation.replace('MainApp');
        // Oturumsuz açılan link ya da oturum bitince kalınan ekran (N-23)
        if (pending) navigation.navigate(pending.name, pending.params);
      }
    } catch (err) {
      // Şifre doğru ama e-posta henüz doğrulanmamış → yeni kod gönder, kod ekranına geç
      if (err?.response?.status === 403 && err?.response?.data?.message === 'EMAIL_NOT_VERIFIED') {
        API.post('/auth/resend-verification', { email: cleanEmail }).catch(() => {});
        navigation.navigate('VerifyEmail', { email: cleanEmail });
        return;
      }
      const status = err?.response?.status;
      const reason = err?.response?.data?.message;
      const message = t(
        reason === 'ACCOUNT_BANNED' ? 'login_banned'
          : status === 429 ? 'auth_too_many'
          : 'login_error'
      );
      setErrors({ password: message });
      Alert.alert(t('error'), message);
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field) => setErrors(e => (e[field] ? { ...e, [field]: undefined } : e));

  return (
    <AuthLayout
      showLogo
      // Marka logosu belirgin olsun; geri butonu olmadığı için üst boşluk gerekmez
      logoSize={168}
      topGap={0}
      // Logo zaten "Concertly" yazısını taşıyor; altına ikinci kez başlık yazmıyoruz
      subtitle={t('login_subtitle')}
      footer={(
        <TouchableOpacity
          onPress={() => navigation.navigate('Register')}
          style={styles.switchRow}
          accessibilityRole="button"
          accessibilityLabel={`${t('login_no_account')} ${t('login_register_link')}`}
        >
          <Text style={[styles.switchText, { color: colors.textSecondary }]}>
            {t('login_no_account')}{' '}
            <Text style={[styles.switchLink, { color: colors.primary }]}>{t('login_register_link')}</Text>
          </Text>
        </TouchableOpacity>
      )}
    >
      <AuthInput
        label={t('email')}
        icon="mail-outline"
        placeholder={t('forgot_email_placeholder')}
        value={email}
        onChangeText={(v) => { setEmail(v); clearError('email'); }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        blurOnSubmit={false}
        error={errors.email}
      />
      <AuthInput
        ref={passwordRef}
        label={t('password')}
        icon="lock-closed-outline"
        placeholder={t('password')}
        value={password}
        onChangeText={(v) => { setPassword(v); clearError('password'); }}
        secure
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        autoComplete="password"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
        error={errors.password}
        style={styles.lastInput}
      />

      <View style={styles.forgotRow}>
        <AuthButton
          variant="link"
          title={t('forgot_link')}
          onPress={() => navigation.navigate('ForgotPassword')}
        />
      </View>

      <AuthButton title={t('login_btn')} onPress={handleLogin} loading={loading} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  lastInput: { marginBottom: 4 },
  forgotRow: { alignItems: 'flex-end', marginBottom: 12 },
  switchRow: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  switchText: { fontSize: 14, textAlign: 'center' },
  switchLink: { fontWeight: '700' },
});
