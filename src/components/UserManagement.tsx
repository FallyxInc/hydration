'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Firestore } from 'firebase/firestore';
import { createUserWithEmailAndPassword, Auth, deleteUser } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'home_manager';
  retirementHome: string;
  createdAt: Date;
  firebaseUid?: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'home_manager',
    retirementHome: ''
  });
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionRef = useRef<boolean>(false);
  const [submissionInProgress, setSubmissionInProgress] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      if (!db || db === null) {
        console.error('Firebase not initialized. Please check environment variables.');
        return;
      }
      let fbdb = db as Firestore;
      const querySnapshot = await getDocs(collection(fbdb, 'users'));
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Multiple layers of duplicate prevention
    if (submissionRef.current || submissionInProgress || isSubmitting) {
      console.log('Duplicate submission prevented - multiple checks failed');
      return;
    }
    
    console.log('Starting user creation process...');
    submissionRef.current = true;
    setSubmissionInProgress(true);
    setIsSubmitting(true);
    setLoading(true);
    setMessage('');

    try {
      // Check if Firebase is available
      if (!auth || auth === null || !db || db === null) {
        setMessage('Error: Firebase not initialized. Please check environment variables.');
        return;
      }

      // Validate password length
      if (formData.password.length < 6) {
        setMessage('Error: Password must be at least 6 characters long.');
        return;
      }

      // Validate retirement home for home managers
      if (formData.role === 'home_manager' && !formData.retirementHome.trim()) {
        setMessage('Error: Retirement home is required for home managers.');
        return;
      }

      console.log('Creating user with role:', formData.role, 'Email:', formData.email);

      // Create Firebase Auth user first
      let fbauth = auth as Auth;
      const userCredential = await createUserWithEmailAndPassword(fbauth, formData.email, formData.password);
      const firebaseUser = userCredential.user;
      console.log('Firebase Auth user created:', firebaseUser.uid);

      // Then create the user document in Firestore
      let fbdb = db as Firestore;
      const userDocRef = await addDoc(collection(fbdb, 'users'), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        retirementHome: formData.role === 'home_manager' ? formData.retirementHome : '',
        createdAt: new Date(),
        firebaseUid: firebaseUser.uid
      });
      console.log('Firestore user document created:', userDocRef.id);

      setMessage('User created successfully! You can now provide these credentials to the user to log in.');
      setFormData({ name: '', email: '', password: '', role: 'home_manager', retirementHome: '' });
      setShowForm(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      // Handle Firebase errors with user-friendly messages
      let errorMessage = 'An error occurred while creating the user.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/password accounts are not enabled. Please contact support.';
      }
      
      setMessage(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
      setIsSubmitting(false);
      setSubmissionInProgress(false);
      // Reset submission ref
      submissionRef.current = false;
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'home_manager') => {
    try {
      if (!db || db === null) {
        console.error('Firebase not initialized. Please check environment variables.');
        return;
      }
      let fbdb = db as Firestore;
      await updateDoc(doc(fbdb, 'users', userId), {
        role: newRole
      });
      setMessage(`User role updated to ${newRole === 'admin' ? 'Admin' : 'Home Manager'} successfully!`);
      fetchUsers();
    } catch (error) {
      setMessage(`Error updating user role: ${error}`);
    }
  };

  const handleDelete = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        if (!db || db === null || !auth || auth === null) {
          console.error('Firebase not initialized. Please check environment variables.');
          return;
        }

        // Find the user document to get the Firebase UID
        let fbdb = db as Firestore;
        const userDoc = doc(fbdb, 'users', userId);
        const userData = users.find(user => user.id === userId);
        
        if (!userData) {
          setMessage('Error: User not found');
          return;
        }

        // Delete from Firestore first
        await deleteDoc(userDoc);
        
        // Try to delete from Firebase Auth if we have the UID
        if (userData.firebaseUid) {
          try {
            let fbauth = auth as Auth;
            // Note: deleteUser requires the user to be currently signed in
            // For admin deletion, we might need to use Firebase Admin SDK
            // For now, we'll just delete from Firestore and show a warning
            console.log('Firebase Auth user deletion requires Admin SDK for admin operations');
          } catch (authError) {
            console.log('Could not delete Firebase Auth user:', authError);
          }
        }
        
        setMessage('User deleted successfully! Note: Firebase Auth user may still exist.');
        fetchUsers();
      } catch (error) {
        setMessage(`Error deleting user: ${error}`);
      }
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-base leading-6 font-medium text-gray-900">User Management</h3>
        <button
          onClick={() => setShowForm(true)}
          className="text-white px-4 py-2 rounded-md text-sm font-medium"
          style={{ backgroundColor: '#0cc7ed' }}
          onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#0aa8c7'}
          onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#0cc7ed'}
        >
          Add New User
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-md ${
          message.includes('Error') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
        }`}>
          {message}
        </div>
      )}

      {/* Add User Form */}
      {showForm && (
        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-base font-medium text-gray-900 mb-4">Add New User</h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full px-4 py-3 text-gray-900 border-gray-300 rounded-md shadow-sm text-base"
                style={{ 
                  '--tw-ring-color': '#0cc7ed',
                  '--tw-border-color': '#0cc7ed'
                } as React.CSSProperties}
                onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = '#0cc7ed';
                (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(12, 199, 237, 0.1)';
                }}
                onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = '#d1d5db';
                (e.target as HTMLInputElement).style.boxShadow = 'none';
                }}
                placeholder="Enter full name"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 block w-full px-4 py-3 text-gray-900 border-gray-300 rounded-md shadow-sm text-base"
                style={{ 
                  '--tw-ring-color': '#0cc7ed',
                  '--tw-border-color': '#0cc7ed'
                } as React.CSSProperties}
                onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = '#0cc7ed';
                (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(12, 199, 237, 0.1)';
                }}
                onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = '#d1d5db';
                (e.target as HTMLInputElement).style.boxShadow = 'none';
                }}
                placeholder="Enter email address"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`block w-full px-4 py-3 pr-10 text-gray-900 rounded-md shadow-sm text-base ${
                    formData.password.length > 0 && formData.password.length < 6 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:border-cyan-500 focus:ring-cyan-500'
                  }`}
                  style={{ 
                    '--tw-ring-color': formData.password.length > 0 && formData.password.length < 6 ? '#ef4444' : '#0cc7ed',
                    '--tw-border-color': formData.password.length > 0 && formData.password.length < 6 ? '#ef4444' : '#0cc7ed'
                  } as React.CSSProperties}
                  onFocus={(e) => {
                    const target = e.target as HTMLInputElement;
                    if (formData.password.length > 0 && formData.password.length < 6) {
                      target.style.borderColor = '#ef4444';
                      target.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
                    } else {
                      target.style.borderColor = '#0cc7ed';
                      target.style.boxShadow = '0 0 0 3px rgba(12, 199, 237, 0.1)';
                    }
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLInputElement).style.borderColor = '#d1d5db';
                    (e.target as HTMLInputElement).style.boxShadow = 'none';
                  }}
                  placeholder="Enter password (minimum 6 characters)"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {formData.password.length > 0 && formData.password.length < 6 && (
                <p className="mt-1 text-sm text-red-600">
                  Password must be at least 6 characters long
                </p>
              )}
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => {
                  const newRole = e.target.value as 'admin' | 'home_manager';
                  setFormData({ 
                    ...formData, 
                    role: newRole,
                    // Clear retirement home when switching to admin
                    retirementHome: newRole === 'admin' ? '' : formData.retirementHome
                  });
                }}
                className="mt-1 block w-full px-4 py-3 text-gray-900 border-gray-300 rounded-md shadow-sm text-base"
                style={{ 
                  '--tw-ring-color': '#0cc7ed',
                  '--tw-border-color': '#0cc7ed'
                } as React.CSSProperties}
                onFocus={(e) => {
                (e.target as HTMLSelectElement).style.borderColor = '#0cc7ed';
                (e.target as HTMLSelectElement).style.boxShadow = '0 0 0 3px rgba(12, 199, 237, 0.1)';
                }}
                onBlur={(e) => {
                (e.target as HTMLSelectElement).style.borderColor = '#d1d5db';
                (e.target as HTMLSelectElement).style.boxShadow = 'none';
                }}
              >
                <option value="home_manager">Home Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {formData.role === 'home_manager' && (
              <div>
                <label htmlFor="retirementHome" className="block text-sm font-medium text-gray-700">
                  Retirement Home Name
                </label>
                <input
                  type="text"
                  id="retirementHome"
                  value={formData.retirementHome}
                  onChange={(e) => setFormData({ ...formData, retirementHome: e.target.value })}
                  className="mt-1 block w-full px-4 py-3 text-gray-900 border-gray-300 rounded-md shadow-sm text-base"
                  style={{ 
                    '--tw-ring-color': '#0cc7ed',
                    '--tw-border-color': '#0cc7ed'
                  } as React.CSSProperties}
                  onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = '#0cc7ed';
                  (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(12, 199, 237, 0.1)';
                  }}
                  onBlur={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = '#d1d5db';
                  (e.target as HTMLInputElement).style.boxShadow = 'none';
                  }}
                  placeholder="e.g., Sunset Manor, Golden Years, etc."
                  required
                />
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || formData.password.length < 6 || isSubmitting || submissionInProgress}
                className="text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: '#0cc7ed' }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = '#0aa8c7';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = '#0cc7ed';
                  }
                }}
              >
                {loading || isSubmitting || submissionInProgress ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-base leading-6 font-medium text-gray-900">All Users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retirement Home
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'home_manager')}
                      className={`text-xs font-semibold rounded-full px-2 py-1 border-0 cursor-pointer ${
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      <option value="home_manager">🏠 Home Manager</option>
                      <option value="admin">👑 Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.retirementHome || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
