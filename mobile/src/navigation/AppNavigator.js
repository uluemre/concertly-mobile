// AppNavigator.js

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, ActivityIndicator, Animated, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadLaunchCities } from '../services/launchCities';
import * as Notifications from 'expo-notifications';
import API, { setSessionExpiredHandler, hasApiSession } from '../services/api';
import { PUBLIC_SCREENS, setPendingRoute } from './pendingRoute';
import SlideTabBar from './SlideTabBar';
import postAuthRoute from './postAuthRoute';
import { useAuth } from '../context/AuthContext';
import linking from './linking';
import {
  registerPushToken,
  routeForNotification,
  setBadgeCount,
} from '../services/pushNotifications';

// Alt menü ikonları: tek tip çizgi ikonlar (seçiliyken dolu). Emojiler her
// cihazda farklı çizildiği ve renkleri temaya uymadığı için bırakıldı.
function TabIcon({ name, focused, color }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (focused) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, tension: 300, friction: 6 }),
        Animated.spring(scale, { toValue: 1,   useNativeDriver: true, tension: 300, friction: 6 }),
      ]).start();
    }
  }, [focused]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={focused ? name : `${name}-outline`} size={23} color={color} />
    </Animated.View>
  );
}

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import ExploreScreen from '../screens/ExploreScreen';
import EventsScreen from '../screens/EventsScreen';
import FeedScreen from '../screens/FeedScreen';
import ProfileScreen from '../screens/ProfileScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import CommunitiesScreen from '../screens/CommunitiesScreen';
import CommunityDetailScreen from '../screens/CommunityDetailScreen';
import CreateCommunityScreen from '../screens/CreateCommunityScreen';
import CommunityManageScreen from '../screens/CommunityManageScreen';
import TransferOwnershipScreen from '../screens/TransferOwnershipScreen';
import ArtistProfileScreen from '../screens/ArtistProfileScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MapScreen from '../screens/MapScreen';
import FollowListScreen from '../screens/FollowListScreen';
import FollowRequestsScreen from '../screens/FollowRequestsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import GenreSelectionScreen from '../screens/GenreSelectionScreen';
import CompleteProfileScreen from '../screens/CompleteProfileScreen';
import ArtistSelectionScreen from '../screens/ArtistSelectionScreen';
import AdminScreen from '../screens/AdminScreen';
import AdminEventsScreen from '../screens/AdminEventsScreen';
import AdminUsersScreen from '../screens/AdminUsersScreen';
import AdminPostsScreen from '../screens/AdminPostsScreen';
import AdminDeletionFeedbackScreen from '../screens/AdminDeletionFeedbackScreen';
import AdminSourcesScreen from '../screens/AdminSourcesScreen';
import AdminCitiesScreen from '../screens/AdminCitiesScreen';
import AdminCommunitiesScreen from '../screens/AdminCommunitiesScreen';
import AdminReportsScreen from '../screens/AdminReportsScreen';
import AdminOrganizerRequestsScreen from '../screens/AdminOrganizerRequestsScreen';
import SuggestEventScreen from '../screens/SuggestEventScreen';
import SpotifyRecommendationsScreen from '../screens/SpotifyRecommendationsScreen';
import VenueProfileScreen from '../screens/VenueProfileScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import ConcertBuddyMatchScreen from '../screens/ConcertBuddyMatchScreen';
import ConcertPassportScreen from '../screens/ConcertPassportScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import SongQuizScreen from '../screens/SongQuizScreen';
import DailySongScreen from '../screens/DailySongScreen';
import BlindRankScreen from '../screens/BlindRankScreen';
import SetlistPredictionScreen from '../screens/SetlistPredictionScreen';
import GamesScreen from '../screens/GamesScreen';
import ConcertBingoScreen from '../screens/ConcertBingoScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import ConcertPrepScreen from '../screens/ConcertPrepScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import LegalScreen from '../screens/LegalScreen';
import NotFoundScreen from '../screens/NotFoundScreen';
import AdminSettingsScreen from '../screens/AdminSettingsScreen';
import AdminAuditLogScreen from '../screens/AdminAuditLogScreen';
import AdminCatalogScreen from '../screens/AdminCatalogScreen';
import AdminCatalogEditScreen from '../screens/AdminCatalogEditScreen';
import OrganizerScreen from '../screens/OrganizerScreen';
import AdminOrganizerRequestScreen from '../screens/AdminOrganizerRequestScreen';
import AdminOrganizerDetailScreen from '../screens/AdminOrganizerDetailScreen';
import AdminUserDetailScreen from '../screens/AdminUserDetailScreen';
import OrganizerProfileScreen from '../screens/OrganizerProfileScreen';
import OrganizerProfileEditScreen from '../screens/OrganizerProfileEditScreen';
import OrganizerAnnounceScreen from '../screens/OrganizerAnnounceScreen';
import OrganizerClaimScreen from '../screens/OrganizerClaimScreen';
import AdminClaimsScreen from '../screens/AdminClaimsScreen';
import OrganizerEventFormScreen from '../screens/OrganizerEventFormScreen';
import MaintenanceView from '../components/MaintenanceView';
import { withFeature } from '../components/FeatureGate';
import { useAppConfig } from '../context/AppConfigContext';

