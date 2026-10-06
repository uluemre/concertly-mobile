import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/theme';
import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { initMonitoring, wrapRoot } from './src/services/monitoring';
import { KeyboardProvider } from './src/components/keyboard';

initMonitoring();

function App() {
  return (
    <KeyboardProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </KeyboardProvider>
  );
}

export default wrapRoot(App);
