'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, Firestore } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import FileUpload from './FileUpload';
import HydrationData from './HydrationData';
import UserManagement from './UserManagement';

export default function Dashboard() {
  const { user, logout } = useAuth();
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900">
                {userRole === 'admin' ? 'Hydration Dashboard' : `${retirementHome} - Hydration Data`}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.email}
                {retirementHome && ` (${retirementHome})`}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white"
                style={{ backgroundColor: '#0cc7ed' }}
                onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#0aa8c7'}
                onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#0cc7ed'}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation - Only show for admins */}
      {userRole === 'admin' && (
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab('upload')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                  activeTab === 'upload'
                    ? 'border-cyan-500 text-cyan-600'
                    : 'border-transparent text-gray-500 hover:text-cyan-600 hover:border-cyan-300'
                }`}
              >
                File Upload
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                  activeTab === 'users'
                    ? 'border-cyan-500 text-cyan-600'
                    : 'border-transparent text-gray-500 hover:text-cyan-600 hover:border-cyan-300'
                }`}
              >
                User Management
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {activeTab === 'upload' && userRole === 'admin' && <FileUpload />}
        {activeTab === 'data' && userRole === 'home_manager' && <HydrationData userRole={userRole} retirementHome={retirementHome} />}
        {activeTab === 'users' && userRole === 'admin' && <UserManagement />}
      </main>
    </div>
  );
}
