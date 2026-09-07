import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import InstructorClassesStack from './InstructorClassesStack';
import InstructorAttendanceScreen from './InstructorAttendanceScreen';
import InstructorStudentManagementScreen from './InstructorStudentManagementScreen';
import InstructorReportsScreen from './InstructorReportsScreen';

const Drawer = createDrawerNavigator();
const GREEN = '#1E7A3E';

// ---- Custom sidebar content ----
function CustomDrawerContent(props: DrawerContentComponentProps) {
  const [instructorEmail, setInstructorEmail] = React.useState('');
  const [deptCode, setDeptCode] = React.useState('');

  React.useEffect(() => {
    (async () => {
      const user = auth.currentUser;
      if (!user) return;
      setInstructorEmail(user.email || '');

      try {
        const snap = await getDoc(doc(db, 'instructors', user.uid));
        if (snap.exists()) {
          const data = snap.data() as { departmentCode?: string };
          setDeptCode(data.departmentCode || '');
        }
      } catch (err) {
        console.error('Failed to load instructor profile:', err);
      }
    })();
  }, []);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await auth.signOut();
        },
      },
    ]);
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <View style={styles.profileBlock}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {instructorEmail ? instructorEmail[0].toUpperCase() : 'I'}
          </Text>
        </View>
        <Text style={styles.email}>{instructorEmail}</Text>
        <Text style={styles.role}>Instructor</Text>
        {!!deptCode && (
          <View style={styles.deptTag}>
            <Text style={styles.deptTagText}>{deptCode}</Text>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      <DrawerItem
        label="My Classes"
        onPress={() => props.navigation.navigate('MyClasses')}
        focused={props.state.routeNames[props.state.index] === 'MyClasses'}
        activeTintColor="#fff"
        activeBackgroundColor={GREEN}
        inactiveTintColor="#333"
      />
      <DrawerItem
        label="Attendance"
        onPress={() => props.navigation.navigate('InstructorAttendance')}
        focused={props.state.routeNames[props.state.index] === 'InstructorAttendance'}
        activeTintColor="#fff"
        activeBackgroundColor={GREEN}
        inactiveTintColor="#333"
      />
      <DrawerItem
        label="Student Management"
        onPress={() => props.navigation.navigate('InstructorStudentManagement')}
        focused={props.state.routeNames[props.state.index] === 'InstructorStudentManagement'}
        activeTintColor="#fff"
        activeBackgroundColor={GREEN}
        inactiveTintColor="#333"
      />
      <DrawerItem
        label="Reports"
        onPress={() => props.navigation.navigate('InstructorReports')}
        focused={props.state.routeNames[props.state.index] === 'InstructorReports'}
        activeTintColor="#fff"
        activeBackgroundColor={GREEN}
        inactiveTintColor="#333"
      />

      <View style={{ flex: 1 }} />

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
}

export default function InstructorHomeScreen() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#111',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Drawer.Screen
        name="MyClasses"
        component={InstructorClassesStack}
        options={{ title: 'My Classes', headerShown: false }}
      />
      <Drawer.Screen
        name="InstructorAttendance"
        component={InstructorAttendanceScreen}
        options={{ title: 'Attendance' }}
      />
      <Drawer.Screen
        name="InstructorStudentManagement"
        component={InstructorStudentManagementScreen}
        options={{ title: 'Student Management' }}
      />
      <Drawer.Screen
        name="InstructorReports"
        component={InstructorReportsScreen}
        options={{ title: 'Reports' }}
      />
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
    borderColor: '#e33',
    alignItems: 'center',
  },
  logoutText: { color: '#e33', fontWeight: '700' },
});