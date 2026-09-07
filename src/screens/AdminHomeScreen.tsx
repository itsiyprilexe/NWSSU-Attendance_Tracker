import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';

import DashboardScreen from './DashboardScreen';
import StudentManagementScreen from './StudentManagementScreen';
import EventsScreen from './EventsScreen';
import AttendanceScreen from './AttendanceScreen';
import ReportsScreen from './ReportsScreen';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const Drawer = createDrawerNavigator();
const GREEN = '#1E7A3E';
const RED = '#e33';

// ---- Custom sidebar content (mirrors the web UniMonitor sidebar) ----
function CustomDrawerContent(props: DrawerContentComponentProps) {
  const [adminEmail, setAdminEmail] = React.useState('');
  const [deptCode, setDeptCode] = React.useState('');
  const [loggingOut, setLoggingOut] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const user = auth.currentUser;
      if (!user) return;
      setAdminEmail(user.email || '');

      try {
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        if (adminSnap.exists()) {
          const data = adminSnap.data() as { departmentCode?: string };
          setDeptCode(data.departmentCode || '');
        }
      } catch (err) {
        console.error('Failed to load admin profile:', err);
      }
    })();
  }, []);

  const handleLogout = () => {
    if (loggingOut) return;
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await auth.signOut();
            // Navigation back to Login happens automatically via the
            // onAuthStateChanged listener in the root navigator.
          } catch (err: any) {
            setLoggingOut(false);
            Alert.alert('Error', err?.message || 'Failed to log out. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <View style={styles.profileBlock}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{adminEmail ? adminEmail[0].toUpperCase() : 'A'}</Text>
        </View>
        <Text style={styles.email}>{adminEmail}</Text>
        <Text style={styles.role}>Admin</Text>
        {!!deptCode && (
          <View style={styles.deptTag}>
            <Text style={styles.deptTagText}>{deptCode}</Text>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      <DrawerItem
        label="Dashboard"
        onPress={() => props.navigation.navigate('Dashboard')}
        focused={props.state.routeNames[props.state.index] === 'Dashboard'}
        activeTintColor="#fff"
        activeBackgroundColor={GREEN}
        inactiveTintColor="#333"
      />
      <DrawerItem
        label="Students"
        onPress={() => props.navigation.navigate('Students')}
        focused={props.state.routeNames[props.state.index] === 'Students'}
        activeTintColor="#fff"
        activeBackgroundColor={GREEN}
        inactiveTintColor="#333"
      />
      <DrawerItem
        label="Events"
        onPress={() => props.navigation.navigate('Events')}
        focused={props.state.routeNames[props.state.index] === 'Events'}
        activeTintColor="#fff"
        activeBackgroundColor={GREEN}
        inactiveTintColor="#333"
      />
      <DrawerItem
        label="Attendance"
        onPress={() => props.navigation.navigate('Attendance')}
        focused={props.state.routeNames[props.state.index] === 'Attendance'}
        activeTintColor="#fff"
        activeBackgroundColor={GREEN}
        inactiveTintColor="#333"
      />
      <DrawerItem
        label="Reports"
        onPress={() => props.navigation.navigate('Reports')}
        focused={props.state.routeNames[props.state.index] === 'Reports'}
        activeTintColor="#fff"
        activeBackgroundColor={GREEN}
        inactiveTintColor="#333"
      />

      <View style={{ flex: 1 }} />

      <TouchableOpacity
        style={[styles.logoutBtn, loggingOut && styles.logoutBtnDisabled]}
        onPress={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <ActivityIndicator color={RED} />
        ) : (
          <Text style={styles.logoutText}>Logout</Text>
        )}
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
}

export default function AdminHomeScreen() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#111',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} />
      <Drawer.Screen name="Students" component={StudentManagementScreen} options={{ title: 'Student Management' }} />
      <Drawer.Screen name="Events" component={EventsScreen} />
      <Drawer.Screen name="Attendance" component={AttendanceScreen} />
      <Drawer.Screen name="Reports" component={ReportsScreen} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  profileBlock: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#555' },
  email: { fontWeight: '700', color: '#111', fontSize: 14 },
  role: { color: '#888', fontSize: 12, marginTop: 2 },
  deptTag: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#E4F5E9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deptTagText: { color: GREEN, fontWeight: '700', fontSize: 11 },
  divider: { height: 1, backgroundColor: '#eee', marginBottom: 8 },
  logoutBtn: {
    margin: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: RED,
    alignItems: 'center',
  },
  logoutBtnDisabled: {
    opacity: 0.7,
  },
  logoutText: { color: RED, fontWeight: '700' },
});