import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, Modal, FlatList, Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const TURKISH_CITIES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin',
  'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa',
  'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan',
  'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta',
  'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir',
  'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla',
  'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop',
  'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van',
  'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak',
  'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce'
];

export default function SettingsScreen({ navigation, route }) {
  const { colors, themeMode, setThemeMode } = useTheme();
  const { session, updateSession } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [spotifyStatus, setSpotifyStatus] = useState(null);
  const [spotifyLoading, setSpotifyLoading] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    bio: '',
    city: ''
  });

  useEffect(() => {
    fetchProfile();
    fetchSpotifyStatus();
  }, []);

  const fetchSpotifyStatus = async () => {
    try {
      const res = await API.get(`/spotify/status/${session.userId}`);
      setSpotifyStatus(res.data);
    } catch {}
  };

  const handleSpotifyConnect = async () => {
    setSpotifyLoading(true);
    try {
      const res = await API.get(`/spotify/auth-url?userId=${session.userId}`);
      const authUrl = res.data.url;
      await WebBrowser.openBrowserAsync(authUrl);
      await fetchSpotifyStatus();
    } catch (err) {
      Alert.alert(t('error'), t('settings_spotify_connect_error'));
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleSpotifyDisconnect = () => {
    Alert.alert(t('settings_spotify_disconnect_title'), t('settings_spotify_disconnect_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('settings_spotify_disconnect_btn'), style: 'destructive', onPress: async () => {
          try {
            await API.delete(`/spotify/disconnect/${session.userId}`);
            setSpotifyStatus({ connected: false });
          } catch {
            Alert.alert(t('error'), t('settings_spotify_disconnect_error'));
          }
        }
      }
    ]);
  };

  const fetchProfile = async () => {
    try {
      // Backend'deki getUserProfile endpoint'i
      const res = await API.get(`/users/${session.userId}/profile`);
      const data = res.data;
      setFormData({
        username: data.username || '',
        email: data.email || '',
        phone: data.phone || '',
        bio: data.bio || '',
        city: data.city || ''
      });
    } catch (err) {
      Alert.alert(t('error'), t('settings_load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.put(`/users/${session.userId}/profile`, formData);
      if (formData.city) {
        await updateSession({ userCity: formData.city });
      }
      Alert.alert(t('settings_save_success'), t('settings_save_success_msg'), [
        { text: t('confirm'), onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Bilinmeyen hata';
      console.log('Ayar kayıt hatası:', status, msg);
      Alert.alert('Hata', `Ayarlar kaydedilemedi. (${status || 'Ağ hatası'})`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings_title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>{t('settings_appearance_section')}</Text>

        <View style={styles.themeToggleContainer}>
          <Text style={styles.label}>{t('settings_theme')}</Text>
          <View style={styles.themeToggle}>
            <TouchableOpacity
              onPress={() => setThemeMode('dark')}
              style={[styles.themeToggleOption, themeMode === 'dark' && styles.themeToggleOptionActive]}
              activeOpacity={0.8}
            >
              <Text style={styles.themeToggleIcon}>{t('settings_theme_dark')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setThemeMode('light')}
              style={[styles.themeToggleOption, themeMode === 'light' && styles.themeToggleOptionActive]}
              activeOpacity={0.8}
            >
              <Text style={styles.themeToggleIcon}>{t('settings_theme_light')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* DİL SEÇİCİ */}
        <View style={styles.themeToggleContainer}>
          <Text style={styles.label}>{t('settings_language')}</Text>
          <View style={styles.themeToggle}>
            <TouchableOpacity
              onPress={() => setLang('tr')}
              style={[styles.themeToggleOption, lang === 'tr' && styles.themeToggleOptionActive]}
              activeOpacity={0.8}
            >
              <Text style={styles.themeToggleIcon}>{t('settings_language_tr')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setLang('en')}
              style={[styles.themeToggleOption, lang === 'en' && styles.themeToggleOptionActive]}
              activeOpacity={0.8}
            >
              <Text style={styles.themeToggleIcon}>{t('settings_language_en')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('settings_personal_section')}</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('settings_username')}</Text>
          <TextInput
            style={styles.input}
            value={formData.username}
            onChangeText={(val) => setFormData({ ...formData, username: val })}
            placeholder={t('settings_username_placeholder')}
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('settings_email_label')}</Text>
          <TextInput
            style={styles.input}
            value={formData.email}
            onChangeText={(val) => setFormData({ ...formData, email: val })}
            placeholder="email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('settings_phone_label')}</Text>
          <TextInput
            style={styles.input}
            value={formData.phone}
            onChangeText={(val) => setFormData({ ...formData, phone: val })}
            placeholder="0555 555 55 55"
            keyboardType="phone-pad"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('settings_city')}</Text>
          <TouchableOpacity
            style={styles.citySelector}
            activeOpacity={0.8}
            onPress={() => setCityModalVisible(true)}
          >
            <Text style={formData.city ? styles.inputText : styles.inputPlaceholder}>
              {formData.city ? formData.city : t('settings_city_placeholder')}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('settings_bio_label')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.bio}
            onChangeText={(val) => setFormData({ ...formData, bio: val })}
            placeholder={t('settings_bio_placeholder')}
            multiline
            numberOfLines={4}
            maxLength={150}
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <Text style={styles.sectionTitle}>{t('settings_spotify')}</Text>
        <View style={styles.spotifyCard}>
          <View style={styles.spotifyRow}>
            <View style={styles.spotifyIconWrap}>
              <Text style={{ fontSize: 28 }}>🎵</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.spotifyTitle, { color: colors.text }]}>
                {spotifyStatus?.connected ? t('settings_spotify_connected') : t('settings_spotify_connect')}
              </Text>
              <Text style={[styles.spotifyDesc, { color: colors.textSecondary }]}>
                {spotifyStatus?.connected
                  ? `@${spotifyStatus.spotifyDisplayName || '—'} · ${t('settings_spotify_connected_desc')}`
                  : t('settings_spotify_desc')}
              </Text>
            </View>
            {spotifyStatus?.connected ? (
              <View style={styles.connectedBadge}>
                <Text style={styles.connectedBadgeText}>✓</Text>
              </View>
            ) : null}
          </View>

          {spotifyStatus?.connected ? (
            <View style={styles.spotifyActions}>
              <TouchableOpacity
                style={styles.spotifySecondaryBtn}
                onPress={() => navigation.navigate('SpotifyRecommendations')}
                activeOpacity={0.8}
              >
                <Text style={styles.spotifySecondaryBtnText}>{t('settings_spotify_see_recs')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.spotifySecondaryBtn, { borderColor: '#E94560' }]}
                onPress={handleSpotifyDisconnect}
                activeOpacity={0.8}
              >
                <Text style={[styles.spotifySecondaryBtnText, { color: '#E94560' }]}>{t('settings_spotify_disconnect_btn')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleSpotifyConnect}
              disabled={spotifyLoading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#1DB954', '#158a3e']}
                style={styles.spotifyConnectBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {spotifyLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.spotifyConnectBtnText}>{t('settings_spotify_connect_btn')}</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          <LinearGradient
            colors={['#E94560', '#7C3AED']}
            style={styles.saveButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>{t('settings_save_btn')}</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* ŞEHİR SEÇİM MODALI */}
      <Modal visible={cityModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings_city_modal_title')}</Text>
              <TouchableOpacity onPress={() => setCityModalVisible(false)}>
                <Text style={styles.modalCloseText}>{t('settings_city_modal_close')}</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={TURKISH_CITIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cityListItem}
                  onPress={async () => {
                    setFormData(prev => ({ ...prev, city: item }));
                    try {
                      await updateSession({ userCity: item });
                    } catch (err) {
                      console.log('Şehir kaydedilemedi:', err.message);
                    }
                    setCityModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.cityListText,
                    formData.city === item && styles.cityListTextActive
                  ]}>{item}</Text>
                  {formData.city === item && <Text style={styles.checkIcon}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 60,
      paddingBottom: 20,
      paddingHorizontal: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: { width: 60 },
    backButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    scrollContent: { padding: 20, paddingBottom: 60 },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.textSecondary,
      marginBottom: 20,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    themeToggleContainer: { marginBottom: 30 },
    themeToggle: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    themeToggleOption: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeToggleOptionActive: {
      backgroundColor: 'rgba(233,69,96,0.15)', // Energetic accent color with opacity
    },
    themeToggleIcon: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '600',
    },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 13, color: colors.textSecondary, marginBottom: 8, fontWeight: '600' },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      color: colors.text,
      fontSize: 15,
    },
    textArea: { height: 100, textAlignVertical: 'top' },
    citySelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
    },
    inputText: { color: colors.text, fontSize: 15 },
    inputPlaceholder: { color: colors.textSecondary, fontSize: 15 },
    chevron: { color: colors.textSecondary, fontSize: 20 },
    saveButton: {
      padding: 16,
      borderRadius: 14,
      alignItems: 'center',
      marginTop: 20,
    },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    // SPOTIFY
    spotifyCard: {
      backgroundColor: colors.card, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.border, marginBottom: 24, gap: 14,
    },
    spotifyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    spotifyIconWrap: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: 'rgba(29,185,84,0.15)',
      justifyContent: 'center', alignItems: 'center',
    },
    spotifyTitle: { fontSize: 15, fontWeight: '800', marginBottom: 3 },
    spotifyDesc: { fontSize: 12, lineHeight: 17 },
    connectedBadge: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: '#1DB954', justifyContent: 'center', alignItems: 'center',
    },
    connectedBadgeText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    spotifyActions: { flexDirection: 'row', gap: 10 },
    spotifySecondaryBtn: {
      flex: 1, paddingVertical: 10, borderRadius: 10,
      borderWidth: 1.5, borderColor: '#1DB954', alignItems: 'center',
    },
    spotifySecondaryBtnText: { color: '#1DB954', fontWeight: '700', fontSize: 13 },
    spotifyConnectBtn: { padding: 14, borderRadius: 12, alignItems: 'center' },
    spotifyConnectBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

    // MODAL STYLES
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      height: '70%',
      padding: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 16,
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    modalCloseText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
    cityListItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cityListText: { fontSize: 16, color: colors.text },
    cityListTextActive: { fontWeight: 'bold', color: colors.primary },
    checkIcon: { fontSize: 18, color: colors.primary, fontWeight: 'bold' },
  });
}
