import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';

export default function ForgotPasswordScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert(t('error'), t('forgot_email_required'));
      return;
    }
    setLoading(true);
    try {
      await API.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      Alert.alert(t('error'), t('forgot_not_found'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0A0A14', '#1a0a2e', '#0A0A14']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ {t('back')}</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text }]}>🔑 {t('forgot_title')}</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>{t('forgot_subtitle')}</Text>

        {!sent ? (
          <>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder={t('forgot_email_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={handleSend} disabled={loading} activeOpacity={0.85}>
              <LinearGradient colors={['#7C3AED', '#E94560']} style={styles.btn}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>{t('forgot_send_btn')}</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.successBox}>
              <Text style={styles.successEmoji}>📬</Text>
              <Text style={[styles.successTitle, { color: colors.text }]}>{t('forgot_sent_title')}</Text>
              <Text style={[styles.successSub, { color: colors.textSecondary }]}>{t('forgot_sent_sub')}</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('ResetPassword', { email })}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#00897B', '#00D4AA']} style={styles.btn}>
                <Text style={styles.btnText}>{t('forgot_enter_code_btn')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    inner: { flex: 1, padding: 24, justifyContent: 'center' },
    back: { position: 'absolute', top: 56, left: 24 },
    backText: { fontSize: 16, fontWeight: '700' },
    title: { fontSize: 28, fontWeight: '900', marginBottom: 8, marginTop: 60 },
    sub: { fontSize: 14, lineHeight: 20, marginBottom: 32 },
    input: {
      borderRadius: 16, padding: 16, fontSize: 16,
      borderWidth: 1, marginBottom: 16,
    },
    btn: { borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 4 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    successBox: { alignItems: 'center', paddingVertical: 32, gap: 12 },
    successEmoji: { fontSize: 56 },
    successTitle: { fontSize: 20, fontWeight: '800' },
    successSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  });
}
