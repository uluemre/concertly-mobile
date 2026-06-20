import React, { useRef, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Dimensions, Animated, FlatList, StatusBar, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../context/LanguageContext';

const { width, height } = Dimensions.get('window');

// Her slayt app'in bir özellik kümesini tanıtır. `visual` alanı, o slaytta
// emoji yerine gösterilecek kod-mockup'ı (app UI'ını taklit eden kart) seçer.
const SLIDE_DEFS = [
    { key: '1', visual: 'welcome',  titleKey: 'onb_slide1_title', subKey: 'onb_slide1_sub', gradient: ['#0F0F1A', '#1A1A2E'], accent: '#E94560' },
    { key: '2', visual: 'discover', titleKey: 'onb_slide2_title', subKey: 'onb_slide2_sub', gradient: ['#0F0F1A', '#16213E'], accent: '#00D4AA' },
    { key: '3', visual: 'verify',   titleKey: 'onb_slide3_title', subKey: 'onb_slide3_sub', gradient: ['#0F0F1A', '#1A1A2E'], accent: '#7C3AED' },
    { key: '4', visual: 'social',   titleKey: 'onb_slide4_title', subKey: 'onb_slide4_sub', gradient: ['#0F0F1A', '#16213E'], accent: '#F5A623' },
    { key: '5', visual: 'passport', titleKey: 'onb_slide5_title', subKey: 'onb_slide5_sub', gradient: ['#0F0F1A', '#1A1A2E'], accent: '#3B82F6' },
    { key: '6', visual: 'games',    titleKey: 'onb_slide6_title', subKey: 'onb_slide6_sub', gradient: ['#0F0F1A', '#16213E'], accent: '#E94560', isLast: true },
];

/* ----------------------- Kod-mockup görselleri ----------------------- */

function MockWelcome({ accent }) {
    return (
        <View style={styles.welcomeWrap}>
            <View style={[styles.welcomeGlow, { backgroundColor: accent + '22' }]} />
            <Image
                source={require('../../assets/icon.png')}
                style={styles.welcomeIcon}
                resizeMode="contain"
            />
        </View>
    );
}

function MockEventCard({ accent, t }) {
    return (
        <View style={styles.mockCard}>
            <LinearGradient
                colors={[accent, '#1A1A2E']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.mockPoster}
            >
                <Text style={styles.mockPosterEmoji}>🎶</Text>
                <View style={[styles.mockDatePill, { backgroundColor: accent }]}>
                    <Text style={styles.mockDatePillText}>{t('onb_m_date')}</Text>
                </View>
            </LinearGradient>
            <View style={styles.mockCardBody}>
                <Text style={styles.mockCardTitle} numberOfLines={1}>{t('onb_m_event')}</Text>
                <Text style={styles.mockCardSub}>📍 {t('onb_m_city')}</Text>
            </View>
        </View>
    );
}

function MockVerify({ accent, t }) {
    return (
        <View style={styles.mockStack}>
            <View style={[styles.mockBadge, { borderColor: accent + '55', backgroundColor: accent + '18' }]}>
                <Text style={[styles.mockBadgeCheck, { color: accent }]}>✅</Text>
                <Text style={styles.mockBadgeText}>{t('onb_m_verified')}</Text>
            </View>
            <View style={styles.mockPost}>
                <View style={[styles.mockAvatar, { backgroundColor: accent }]} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.mockPostText} numberOfLines={1}>{t('onb_m_post')}</Text>
                    <Text style={styles.mockPostMeta}>❤️ 248   💬 31</Text>
                </View>
            </View>
        </View>
    );
}

