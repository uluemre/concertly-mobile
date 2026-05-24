// AppNavigator.js

import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API, { setSessionExpiredHandler } from '../services/api';

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
import MusicProfileScreen from '../screens/MusicProfileScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import GenreSelectionScreen from '../screens/GenreSelectionScreen';
import ArtistSelectionScreen from '../screens/ArtistSelectionScreen';
import AdminScreen from '../screens/AdminScreen';
import AdminEventsScreen from '../screens/AdminEventsScreen';
import AdminUsersScreen from '../screens/AdminUsersScreen';

import { useTheme } from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { colors } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    global.setNotificationBadge = setUnreadCount;

    const fetchCount = async () => {
      if (!global.authToken) return;
      try {
        const res = await API.get('/notifications/unread-count');
        setUnreadCount(res.data.count ?? 0);
      } catch {}
    };

    fetchCount();
    const interval = setInterval(fetchCount, 20000);
    return () => {
      clearInterval(interval);
      global.setNotificationBadge = null;
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 65,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Ana Sayfa',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text>,
        }}
      />

      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarLabel: 'Menü',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>☰</Text>,
        }}
      />

      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Bildirimler',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🔔</Text>,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#E94560', fontSize: 11 },
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Login');
  const navigationRef = useRef(null);

  useEffect(() => {
    setSessionExpiredHandler(async () => {
      await AsyncStorage.multiRemove([
        'authToken', 'userId', 'username', 'userCity',
        'favoriteGenres', 'isAdmin', 'onboardingCompleted',
      ]);
      global.authToken = null;
      global.userId = null;
      global.username = null;
      global.userCity = null;
      global.favoriteGenres = null;
      global.isAdmin = false;
      global.onboardingCompleted = false;
      navigationRef.current?.reset({ index: 0, routes: [{ name: 'Login' }] });
    });
  }, []);

  useEffect(() => {
    AsyncStorage.multiGet([
      'authToken', 'userId', 'username', 'userCity',
      'favoriteGenres', 'isAdmin', 'onboardingCompleted',
    ])
      .then(async pairs => {
        const data = Object.fromEntries(pairs);
        if (data.authToken && data.userId) {
          global.authToken = data.authToken;
          global.userId = parseInt(data.userId);
          global.username = data.username || '';
          global.userCity = data.userCity || '';
          global.favoriteGenres = data.favoriteGenres || '';
          global.isAdmin = data.isAdmin === 'true';
          global.onboardingCompleted = data.onboardingCompleted === 'true';

          try {
            await API.get(`/users/${global.userId}/profile`);
            setInitialRoute('MainApp');
          } catch {
            await AsyncStorage.multiRemove([
              'authToken', 'userId', 'username', 'userCity',
              'favoriteGenres', 'isAdmin', 'onboardingCompleted',
            ]);
            global.authToken = null;
            global.userId = null;
            setInitialRoute('Login');
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsReady(true));
  }, []);

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

        <Stack.Screen
          name="Events"
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

        <Stack.Screen
          name="MusicProfile"
          component={MusicProfileScreen}
        />

        {/* ADMIN */}
        <Stack.Screen name="Admin" component={AdminScreen} />
        <Stack.Screen name="AdminEvents" component={AdminEventsScreen} />
        <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}