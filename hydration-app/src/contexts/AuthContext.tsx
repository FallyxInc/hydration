'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  Auth,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || auth === null) {
      console.error('Firebase not initialized. Please check environment variables.');
      return;
    }
    let fbauth = auth as Auth;
    const unsubscribe = onAuthStateChanged(fbauth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth || auth === null) {
      console.error('Firebase not initialized. Please check environment variables.');
      return;
    }
    let fbauth = auth as Auth;
    await signInWithEmailAndPassword(fbauth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    if (!auth || auth === null) {
      console.error('Firebase not initialized. Please check environment variables.');
      return;
    }
    let fbauth = auth as Auth;
    await createUserWithEmailAndPassword(fbauth, email, password);
  };

  const logout = async () => {
    if (!auth || auth === null) {
      console.error('Firebase not initialized. Please check environment variables.');
      return;
    }
    let fbauth = auth as Auth;
    await signOut(fbauth);
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
