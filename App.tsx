import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from './src/utils/authContext';
import SplashScreenView from './src/screens/SplashScreen';
import DepartmentSelectScreen from './src/screens/DepartmentSelectScreen';
import LoginScreen from './src/screens/LoginScreen';
import CreateAccountScreen from './src/screens/CreateAccountScreen';
import AdminHomeScreen from './src/screens/AdminHomeScreen';
import InstructorHomeScreen from './src/screens/InstructorHomeScreen';
import { AuthStackParamList, MainStackParamList } from './src/types';

SplashScreen.preventAutoHideAsync().catch(() => {});

const AuthStackNav = createNativeStackNavigator<AuthStackParamList>();
const MainStackNav = createNativeStackNavigator<MainStackParamList>();

function AuthStack() {
  return (
    <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
      <AuthStackNav.Screen name="DepartmentSelect" component={DepartmentSelectScreen} />
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
      <AuthStackNav.Screen name="CreateAccount" component={CreateAccountScreen} />
    </AuthStackNav.Navigator>
  );
}

function AdminMainStack() {
  return (
    <MainStackNav.Navigator screenOptions={{ headerShown: false }}>
      <MainStackNav.Screen name="Dashboard" component={AdminHomeScreen} />
    </MainStackNav.Navigator>
  );
}

function InstructorMainStack() {
  return (
    <MainStackNav.Navigator screenOptions={{ headerShown: false }}>
      <MainStackNav.Screen name="Dashboard" component={InstructorHomeScreen} />
    </MainStackNav.Navigator>
  );
}

function RootNavigator() {
  const { user, role, initializing } = useAuth();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (initializing || !minTimeElapsed) {
    return <SplashScreenView />;
  }
  if (!user) {
    return <AuthStack />;
  }
  if (role === 'admin') {
    return <AdminMainStack />;
  }
  if (role === 'instructor') {
    return <InstructorMainStack />;
  }
  return <AuthStack />;
}

export default function App() {
  // Hide the NATIVE splash as soon as the JS tree has done its first
  // layout — at that point our custom SplashScreenView (or whatever
  // RootNavigator returns first) is already painted, so the handoff is
  // native splash -> custom splash, not native splash -> final screen.
  const onLayoutRootView = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
            <RootNavigator />
          </View>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}