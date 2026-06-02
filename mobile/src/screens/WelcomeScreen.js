import React, { useEffect, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, Animated, Dimensions, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen({ navigation, route }) {
    const { username } = route.params || {};
    const { colors } = useTheme();
    const { t } = useLanguage();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Animasyon değerleri
    const logoScale = useRef(new Animated.Value(0)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;
    const textSlide = useRef(new Animated.Value(30)).current;
    const subOpacity = useRef(new Animated.Value(0)).current;
    const ring1Scale = useRef(new Animated.Value(0)).current;
    const ring1Opacity = useRef(new Animated.Value(0.6)).current;
    const ring2Scale = useRef(new Animated.Value(0)).current;
    const ring2Opacity = useRef(new Animated.Value(0.4)).current;
    const ring3Scale = useRef(new Animated.Value(0)).current;
    const ring3Opacity = useRef(new Animated.Value(0.2)).current;

    useEffect(() => {
        const timers = [];
        const loops = [];

        // 1 — Logo giriş
        Animated.parallel([
            Animated.spring(logoScale, {
                toValue: 1, tension: 50, friction: 7, useNativeDriver: true,
            }),
            Animated.timing(logoOpacity, {
                toValue: 1, duration: 400, useNativeDriver: true,
            }),
        ]).start();

        // 2 — Halkalar yayılsın (pulse)
        timers.push(setTimeout(() => {
            const loop1 = Animated.loop(
                Animated.sequence([
                    Animated.parallel([
                        Animated.timing(ring1Scale, { toValue: 1.8, duration: 1200, useNativeDriver: true }),
                        Animated.timing(ring1Opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
                    ]),
                    Animated.parallel([
                        Animated.timing(ring1Scale, { toValue: 0, duration: 0, useNativeDriver: true }),
                        Animated.timing(ring1Opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
                    ]),
                ])
            );
            loop1.start();
            loops.push(loop1);

            timers.push(setTimeout(() => {
                const loop2 = Animated.loop(
                    Animated.sequence([
                        Animated.parallel([
                            Animated.timing(ring2Scale, { toValue: 1.8, duration: 1200, useNativeDriver: true }),
                            Animated.timing(ring2Opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
                        ]),
                        Animated.parallel([
                            Animated.timing(ring2Scale, { toValue: 0, duration: 0, useNativeDriver: true }),
                            Animated.timing(ring2Opacity, { toValue: 0.4, duration: 0, useNativeDriver: true }),
                        ]),
                    ])
                );
                loop2.start();
                loops.push(loop2);
            }, 400));

            timers.push(setTimeout(() => {
                const loop3 = Animated.loop(
                    Animated.sequence([
                        Animated.parallel([
                            Animated.timing(ring3Scale, { toValue: 1.8, duration: 1200, useNativeDriver: true }),
                            Animated.timing(ring3Opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
                        ]),
                        Animated.parallel([
                            Animated.timing(ring3Scale, { toValue: 0, duration: 0, useNativeDriver: true }),
                            Animated.timing(ring3Opacity, { toValue: 0.2, duration: 0, useNativeDriver: true }),
                        ]),
                    ])
                );
                loop3.start();
                loops.push(loop3);
            }, 800));
        }, 300));

        // 3 — Yazı giriş
        timers.push(setTimeout(() => {
            Animated.parallel([
                Animated.timing(textOpacity, {
                    toValue: 1, duration: 500, useNativeDriver: true,
                }),
                Animated.spring(textSlide, {
                    toValue: 0, tension: 60, friction: 8, useNativeDriver: true,
                }),
            ]).start();
        }, 600));

        // 4 — Alt yazı
        timers.push(setTimeout(() => {
            Animated.timing(subOpacity, {
                toValue: 1, duration: 500, useNativeDriver: true,
            }).start();
        }, 1000));

        // 5 — Ana uygulamaya geç
        timers.push(setTimeout(() => {
            navigation.replace('MainApp');
        }, 3000));

        return () => {
            timers.forEach(clearTimeout);
            loops.forEach(loop => loop.stop());
        };
    }, []);

    return (
        <LinearGradient
            colors={[colors.background, colors.card, colors.background]}
            style={styles.container}
        >
            {/* LOGO + HALKALAR */}
            <View style={styles.logoWrapper}>

                {/* Halka 3 — en dış */}
                <Animated.View style={[
                    styles.ring, styles.ring3,
                    { transform: [{ scale: ring3Scale }], opacity: ring3Opacity },
                ]} />

                {/* Halka 2 */}
                <Animated.View style={[
                    styles.ring, styles.ring2,
                    { transform: [{ scale: ring2Scale }], opacity: ring2Opacity },
                ]} />

                {/* Halka 1 — en iç */}
                <Animated.View style={[
                    styles.ring, styles.ring1,
                    { transform: [{ scale: ring1Scale }], opacity: ring1Opacity },
                ]} />

                {/* LOGO */}
                <Animated.View style={[
                    styles.logoContainer,
                    { opacity: logoOpacity, transform: [{ scale: logoScale }] },
                ]}>
                    <LinearGradient
                        colors={['#E94560', '#7C3AED']}
                        style={styles.logoGradient}
                    >
                        <Image
                            source={require('../../assets/icon.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </LinearGradient>
                </Animated.View>

            </View>

            {/* YAZI */}
            <Animated.View style={[
                styles.textArea,
                { opacity: textOpacity, transform: [{ translateY: textSlide }] },
            ]}>
                <Text style={styles.welcomeText}>
                    {username ? t('welcome_msg', { username }) : t('welcome_generic')}
                </Text>
                <Text style={styles.appName}>Concertly</Text>
            </Animated.View>

            <Animated.Text style={[styles.subText, { opacity: subOpacity }]}>
                {t('welcome_sub')}
            </Animated.Text>

            {/* ALT NOKTA ANİMASYONU */}
            <Animated.View style={[styles.dotsRow, { opacity: subOpacity }]}>
                <LoadingDots dotStyle={styles.dot} />
            </Animated.View>

        </LinearGradient>
    );
}

const RING_BASE = 120;

function LoadingDots({ dotStyle }) {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loops = [];
        const animate = (dot, delay) => {
            const loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(dot, { toValue: -8, duration: 300, delay, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
                    Animated.delay(400),
                ])
            );
            loop.start();
            loops.push(loop);
        };

        animate(dot1, 0);
        animate(dot2, 150);
        animate(dot3, 300);

        return () => loops.forEach(loop => loop.stop());
    }, []);

    return (
        <>
            <Animated.View style={[dotStyle, { transform: [{ translateY: dot1 }] }]} />
            <Animated.View style={[dotStyle, { transform: [{ translateY: dot2 }] }]} />
            <Animated.View style={[dotStyle, { transform: [{ translateY: dot3 }] }]} />
        </>
    );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    logoWrapper: {
        width: RING_BASE * 3,
        height: RING_BASE * 3,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    ring: {
        position: 'absolute',
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: colors.primary,
    },
    ring1: { width: RING_BASE, height: RING_BASE },
    ring2: { width: RING_BASE * 1.5, height: RING_BASE * 1.5 },
    ring3: { width: RING_BASE * 2, height: RING_BASE * 2 },

    logoContainer: {
        width: 100, height: 100, borderRadius: 28,
        overflow: 'hidden',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 20,
    },
    logoGradient: {
        width: '100%', height: '100%',
        justifyContent: 'center', alignItems: 'center',
    },
    logo: { width: 70, height: 70 },

    textArea: { alignItems: 'center', marginBottom: 12 },
    welcomeText: {
        fontSize: 22, fontWeight: '600',
        color: colors.text, marginBottom: 6, textAlign: 'center',
    },
    appName: {
        fontSize: 42, fontWeight: 'bold',
        color: colors.text, letterSpacing: 3,
    },
    subText: {
        fontSize: 15, color: colors.textSecondary,
        marginBottom: 48,
    },

    dotsRow: {
        position: 'absolute',
        bottom: 60,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    dot: {
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: colors.primary,
    },
  });
} 
