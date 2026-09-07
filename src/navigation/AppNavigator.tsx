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

const Drawer = createDrawerNavigator();
const GREEN = '#1E7A3E';

// ---- Placeholder screens (to be built next) ----
function MyClassesScreen() {
  return (
    <View style={placeholderStyles.container}>
      <Text style={placeholderStyles.title}>My Classes</Text>
      <Text style={placeholderStyles.subtitle}>Coming soon</Text>
    </View>
  );
}

function InstructorAttendanceScreen() {
  return (
    <View style={placeholderStyles.container}>
      <Text style={placeholderStyles.title}>Attendance</Text>
      <Text style={placeholderStyles.subtitle}>Coming soon</Text>
    </View>
  );
}

const placeholderStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 6 },
});

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
      <Drawer.Screen name="MyClasses" component={MyClassesScreen} options={{ title: 'My Classes' }} />
      <Drawer.Screen name="InstructorAttendance" component={InstructorAttendanceScreen} options={{ title: 'Attendance' }} />
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