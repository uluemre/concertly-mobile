import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, Modal, FlatList
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';

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
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    bio: '',
    city: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      // Backend'deki getUserProfile endpoint'i
      const res = await API.get(`/users/${global.userId}/profile`);
      const data = res.data;
      setFormData({
        username: data.username || '',
        email: data.email || '',
        phone: data.phone || '',
        bio: data.bio || '',
        city: data.city || ''
      });
    } catch (err) {
      Alert.alert('Hata', 'Profil bilgileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.put(`/users/${global.userId}/profile`, formData);
      if (formData.city) {
        global.userCity = formData.city;
      }
      Alert.alert('✅ Başarılı', 'Ayarların başarıyla kaydedildi!', [
        { text: 'Tamam', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      Alert.alert('Hata', 'Ayarlar kaydedilirken bir sorun oluştu. Email veya kullanıcı adı başkası tarafından kullanılıyor olabilir.');
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
          <Text style={styles.backButtonText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ayarlar</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Uygulama Görünümü</Text>

        <View style={styles.themeToggleContainer}>
          <Text style={styles.label}>Tema</Text>
          <View style={styles.themeToggle}>
            <TouchableOpacity
              onPress={() => setThemeMode('dark')}
              style={[styles.themeToggleOption, themeMode === 'dark' && styles.themeToggleOptionActive]}
              activeOpacity={0.8}
            >
              <Text style={styles.themeToggleIcon}>🌙 Koyu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setThemeMode('light')}
              style={[styles.themeToggleOption, themeMode === 'light' && styles.themeToggleOptionActive]}
              activeOpacity={0.8}
            >
              <Text style={styles.themeToggleIcon}>☀️ Açık</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Kullanıcı Adı</Text>
          <TextInput
            style={styles.input}
            value={formData.username}
            onChangeText={(t) => setFormData({ ...formData, username: t })}
            placeholder="@kullanici_adi"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>E-Posta</Text>
          <TextInput
            style={styles.input}
            value={formData.email}
            onChangeText={(t) => setFormData({ ...formData, email: t })}
            placeholder="ornek@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Telefon Numarası</Text>
          <TextInput
            style={styles.input}
            value={formData.phone}
            onChangeText={(t) => setFormData({ ...formData, phone: t })}
            placeholder="0555 555 55 55"
            keyboardType="phone-pad"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Şehir</Text>
          <TouchableOpacity
            style={styles.citySelector}
            activeOpacity={0.8}
            onPress={() => setCityModalVisible(true)}
          >
            <Text style={formData.city ? styles.inputText : styles.inputPlaceholder}>
              {formData.city ? formData.city : 'Bir şehir seçin'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Hakkımda (Bio)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.bio}
            onChangeText={(t) => setFormData({ ...formData, bio: t })}
            placeholder="Kendinden bahset..."
            multiline
            numberOfLines={4}
            maxLength={150}
            placeholderTextColor={colors.textSecondary}
          />
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
              <Text style={styles.saveButtonText}>Değişiklikleri Kaydet</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* ŞEHİR SEÇİM MODALI */}
      <Modal visible={cityModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Şehir Seç</Text>
              <TouchableOpacity onPress={() => setCityModalVisible(false)}>
                <Text style={styles.modalCloseText}>Kapat</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={TURKISH_CITIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cityListItem}
                  onPress={() => {
                    setFormData({ ...formData, city: item });
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
