'use client';

import { useState, useEffect } from 'react';

export default function HomeManagement() {
  const [homes, setHomes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchHomes();
  }, []);

  const fetchHomes = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/retirement-homes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setHomes(data.retirementHomes || []);
      } else {
        setError(data.error || 'Failed to fetch retirement homes');
      }
    } catch (err) {
      console.error('Error fetching retirement homes:', err);
      setError('Failed to fetch retirement homes');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHome = async (homeName: string) => {
    if (!confirm(`Are you sure you want to delete all data for "${homeName}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(homeName);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/delete-home-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ retirementHome: homeName }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage(data.message || `All data for ${homeName} has been deleted successfully`);
        fetchHomes();
      } else {
        setError(data.error || 'Failed to delete home data');
      }
    } catch (err) {
      console.error('Error deleting home data:', err);
      setError('Failed to delete home data');
    } finally {
      setDeleting(null);
    }
  };

  if (loading && homes.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><p className="mt-2 text-m text-gray-600">
            View all retirement homes 
          </p>
        </div>
        <button
          onClick={fetchHomes}
          className="text-white px-4 py-2 rounded-md text-sm font-medium"
          style={{ backgroundColor: '#0cc7ed' }}
          onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#0aa8c7'}
          onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#0cc7ed'}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {message && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="text-green-800">{message}</div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Retirement Home Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {homes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                      No retirement homes found
                    </td>
                  </tr>
                ) : (
                  homes.map((home, index) => (
                    <tr key={home} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {home}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleDeleteHome(home)}
                          disabled={deleting === home}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                        >
                          {deleting === home ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Deleting...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>Delete Data</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {homes.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Total Homes:</span> {homes.length}
          </div>
        </div>
      )}
    </div>
  );
}

