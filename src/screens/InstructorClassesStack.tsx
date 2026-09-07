// src/screens/InstructorClassesStack.tsx
//
// The "Classes" drawer item needs to push between several screens
// (list -> create, list -> detail -> upload/attendance), so it gets its
// own stack navigator nested inside the Instructor drawer, instead of
// pointing straight at MyClassesScreen.

import React from 'react';
import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import MyClassesScreen from './MyClassesScreen';
import CreateClassScreen from './CreateClassScreen';
import ClassDetailScreen from './ClassDetailScreen';
import UploadStudentsScreen from './UploadStudentsScreen';
import TakeAttendanceScreen from './TakeAttendanceScreen';

const Stack = createNativeStackNavigator();

// Nested stacks don't automatically get the drawer's hamburger icon, since
// as far as this stack is concerned it isn't inside a drawer at all. Add
// one manually, only on the entry screen (MyClasses), so the sidebar is
// still reachable from here.
function DrawerMenuButton() {
  const navigation = useNavigation();
  return (
    <Pressable
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      hitSlop={12}
      style={{ paddingHorizontal: 12 }}
    >
      <Text style={{ fontSize: 20 }}>☰</Text>
    </Pressable>
  );
}

export default function InstructorClassesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#111',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen
        name="MyClasses"
        component={MyClassesScreen}
        options={{
          title: 'My Classes',
          headerLeft: () => <DrawerMenuButton />,
        }}
      />
      <Stack.Screen
        name="CreateClass"
        component={CreateClassScreen}
        options={{ title: 'Create Class' }}
      />
      <Stack.Screen
        name="ClassDetail"
        component={ClassDetailScreen}
        options={{ title: 'Class Details' }}
      />
      <Stack.Screen
        name="UploadStudents"
        component={UploadStudentsScreen}
        options={{ title: 'Upload Students' }}
      />
      <Stack.Screen
        name="TakeAttendance"
        component={TakeAttendanceScreen}
        options={{ title: 'Take Attendance' }}
      />
    </Stack.Navigator>
  );
}