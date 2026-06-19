// Özel alt sekme barı.
// - Normal dokunuş: o sekmeye geçer (standart davranış).
// - Basılı tutup yana kaydırma: parmağın altındaki sekme vurgulanır,
//   bıraktığın sekme açılır ("bas-kaydır-bırak ile seç").
// Saf PanResponder kullanır — ekstra kütüphane / native yapılandırma gerektirmez.

import React, { useRef, useState } from 'react';
import { View, Text, PanResponder, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

const LONG_PRESS_MS = 180;   // bu süre basılı tutunca kaydırma modu açılır
const DRAG_THRESHOLD = 12;   // ya da bu kadar yatay kayınca hemen açılır

export default function SlideTabBar({ state, descriptors, navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Sürükleme görsel durumu (yalnızca jest sırasında değişir)
  const [drag, setDrag] = useState({ active: false, index: -1 });

  const n = state.routes.length;

  // Handler'lar tek sefer oluşan PanResponder içinde kapandığı için
  // güncel değerlere ref üzerinden erişilir (stale closure önlenir).
  const stateRef = useRef(state);   stateRef.current = state;
  const navRef = useRef(navigation); navRef.current = navigation;
  const widthRef = useRef(0);
  const leftRef = useRef(0);
  const barRef = useRef(null);
  const timerRef = useRef(null);
  const dragRef = useRef({ active: false, index: -1 });

  const setDragState = (active, index) => {
    dragRef.current = { active, index };
    setDrag({ active, index });
  };

  const indexFromPageX = (pageX) => {
    const tabW = (widthRef.current || 1) / n;
    let idx = Math.floor((pageX - leftRef.current) / tabW);
    if (idx < 0) idx = 0;
    if (idx > n - 1) idx = n - 1;
    return idx;
  };

  const activate = (index) => {
    const st = stateRef.current;
    const route = st.routes[index];
    if (!route) return;
    const isFocused = st.index === index;
    const event = navRef.current.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navRef.current.navigate(route.name);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.pageX;
        timerRef.current = setTimeout(() => setDragState(true, indexFromPageX(x)), LONG_PRESS_MS);
      },
      onPanResponderMove: (evt, g) => {
        const x = evt.nativeEvent.pageX;
        if (dragRef.current.active) {
          const idx = indexFromPageX(x);
          if (idx !== dragRef.current.index) setDragState(true, idx);
        } else if (Math.abs(g.dx) > DRAG_THRESHOLD) {
          clearTimeout(timerRef.current);
          setDragState(true, indexFromPageX(x));
        }
      },
      onPanResponderRelease: (evt) => {
        clearTimeout(timerRef.current);
        const wasDrag = dragRef.current.active;
        const idx = wasDrag ? dragRef.current.index : indexFromPageX(evt.nativeEvent.pageX);
        setDragState(false, -1);
        activate(idx);
      },
      onPanResponderTerminate: () => {
        clearTimeout(timerRef.current);
        setDragState(false, -1);
      },
    })
  ).current;

  return (
    <View
      ref={barRef}
      onLayout={() => {
        barRef.current?.measureInWindow((x, y, w) => { leftRef.current = x; widthRef.current = w; });
      }}
      {...panResponder.panHandlers}
      style={[
        styles.bar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      {state.routes.map((route, i) => {
        const { options } = descriptors[route.key];
        const focused = state.index === i;
        const highlighted = drag.active && drag.index === i;
        const activeColor = options.tabBarActiveTintColor || colors.primary;
        const inactiveColor = options.tabBarInactiveTintColor || colors.textSecondary;
        const color = focused || highlighted ? activeColor : inactiveColor;
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;
        const badge = options.tabBarBadge;

        return (
          // pointerEvents none → tüm dokunuşları bar (PanResponder) yönetir
          <View key={route.key} style={styles.tab} pointerEvents="none">
            <View
              style={[
                styles.iconWrap,
                highlighted && {
                  backgroundColor: activeColor + '22',
                  transform: [{ scale: 1.18 }, { translateY: -3 }],
                },
              ]}
            >
              {options.tabBarIcon?.({ focused: focused || highlighted, color, size: 20 })}
              {badge != null && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, { color }]} numberOfLines={1}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 46, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  badge: {
    position: 'absolute', top: -5, right: 0,
    backgroundColor: '#E94560', borderRadius: 9,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