function MockSocial({ accent, t }) {
    return (
        <View style={styles.mockStack}>
            <View style={styles.mockRow}>
                <LinearGradient
                    colors={[accent, '#7C3AED']}
                    style={styles.mockArtistAvatar}
                >
                    <Text style={styles.mockArtistEmoji}>🎤</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                    <Text style={styles.mockCardTitle}>Hadise</Text>
                    <Text style={styles.mockCardSub}>1.2M</Text>
                </View>
                <View style={[styles.mockFollow, { backgroundColor: accent }]}>
                    <Text style={styles.mockFollowText}>🔔 {t('onb_m_following')}</Text>
                </View>
            </View>
            <View style={[styles.mockCommunity, { borderColor: accent + '40' }]}>
                <Text style={styles.mockCommunityText}>🎸 {t('onb_m_community')}</Text>
                <Text style={styles.mockCardSub}>3.4k</Text>
            </View>
        </View>
    );
}

function MockPassport({ accent, t }) {
    const bars = [0.5, 0.8, 0.35, 1, 0.65];
    return (
        <View style={styles.mockStack}>
            <LinearGradient
                colors={[accent, '#1A1A2E']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.mockPassport}
            >
                <Text style={styles.mockPassportLabel}>{t('onb_m_thisyear')}</Text>
                <Text style={styles.mockPassportBig}>{t('onb_m_concerts')}</Text>
                <View style={styles.mockStamps}>
                    <Text style={styles.mockStamp}>🎫</Text>
                    <Text style={styles.mockStamp}>🎫</Text>
                    <Text style={styles.mockStamp}>🎫</Text>
                    <Text style={styles.mockStamp}>＋</Text>
                </View>
            </LinearGradient>
            <View style={styles.mockWrapped}>
                <Text style={styles.mockCardSub}>{t('onb_m_top')}</Text>
                <View style={styles.mockBars}>
                    {bars.map((b, i) => (
                        <View key={i} style={[styles.mockBar, { height: 34 * b, backgroundColor: accent }]} />
                    ))}
                </View>
            </View>
        </View>
    );
}

function MockGames({ accent, t }) {
    return (
        <View style={styles.mockStack}>
            <View style={styles.mockTilesRow}>
                <View style={[styles.mockTile, { borderColor: accent + '40' }]}>
                    <Text style={styles.mockTileEmoji}>🎯</Text>
                    <Text style={styles.mockTileText}>{t('onb_m_quiz')}</Text>
                </View>
                <View style={[styles.mockTile, { borderColor: accent + '40' }]}>
                    <Text style={styles.mockTileEmoji}>🎵</Text>
                    <Text style={styles.mockTileText} numberOfLines={1}>{t('onb_m_dailysong')}</Text>
                </View>
            </View>
            <View style={[styles.mockBuddy, { backgroundColor: accent + '18', borderColor: accent + '40' }]}>
                <Text style={styles.mockTileEmoji}>🤝</Text>
                <Text style={styles.mockBuddyText}>{t('onb_m_buddy')}</Text>
            </View>
        </View>
    );
}

function Visual({ item, t }) {
    switch (item.visual) {
        case 'welcome':  return <MockWelcome accent={item.accent} />;
        case 'discover': return <MockEventCard accent={item.accent} t={t} />;
        case 'verify':   return <MockVerify accent={item.accent} t={t} />;
        case 'social':   return <MockSocial accent={item.accent} t={t} />;
        case 'passport': return <MockPassport accent={item.accent} t={t} />;
        case 'games':    return <MockGames accent={item.accent} t={t} />;
        default:         return null;
    }
}

/* ----------------------------- Slayt ----------------------------- */

