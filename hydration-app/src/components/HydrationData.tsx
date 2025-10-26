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
  unit?: string;
  averageIntake?: number;
  hasFeedingTube?: boolean;
  comments?: string;
}

export default function HydrationData({ userRole, retirementHome }: HydrationDataProps) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [filteredResidents, setFilteredResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [dateRange, setDateRange] = useState<number>(3);
  const [residentComments, setResidentComments] = useState<{[key: string]: string}>({});

  useEffect(() => {
    fetchHydrationData();
  }, []);

  useEffect(() => {
    filterResidents();
  }, [residents, selectedUnit, dateRange]);

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
        const processedResidents = (data.residents || []).map((resident: any) => ({
          ...resident,
          unit: extractUnitFromName(resident.name),
          averageIntake: calculateAverageIntake(resident),
          hasFeedingTube: resident.hasFeedingTube || false,
          comments: residentComments[resident.name] || ''
        }));
        setResidents(processedResidents);
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

  const extractUnitFromName = (name: string) => {
    // Extract unit from name patterns like "Unit 2A" or "Floor 3"
    const unitMatch = name.match(/(?:Unit|Floor)\s*(\d+[A-Z]?)/i);
    return unitMatch ? unitMatch[1] : 'Unknown';
  };

  const calculateAverageIntake = (resident: any) => {
    const days = [resident.day14, resident.day15, resident.day16, resident.yesterday];
    const validDays = days.filter(day => day > 0);
    return validDays.length > 0 ? Math.round(validDays.reduce((sum, day) => sum + day, 0) / validDays.length) : 0;
  };

  const filterResidents = () => {
    let filtered = [...residents];
    
    // Filter by unit
    if (selectedUnit !== 'all') {
      filtered = filtered.filter(resident => resident.unit === selectedUnit);
    }
    
    setFilteredResidents(filtered);
  };

  const handleCommentChange = (residentName: string, comment: string) => {
    setResidentComments(prev => ({
      ...prev,
      [residentName]: comment
    }));
  };

  const getUniqueUnits = () => {
    const units = residents.map(r => r.unit).filter((unit, index, self) => 
      unit && self.indexOf(unit) === index
    );
    return units.sort();
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
        'Unit',
        'Goal (mL)',
        'Yesterday (mL)',
        'Average Intake (mL)',
        'Status',
        'Day 14',
        'Day 15', 
        'Day 16',
        'Missed 3 Days',
        'Has Feeding Tube',
        'Comments',
        'Source File'
      ];

      // Create CSV rows
      const csvRows = residents.map(resident => {
        const status = getGoalStatus(resident.goal, resident.yesterday);
        const cleanedName = cleanResidentName(resident.name);
        return [
          `"${cleanedName}"`,
          `"${resident.unit || 'Unknown'}"`,
          resident.goal,
          resident.yesterday,
          resident.averageIntake || 0,
          `"${status}"`,
          resident.day14,
          resident.day15,
          resident.day16,
          `"${resident.missed3Days === 'yes' ? 'Yes' : 'No'}"`,
          `"${resident.hasFeedingTube ? 'Yes' : 'No'}"`,
          `"${residentComments[resident.name] || ''}"`,
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

  const goalMetCount = filteredResidents.filter(r => r.goal > 0 && r.yesterday >= r.goal).length;
  const missed3DaysCount = filteredResidents.filter(r => r.missed3Days === 'yes').length;
  const goalMetPercentage = filteredResidents.length > 0 ? (goalMetCount / filteredResidents.length * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Combined Summary Stats and Filter Controls - Same Line */}
      <div className="flex space-x-6">
        {/* Summary Stats Island - Left Side */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 flex-1">
          <div className="grid grid-cols-2 gap-6">
            {/* First Row */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <dl>
                  <dt className="text-sm font-medium text-gray-500">Total Residents</dt>
                  <dd className="text-2xl font-bold text-gray-900">{residents.length}</dd>
                </dl>
              </div>
            </div>

            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <dl>
                  <dt className="text-sm font-medium text-gray-500">Goal Met Today</dt>
                  <dd className="text-2xl font-bold text-gray-900">{goalMetCount}</dd>
                </dl>
              </div>
            </div>

            {/* Second Row */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-300 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <dl>
                  <dt className="text-sm font-medium text-gray-500">Missed 3 Days</dt>
                  <dd className="text-2xl font-bold text-gray-900">{missed3DaysCount}</dd>
                </dl>
              </div>
            </div>

            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-400 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <dl>
                  <dt className="text-sm font-medium text-gray-500">Goal Met %</dt>
                  <dd className={`text-2xl font-bold ${
                    parseFloat(goalMetPercentage) < 20 ? 'text-red-500' :
                    parseFloat(goalMetPercentage) < 40 ? 'text-yellow-500' :
                    parseFloat(goalMetPercentage) < 60 ? 'text-yellow-400' :
                    parseFloat(goalMetPercentage) < 80 ? 'text-green-400' :
                    'text-green-500'
                  }`}>{goalMetPercentage}%</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls Island - Right Side */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex flex-col justify-between h-full">
            <div className="flex items-center space-x-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Unit Filter</label>
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                >
                  <option value="all">All Units</option>
                  {getUniqueUnits().map(unit => (
                    <option key={unit} value={unit}>Unit {unit}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(parseInt(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                >
                  <option value={3}>Past 3 Days</option>
                  <option value={7}>Past 7 Days</option>
                  <option value={14}>Past 14 Days</option>
                </select>
              </div>
            </div>
            <div className="text-sm text-cyan-600 font-medium mt-4">
              Showing {filteredResidents.length} of {residents.length} residents
            </div>
          </div>
        </div>
      </div>

      {/* Residents Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl leading-6 font-bold text-gray-900">Resident Hydration Data</h3>
              <p className="mt-2 text-sm text-gray-600">
                Detailed view of all residents' hydration goals and consumption
              </p>
            </div>
            
            {/* Action buttons for home managers */}
            {userRole === 'home_manager' && (
              <div className="flex space-x-4">
                {/* Export CSV button */}
                <button
                  onClick={handleExportCSV}
                  disabled={exporting || residents.length === 0}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg text-sm font-medium flex items-center space-x-2 disabled:opacity-50 transition-colors"
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
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg text-sm font-medium flex items-center space-x-2 disabled:opacity-50 transition-colors"
                >
                  {deleting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-64 min-w-64">
                  Resident Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Goal (mL)
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Yesterday (mL)
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Average (mL)
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Day 14
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Day 15
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Day 16
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Missed 3 Days
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-80 min-w-80">
                  Comments
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredResidents.map((resident, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors duration-200">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 w-64 min-w-64">
                    <div className="flex items-center space-x-2">
                      <div className="truncate" title={cleanResidentName(resident.name)}>
                        {cleanResidentName(resident.name)}
                      </div>
                      {resident.hasFeedingTube && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800" title="Has Feeding Tube">
                          🥤
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {resident.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {resident.goal}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {resident.yesterday}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {resident.averageIntake || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${
                      resident.goal === 0 ? 'text-gray-400' : 
                      resident.yesterday >= resident.goal ? 'text-green-600' : 'text-red-600'
                    }`}>
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
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                      resident.missed3Days === 'yes' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {resident.missed3Days === 'yes' ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-4 w-80 min-w-80">
                    <textarea
                      value={residentComments[resident.name] || ''}
                      onChange={(e) => handleCommentChange(resident.name, e.target.value)}
                      placeholder="Add comment..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      rows={2}
                    />
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
