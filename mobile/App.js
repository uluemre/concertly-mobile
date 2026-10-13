import { useEffect } from 'react';
import { useFonts } from 'expo-font';
// Yalnız kullanılan iki ağırlık (paketin ana dosyası 7 ağırlığın hepsini ekler)
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/theme';
import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { AppConfigProvider } from './src/context/AppConfigContext';
import { initMonitoring, wrapRoot } from './src/services/monitoring';
import { KeyboardProvider } from './src/components/keyboard';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

initMonitoring();
// Başlık fontu yüklenene kadar açılış ekranı kalsın (yerel dosya, birkaç ms)
SplashScreen.preventAutoHideAsync().catch(() => {});

function App() {
  const [fontsLoaded, fontError] = useFonts({ BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Font yüklenemezse de açılır: başlıklar sistem fontuna düşer
  if (!ready) return null;

  return (
    // Kaydırma hareketleri (Konser Arkadaşı kartı) native tanıyıcıyla alınır
    <GestureHandlerRootView style={{ flex: 1 }}>
    <KeyboardProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <AppConfigProvider>
              <AppNavigator />
            </AppConfigProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(App);
