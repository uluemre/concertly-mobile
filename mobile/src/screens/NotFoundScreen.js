import React from 'react';
import DeepLinkLoader from '../components/DeepLinkLoader';
import { useAuth } from '../context/AuthContext';

/**
 * Bilinmeyen web adresi (N-19): eskiden sessizce ana sayfaya düşüyordu.
 * Mevcut "İçerik bulunamadı" ekranı gösterilir; buton oturum varsa ana
 * sayfaya, yoksa girişe götürür (geri yığını sıfırlanır).
 */
export default function NotFoundScreen({ navigation }) {
  const { session } = useAuth();
  const goHome = () => navigation.reset({
    index: 0,
    routes: [{ name: session?.authToken ? 'MainApp' : 'Login' }],
  });
  return <DeepLinkLoader error onBack={goHome} />;
}
