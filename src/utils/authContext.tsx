import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { AdminProfile } from '../types';

export type Role = 'admin' | 'instructor' | null;

type AuthContextType = {
  user: User | null;
  profile: AdminProfile | null;
  role: Role;
  initializing: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  initializing: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Check admins first...
        const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
        if (adminSnap.exists()) {
          setProfile(adminSnap.data() as AdminProfile);
          setRole('admin');
        } else {
          // ...then fall back to instructors. Mirrors the lookup order
          // already used in LoginScreen.tsx.
          const instructorSnap = await getDoc(
            doc(db, 'instructors', firebaseUser.uid)
          );
          if (instructorSnap.exists()) {
            setProfile(instructorSnap.data() as AdminProfile);
            setRole('instructor');
          } else {
            // Signed in with Firebase Auth but no matching Firestore
            // profile in either collection — treat as no role.
            setProfile(null);
            setRole(null);
          }
        }
      } else {
        setProfile(null);
        setRole(null);
      }

      if (initializing) setInitializing(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, role, initializing }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}