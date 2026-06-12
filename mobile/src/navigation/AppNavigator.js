// AppNavigator.js

import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, ActivityIndicator, Animated } from 'react-native';
import API, { setSessionExpiredHandler } from '../services/api';
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
import MusicProfileScreen from '../screens/MusicProfileScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import GenreSelectionScreen from '../screens/GenreSelectionScreen';
import ArtistSelectionScreen from '../screens/ArtistSelectionScreen';
import AdminScreen from '../screens/AdminScreen';
import AdminEventsScreen from '../screens/AdminEventsScreen';
import AdminUsersScreen from '../screens/AdminUsersScreen';
import AdminPostsScreen from '../screens/AdminPostsScreen';
import SpotifyRecommendationsScreen from '../screens/SpotifyRecommendationsScreen';
import VenueProfileScreen from '../screens/VenueProfileScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import ConcertBuddyMatchScreen from '../screens/ConcertBuddyMatchScreen';
import ConcertPassportScreen from '../screens/ConcertPassportScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';

import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { session, notificationCount, setNotificationCount } = useAuth();

  useEffect(() => {
    const fetchCount = async () => {
      if (!session.authToken) return;
      try {
        const res = await API.get('/notifications/unread-count');
        setNotificationCount(res.data.count ?? 0);
      } catch {}
    };

    fetchCount();
    const interval = setInterval(fetchCount, 20000);
    return () => clearInterval(interval);
  }, [session.authToken]);

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
          tabBarLabel: t('tab_home'),
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
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
        <Stack.Screen name="AdminPosts" component={AdminPostsScreen} />
        <Stack.Screen name="SpotifyRecommendations" component={SpotifyRecommendationsScreen} />
        <Stack.Screen name="VenueProfile" component={VenueProfileScreen} />
        <Stack.Screen name="PostDetail" component={PostDetailScreen} />
        <Stack.Screen name="ConcertBuddyMatch" component={ConcertBuddyMatchScreen} />
        <Stack.Screen name="ConcertPassport" component={ConcertPassportScreen} />
        <Stack.Screen name="ChatList" component={ChatListScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}