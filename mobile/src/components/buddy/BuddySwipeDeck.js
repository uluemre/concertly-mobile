import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../../theme';
import { onPhoto } from './buddyUtils';

const SPRING_BACK = { damping: 15, stiffness: 180 };
const SWIPE_VELOCITY = 800;

// Öndeki kart sürüklenir ya da alttaki düğmelerle fırlatılır, arkadaki kart sürükledikçe
// büyür. Ekranda `key={card.userId}` ile kullanılır: her kart ortadan, temiz başlar.
export default function BuddySwipeDeck({ card, next, renderCard, beginSwipe, onSwipe, onOpen, t, tu }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const threshold = width * 0.28;
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  // Kart uçmaya başlayınca yeni sürükleme ve düğme basışı alınmaz
  const leaving = useSharedValue(false);

  const springBack = () => {
    'worklet';
    x.value = withSpring(0, SPRING_BACK);
    y.value = withSpring(0, SPRING_BACK);
  };

  // Uçuştaki kararın kaydı bir kez gönderilir. Kart uçarken sekme ya da filtre değişip
  // bileşen kalkarsa animasyonun bitişi gelmeyebilir; o zaman ayrılırken gönderilir,
  // yoksa beginSwipe kilidi açılmaz ve deste donar.
  const pending = useRef(null);
  const finish = () => {
    const liked = pending.current;
    if (liked === null) return;
    pending.current = null;
    onSwipe(card, liked);
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => () => finishRef.current(), []);

  // Deste reddederse (önceki kayıt sürüyor) kart yerine döner
  const request = (liked) => {
    if (leaving.value) return;
    if (!beginSwipe()) {
      springBack();
      return;
    }
    leaving.value = true;
    pending.current = liked;
    const to = (liked ? 1 : -1) * width * 1.4;
    y.value = withTiming(30, { duration: 260 });
    // Bitiş geri çağrısı animasyon kesilse de çalışır: kayıt gönderilir, deste kilitlenmez
    x.value = withTiming(to, { duration: 260 }, () => {
      scheduleOnRN(finish);
    });
  };

  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-24, 24])
    .onUpdate((e) => {
      if (leaving.value) return;
      x.value = e.translationX;
      y.value = e.translationY * 0.18;
    })
    .onEnd((e) => {
      if (leaving.value) return;
      const far = Math.abs(e.translationX) > threshold || Math.abs(e.velocityX) > SWIPE_VELOCITY;
      if (far) scheduleOnRN(request, e.translationX > 0);
      else springBack();
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [card, threshold, width]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-width, 0, width], [-12, 0, 12])}deg` },
    ],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(Math.abs(x.value), [0, threshold], [0.96, 1], Extrapolation.CLAMP) }],
  }));
  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [24, threshold], [0, 1], Extrapolation.CLAMP),
  }));
  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-threshold, -24], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.wrap}>
      {next ? (
        <Reanimated.View style={[styles.backCard, backStyle]} pointerEvents="none">
          {renderCard(next, true)}
        </Reanimated.View>
      ) : null}

      <GestureDetector gesture={pan}>
        <Reanimated.View style={[styles.frontCard, cardStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => onOpen(card)}
            accessibilityRole="button"
            accessibilityHint={t('buddy_open_profile_hint')}
            accessibilityActions={[
              { name: 'activate' },
              { name: 'like', label: t('buddy_like') },
              { name: 'pass', label: t('buddy_pass') },
            ]}
            onAccessibilityAction={(e) => {
              const action = e.nativeEvent.actionName;
              if (action === 'like' || action === 'pass') request(action === 'like');
              else onOpen(card);
            }}
          >
            {renderCard(card, false)}
          </Pressable>
          <Reanimated.View pointerEvents="none" style={[styles.stamp, styles.likeStamp, likeStyle]}>
            <Text style={[styles.stampText, { color: colors.primary }]}>{tu('buddy_swipe_yes')}</Text>
          </Reanimated.View>
          <Reanimated.View pointerEvents="none" style={[styles.stamp, styles.passStamp, passStyle]}>
            <Text style={[styles.stampText, { color: onPhoto.text }]}>{tu('buddy_swipe_no')}</Text>
          </Reanimated.View>
        </Reanimated.View>
      </GestureDetector>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => request(false)}
          style={[styles.action, styles.passBtn]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('buddy_pass')}
        >
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => request(true)}
          style={[styles.action, styles.likeBtn]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('buddy_like')}
        >
          <Ionicons name="heart" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
      <Text style={styles.cue}>{t('buddy_cue')}</Text>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    wrap: { flex: 1 },
    backCard: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 92, marginHorizontal: 18 },
    frontCard: { flex: 1, marginHorizontal: 16, marginBottom: 92 },
    stamp: {
      position: 'absolute',
      top: 70,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 2,
    },
    likeStamp: { right: 22, borderColor: colors.primary, transform: [{ rotate: '12deg' }] },
    passStamp: { left: 22, borderColor: 'rgba(255,255,255,0.7)', transform: [{ rotate: '-12deg' }] },
    stampText: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: 1.4 },
    actions: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 18,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 28,
    },
    action: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    passBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    likeBtn: { backgroundColor: colors.primary, boxShadow: `0 8px 16px ${colors.primary}8C` },
    cue: { position: 'absolute', bottom: 0, alignSelf: 'center', color: colors.textSecondary, fontSize: 12 },
  });
}
