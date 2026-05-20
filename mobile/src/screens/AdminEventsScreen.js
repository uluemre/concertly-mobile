import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, Modal, TextInput, ScrollView,
  RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import API from '../services/api';

const TABS = [
  { key: 'pending', label: 'Bekleyen' },
  { key: 'all', label: 'Tumu' },
];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminEventsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState('pending');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const [form, setForm] = useState({
    name: '', description: '', eventDate: '',
    artistName: '', artistGenre: '',
    venueName: '', venueCity: 'Ankara', venueAddress: '',
    venueLatitude: '', venueLongitude: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchEvents = async () => {
    try {
      const param = activeTab === 'pending' ? '?approved=false' : '';
      const res = await API.get(`/admin/events${param}`);
      setEvents(res.data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { setLoading(true); fetchEvents(); }, [activeTab]);

  const openCreate = () => {
    setEditingEvent(null);
    setForm({ name: '', description: '', eventDate: '', artistName: '', artistGenre: '', venueName: '', venueCity: 'Ankara', venueAddress: '', venueLatitude: '', venueLongitude: '' });
    setModalVisible(true);
  };

  const openEdit = (event) => {
    setEditingEvent(event);
    setForm({
      name: event.name || '',
      description: event.description || '',
      eventDate: event.eventDate ? event.eventDate.replace('T', ' ').substring(0, 16) : '',
      artistName: event.artistName || '',
      artistGenre: event.artistGenre || '',
      venueName: event.venueName || '',
      venueCity: event.venueCity || '',
      venueAddress: event.venueAddress || '',
      venueLatitude: event.venueLatitude ? String(event.venueLatitude) : '',
      venueLongitude: event.venueLongitude ? String(event.venueLongitude) : '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Hata', 'Etkinlik adi gerekli.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        eventDate: form.eventDate.trim() ? form.eventDate.trim().replace(' ', 'T') : null,
        artistName: form.artistName.trim() || null,
        artistGenre: form.artistGenre.trim() || null,
        venueName: form.venueName.trim() || null,
        venueCity: form.venueCity.trim() || null,
        venueAddress: form.venueAddress.trim() || null,
        venueLatitude: form.venueLatitude ? parseFloat(form.venueLatitude) : null,
        venueLongitude: form.venueLongitude ? parseFloat(form.venueLongitude) : null,
      };
      if (editingEvent) {
        await API.put(`/admin/events/${editingEvent.id}`, payload);
      } else {
        await API.post('/admin/events', payload);
      }
      setModalVisible(false);
      fetchEvents();
    } catch {
      Alert.alert('Hata', 'Islem basarisiz.');
    }
    setSaving(false);
  };

  const handleApprove = (event) => {
    Alert.alert('Onayla', `"${event.name}" etkinligini onaylamak istiyor musun?`, [
      { text: 'Iptal', style: 'cancel' },
      {
        text: 'Onayla', onPress: async () => {
          try {
            await API.patch(`/events/${event.id}/approve`);
            fetchEvents();
          } catch { Alert.alert('Hata', 'Onaylanamadi.'); }
        },
      },
    ]);
  };

  const handleDelete = (event) => {
    Alert.alert('Sil', `"${event.name}" etkinligini silmek istiyor musun?`, [
      { text: 'Iptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          try {
            await API.delete(`/admin/events/${event.id}`);
            fetchEvents();
          } catch { Alert.alert('Hata', 'Silinemedi.'); }
        },
      },
    ]);
  };

  const renderEvent = ({ item }) => (
    <View style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.eventInfo}>
        <Text style={[styles.eventName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.eventMeta, { color: colors.textSecondary }]}>{item.artistName} • {item.venueCity}</Text>
        <Text style={[styles.eventDate, { color: colors.textSecondary }]}>{formatDate(item.eventDate)}</Text>
      </View>
      <View style={styles.eventActions}>
        {!item.isApproved && (
          <TouchableOpacity onPress={() => handleApprove(item)} style={[styles.actionBtn, { backgroundColor: '#00D4AA22' }]}>
            <Text style={[styles.actionBtnText, { color: '#00D4AA' }]}>Onayla</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => openEdit(item)} style={[styles.actionBtn, { backgroundColor: colors.cardAlt }]}>
          <Text style={[styles.actionBtnText, { color: colors.primary }]}>Duzenle</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.actionBtn, { backgroundColor: '#E9456022' }]}>
          <Text style={[styles.actionBtnText, { color: '#E94560' }]}>Sil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Geri</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Etkinlikler</Text>
          <TouchableOpacity onPress={openCreate} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.addBtnText}>+ Ekle</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={[styles.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tab, activeTab === tab.key && styles.tabActive]}>
            <Text style={[styles.tabText, { color: activeTab === tab.key ? colors.primary : colors.textSecondary }]}>{tab.label}</Text>
            {activeTab === tab.key && <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={item => String(item.id)}
          renderItem={renderEvent}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>Etkinlik yok.</Text>}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingEvent ? 'Etkinligi Duzenle' : 'Yeni Etkinlik'}
                </Text>

                {[
                  { key: 'name', placeholder: 'Etkinlik Adi *' },
                  { key: 'description', placeholder: 'Aciklama' },
                  { key: 'eventDate', placeholder: 'Tarih (2026-06-15T20:00)' },
                  { key: 'artistName', placeholder: 'Sanatci Adi' },
                  { key: 'artistGenre', placeholder: 'Tur (Pop, Rock, vs.)' },
                  { key: 'venueName', placeholder: 'Mekan Adi' },
                  { key: 'venueCity', placeholder: 'Sehir' },
                  { key: 'venueAddress', placeholder: 'Adres' },
                  { key: 'venueLatitude', placeholder: 'Enlem (39.908368)' },
                  { key: 'venueLongitude', placeholder: 'Boylam (32.752193)' },
                ].map(field => (
                  <TextInput
                    key={field.key}
                    style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textSecondary}
                    value={form[field.key]}
                    onChangeText={v => setForm(f => ({ ...f, [field.key]: v }))}
                    keyboardType={field.key.includes('atitude') || field.key.includes('ongitude') ? 'decimal-pad' : 'default'}
                  />
                ))}

                <View style={styles.modalButtons}>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                    <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Iptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Kaydet</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 },
    backBtn: { marginBottom: 8 },
    backText: { fontSize: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { fontSize: 26, fontWeight: 'bold' },
    addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    tabs: { flexDirection: 'row', borderBottomWidth: 1 },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative' },
    tabActive: {},
    tabText: { fontSize: 14, fontWeight: '600' },
    tabIndicator: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, borderRadius: 2 },

    eventCard: {
      borderRadius: 14, borderWidth: 1, padding: 14,
      marginBottom: 10,
    },
    eventInfo: { marginBottom: 10 },
    eventName: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
    eventMeta: { fontSize: 12, marginBottom: 2 },
    eventDate: { fontSize: 12 },
    eventActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    actionBtnText: { fontSize: 12, fontWeight: '700' },

    empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalBox: {
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderWidth: 1, padding: 24, maxHeight: '90%',
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
    input: {
      borderWidth: 1, borderRadius: 10, padding: 12,
      fontSize: 14, marginBottom: 10,
    },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
    cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
    cancelBtnText: { fontSize: 14, fontWeight: '600' },
    saveBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  });
}
