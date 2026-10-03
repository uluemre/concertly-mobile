import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Modal, FlatList, ActivityIndicator, Animated,
    Dimensions, Image, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { parseEventDate, dateLocale } from '../utils/time';
import { GENRE_SHORTCUTS } from '../constants/genres';
import { openEvent } from '../navigation/navHelpers';

const RECENT_KEY = 'recentSearches';
const RECENT_MAX = 8;

const { width, height } = Dimensions.get('window');

// ── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce(fn, delay) {
    const timer = useRef(null);
    return useCallback((...args) => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => fn(...args), delay);
    }, [fn, delay]);
}

// ── Arama Modalı ─────────────────────────────────────────────────────────────
export default function SearchModal({ visible, onClose, navigation }) {
    const { colors } = useTheme();
    const { session } = useAuth();
    const { t, lang } = useLanguage();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState({ events: [], artists: [], users: [], venues: [] });
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('events');
    const [searched, setSearched] = useState(false);
    const [recent, setRecent] = useState([]);
    const [popular, setPopular] = useState([]);

    const inputRef = useRef(null);
    // Sekme göstergesi: her sekmenin ölçülen konum/genişliğine kayar (yatay kaydırılabilir sekmeler)
    const tabScrollRef = useRef(null);
    const tabLayouts = useRef({});
    const indicatorX = useRef(new Animated.Value(0)).current;
    const indicatorW = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(height)).current;

    // Modal açılınca yukarı kay
    React.useEffect(() => {
        if (visible) {
            searchSeq.current++;
            setQuery('');
            setResults({ events: [], artists: [], users: [], venues: [] });
            setSearched(false);
            setActiveTab('events');
            AsyncStorage.getItem(RECENT_KEY)
                .then(v => setRecent(v ? JSON.parse(v) : []))
                .catch(() => {});
            if (popular.length === 0) {
                API.get('/artists/popular?limit=10')
                    .then(res => setPopular(Array.isArray(res.data) ? res.data : []))
                    .catch(() => {});
            }
            Animated.spring(slideAnim, {
                toValue: 0, tension: 65, friction: 11, useNativeDriver: true,
            }).start(() => inputRef.current?.focus());
        } else {
            Animated.timing(slideAnim, {
                toValue: height, duration: 250, useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    // Yalnızca en son aramanın cevabı ekrana yazılır (N-52): yavaş dönen eski
    // sorgu, yeni sorgunun sonucunun üstüne yazamaz
    const searchSeq = useRef(0);
    // Ekrandaki güncel metin: gecikmeli (debounce) çağrı, kutu temizlendikten
    // sonra eski metinle sonuç getirmesin
    const latestQuery = useRef('');
    latestQuery.current = query;

    const doSearch = useCallback(async (q) => {
        const seq = ++searchSeq.current;
        if (q.trim().length < 2 || q.trim() !== latestQuery.current.trim()) {
            setResults({ events: [], artists: [], users: [], venues: [] });
            setSearched(false);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await API.get(
                `/search?q=${encodeURIComponent(q)}&currentUserId=${session.userId}`
            );
            if (seq !== searchSeq.current) return;
            setResults(res.data);
            setSearched(true);
        } catch (err) {
            if (seq !== searchSeq.current) return;
            console.log('Arama hatası:', err.message);
        } finally {
            if (seq === searchSeq.current) setLoading(false);
        }
    }, []);

    const debouncedSearch = useDebounce(doSearch, 400);

    // Son aramalar: bir sonuca dokunulunca ya da klavyeden "ara" denince kaydedilir
    const rememberQuery = useCallback((q) => {
        const clean = (q || '').trim();
        if (clean.length < 2) return;
        setRecent(prev => {
            const next = [clean, ...prev.filter(x => x.toLowerCase() !== clean.toLowerCase())].slice(0, RECENT_MAX);
            AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
            return next;
        });
    }, []);

    const removeRecent = (q) => {
        setRecent(prev => {
            const next = prev.filter(x => x !== q);
            AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
            return next;
        });
    };

    const clearRecent = () => {
        setRecent([]);
        AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
    };

    const runRecent = (q) => {
        setQuery(q);
        latestQuery.current = q;
        doSearch(q);
    };

    const openGenre = (genre) => {
        onClose();
        navigation.navigate('MainApp', { screen: 'Events', params: { genre } });
    };

    const handleChangeText = (text) => {
        setQuery(text);
        latestQuery.current = text;
        debouncedSearch(text);
    };

    const moveIndicator = useCallback((tab, animate) => {
        const l = tabLayouts.current[tab];
        if (!l) return;
        if (animate) {
            Animated.parallel([
                Animated.spring(indicatorX, { toValue: l.x, tension: 70, friction: 10, useNativeDriver: false }),
                Animated.spring(indicatorW, { toValue: l.width, tension: 70, friction: 10, useNativeDriver: false }),
            ]).start();
        } else {
            indicatorX.setValue(l.x);
            indicatorW.setValue(l.width);
        }
        // Seçili sekme dar ekranda görünür kalsın
        tabScrollRef.current?.scrollTo({ x: Math.max(0, l.x - 24), animated: animate });
    }, [indicatorX, indicatorW]);

    const switchTab = (tab) => {
        setActiveTab(tab);
        moveIndicator(tab, true);
    };

    // Modal yeniden açılınca sekme 'events'e döner; gösterge de onu izler
    React.useEffect(() => { moveIndicator(activeTab, false); }, [activeTab, moveIndicator]);

    const onTabLayout = (tab) => (e) => {
        const { x, width } = e.nativeEvent.layout;
        tabLayouts.current[tab] = { x, width };
        // Sayılar değişince genişlik değişir; seçili sekmenin göstergesi güncel kalsın
        if (tab === activeTab) moveIndicator(tab, false);
    };

    // Adı aramayla eşleşen mekanlar (N-15). BUG-01: Etkinlikler sekmesine karışmasın diye
    // kendi "Mekanlar" sekmesinde gösterilir.
    const venues = results.venues || [];

    const totalResults =
        results.events.length + results.artists.length + results.users.length + venues.length;

    // ── Render fonksiyonları ──────────────────────────────────────────────────

    const renderEvent = ({ item, index }) => (
        <TouchableOpacity
            style={styles.resultCard}
            onPress={() => {
                rememberQuery(query);
                onClose();
                openEvent(navigation, item);
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
        >
            <View style={styles.resultIcon}>
                <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.resultInfo}>
                <Text style={styles.resultTitle} numberOfLines={1}>{item.name}</Text>
                <View style={styles.metaRow}>
                    {item.artistName ? (
                        <>
                            <Ionicons name="mic-outline" size={12} color={colors.textSecondary} />
                            <Text style={[styles.resultSub, styles.metaText]} numberOfLines={1}>{item.artistName}</Text>
                        </>
                    ) : null}
                    {item.venueCity ? (
                        <>
                            <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                            <Text style={[styles.resultSub, styles.metaText]} numberOfLines={1}>{item.venueCity}</Text>
                        </>
                    ) : null}
                </View>
                <View style={styles.metaRow}>
                    <Ionicons name="calendar-clear-outline" size={11} color={colors.textSecondary} />
                    <Text style={styles.resultDate}>
                        {parseEventDate(item.eventDate).toLocaleDateString(dateLocale(lang), {
                            day: 'numeric', month: 'short', year: 'numeric',
                        })}
                    </Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
    );

    const renderArtist = ({ item, index }) => (
        <TouchableOpacity
            style={styles.resultCard}
            onPress={() => {
                rememberQuery(query);
                onClose();
                navigation.navigate('ArtistProfile', {
                    artistId: item.id,
                    artistName: item.name,
                });
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
        >
            {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.artistAvatar} />
            ) : (
                <View style={styles.resultIcon}>
                    <Ionicons name="mic-outline" size={22} color={colors.primary} />
                </View>
            )}
            <View style={styles.resultInfo}>
                <Text style={styles.resultTitle} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.resultSub}>
                    {item.followerCount || 0} {t('search_followers')}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
    );

    const renderUser = ({ item, index }) => (
        <TouchableOpacity
            style={styles.resultCard}
            onPress={() => {
                rememberQuery(query);
                onClose();
                navigation.navigate('UserProfile', { userId: item.id });
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
        >
            <View style={styles.resultIcon}>
                <Text style={styles.resultIconText}>
                    {item.username?.charAt(0).toUpperCase() || '?'}
                </Text>
            </View>
            <View style={styles.resultInfo}>
                <Text style={styles.resultTitle}>@{item.username}</Text>
                {!!item.city && (
                    <View style={styles.metaRow}>
                        <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                        <Text style={[styles.resultSub, styles.metaText]}>{item.city}</Text>
                    </View>
                )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
    );

    const renderVenue = ({ item: v, index }) => (
        <TouchableOpacity
            style={styles.resultCard}
            onPress={() => {
                rememberQuery(query);
                onClose();
                navigation.navigate('VenueProfile', { venueId: v.id, venueName: v.name });
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
        >
            <View style={styles.resultIcon}>
                <Ionicons name="location-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.resultInfo}>
                <Text style={styles.resultTitle} numberOfLines={1}>{v.name}</Text>
                {!!v.city && <Text style={styles.resultSub} numberOfLines={1}>{v.city}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
    );

    const activeData =
        activeTab === 'events' ? results.events :
            activeTab === 'artists' ? results.artists :
                activeTab === 'venues' ? venues :
                    results.users;

    const renderItem = activeTab === 'events' ? renderEvent :
        activeTab === 'artists' ? renderArtist :
            activeTab === 'venues' ? renderVenue :
                renderUser;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <Animated.View
                style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                    {/* ARAMA BAŞLIĞI */}
                    <View style={styles.header}>
                        <View style={styles.searchBox}>
                            <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
                            <TextInput
                                ref={inputRef}
                                style={styles.searchInput}
                                placeholder={t('search_modal_placeholder')}
                                placeholderTextColor={colors.textSecondary}
                                value={query}
                                maxLength={100}
                                onChangeText={handleChangeText}
                                autoCapitalize="none"
                                returnKeyType="search"
                                onSubmitEditing={() => { rememberQuery(query); doSearch(query); }}
                            />
                            {query.length > 0 && (
                                <TouchableOpacity onPress={() => {
                                    searchSeq.current++;
                                    setLoading(false);
                                    setQuery('');
                                    setResults({ events: [], artists: [], users: [], venues: [] });
                                    setSearched(false);
                                }} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={8}>
                                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.cancelBtn} accessibilityRole="button">
                            <Text style={styles.cancelText}>{t('cancel')}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* SEKMELER */}
                    {searched && (
                        <View style={styles.tabBarWrapper}>
                            <ScrollView
                                ref={tabScrollRef}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.tabBar}
                                contentContainerStyle={styles.tabBarContent}
                                keyboardShouldPersistTaps="handled"
                            >
                                <Animated.View style={[styles.tabIndicator, { left: indicatorX, width: indicatorW }]} />
                                {[
                                    { key: 'events', label: `${t('search_events')} (${results.events.length})`, index: 0 },
                                    { key: 'artists', label: `${t('search_artists')} (${results.artists.length})`, index: 1 },
                                    { key: 'users', label: `${t('search_users')} (${results.users.length})`, index: 2 },
                                    { key: 'venues', label: `${t('search_venues')} (${venues.length})`, index: 3 },
                                ].map(tab => (
                                    <TouchableOpacity
                                        key={tab.key}
                                        style={styles.tabBtn}
                                        onPress={() => switchTab(tab.key)}
                                        onLayout={onTabLayout(tab.key)}
                                        accessibilityRole="tab"
                                        accessibilityState={{ selected: activeTab === tab.key }}
                                    >
                                        <Text style={[
                                            styles.tabText,
                                            activeTab === tab.key && styles.tabTextActive,
                                        ]}>
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* SONUÇLAR */}
                    {loading ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : !searched ? (
                        // Boş bekleme ekranı yerine keşif: son aramalar, popüler sanatçılar, türler
                        <ScrollView
                            contentContainerStyle={styles.discover}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {recent.length > 0 && (
                                <View style={styles.discoverSection}>
                                    <View style={styles.discoverHead}>
                                        <Text style={styles.discoverTitle}>{t('search_recent')}</Text>
                                        <TouchableOpacity onPress={clearRecent} hitSlop={10}>
                                            <Text style={styles.discoverAction}>{t('search_clear_recent')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {recent.map(q => (
                                        <TouchableOpacity key={q} style={styles.recentRow} onPress={() => runRecent(q)} activeOpacity={0.7} accessibilityRole="button">
                                            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                                            <Text style={styles.recentText} numberOfLines={1}>{q}</Text>
                                            <TouchableOpacity onPress={() => removeRecent(q)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('delete')}>
                                                <Ionicons name="close" size={16} color={colors.textSecondary} style={styles.recentRemove} />
                                            </TouchableOpacity>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {popular.length > 0 && (
                                <View style={styles.discoverSection}>
                                    <Text style={styles.discoverTitle}>{t('search_popular_artists')}</Text>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.popularRow}
                                        keyboardShouldPersistTaps="handled"
                                    >
                                        {popular.map(a => (
                                            <TouchableOpacity
                                                key={a.id}
                                                style={styles.popularItem}
                                                activeOpacity={0.8}
                                                accessibilityRole="button"
                                                accessibilityLabel={a.name}
                                                onPress={() => {
                                                    onClose();
                                                    navigation.navigate('ArtistProfile', { artistId: a.id, artistName: a.name });
                                                }}
                                            >
                                                <Image source={{ uri: a.imageUrl }} style={styles.popularAvatar} />
                                                <Text style={styles.popularName} numberOfLines={2}>{a.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            <View style={styles.discoverSection}>
                                <Text style={styles.discoverTitle}>{t('search_by_genre')}</Text>
                                <View style={styles.genreGrid}>
                                    {GENRE_SHORTCUTS.map(g => (
                                        <TouchableOpacity key={g.name} style={styles.genreTileWrap} onPress={() => openGenre(g.name)} activeOpacity={0.85} accessibilityRole="button">
                                            <View style={[styles.genreTile, { backgroundColor: g.color }]}>
                                                <Text style={styles.genreTileName}>{g.name}</Text>
                                                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.85)" />
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <Text style={styles.discoverHint}>{t('search_min_chars')}</Text>
                        </ScrollView>
                    ) : totalResults === 0 ? (
                        <View style={styles.center}>
                            <Ionicons name="search-outline" size={48} color={colors.textSecondary} style={styles.hintEmoji} />
                            <Text style={styles.hintText}>"{query}" {t('search_no_results_for')}</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={activeData}
                            keyExtractor={(item) => String(item.id)}
                            renderItem={renderItem}
                            contentContainerStyle={styles.list}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={(
                                <View style={styles.center}>
                                    <Ionicons name="file-tray-outline" size={48} color={colors.textSecondary} style={styles.hintEmoji} />
                                    <Text style={styles.hintText}>{t('search_category_empty')}</Text>
                                </View>
                            )}
                        />
                    )}
                </KeyboardAvoidingView>
            </Animated.View>
        </Modal>
    );
}

function createStyles(colors) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
            paddingTop: Platform.OS === 'ios' ? 56 : 32,
        },

        // HEADER
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingBottom: 12,
            gap: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        searchBox: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
            gap: 8,
            borderWidth: 1,
            borderColor: colors.border,
        },
        searchIcon: { fontSize: 16 },
        searchInput: { flex: 1, color: colors.text, fontSize: 15 },
        cancelBtn: { paddingVertical: 8, paddingHorizontal: 4 },
        cancelText: { color: colors.primary, fontSize: 15, fontWeight: '600' },

        // SEKMELER
        tabBarWrapper: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        tabBar: {
            flexGrow: 0,
            backgroundColor: colors.cardAlt,
            borderRadius: 12,
        },
        tabBarContent: {
            flexDirection: 'row',
            padding: 4,
            position: 'relative',
        },
        tabIndicator: {
            position: 'absolute',
            top: 4, bottom: 4,
            backgroundColor: colors.primary,
            borderRadius: 8,
        },
        tabBtn: { paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center', zIndex: 1 },
        tabText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
        tabTextActive: { color: colors.text },

        // LİSTE
        list: { padding: 16, paddingBottom: 40 },

        // SONUÇ KARTI
        resultCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            borderRadius: 14,
            padding: 12,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
        },
        resultIcon: {
            width: 48, height: 48, borderRadius: 14,
            justifyContent: 'center', alignItems: 'center',
            backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
        },
        resultIconText: { fontSize: 20, fontWeight: 'bold', color: colors.text },
        artistAvatar: { width: 48, height: 48, borderRadius: 24 },
        resultInfo: { flex: 1 },
        resultTitle: {
            fontSize: 14, fontWeight: 'bold',
            color: colors.text, marginBottom: 3,
        },
        resultSub: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
        metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
        metaText: { marginBottom: 0, flexShrink: 1, marginRight: 6 },
        resultDate: { fontSize: 11, color: colors.textSecondary },

        // BOŞ / HINT
        center: {
            flex: 1, justifyContent: 'center',
            alignItems: 'center', paddingTop: 80,
        },
        hintEmoji: { marginBottom: 14 },

        // KEŞİF (boş arama)
        discover: { padding: 16, paddingBottom: 48, gap: 22 },
        discoverSection: { gap: 10 },
        discoverHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        discoverTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
        discoverAction: { color: colors.primary, fontSize: 13, fontWeight: '700' },
        recentRow: {
            flexDirection: 'row', alignItems: 'center', gap: 10,
            paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
        },
        recentText: { flex: 1, color: colors.text, fontSize: 15 },
        recentRemove: { paddingHorizontal: 4 },
        popularRow: { gap: 14, paddingRight: 8 },
        popularItem: { width: 72, alignItems: 'center' },
        popularAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.card },
        popularName: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 6 },
        genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
        genreTileWrap: { width: '48%', flexGrow: 1, borderRadius: 14, overflow: 'hidden' },
        genreTile: { height: 64, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        genreTileName: { color: '#fff', fontSize: 16, fontWeight: '800' },
        discoverHint: { color: colors.textSecondary, fontSize: 12, textAlign: 'center' },
        hintText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center' },
    });
}