function Slide({ item, index, scrollX, t }) {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    const visualScale = scrollX.interpolate({
        inputRange, outputRange: [0.7, 1, 0.7], extrapolate: 'clamp',
    });
    const visualOpacity = scrollX.interpolate({
        inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp',
    });
    const textTranslateY = scrollX.interpolate({
        inputRange, outputRange: [40, 0, -40], extrapolate: 'clamp',
    });
    const textOpacity = scrollX.interpolate({
        inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp',
    });

    return (
        <LinearGradient colors={item.gradient} style={styles.slide}>
            {/* Dekoratif arka plan daireleri */}
            <View style={[styles.bgCircle, styles.bgCircle1, { borderColor: item.accent + '20' }]} />
            <View style={[styles.bgCircle, styles.bgCircle2, { borderColor: item.accent + '15' }]} />
            <View style={[styles.bgCircle, styles.bgCircle3, { borderColor: item.accent + '08' }]} />

            {/* Görsel mockup */}
            <Animated.View style={[
                styles.visualContainer,
                { opacity: visualOpacity, transform: [{ scale: visualScale }] },
            ]}>
                <Visual item={item} t={t} />
            </Animated.View>

            {/* Metin */}
            <Animated.View style={[
                styles.textContainer,
                { opacity: textOpacity, transform: [{ translateY: textTranslateY }] },
            ]}>
                <Text style={styles.title}>{t(item.titleKey)}</Text>
                <View style={[styles.accentLine, { backgroundColor: item.accent }]} />
                <Text style={styles.subtitle}>{t(item.subKey)}</Text>
            </Animated.View>
        </LinearGradient>
    );
}

