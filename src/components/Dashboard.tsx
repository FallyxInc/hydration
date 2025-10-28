'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, Firestore, getDoc, setDoc } from 'firebase/firestore';
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
      const userDoc = await getDoc(doc(fbdb, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('User data:', userData); // Debug log
        setUserRole(userData.role);
        setRetirementHome(userData.retirementHome || '');
        
        // Home managers should only see data tab
        if (userData.role === 'home_manager') {
          setActiveTab('data');
        }
      } else {
        console.log('User document not found, creating default...');
        // If user document doesn't exist, create a default one
        await setDoc(doc(db, 'users', user.uid), {
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email,
          role: 'home_manager', // Default role
          retirementHome: 'Responsive Senior Living', // Default home
          createdAt: new Date(),
        });
        setUserRole('home_manager');
        setRetirementHome('Responsive Senior Living');
        setActiveTab('data');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Fallback to default values
      setUserRole('home_manager');
      setRetirementHome('Responsive Senior Living');
      setActiveTab('data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user, fetchUserData]);

  const handleLogout = async () => {
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