import { useTheme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';

// iOS'ta kenardan kaydırıp geri dönme olduğu gibi kalır (yalnızca açılış animasyonu değişir)
const COMPOSE_OPTIONS = { animation: 'slide_from_bottom' };

// Admin panelinden kapatılabilen özellikler: kapalıyken ekran yerine "şu an kapalı" açılır
const BuddyGated = withFeature('buddy', ConcertBuddyMatchScreen);
const GamesGated = withFeature('games', GamesScreen);
const SongQuizGated = withFeature('games', SongQuizScreen);
const DailySongGated = withFeature('games', DailySongScreen);
const BlindRankGated = withFeature('games', BlindRankScreen);
const SetlistPredictionGated = withFeature('games', SetlistPredictionScreen);
const ConcertBingoGated = withFeature('games', ConcertBingoScreen);
const CommunitiesGated = withFeature('communities', CommunitiesScreen);
const CommunityDetailGated = withFeature('communities', CommunityDetailScreen);
const CreateCommunityGated = withFeature('communities', CreateCommunityScreen);
const CommunityManageGated = withFeature('communities', CommunityManageScreen);
const TransferOwnershipGated = withFeature('communities', TransferOwnershipScreen);
const CreatePostGated = withFeature('posting', CreatePostScreen);
const SuggestEventGated = withFeature('eventSuggestions', SuggestEventScreen);

const Stack = createNativeStackNavigator();

// Profil tamamlanmadan açılabilen ekranlar (yasal metinler okunabilsin)
const PROFILE_GATE_ALLOWED = new Set(['CompleteProfile', 'Legal', 'Login', 'Register', 'VerifyEmail']);
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { session, notificationCount, setNotificationCount } = useAuth();

  useEffect(() => {
    if (!session.authToken) return;
    let interval = null;
    const fetchCount = async () => {
      try {
        const res = await API.get('/notifications/unread-count');
        setNotificationCount(res.data.count ?? 0);
      } catch {}
    };
    // Yalnızca uygulama önplandayken poll et — arka planda boşa istek atma (10.3)
    const start = () => {
      clearInterval(interval);
      fetchCount();
      interval = setInterval(fetchCount, 30000);
    };
    const stop = () => clearInterval(interval);
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', s => (s === 'active' ? start() : stop()));
    return () => { stop(); sub.remove(); };
  }, [session.authToken]);

  return (
    <Tab.Navigator
      tabBar={(props) => <SlideTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t('tab_home'),
          tabBarIcon: ({ focused, color }) => <TabIcon name="home" focused={focused} color={color} />,
        }}
      />

      <Tab.Screen
        name="Events"
        component={EventsScreen}
        options={{
          tabBarLabel: t('tab_events'),
          tabBarIcon: ({ focused, color }) => <TabIcon name="ticket" focused={focused} color={color} />,
        }}
      />

      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarLabel: t('tab_menu'),
          tabBarIcon: ({ focused, color }) => <TabIcon name="compass" focused={focused} color={color} />,
        }}
      />

      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: t('tab_notifications'),
          tabBarIcon: ({ focused, color }) => <TabIcon name="notifications" focused={focused} color={color} />,
          tabBarBadge: notificationCount > 0 ? notificationCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#E94560', fontSize: 11 },
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('tab_profile'),
          tabBarIcon: ({ focused, color }) => <TabIcon name="person" focused={focused} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { session, isReady, logout, updateSession, notificationCount } = useAuth();
  const { maintenance } = useAppConfig();
  // Bakımda oturumu olmayan biri "Admin girişi"ne dokunursa giriş ekranı açılır
  const [maintenanceLogin, setMaintenanceLogin] = useState(false);
  const { lang } = useLanguage();
  const navigationRef = useRef(null);

  // Açık şehirler (Admin > Şehirler) sunucudan; oturum gerekmez
  useEffect(() => { loadLaunchCities(); }, []);

  // ── Push bildirimleri ──────────────────────────────────────────────────────
  // Cihaz adresi her girişte tazelenir: token yenilenebilir, kullanıcı
  // uygulamanın dilini değiştirmiş olabilir, cihaz el değiştirmiş olabilir.
  useEffect(() => {
    if (!session.authToken) return;
    registerPushToken(lang);
  }, [session.authToken, lang]);

  // Bildirime dokunulduğunda ilgili ekrana git.
  useEffect(() => {
    const open = (response) => {
      const route = routeForNotification(response?.notification?.request?.content?.data);
      if (route) navigationRef.current?.navigate(route.screen, route.params);
    };
    // Uygulama bildirimle kapalıyken açıldıysa son yanıtı da işle.
    try {
      Notifications.getLastNotificationResponseAsync().then((r) => r && open(r)).catch(() => {});
      const sub = Notifications.addNotificationResponseReceivedListener(open);
      return () => sub.remove();
    } catch {
      // Web / desteklenmeyen ortam — bildirim dinleyicisi olmadan devam.
      return undefined;
    }
  }, []);

  // Uygulama simgesindeki rozet okunmamış sayısını izlesin.
  useEffect(() => {
    setBadgeCount(notificationCount);
  }, [notificationCount]);

  // İlk açılış tanıtım ekranı: giriş yapılmamış VE onboarding daha önce
  // görülmemişse Onboarding slaytları başlangıç rotası olur.
  const [onbChecked, setOnbChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const userIdRef = useRef(session.userId);
  userIdRef.current = session.userId;
  useEffect(() => {
    setSessionExpiredHandler(async () => {
      // Kalınan ekran aynı kullanıcı tekrar girince geri açılır (N-23)
      setPendingRoute(navigationRef.current?.getCurrentRoute(), userIdRef.current);
      await logout();
      navigationRef.current?.reset({ index: 0, routes: [{ name: 'Login' }] });
    });
  }, [logout]);

  // Oturum yokken giriş gerektiren bir ekrana (link, adres çubuğu, geri tuşu)
  // gelinirse hedef saklanır ve Login açılır; girişten sonra oraya dönülür (N-23).
  // Herkese açık ekranlar (etkinlik detayı, giriş/kayıt, yasal metinler) açık kalır.
  const authTokenRef = useRef(session.authToken);
  authTokenRef.current = session.authToken;
  const guardRoute = useCallback(() => {
    if (authTokenRef.current || hasApiSession()) return;
    const nav = navigationRef.current;
    const route = nav?.getCurrentRoute();
    if (!route || PUBLIC_SCREENS.has(route.name)) return;
    setPendingRoute(route);
    nav.reset({ index: 0, routes: [{ name: 'Login' }] });
  }, []);
  // Oturum kapanınca (çıkış, hesap silme) giriş gerektiren ekranda kalınmaz.
  // Bilinçli çıkış olduğu için hedef saklanmaz.
  useEffect(() => {
    if (session.authToken) return;
    const nav = navigationRef.current;
    const route = nav?.getCurrentRoute();
    if (route && !PUBLIC_SCREENS.has(route.name)) {
      nav.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  }, [session.authToken]);

  // Ad soyad / doğum tarihi eksik hesap uygulamaya geçemez. Eski oturumda bilgi yoksa
  // (undefined) sunucuya bir kez sorulur; eksikse her ekran değişiminde CompleteProfile'a
  // dönülür (link, bildirim, giriş sonrası yönlendirme dahil). Admin hesapları hariç.
  const profileCompleteRef = useRef(session.profileComplete);
  profileCompleteRef.current = session.profileComplete;
  const isAdminRef = useRef(session.isAdmin);
  isAdminRef.current = session.isAdmin;
  const guardProfile = useCallback(() => {
    if (!authTokenRef.current || isAdminRef.current || profileCompleteRef.current !== false) return;
    const nav = navigationRef.current;
    const route = nav?.getCurrentRoute();
    if (!route || PROFILE_GATE_ALLOWED.has(route.name)) return;
    nav.reset({ index: 0, routes: [{ name: 'CompleteProfile' }] });
  }, []);
  useEffect(() => {
    if (!session.authToken || session.isAdmin || session.profileComplete !== undefined) return;
    API.get('/users/me/basic-info')
      .then(({ data }) => updateSession({ profileComplete: !!data?.profileComplete, fullName: data?.fullName || '' }))
      .catch(() => {});   // çevrimdışı: bir sonraki açılışta tekrar sorulur
  }, [session.authToken, session.isAdmin, session.profileComplete, updateSession]);
  useEffect(() => { guardProfile(); }, [session.profileComplete, session.authToken, guardProfile]);
  const guardAll = useCallback(() => { guardRoute(); guardProfile(); }, [guardRoute, guardProfile]);

  // Aynı kontrol link çözülürken de yapılır: giriş gerektiren ekran oturumsuz hiç
  // açılmaz (açılsaydı istekleri 401 alıp hata uyarısı gösterirdi).
  const guardedLinking = useMemo(() => ({
    ...linking,
    getStateFromPath: (path, options) => {
      const state = linking.getStateFromPath(path, options);
      if (!state || authTokenRef.current || hasApiSession()) return state;
      let route = state.routes[state.index ?? state.routes.length - 1];
      while (route?.state) route = route.state.routes[route.state.index ?? route.state.routes.length - 1];
      if (!route || PUBLIC_SCREENS.has(route.name)) return state;
      setPendingRoute(route);
      return { routes: [{ name: 'Login' }] };
    },
  }), []);

  useEffect(() => {
    AsyncStorage.getItem('onboardingDone')
      .then(done => setShowOnboarding(done !== 'true'))
      .catch(() => setShowOnboarding(false))
      .finally(() => setOnbChecked(true));
  }, []);

  let initialRoute = 'Login';
  if (session.authToken) {
    // Kayıttan sonra tür/sanatçı seçimini bitirmeden uygulamayı kapatan kullanıcı
    // bir dahaki açılışta oraya döner (eskiden doğrudan ana sayfaya düşüyordu).
    // Eski oturumlarda alan hiç yok (undefined) → ana sayfa.
    // Ad soyad / doğum tarihi eksik eski hesap önce "Profilini tamamla"ya gider.
    initialRoute = postAuthRoute(session);
  } else if (showOnboarding) {
    initialRoute = 'Onboarding';
  }

  if (!isReady || !onbChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A14', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#E94560" />
      </View>
    );
  }

  // Bakım modu: admin dışındakiler uygulamaya giremez (sunucu da 503 döner)
  if (maintenance.enabled && !session.isAdmin && !(maintenanceLogin && !session.authToken)) {
    return <MaintenanceView onAdminLogin={session.authToken ? null : () => setMaintenanceLogin(true)} />;
  }

  return (
    <NavigationContainer ref={navigationRef} linking={guardedLinking} onReady={guardAll} onStateChange={guardAll}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
      >
        {/* ONBOARDING — ilk açılış tanıtım slaytları (giriş öncesi) */}
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
        />

        {/* Eski hesaplar: ad soyad + doğum tarihi bir kez sorulur (geri hareketi kapalı) */}
        <Stack.Screen
          name="CompleteProfile"
          component={CompleteProfileScreen}
          options={{ gestureEnabled: false }}
        />

        {/* NEW ONBOARDING FLOW */}
        <Stack.Screen
          name="GenreSelection"
          component={GenreSelectionScreen}
        />
        <Stack.Screen
          name="ArtistSelection"
          component={ArtistSelectionScreen}
        />

        {/* AUTH */}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
        />

        <Stack.Screen
          name="Register"
          component={RegisterScreen}
        />

        <Stack.Screen
          name="VerifyEmail"
          component={VerifyEmailScreen}
        />

        {/* MAIN APP */}
        <Stack.Screen
          name="MainApp"
          component={TabNavigator}
        />

        {/* STACK SCREENS */}
        <Stack.Screen
          name="EventDetail"
          component={EventDetailScreen}
        />

        {/* Oluşturma ekranları (gönderi, topluluk, etkinlik önerisi) alttan açılır */}
        <Stack.Screen
          name="CreatePost"
          component={CreatePostGated}
          options={COMPOSE_OPTIONS}
        />

        {/* Setlist seçim akışı için pushable Events (param'lı) — tab dışı */}
        <Stack.Screen
          name="EventsPicker"
          component={EventsScreen}
        />

        <Stack.Screen
          name="FeedTab"
          component={FeedScreen}
        />

        <Stack.Screen
          name="UserProfile"
          component={UserProfileScreen}
        />

        <Stack.Screen
          name="Communities"
          component={CommunitiesGated}
        />

        <Stack.Screen
          name="CommunityDetail"
          component={CommunityDetailGated}
        />

        <Stack.Screen
          name="CreateCommunity"
          component={CreateCommunityGated}
          options={COMPOSE_OPTIONS}
        />

        <Stack.Screen
          name="CommunityManage"
          component={CommunityManageGated}
        />

        <Stack.Screen
          name="TransferOwnership"
          component={TransferOwnershipGated}
        />

        <Stack.Screen
          name="ArtistProfile"
          component={ArtistProfileScreen}
        />

        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
        />

        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
        />

        <Stack.Screen
          name="Map"
          component={MapScreen}
        />

        <Stack.Screen
          name="FollowList"
          component={FollowListScreen}
        />

        <Stack.Screen
          name="FollowRequests"
          component={FollowRequestsScreen}
        />

        {/* ADMIN */}
        <Stack.Screen name="Admin" component={AdminScreen} />
        <Stack.Screen name="AdminEvents" component={AdminEventsScreen} />
        <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
        <Stack.Screen name="AdminPosts" component={AdminPostsScreen} />
        <Stack.Screen name="AdminDeletionFeedback" component={AdminDeletionFeedbackScreen} />
        <Stack.Screen name="AdminSources" component={AdminSourcesScreen} />
        <Stack.Screen name="AdminCities" component={AdminCitiesScreen} />
        <Stack.Screen name="AdminCommunities" component={AdminCommunitiesScreen} />
        <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} />
        <Stack.Screen name="AdminAuditLog" component={AdminAuditLogScreen} />
        <Stack.Screen name="AdminCatalog" component={AdminCatalogScreen} />
        <Stack.Screen name="AdminCatalogEdit" component={AdminCatalogEditScreen} />
        {/* Organizatör hesabı: başvuru ve panel */}
        <Stack.Screen name="Organizer" component={OrganizerScreen} />
        <Stack.Screen name="AdminOrganizerRequest" component={AdminOrganizerRequestScreen} />
        <Stack.Screen name="AdminOrganizerDetail" component={AdminOrganizerDetailScreen} />
        <Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
        <Stack.Screen name="AdminClaims" component={AdminClaimsScreen} />
        <Stack.Screen name="OrganizerProfile" component={OrganizerProfileScreen} />
        <Stack.Screen name="OrganizerProfileEdit" component={OrganizerProfileEditScreen} options={COMPOSE_OPTIONS} />
        <Stack.Screen name="OrganizerAnnounce" component={OrganizerAnnounceScreen} options={COMPOSE_OPTIONS} />
        <Stack.Screen name="OrganizerClaim" component={OrganizerClaimScreen} />
        <Stack.Screen name="OrganizerEventForm" component={OrganizerEventFormScreen} options={COMPOSE_OPTIONS} />
        <Stack.Screen name="SpotifyRecommendations" component={SpotifyRecommendationsScreen} />
        <Stack.Screen name="VenueProfile" component={VenueProfileScreen} />
        <Stack.Screen name="PostDetail" component={PostDetailScreen} />
        <Stack.Screen name="ConcertBuddyMatch" component={BuddyGated} />
        <Stack.Screen name="ConcertPassport" component={ConcertPassportScreen} />
        <Stack.Screen name="ChatList" component={ChatListScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="SongQuiz" component={SongQuizGated} />
        <Stack.Screen name="DailySong" component={DailySongGated} />
        <Stack.Screen name="BlindRank" component={BlindRankGated} />
        <Stack.Screen name="SetlistPrediction" component={SetlistPredictionGated} />
        <Stack.Screen name="Games" component={GamesGated} />
        <Stack.Screen name="ConcertBingo" component={ConcertBingoGated} />
        <Stack.Screen name="ConcertPrep" component={ConcertPrepScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />

        {/* Kullanıcı etkinlik önerisi — Ticketmaster dışı veri kanalı */}
        <Stack.Screen name="SuggestEvent" component={SuggestEventGated} options={COMPOSE_OPTIONS} />

        {/* Moderasyon & organizatör kuyruğu (admin) */}
        <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
        <Stack.Screen name="AdminOrganizerRequests" component={AdminOrganizerRequestsScreen} />
        <Stack.Screen name="Legal" component={LegalScreen} />
        {/* Bilinmeyen web adresi (N-19) */}
        <Stack.Screen name="NotFound" component={NotFoundScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}