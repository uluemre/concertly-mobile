import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { colors } from '../theme';

export default function RegisterScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !email || !password) {
      Alert.alert('Hata', 'Tüm alanları doldurun.');
      return;
    }
    setLoading(true);
    try {
      await API.post('/auth/register', { username, email, password });
      Alert.alert('🎉 Başarılı', 'Hesabın oluşturuldu!', [
        { text: 'Giriş Yap', onPress: () => navigation.replace('Login') }
      ]);
    } catch (err) {
      Alert.alert('Hata', 'Bu email veya kullanıcı adı zaten kullanılıyor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0F0F1A', '#1A1A2E', '#16213E']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>

        <View style={styles.logoArea}>
          <Text style={styles.emoji}>🎟️</Text>
          <Text style={styles.title}>Katıl Bize</Text>
          <Text style={styles.subtitle}>Festival deneyimini paylaş</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Kullanıcı adı"
            placeholderTextColor={colors.textSecondary}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Şifre"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 16 }} />
          ) : (
            <TouchableOpacity onPress={handleRegister}>
              <LinearGradient colors={['#F5A623', '#E94560']} style={styles.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.buttonText}>Kayıt Ol 🚀</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkArea}>
            <Text style={styles.link}>Zaten hesabın var mı? <Text style={styles.linkBold}>Giriş yap</Text></Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  logoArea: { alignItems: 'center', marginBottom: 48 },
  emoji: { fontSize: 64, marginBottom: 12 },
  title: { fontSize: 36, fontWeight: 'bold', color: colors.text, letterSpacing: 2 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 6 },
  form: { gap: 12 },
  input: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
  },
  button: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  linkArea: { alignItems: 'center', marginTop: 16 },
  link: { color: colors.textSecondary, fontSize: 14 },
  linkBold: { color: colors.secondary, fontWeight: 'bold' },
});