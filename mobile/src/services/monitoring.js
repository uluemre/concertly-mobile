// Çökme raporlama (Sentry). DSN verilmezse hiçbir şey yapmaz; yerel geliştirmede de
// kapalıdır (EXPO_PUBLIC_SENTRY_IN_DEV=true ile açılabilir). Kullanıcı kimliği, e-posta,
// IP gönderilmez: yalnızca hata, ekran ve cihaz bilgisi.
import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const IN_DEV = process.env.EXPO_PUBLIC_SENTRY_IN_DEV === 'true';

export const monitoringEnabled = !!DSN && (!__DEV__ || IN_DEV);

export function initMonitoring() {
  if (!monitoringEnabled) return;
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

/** Kök bileşeni sarar: yakalanmamış hatalar ve yerel çökmeler raporlanır. */
export function wrapRoot(Component) {
  return monitoringEnabled ? Sentry.wrap(Component) : Component;
}
