// Oturum açıldıktan sonra gidilecek ilk ekran (giriş, e-posta doğrulama, açılış).
// Eski hesapta ad soyad / doğum tarihi yoksa önce "Profilini tamamla" (profileComplete === false;
// undefined = bilinmiyor, AppNavigator sunucuya sorar). Ardından tür seçimi, sonra ana sayfa.
export default function postAuthRoute(s) {
  if (s.isAdmin) return 'Admin';
  if (s.profileComplete === false) return 'CompleteProfile';
  if (s.onboardingCompleted === false && !s.favoriteGenres) return 'GenreSelection';
  return 'MainApp';
}