export default function OnboardingScreen({ navigation }) {
    const scrollX = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const { t } = useLanguage();

    const SLIDES = SLIDE_DEFS;

    const goNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
        } else {
            finish();
        }
    };

    const finish = async () => {
        await AsyncStorage.setItem('onboardingDone', 'true');
        // İlk açılış tanıtımı bitti → giriş/kayıt ekranına geç.
        navigation.replace('Login');
    };

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index ?? 0);
        }
    }).current;

    const currentSlide = SLIDES[currentIndex];

    // Buton rengi scroll ile değişsin
    const btnBg = scrollX.interpolate({
        inputRange: SLIDES.map((_, i) => i * width),
        outputRange: SLIDES.map(s => s.accent),
        extrapolate: 'clamp',
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Slaytlar */}
            <Animated.FlatList
                ref={flatListRef}
                data={SLIDES}
                keyExtractor={item => item.key}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
                renderItem={({ item, index }) => (
                    <Slide item={item} index={index} scrollX={scrollX} t={t} />
                )}
            />

            {/* Alt alan */}
            <View style={styles.footer}>

                {/* Nokta indikatörler */}
                <View style={styles.dotsRow}>
                    {SLIDES.map((slide, i) => {
                        const dotWidth = scrollX.interpolate({
                            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                            outputRange: [8, 24, 8],
                            extrapolate: 'clamp',
                        });
                        const dotOpacity = scrollX.interpolate({
                            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                            outputRange: [0.3, 1, 0.3],
                            extrapolate: 'clamp',
                        });
                        return (
                            <Animated.View
                                key={slide.key}
                                style={[
                                    styles.dot,
                                    {
                                        width: dotWidth,
                                        opacity: dotOpacity,
                                        backgroundColor: currentSlide.accent,
                                    },
                                ]}
                            />
                        );
                    })}
                </View>

                {/* Butonlar */}
                <View style={styles.btnRow}>
                    {/* Atla */}
                    {currentIndex < SLIDES.length - 1 ? (
                        <TouchableOpacity onPress={finish} style={styles.skipBtn} activeOpacity={0.7}>
                            <Text style={styles.skipText}>{t('onb_skip')}</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.skipBtn} />
                    )}

                    {/* İleri / Başla */}
                    <TouchableOpacity onPress={goNext} activeOpacity={0.85}>
                        <Animated.View style={[styles.nextBtn, { backgroundColor: btnBg }]}>
                            <Text style={styles.nextText}>
                                {currentIndex === SLIDES.length - 1 ? t('onb_start') : t('onb_next')}
                            </Text>
                        </Animated.View>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F0F1A' },

    // SLAYT
    slide: {
        width,
        height,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },

    // Arka plan dekoratif halkalar
    bgCircle: {
        position: 'absolute',
        borderRadius: 9999,
        borderWidth: 1,
    },
    bgCircle1: { width: 280, height: 280, top: height * 0.06, right: -60 },
    bgCircle2: { width: 200, height: 200, bottom: height * 0.22, left: -50 },
    bgCircle3: { width: 360, height: 360, top: height * 0.22, left: -80 },

    // Görsel alanı
    visualContainer: {
        width: '100%',
        height: height * 0.34,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 44,
    },

    // --- Welcome (marka ikonu) ---
    welcomeWrap: { alignItems: 'center', justifyContent: 'center' },
    welcomeGlow: {
        position: 'absolute',
        width: 240, height: 240, borderRadius: 120,
    },
    welcomeIcon: { width: 160, height: 160 },

    // --- Ortak mock kart ---
    mockStack: { width: 280, gap: 12 },
    mockCard: {
        width: 240,
        backgroundColor: '#181B23',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#262A33',
        overflow: 'hidden',
    },
    mockPoster: {
        height: 132,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mockPosterEmoji: { fontSize: 52, opacity: 0.9 },
    mockDatePill: {
        position: 'absolute', top: 12, left: 12,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    },
    mockDatePillText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    mockCardBody: { padding: 14 },
    mockCardTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
    mockCardSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 4 },

    // --- Verify ---
    mockBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 14, borderWidth: 1,
    },
    mockBadgeCheck: { fontSize: 16 },
    mockBadgeText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    mockPost: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: '#181B23',
        borderRadius: 16, borderWidth: 1, borderColor: '#262A33',
        padding: 14,
    },
    mockAvatar: { width: 40, height: 40, borderRadius: 20 },
    mockPostText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    mockPostMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 },

    // --- Social ---
    mockRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: '#181B23',
        borderRadius: 16, borderWidth: 1, borderColor: '#262A33',
        padding: 12,
    },
    mockArtistAvatar: {
        width: 46, height: 46, borderRadius: 23,
        alignItems: 'center', justifyContent: 'center',
    },
    mockArtistEmoji: { fontSize: 22 },
    mockFollow: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
    mockFollowText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    mockCommunity: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#181B23',
        borderRadius: 14, borderWidth: 1, padding: 14,
    },
    mockCommunityText: { color: '#fff', fontSize: 14, fontWeight: '700' },

    // --- Passport / Wrapped ---
    mockPassport: { borderRadius: 18, padding: 16 },
    mockPassportLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' },
    mockPassportBig: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 2 },
    mockStamps: { flexDirection: 'row', gap: 8, marginTop: 12 },
    mockStamp: { fontSize: 22 },
    mockWrapped: {
        backgroundColor: '#181B23',
        borderRadius: 16, borderWidth: 1, borderColor: '#262A33',
        padding: 14, flexDirection: 'row', alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    mockBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 34 },
    mockBar: { width: 10, borderRadius: 3 },

    // --- Games / Buddy ---
    mockTilesRow: { flexDirection: 'row', gap: 12 },
    mockTile: {
        flex: 1,
        backgroundColor: '#181B23',
        borderRadius: 16, borderWidth: 1,
        paddingVertical: 18, alignItems: 'center', gap: 8,
    },
    mockTileEmoji: { fontSize: 28 },
    mockTileText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    mockBuddy: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        borderRadius: 16, borderWidth: 1, paddingVertical: 16,
    },
    mockBuddyText: { color: '#fff', fontSize: 15, fontWeight: '800' },

    // Metin
    textContainer: { alignItems: 'flex-start', width: '100%' },
    title: {
        fontSize: 40,
        fontWeight: '900',
        lineHeight: 46,
        letterSpacing: -1,
        marginBottom: 16,
        color: '#FFFFFF',
    },
    accentLine: {
        width: 48,
        height: 4,
        borderRadius: 2,
        marginBottom: 20,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        lineHeight: 26,
        maxWidth: 320,
    },

    // ALT ALAN
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 32,
        paddingBottom: 52,
        paddingTop: 24,
        backgroundColor: 'rgba(15,15,26,0.85)',
    },

    dotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 28,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },

    btnRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    skipBtn: {
        paddingVertical: 14,
        paddingHorizontal: 8,
    },
    skipText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 15,
        fontWeight: '600',
    },
    nextBtn: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 28,
        minWidth: 160,
        alignItems: 'center',
    },
    nextText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
});
