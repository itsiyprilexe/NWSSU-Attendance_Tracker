// src/firebase/config.ts
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA5jZJak8zm7tQk7SpIzvYTa-DwGPk2wBY",
  authDomain: "nwssu-student-tracker.firebaseapp.com",
  projectId: "nwssu-student-tracker",
  storageBucket: "nwssu-student-tracker.firebasestorage.app",
  messagingSenderId: "776987355860",
  appId: "1:776987355860:web:5971cc431208eb86422941",
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export { app, auth, db };