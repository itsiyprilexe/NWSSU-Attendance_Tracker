import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyA5jZJak8zm7tQk7SpIzvYTa-DwGPk2wBY',
  authDomain: 'nwssu-student-tracker.firebaseapp.com',
  projectId: 'nwssu-student-tracker',
  storageBucket: 'nwssu-student-tracker.firebasestorage.app',
  messagingSenderId: '776987355860',
  appId: '1:776987355860:web:559aa76402964cd2422941',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);