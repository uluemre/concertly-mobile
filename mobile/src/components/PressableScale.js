// Basınca hafifçe içe göçen dokunulabilir kart. Animasyon Reanimated ile UI
// thread'inde çalışır; JS meşgulken bile takılmaz. Sistemde "hareketi azalt"
// açıksa Reanimated animasyonu kendiliğinden atlar.
// Not: `style` içindeki transform ölçekle ezilir; dışta bir sarmalayıcı kullan.
import React from 'react';
import { Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function PressableScale({
  scaleTo = 0.97, style, onPressIn, onPressOut, children, accessibilityRole = 'button', ...rest
}) {
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - scaleTo) * pressed.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      accessibilityRole={accessibilityRole}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        pressed.value = withTiming(1, { duration: 90 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, { damping: 14, stiffness: 320 });
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
