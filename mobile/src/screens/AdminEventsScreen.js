import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, Modal, TextInput, ScrollView,
  RefreshControl, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';

const TABS = [
  { key: 'pending', labelKey: 'admin_tab_pending' },
  { key: 'approved', labelKey: 'admin_tab_approved' },
  { key: 'all', labelKey: 'admin_tab_all' },
];

const INITIAL_FORM = {
  name: '', description: '', eventDate: '', ticketUrl: '',
  artistName: '', artistGenre: '',
  venueName: '', venueCity: 'Ankara', venueCountry: 'Türkiye',
  venueAddress: '', venueLatitude: '', venueLongitude: '',
};

const FORM_FIELDS = [
  { key: 'name',          labelKey: 'admin_field_name',        multiline: false },
  { key: 'description',   labelKey: 'admin_field_description', multiline: true  },
  { key: 'eventDate',     labelKey: 'admin_field_date',        multiline: false },
  { key: 'ticketUrl',     labelKey: 'admin_field_ticket_url',  multiline: false },
  { key: 'artistName',    labelKey: 'admin_field_artist_name', multiline: false },
  { key: 'artistGenre',   labelKey: 'admin_field_genre',       multiline: false },
  { key: 'venueName',     labelKey: 'admin_field_venue_name',  multiline: false },
  { key: 'venueCity',     labelKey: 'admin_field_city',        multiline: false },
  { key: 'venueCountry',  labelKey: 'admin_field_country',     multiline: false },
  { key: 'venueAddress',  labelKey: 'admin_field_address',     multiline: false },
  { key: 'venueLatitude', labelKey: 'admin_field_lat',         multiline: false, numeric: true },
  { key: 'venueLongitude',labelKey: 'admin_field_lng',         multiline: false, numeric: true },
];

