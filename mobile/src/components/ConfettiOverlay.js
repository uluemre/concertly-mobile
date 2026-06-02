import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { View, Animated, Easing, Dimensions, StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');

const COLORS = ['#E94560', '#F5A623', '#00D4AA', '#7C3AED', '#3B82F6', '#EC4899', '#10B981', '#FBBF24'];
const COUNT = 48;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function Particle({ color, size, isCircle, startX, delay }) {
  const y         = useRef(new Animated.Value(-20)).current;
  const x         = useRef(new Animated.Value(startX)).current;
  const rotate    = useRef(new Animated.Value(0)).current;
  const opacity   = useRef(new Animated.Value(0)).current;
  const duration  = randomBetween(2000, 3500);
  const drift     = randomBetween(-80, 80);

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        // появление
        Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        // падение с ускорением
        Animated.timing(y, {
          toValue: height + 60,
          duration,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        // горизонтальный дрейф
        Animated.timing(x, {
          toValue: startX + drift,
          duration,
          useNativeDriver: true,
        }),
        // вращение
        Animated.timing(rotate, {
          toValue: randomBetween(2, 6) * (Math.random() > 0.5 ? 1 : -1),
          duration,
          useNativeDriver: true,
        }),
        // угасание в конце
        Animated.sequence([
          Animated.delay(duration * 0.7),
          Animated.timing(opacity, { toValue: 0, duration: duration * 0.3, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  const rotateInterp = rotate.interpolate({
    inputRange: [-6, 6],
    outputRange: ['-360deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: isCircle ? size : size * 0.6,
        borderRadius: isCircle ? size / 2 : 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateX: x }, { translateY: y }, { rotate: rotateInterp }],
      }}
    />
  );
}

const ConfettiOverlay = forwardRef((_, ref) => {
  const [particles, setParticles] = useState([]);
  const [visible, setVisible] = useState(false);

  useImperativeHandle(ref, () => ({
    fire() {
      const items = Array.from({ length: COUNT }, (__, i) => ({
        id: Date.now() + i,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: randomBetween(7, 14),
        isCircle: Math.random() > 0.4,
        startX: randomBetween(0, width),
        delay: randomBetween(0, 600),
      }));
      setParticles(items);
      setVisible(true);
      setTimeout(() => setVisible(false), 4200);
    },
  }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map(p => (
        <Particle key={p.id} {...p} />
      ))}
    </View>
  );
});

export default ConfettiOverlay;
