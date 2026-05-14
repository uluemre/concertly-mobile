import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    inner: { flex: 1, justifyContent: 'center', padding: 24 },

    logoArea: { alignItems: 'center', marginBottom: 48 },
    logo: {
      width: 100,
      height: 100,
      marginBottom: 16,
    },
    title: {
      fontSize: 36, fontWeight: 'bold',
      color: colors.text, letterSpacing: 2,
    },
    subtitle: {
      fontSize: 14, color: colors.textSecondary, marginTop: 6,
    },

    form: { gap: 12 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, padding: 16,
      fontSize: 16, color: colors.text,
    },
    button: {
      padding: 16, borderRadius: 12,
      alignItems: 'center', marginTop: 8,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    linkArea: { alignItems: 'center', marginTop: 16 },
    link: { color: colors.textSecondary, fontSize: 14 },
    linkBold: { color: colors.primary, fontWeight: 'bold' },

    demoDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 32, marginBottom: 12 },
    demoLine: { flex: 1, height: 1, backgroundColor: colors.border },
    demoLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
    demoBtn: {
      paddingVertical: 12, borderRadius: 12,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      alignItems: 'center',
    },
    demoBtnText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
    demoHint: { color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 8 },
  });
}

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Hata', 'Email ve şifre boş olamaz.');
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/auth/login', { email, password });
      global.authToken = res.data.accessToken;
      global.userId = res.data.userId;
      global.userCity = res.data.city;
      global.username = res.data.username;
      global.favoriteGenres = res.data.favoriteGenres;
      global.onboardingCompleted = res.data.onboardingCompleted;

      if (!res.data.onboardingCompleted) {
        navigation.replace('GenreSelection');
      } else {
        navigation.replace('Welcome', { username: res.data.username });
      }
    } catch (err) {
      Alert.alert('Hata', 'Email veya şifre hatalı.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSetup = async () => {
    setLoading(true);
    try {
      await API.post('/demo/setup');
      setEmail('ahmet@demo.com');
      setPassword('Demo1234');
      Alert.alert('Demo Hazır', 'Demo hesabı oluşturuldu. Giriş yap butonuna basın.', [{ text: 'Tamam' }]);
    } catch (err) {
      Alert.alert('Hata', 'Demo kurulumu yapılamadı. Backend çalışıyor mu?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.background, colors.card, colors.cardAlt]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        {/* LOGO ALANI */}
        <View style={styles.logoArea}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Concertly</Text>
          <Text style={styles.subtitle}>Müziği yaşa, anları paylaş</Text>

        </View>

        {/* FORM */}
        <View style={styles.form}>
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
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={{ marginTop: 16 }}
            />
          ) : (
            <TouchableOpacity onPress={handleLogin}>
              <LinearGradient
                colors={['#E94560', '#7C3AED']}
                style={styles.button}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>Giriş Yap 🎵</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            style={styles.linkArea}
          >
            <Text style={styles.link}>
              Hesabın yok mu?{' '}
              <Text style={styles.linkBold}>Kayıt ol</Text>
            </Text>
          </TouchableOpacity>

          {/* DEMO */}
          <View style={styles.demoDivider}>
            <View style={styles.demoLine} />
            <Text style={styles.demoLabel}>MENTOR DEMOSU</Text>
            <View style={styles.demoLine} />
          </View>

          <TouchableOpacity onPress={handleDemoSetup} style={styles.demoBtn}>
            <Text style={styles.demoBtnText}>🚀 Demo Veriyi Yükle</Text>
          </TouchableOpacity>
          <Text style={styles.demoHint}>
            Demo: ahmet@demo.com / Demo1234
          </Text>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
