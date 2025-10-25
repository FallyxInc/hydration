'use client';

import { useState, useEffect } from 'react';

interface HydrationDataProps {
  userRole?: 'admin' | 'home_manager' | null;
  retirementHome?: string;
}

interface Resident {
  name: string;
  goal: number;
  source: string;
  missed3Days: string;
  day14: number;
  day15: number;
  day16: number;
  yesterday: number;
}

export default function HydrationData({ userRole, retirementHome }: HydrationDataProps) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchHydrationData();
  }, []);

  const fetchHydrationData = async () => {
    console.log('🚀 [HYDRATION DATA COMPONENT] Starting data fetch...');
    console.log('📊 [HYDRATION DATA COMPONENT] Request parameters:', { userRole, retirementHome });
    
    try {
      console.log('📤 [HYDRATION DATA COMPONENT] Sending request to /api/hydration-data...');
      
      const response = await fetch('/api/hydration-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userRole,
          retirementHome
        }),
      });
      
      console.log('📥 [HYDRATION DATA COMPONENT] Response received:', { status: response.status, ok: response.ok });
      
      const data = await response.json();
      console.log('📊 [HYDRATION DATA COMPONENT] Response data:', data);
      
      if (response.ok) {
        console.log(`✅ [HYDRATION DATA COMPONENT] Successfully fetched ${data.residents?.length || 0} residents`);
        setResidents(data.residents || []);
      } else {
        console.error('❌ [HYDRATION DATA COMPONENT] API error:', data.error);
        setError(data.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('💥 [HYDRATION DATA COMPONENT] Network or processing error:', err);
      setError('Failed to fetch hydration data');
    } finally {
      setLoading(false);
      console.log('🏁 [HYDRATION DATA COMPONENT] Data fetch completed');
    }
  };

  const getGoalStatus = (goal: number, yesterday: number) => {
    if (goal === 0) return 'No goal set';
    return yesterday >= goal ? 'Goal Met' : 'Below Goal';
  };

  const cleanResidentName = (name: string) => {
    // Remove "No Middle Name" phrase from names
    return name.replace(/\s+No Middle Name\s*/gi, ' ').trim();
  };

  const handleDeleteData = async () => {
    if (!confirm('Are you sure you want to delete all data for this retirement home? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      console.log('🗑️ [DELETE] Starting data deletion for:', retirementHome);
      
      const response = await fetch('/api/delete-home-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          retirementHome
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ [DELETE] Data deleted successfully');
        // Refresh the data
        await fetchHydrationData();
      } else {
        console.error('❌ [DELETE] Error deleting data:', result.error);
        setError(result.error || 'Failed to delete data');
      }
    } catch (error) {
      console.error('💥 [DELETE] Network error:', error);
      setError('Failed to delete data');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (residents.length === 0) {
      alert('No data to export');
      return;
    }

    setExporting(true);
    try {
      console.log('📊 [EXPORT] Starting CSV export for:', retirementHome);
      
      // Create CSV headers
      const headers = [
        'Resident Name',
        'Goal (mL)',
        'Yesterday (mL)',
        'Status',
        'Day 14',
        'Day 15', 
        'Day 16',
        'Missed 3 Days',
        'Source File'
      ];

      // Create CSV rows
      const csvRows = residents.map(resident => {
        const status = getGoalStatus(resident.goal, resident.yesterday);
        const cleanedName = cleanResidentName(resident.name);
        return [
          `"${cleanedName}"`,
          resident.goal,
          resident.yesterday,
          `"${status}"`,
          resident.day14,
          resident.day15,
          resident.day16,
          `"${resident.missed3Days === 'yes' ? 'Yes' : 'No'}"`,
          `"${resident.source}"`
        ];
      });

      // Combine headers and rows
      const csvContent = [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `hydration-report-${retirementHome || 'all'}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('✅ [EXPORT] CSV export completed successfully');
    } catch (error) {
      console.error('💥 [EXPORT] Export error:', error);
      setError('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const getStatusColor = (goal: number, yesterday: number) => {
    if (goal === 0) return 'text-gray-500';
    return yesterday >= goal ? 'text-green-600' : 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-800">{error}</div>
      </div>
    );
  }

  const goalMetCount = residents.filter(r => r.goal > 0 && r.yesterday >= r.goal).length;
  const missed3DaysCount = residents.filter(r => r.missed3Days === 'yes').length;
  const goalMetPercentage = residents.length > 0 ? (goalMetCount / residents.length * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">👥</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Residents</dt>
                  <dd className="text-lg font-medium text-gray-900">{residents.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">✅</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Goal Met Today</dt>
                  <dd className="text-lg font-medium text-gray-900">{goalMetCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">⚠️</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Missed 3 Days</dt>
                  <dd className="text-lg font-medium text-gray-900">{missed3DaysCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">📊</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Goal Met %</dt>
                  <dd className="text-lg font-medium text-gray-900">{goalMetPercentage}%</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Residents Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Resident Hydration Data</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Detailed view of all residents' hydration goals and consumption
              </p>
            </div>
            
            {/* Action buttons for home managers */}
            {userRole === 'home_manager' && (
              <div className="flex space-x-3">
                {/* Export CSV button */}
                <button
                  onClick={handleExportCSV}
                  disabled={exporting || residents.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
                >
                  {exporting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export CSV
                    </>
                  )}
                </button>

                {/* Delete button */}
                <button
                  onClick={handleDeleteData}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
                >
                  {deleting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete All Data
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64 min-w-64">
                  Resident Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Goal (mL)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Yesterday (mL)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Day 14
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Day 15
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Day 16
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Missed 3 Days
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {residents.map((resident, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 w-64 min-w-64">
                    <div className="truncate" title={cleanResidentName(resident.name)}>
                      {cleanResidentName(resident.name)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {resident.goal}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {resident.yesterday}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${getStatusColor(resident.goal, resident.yesterday)}`}>
                      {getGoalStatus(resident.goal, resident.yesterday)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {resident.day14}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {resident.day15}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {resident.day16}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      resident.missed3Days === 'yes' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {resident.missed3Days === 'yes' ? 'Yes' : 'No'}
                    </span>
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
