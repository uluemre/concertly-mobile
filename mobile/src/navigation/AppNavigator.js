// AppNavigator.js

import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, ActivityIndicator, Animated, AppState } from 'react-native';
import API, { setSessionExpiredHandler } from '../services/api';
import SlideTabBar from './SlideTabBar';
import { useAuth } from '../context/AuthContext';

function TabIcon({ emoji, focused }) {
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
    <Animated.Text style={{ fontSize: 20, transform: [{ scale }] }}>
      {emoji}
    </Animated.Text>
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
import ArtistProfileScreen from '../screens/ArtistProfileScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MapScreen from '../screens/MapScreen';
import FollowListScreen from '../screens/FollowListScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import GenreSelectionScreen from '../screens/GenreSelectionScreen';
import ArtistSelectionScreen from '../screens/ArtistSelectionScreen';
import AdminScreen from '../screens/AdminScreen';
import AdminEventsScreen from '../screens/AdminEventsScreen';
import AdminUsersScreen from '../screens/AdminUsersScreen';
import AdminPostsScreen from '../screens/AdminPostsScreen';
import AdminDeletionFeedbackScreen from '../screens/AdminDeletionFeedbackScreen';
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
import WrappedScreen from '../screens/WrappedScreen';
import ConcertBingoScreen from '../screens/ConcertBingoScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import LegalScreen from '../screens/LegalScreen';

import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';

const Stack = createNativeStackNavigator();
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
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />

      <Tab.Screen
        name="Events"
        component={EventsScreen}
        options={{
          tabBarLabel: t('tab_events'),
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎫" focused={focused} />,
        }}
      />

      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarLabel: t('tab_menu'),
          tabBarIcon: ({ focused }) => <TabIcon emoji="☰" focused={focused} />,
        }}
      />

      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: t('tab_notifications'),
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔔" focused={focused} />,
          tabBarBadge: notificationCount > 0 ? notificationCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#E94560', fontSize: 11 },
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('tab_profile'),
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { session, isReady, logout } = useAuth();
  const navigationRef = useRef(null);

  useEffect(() => {
    setSessionExpiredHandler(async () => {
      await logout();
      navigationRef.current?.reset({ index: 0, routes: [{ name: 'Login' }] });
    });
  }, [logout]);

  let initialRoute = 'Login';
  if (session.authToken) {
    initialRoute = session.isAdmin ? 'Admin' : 'MainApp';
  }

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A14', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#E94560" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
      >
        {/* ONBOARDING (legacy — replaced by GenreSelection) */}
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
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

        <Stack.Screen
          name="CreatePost"
          component={CreatePostScreen}
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
          component={CommunitiesScreen}
        />

        <Stack.Screen
          name="CommunityDetail"
          component={CommunityDetailScreen}
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

        {/* ADMIN */}
        <Stack.Screen name="Admin" component={AdminScreen} />
        <Stack.Screen name="AdminEvents" component={AdminEventsScreen} />
        <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
        <Stack.Screen name="AdminPosts" component={AdminPostsScreen} />
        <Stack.Screen name="AdminDeletionFeedback" component={AdminDeletionFeedbackScreen} />
        <Stack.Screen name="SpotifyRecommendations" component={SpotifyRecommendationsScreen} />
        <Stack.Screen name="VenueProfile" component={VenueProfileScreen} />
        <Stack.Screen name="PostDetail" component={PostDetailScreen} />
        <Stack.Screen name="ConcertBuddyMatch" component={ConcertBuddyMatchScreen} />
        <Stack.Screen name="ConcertPassport" component={ConcertPassportScreen} />
        <Stack.Screen name="ChatList" component={ChatListScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="SongQuiz" component={SongQuizScreen} />
        <Stack.Screen name="DailySong" component={DailySongScreen} />
        <Stack.Screen name="BlindRank" component={BlindRankScreen} />
        <Stack.Screen name="SetlistPrediction" component={SetlistPredictionScreen} />
        <Stack.Screen name="Games" component={GamesScreen} />
        <Stack.Screen name="Wrapped" component={WrappedScreen} />
        <Stack.Screen name="ConcertBingo" component={ConcertBingoScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
        <Stack.Screen name="Legal" component={LegalScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}