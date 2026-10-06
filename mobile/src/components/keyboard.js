// Klavye bileşenleri: react-native-keyboard-controller varsa onu, yoksa React Native'in
// kendi bileşenlerini kullanır.
//
// Neden kütüphane: SDK 57 ile Android uygulaması kenardan kenara (edge-to-edge) çiziliyor;
// pencere artık klavyeye göre küçülmüyor ve RN'nin KeyboardAvoidingView'ı Android'de
// alanları klavyenin altında bırakıyordu. Kütüphane klavye yüksekliğini her karede iki
// platformda da aynı şekilde verir; odaktaki kutuyu görünür yere kaydırır.
//
// Neden yedek: Expo Go'da (ve kütüphane eklenmeden önce alınmış build'lerde) native modül
// yok. O durumda kütüphanenin native görünümü çizilemez; ekran boş kalmasın diye
// RN bileşenlerine dönülür.
import React from 'react';
import {
  TurboModuleRegistry, KeyboardAvoidingView as RNKeyboardAvoidingView, ScrollView, View, Platform,
} from 'react-native';

const NATIVE = !!TurboModuleRegistry.get('KeyboardController');
const KC = NATIVE ? require('react-native-keyboard-controller') : null;

export const keyboardControllerAvailable = NATIVE;

export function KeyboardProvider({ children }) {
  if (!NATIVE) return children;
  return <KC.KeyboardProvider>{children}</KC.KeyboardProvider>;
}

/** Klavye kadar alt boşluk bırakır (sabit alt çubuklu ekranlar, sohbet). */
export const KeyboardAvoidingView = NATIVE
  ? KC.KeyboardAvoidingView
  : function FallbackKeyboardAvoidingView({ behavior, ...props }) {
    // Yedekte Android'de davranış verilmez (eski davranış)
    return <RNKeyboardAvoidingView behavior={Platform.OS === 'ios' ? behavior : undefined} {...props} />;
  };

/** Odaktaki kutuyu klavyenin üstüne kaydıran ScrollView (formlar). */
export const KeyboardAwareScrollView = NATIVE
  ? KC.KeyboardAwareScrollView
  : React.forwardRef(function FallbackKeyboardAwareScrollView({ bottomOffset, ...props }, ref) {
    return <ScrollView ref={ref} automaticallyAdjustKeyboardInsets {...props} />;
  });

/** Klavyeyle birlikte yukarı kayan alt çubuk (yorum / mesaj kutusu). */
export const KeyboardStickyView = NATIVE
  ? KC.KeyboardStickyView
  : function FallbackKeyboardStickyView({ offset, ...props }) {
    return <View {...props} />;
  };
