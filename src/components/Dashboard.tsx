'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { collection, query, where, getDocs, Firestore } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import FileUpload from './FileUpload';
import HydrationData from './HydrationData';
import UserManagement from './UserManagement';
import HomeManagement from './HomeManagement';
import Analytics from './Analytics';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('data');
  const [userRole, setUserRole] = useState<'admin' | 'home_manager' | null>(null);
  const [retirementHome, setRetirementHome] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    
    try {
      if (!db || db === null) {
        console.error('Firebase not initialized. Please check environment variables.');
        return;
      }
      let fbdb = db as Firestore;
      
      // First try to query by document ID (which should match user.uid)
      const usersQuery = query(
        collection(fbdb, 'users'),
        where('__name__', '==', user.uid)
      );
      let querySnapshot = await getDocs(usersQuery);
      
      // If still not found, try firebaseUid as fallback
      if (querySnapshot.empty) {
        console.log('User not found by uid, trying firebaseUid...');
        const fallbackQuery = query(
          collection(fbdb, 'users'),
          where('firebaseUid', '==', user.uid)
        );
        querySnapshot = await getDocs(fallbackQuery);
      }
      
      if (!querySnapshot.empty) {
        console.log('User data found');
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        setUserRole(userData.role);
        setRetirementHome(userData.retirementHome || '');
        
        // Home managers should only see data tab
        if (userData.role === 'home_manager') {
          console.log('Setting active tab to data');
          setActiveTab('data');
        }
      } else {
        console.log('User document not found. Logging out and returning to login.');
        await logout();
        return;
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      console.log('Logging out and returning to login.');
      await logout();
      return;
    } finally {
      setLoading(false);
    }
  }, [user, logout]);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user, fetchUserData]);

  // Force refresh user data when component mounts
  useEffect(() => {
    if (user && !loading) {
      console.log('🔄 [DASHBOARD] Force refreshing user data...');
      fetchUserData();
    }
  }, [fetchUserData, loading, user]);

  const handleLogout = async () => {
    console.log('Logging out');
    await logout();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500 dark:border-primary-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {userRole === 'admin' ? 'Hydration Dashboard' : `${retirementHome} - Hydration Data`}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Welcome, {user?.email}
                {retirementHome && ` (${retirementHome})`}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {userRole === 'admin' && (
              <>
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                    activeTab === 'upload'
                      ? 'border-cyan-500 dark:border-cyan-400 text-cyan-600 dark:text-cyan-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-300 dark:hover:border-cyan-600'
                  }`}
                >
                  File Upload
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                    activeTab === 'users'
                      ? 'border-cyan-500 dark:border-cyan-400 text-cyan-600 dark:text-cyan-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-300 dark:hover:border-cyan-600'
                  }`}
                >
                  User Management
                </button>
                <button
                  onClick={() => setActiveTab('homes')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                    activeTab === 'homes'
                      ? 'border-cyan-500 dark:border-cyan-400 text-cyan-600 dark:text-cyan-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-300 dark:hover:border-cyan-600'
                  }`}
                >
                  Home Management
                </button>
              </>
            )}
            {userRole === 'home_manager' && (
              <>
                <button
                  onClick={() => setActiveTab('data')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                    activeTab === 'data'
                      ? 'border-cyan-500 dark:border-cyan-400 text-cyan-600 dark:text-cyan-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-300 dark:hover:border-cyan-600'
                  }`}
                >
                  Hydration Data
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                    activeTab === 'analytics'
                      ? 'border-cyan-500 dark:border-cyan-400 text-cyan-600 dark:text-cyan-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-300 dark:hover:border-cyan-600'
                  }`}
                >
                  Analytics & Trends
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {activeTab === 'upload' && userRole === 'admin' && <FileUpload />}
        {activeTab === 'data' && userRole === 'home_manager' && <HydrationData userRole={userRole} retirementHome={retirementHome} />}
        {activeTab === 'analytics' && userRole === 'home_manager' && <Analytics userRole={userRole} retirementHome={retirementHome} />}
        {activeTab === 'users' && userRole === 'admin' && <UserManagement />}
        {activeTab === 'homes' && userRole === 'admin' && <HomeManagement />}
      </main>
    </div>
  );
}
