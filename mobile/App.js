import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/theme';
import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { initMonitoring, wrapRoot } from './src/services/monitoring';

initMonitoring();

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default wrapRoot(App);
