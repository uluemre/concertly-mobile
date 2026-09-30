/**
 * Oturum yokken açılan hedef ekran (N-23).
 *
 * Giriş gerektiren bir link oturumsuz açılırsa (ya da oturum süresi dolarsa)
 * hedef burada saklanır, kullanıcı Login'e gönderilir ve giriş yapınca
 * kaldığı ekrana döner. Yalnızca bellekte tutulur: uygulama kapanırsa
 * kullanıcı normal açılış akışıyla devam eder.
 */

// Oturum olmadan da açılabilen ekranlar. Etkinlik detayı herkese açık
// (GET /api/events/** public); giriş gerektiren eylemler ekranın içinde kalır.
export const PUBLIC_SCREENS = new Set([
  'Onboarding', 'Login', 'Register', 'VerifyEmail', 'ForgotPassword', 'ResetPassword',
  'Legal', 'NotFound', 'EventDetail',
]);

const TAB_SCREENS = new Set(['Home', 'Events', 'Explore', 'Notifications', 'Profile']);

let pending = null;

/**
 * ownerId: oturumu biten kullanıcının id'si. Verilirse hedef yalnızca aynı
 * kullanıcı tekrar girerse açılır (başkası girerse önceki kişinin ekranına,
 * ör. sohbetine düşmesin). Oturumsuz açılan linkte sahip yoktur.
 */
export function setPendingRoute(route, ownerId = null) {
  if (!route?.name || PUBLIC_SCREENS.has(route.name)) {
    pending = null;
    return;
  }
  // Sekmeler MainApp'in içinde: kökten ancak MainApp üzerinden açılabilir
  const target = TAB_SCREENS.has(route.name)
    ? { name: 'MainApp', params: { screen: route.name, params: route.params } }
    : { name: route.name, params: route.params };
  pending = { ...target, ownerId };
}

export function takePendingRoute(userId) {
  const route = pending;
  pending = null;
  if (!route || (route.ownerId != null && String(route.ownerId) !== String(userId))) return null;
  return { name: route.name, params: route.params };
}

export function clearPendingRoute() {
  pending = null;
}