function formatDate(dateStr, lang) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminEventsScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tabAnim = useRef(new Animated.Value(0)).current;

  const initialTab = route.params?.filter === 'pending' ? 'pending' : 'pending';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const param = activeTab === 'pending' ? '?approved=false'
        : activeTab === 'approved' ? '?approved=true' : '';
      const res = await API.get(`/admin/events${param}`);
      setEvents(res.data);
    } catch (err) {
      console.log('Admin events error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => { setLoading(true); fetchEvents(); }, [activeTab]);

  // Route'dan openCreate parametresi
  useEffect(() => {
    if (route.params?.openCreate) openCreate();
  }, []);

  const switchTab = (tab, idx) => {
    setActiveTab(tab);
    Animated.spring(tabAnim, { toValue: idx, tension: 70, friction: 10, useNativeDriver: false }).start();
  };

  const openCreate = () => {
    setEditingEvent(null);
    setForm(INITIAL_FORM);
    setModalVisible(true);
  };

  const openEdit = (ev) => {
    setEditingEvent(ev);
    setForm({
      name: ev.name || '',
      description: ev.description || '',
      eventDate: ev.eventDate ? ev.eventDate.replace('T', ' ').substring(0, 16) : '',
      ticketUrl: ev.ticketUrl || '',
      artistName: ev.artistName || '',
      artistGenre: ev.artistGenre || '',
      venueName: ev.venueName || '',
      venueCity: ev.venueCity || '',
      venueCountry: ev.venueCountry || '',
      venueAddress: ev.venueAddress || '',
      venueLatitude: ev.venueLatitude ? String(ev.venueLatitude) : '',
      venueLongitude: ev.venueLongitude ? String(ev.venueLongitude) : '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert(t('error'), t('admin_name_required')); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        eventDate: form.eventDate.trim() ? form.eventDate.trim().replace(' ', 'T') : null,
        ticketUrl: form.ticketUrl.trim() || null,
        artistName: form.artistName.trim() || null,
        artistGenre: form.artistGenre.trim() || null,
        venueName: form.venueName.trim() || null,
        venueCity: form.venueCity.trim() || null,
        venueCountry: form.venueCountry.trim() || null,
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
      Alert.alert(t('error'), t('admin_op_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = (ev) => {
    Alert.alert(t('admin_approve_title'), t('admin_approve_msg', { name: ev.name }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('admin_approve_title'), onPress: async () => {
          try {
            await API.patch(`/admin/events/${ev.id}/approve`);
            fetchEvents();
          } catch { Alert.alert(t('error'), t('admin_approve_error')); }
        },
      },
    ]);
  };

  const handleDelete = (ev) => {
    Alert.alert(t('admin_event_delete_title'), t('admin_event_delete_msg', { name: ev.name }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: async () => {
          try {
            await API.delete(`/admin/events/${ev.id}`);
            fetchEvents();
          } catch { Alert.alert(t('error'), t('admin_event_delete_error')); }
        },
      },
    ]);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return events;
    const q = search.toLowerCase();
    return events.filter(e =>
      e.name?.toLowerCase().includes(q) ||
      e.artistName?.toLowerCase().includes(q) ||
      e.venueCity?.toLowerCase().includes(q)
    );
  }, [events, search]);

  const indicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ['0%', '33.33%', '66.66%'],
  });

  const renderEvent = ({ item }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* STATUS STRIP */}
      <View style={[styles.cardStrip, { backgroundColor: item.isApproved ? '#00D4AA' : '#F5A623' }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
              {[item.artistName, item.venueCity].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={[styles.statusBadge, {
            backgroundColor: item.isApproved ? '#00D4AA22' : '#F5A62322',
          }]}>
            <Text style={[styles.statusBadgeText, { color: item.isApproved ? '#00D4AA' : '#F5A623' }]}>
              {item.isApproved ? t('admin_status_approved_label') : t('admin_status_pending_label')}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <Text style={[styles.cardDetail, { color: colors.textSecondary }]}>
            📅 {formatDate(item.eventDate, lang)}
          </Text>
          {item.genre && (
            <View style={[styles.genrePill, { backgroundColor: colors.primary + '22' }]}>
              <Text style={[styles.genrePillText, { color: colors.primary }]}>{item.genre}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardActions}>
          {!item.isApproved && (
            <TouchableOpacity
              onPress={() => handleApprove(item)}
              style={[styles.actionBtn, { backgroundColor: '#00D4AA20', borderColor: '#00D4AA50' }]}
            >
              <Text style={[styles.actionBtnText, { color: '#00D4AA' }]}>{t('admin_action_approve')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => openEdit(item)}
            style={[styles.actionBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
          >
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>{t('admin_action_edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            style={[styles.actionBtn, { backgroundColor: '#E9456020', borderColor: '#E9456050' }]}
          >
            <Text style={[styles.actionBtnText, { color: '#E94560' }]}>{t('admin_action_delete')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: colors.primary }]}>{t('back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('admin_events_title')}</Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{t('admin_events_count', { count: filtered.length })}</Text>
          </View>
          <TouchableOpacity onPress={openCreate} activeOpacity={0.85}>
            <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.addBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.addBtnText}>{t('admin_add_btn')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* SEARCH */}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 16 }}>⌕</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('admin_events_search')}
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: colors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* TABS */}
      <View style={[styles.tabsWrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Animated.View style={[styles.tabIndicatorLine, { left: indicatorLeft, backgroundColor: colors.primary }]} />
        {TABS.map((tab, idx) => (
          <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => switchTab(tab.key, idx)}>
            <Text style={[styles.tabText, { color: activeTab === tab.key ? colors.primary : colors.textSecondary }]}>
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderEvent}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎭</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {search ? t('admin_no_search_results') : t('admin_events_empty')}
              </Text>
            </View>
          }
        />
      )}

      {/* FORM MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingEvent ? t('admin_modal_edit') : t('admin_modal_new')}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 22 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {FORM_FIELDS.map(field => (
                  <View key={field.key}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t(field.labelKey)}</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                        field.multiline && { height: 80, textAlignVertical: 'top' },
                      ]}
                      placeholder={t(field.labelKey)}
                      placeholderTextColor={colors.textSecondary}
                      value={form[field.key]}
                      onChangeText={v => setForm(f => ({ ...f, [field.key]: v }))}
                      keyboardType={field.numeric ? 'decimal-pad' : 'default'}
                      multiline={field.multiline}
                    />
                  </View>
                ))}

                <View style={styles.modalBtns}>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={[styles.cancelBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} disabled={saving} style={{ flex: 1 }}>
                    <LinearGradient
                      colors={['#E94560', '#7C3AED']}
                      style={styles.saveBtn}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    >
                      {saving
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.saveBtnText}>{t('admin_save_btn')}</Text>}
                    </LinearGradient>
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
    header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, gap: 12 },
    backText: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { fontSize: 26, fontWeight: '900' },
    headerSub: { fontSize: 12, marginTop: 2 },
    addBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
    addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderWidth: 1, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 11,
    },
    searchInput: { flex: 1, fontSize: 14 },

    tabsWrap: {
      flexDirection: 'row', borderBottomWidth: 1, position: 'relative',
    },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 14 },
    tabText: { fontSize: 13, fontWeight: '700' },
    tabIndicatorLine: {
      position: 'absolute', bottom: 0, height: 2,
      width: '33.33%', borderRadius: 2,
    },

    // EVENT CARD
    card: {
      flexDirection: 'row', borderRadius: 16, borderWidth: 1,
      marginBottom: 12, overflow: 'hidden',
    },
    cardStrip: { width: 4 },
    cardBody: { flex: 1, padding: 14 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
    cardName: { fontSize: 15, fontWeight: '800', marginBottom: 3 },
    cardMeta: { fontSize: 12 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    statusBadgeText: { fontSize: 11, fontWeight: '800' },
    cardDetails: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    cardDetail: { fontSize: 12 },
    genrePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    genrePillText: { fontSize: 11, fontWeight: '700' },
    cardActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    actionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
    actionBtnText: { fontSize: 12, fontWeight: '700' },

    empty: { alignItems: 'center', paddingVertical: 80 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 15 },

    // MODAL
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
    modalBox: {
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderWidth: 1, padding: 24, maxHeight: '92%',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 19, fontWeight: '800' },
    fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
    input: { borderWidth: 1, borderRadius: 12, padding: 13, fontSize: 14 },
    modalBtns: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 8 },
    cancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
    cancelBtnText: { fontSize: 14, fontWeight: '700' },
    saveBtn: { padding: 14, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  });
}
