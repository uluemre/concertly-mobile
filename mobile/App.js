import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/theme';
import { AuthProvider } from './src/context/AuthContext';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
