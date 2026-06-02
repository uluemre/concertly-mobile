import React, { useRef, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Dimensions, Animated, FlatList, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../context/LanguageContext';

const { width, height } = Dimensions.get('window');

const SLIDE_DEFS = [
    { key: '1', emoji: '🎸', titleKey: 'onb_slide1_title', subKey: 'onb_slide1_sub', gradient: ['#0F0F1A', '#1A1A2E'], accent: '#E94560' },
    { key: '2', emoji: '📍', titleKey: 'onb_slide2_title', subKey: 'onb_slide2_sub', gradient: ['#0F0F1A', '#16213E'], accent: '#00D4AA' },
    { key: '3', emoji: '🎤', titleKey: 'onb_slide3_title', subKey: 'onb_slide3_sub', gradient: ['#0F0F1A', '#1A1A2E'], accent: '#7C3AED' },
    { key: '4', emoji: '👥', titleKey: 'onb_slide4_title', subKey: 'onb_slide4_sub', gradient: ['#0F0F1A', '#16213E'], accent: '#F5A623', isLast: true },
];

function Slide({ item, index, scrollX, t }) {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    const emojiScale = scrollX.interpolate({
        inputRange,
        outputRange: [0.6, 1, 0.6],
        extrapolate: 'clamp',
    });
    const emojiOpacity = scrollX.interpolate({
        inputRange,
        outputRange: [0, 1, 0],
        extrapolate: 'clamp',
    });
    const textTranslateY = scrollX.interpolate({
        inputRange,
        outputRange: [40, 0, -40],
        extrapolate: 'clamp',
    });
    const textOpacity = scrollX.interpolate({
        inputRange,
        outputRange: [0, 1, 0],
        extrapolate: 'clamp',
    });

    return (
        <LinearGradient colors={item.gradient} style={styles.slide}>
            {/* Dekoratif arka plan daireleri */}
            <View style={[styles.bgCircle, styles.bgCircle1, { borderColor: item.accent + '20' }]} />
            <View style={[styles.bgCircle, styles.bgCircle2, { borderColor: item.accent + '15' }]} />
            <View style={[styles.bgCircle, styles.bgCircle3, { borderColor: item.accent + '08' }]} />

            {/* Emoji */}
            <Animated.View style={[
                styles.emojiContainer,
                { borderColor: item.accent + '30', backgroundColor: item.accent + '12' },
                { opacity: emojiOpacity, transform: [{ scale: emojiScale }] },
            ]}>
                <Text style={styles.emoji}>{item.emoji}</Text>
                {/* Parlayan halka */}
                <View style={[styles.emojiGlow, { backgroundColor: item.accent + '20' }]} />
            </Animated.View>

            {/* Metin */}
            <Animated.View style={[
                styles.textContainer,
                { opacity: textOpacity, transform: [{ translateY: textTranslateY }] },
            ]}>
                <Text style={[styles.title, { color: '#FFFFFF' }]}>
                    {t(item.titleKey)}
                </Text>
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

    const SLIDES = SLIDE_DEFS.map(s => ({ ...s, title: t(s.titleKey), subtitle: t(s.subKey) }));

    const goNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
        } else {
            finish();
        }
    };

    const finish = async () => {
        await AsyncStorage.setItem('onboardingDone', 'true');
        navigation.replace('MainApp');
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
    bgCircle1: { width: 280, height: 280, top: height * 0.08, right: -60 },
    bgCircle2: { width: 200, height: 200, bottom: height * 0.22, left: -50 },
    bgCircle3: { width: 360, height: 360, top: height * 0.25, left: -80 },

    // Emoji kutusu
    emojiContainer: {
        width: 140,
        height: 140,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        marginBottom: 52,
        position: 'relative',
        overflow: 'hidden',
    },
    emoji: { fontSize: 72 },
    emojiGlow: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        top: -30,
        left: -30,
    },

    // Metin
    textContainer: { alignItems: 'flex-start', width: '100%' },
    title: {
        fontSize: 48,
        fontWeight: '900',
        lineHeight: 54,
        letterSpacing: -1,
        marginBottom: 16,
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
        maxWidth: 300,
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