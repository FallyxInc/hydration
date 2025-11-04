'use client';

import { useState, useEffect, useCallback } from 'react';

interface HydrationDataProps {
  userRole?: 'admin' | 'home_manager' | null;
  retirementHome?: string;
}

interface Resident {
  name: string;
  goal: number;
  source: string;
  missed3Days: string;
  dateData?: { [date: string]: number };
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
  const [startDate, setStartDate] = useState<string>('');
  const [residentComments, setResidentComments] = useState<{[key: string]: string}>({});
  const [editingComments, setEditingComments] = useState<{[key: string]: string}>({});
  const [savingComments, setSavingComments] = useState<{[key: string]: boolean}>({});
  const [showFeedingTubePopup, setShowFeedingTubePopup] = useState<string | null>(null);
  const [dateColumns, setDateColumns] = useState<string[]>([]);

  const loadSavedComments = () => {
    try {
      const savedComments = localStorage.getItem('residentComments');
      if (savedComments) {
        setResidentComments(JSON.parse(savedComments));
      }
    } catch (error) {
      console.error('Error loading saved comments:', error);
    }
  };

  const saveCommentsToStorage = (comments: {[key: string]: string}) => {
    try {
      localStorage.setItem('residentComments', JSON.stringify(comments));
    } catch (error) {
      console.error('Error saving comments to localStorage:', error);
    }
  };

  const formatDateForInput = (dateStr: string): string => {
    const parts = dateStr.split('/');
    return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  };

  const fetchHydrationData = useCallback(async () => {
    console.log('🚀 [HYDRATION DATA COMPONENT] Starting data fetch...');
    console.log('📊 [HYDRATION DATA COMPONENT] Request parameters:', { userRole, retirementHome });
    console.log('🔍 [HYDRATION DATA COMPONENT] Retirement home value:', retirementHome);
    console.log('🔍 [HYDRATION DATA COMPONENT] Retirement home type:', typeof retirementHome);
    
    try {
      console.log('📤 [HYDRATION DATA COMPONENT] Sending request to /api/hydration-data...');
      
      const requestBody = {
        userRole,
        retirementHome
      };
      
      console.log('📤 [HYDRATION DATA COMPONENT] Request body:', requestBody);
      
      const response = await fetch('/api/hydration-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('📥 [HYDRATION DATA COMPONENT] Response received:', { status: response.status, ok: response.ok });
      
      const data = await response.json();
      console.log('📊 [HYDRATION DATA COMPONENT] Response data:', data);
      
      if (response.ok) {
        console.log(`✅ [HYDRATION DATA COMPONENT] Successfully fetched ${data.residents?.length || 0} residents`);
        const processedResidents = (data.residents || []).map((resident: any) => ({
          ...resident,
          unit: extractUnitFromSource(resident.source),
          averageIntake: calculateAverageIntake(resident),
          hasFeedingTube: resident.hasFeedingTube || false
        }));
        setResidents(processedResidents);
        
        // Extract all unique dates from all residents
        const allDates = new Set<string>();
        processedResidents.forEach((resident: any) => {
          if (resident.dateData) {
            Object.keys(resident.dateData).forEach(date => allDates.add(date));
          }
        });
        
        // Sort dates chronologically
        const sortedDates = Array.from(allDates).sort((a, b) => {
          const dateA = new Date(a.split('/')[2] + '-' + a.split('/')[0] + '-' + a.split('/')[1]);
          const dateB = new Date(b.split('/')[2] + '-' + b.split('/')[0] + '-' + b.split('/')[1]);
          return dateA.getTime() - dateB.getTime();
        });
        
        setDateColumns(sortedDates);
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
  }, [userRole, retirementHome]);

  const getGoalStatus = (goal: number, value: number) => {
    if (goal === 0) return 'No goal set';
    return value >= goal ? 'Goal Met' : 'Below Goal';
  };

  const cleanResidentName = (name: string) => {
    // Remove "No Middle Name" phrase from names
    return name.replace(/\s+No Middle Name\s*/gi, ' ').trim();
  };

  const extractUnitFromSource = (source: string) => {
    // Extract unit from PDF filename, remove .pdf extension and everything after it
    if (!source) return 'Unknown';
    // Remove .pdf and everything after it (like " - Page XX")
    const filename = source.replace(/\.pdf.*$/i, '');
    return filename || 'Unknown';
  };

  const calculateAverageIntake = (resident: any) => {
    if (resident.dateData) {
      const days = Object.values(resident.dateData) as number[];
      const validDays = days.filter(day => day > 0);
      return validDays.length > 0 ? Math.round(validDays.reduce((sum, day) => sum + day, 0) / validDays.length) : 0;
    }
    return 0;
  };
  
  const parseDate = (dateStr: string): Date => {
    const parts = dateStr.split('/');
    return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
  };

  const formatDateWithoutYear = (dateStr: string): string => {
    const parts = dateStr.split('/');
    return `${parts[0]}/${parts[1]}`;
  };

  const parseInputDate = (dateStr: string): Date => {
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  };

  const getFilteredDateColumns = (): string[] => {
    if (dateColumns.length === 0) return [];
    if (!startDate) return dateColumns;
    
    const endDate = parseInputDate(startDate);
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth();
    const endDay = endDate.getDate();
    const endDateOnly = new Date(endYear, endMonth, endDay);
    
    const cutoffDate = new Date(endYear, endMonth, endDay - (dateRange - 1));
    
    return dateColumns.filter(date => {
      const dateObj = parseDate(date);
      const dateYear = dateObj.getFullYear();
      const dateMonth = dateObj.getMonth();
      const dateDay = dateObj.getDate();
      const dateOnly = new Date(dateYear, dateMonth, dateDay);
      
      return dateOnly >= cutoffDate && dateOnly <= endDateOnly;
    });
  };

  const filteredDateColumns = getFilteredDateColumns();

  const getMostRecentDateValue = (resident: Resident) => {
    if (!resident.dateData || filteredDateColumns.length === 0) return 0;
    const mostRecentDate = filteredDateColumns[filteredDateColumns.length - 1];
    return resident.dateData[mostRecentDate] || 0;
  };

  const filterResidents = useCallback(() => {
    let filtered = [...residents];
    
    // Filter by unit
    if (selectedUnit !== 'all') {
      filtered = filtered.filter(resident => resident.unit === selectedUnit);
    }
    
    setFilteredResidents(filtered);
  }, [residents, selectedUnit]);

  const handleCommentChange = (residentName: string, comment: string) => {
    setEditingComments(prev => ({
      ...prev,
      [residentName]: comment
    }));
  };

  const handleSaveComment = async (residentName: string) => {
    setSavingComments(prev => ({ ...prev, [residentName]: true }));
    
    try {
      // Simulate API call - in a real app, you'd save to a backend
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const newComments = {
        ...residentComments,
        [residentName]: editingComments[residentName] || ''
      };
      
      // Update state
      setResidentComments(newComments);
      
      // Save to localStorage
      saveCommentsToStorage(newComments);
      
      // Clear editing state
      setEditingComments(prev => ({
        ...prev,
        [residentName]: ''
      }));
      
      console.log('Comment saved for', residentName, ':', editingComments[residentName]);
    } catch (error) {
      console.error('Error saving comment:', error);
    } finally {
      setSavingComments(prev => ({ ...prev, [residentName]: false }));
    }
  };

  const handleEditComment = (residentName: string) => {
    setEditingComments(prev => ({
      ...prev,
      [residentName]: residentComments[residentName] || ''
    }));
  };

  const handleCancelEdit = (residentName: string) => {
    setEditingComments(prev => ({
      ...prev,
      [residentName]: ''
    }));
  };

  const handleDeleteComment = (residentName: string) => {
    const newComments = { ...residentComments };
    delete newComments[residentName];
    
    setResidentComments(newComments);
    saveCommentsToStorage(newComments);
    
    console.log('Comment deleted for', residentName);
  };

  const handleFeedingTubeClick = (residentName: string) => {
    console.log('Feeding tube button clicked for:', residentName);
    setShowFeedingTubePopup(residentName);
    // Auto-hide after 2 seconds
    setTimeout(() => {
      setShowFeedingTubePopup(null);
    }, 2000);
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
        ...filteredDateColumns.map(date => date),
        'Average Intake (mL)',
        'Status',
        'Missed 3 Days',
        'Has Feeding Tube',
        'Comments',
        'Source File'
      ];

      // Create CSV rows
      const csvRows = residents.map(resident => {
        const mostRecent = getMostRecentDateValue(resident);
        const status = getGoalStatus(resident.goal, mostRecent);
        const cleanedName = cleanResidentName(resident.name);
        return [
          `"${cleanedName}"`,
          `"${resident.unit || 'Unknown'}"`,
          resident.goal,
          ...filteredDateColumns.map(date => resident.dateData?.[date] || 0),
          resident.averageIntake || 0,
          `"${status}"`,
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

  const getStatusColor = (goal: number, value: number) => {
    if (goal === 0) return 'text-gray-500';
    return value >= goal ? 'text-green-600' : 'text-red-600';
  };

  useEffect(() => {
    fetchHydrationData();
    loadSavedComments();
  }, [fetchHydrationData]);

  useEffect(() => {
    filterResidents();
  }, [filterResidents]);

  useEffect(() => {
    if (dateColumns.length > 0 && !startDate) {
      const today = new Date();
      const todayYear = today.getFullYear();
      const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
      const todayDay = String(today.getDate()).padStart(2, '0');
      setStartDate(`${todayYear}-${todayMonth}-${todayDay}`);
    }
  }, [dateColumns, startDate]);

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

  const goalMetCount = filteredResidents.filter(r => {
    const mostRecent = getMostRecentDateValue(r);
    return r.goal > 0 && mostRecent >= r.goal;
  }).length;
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
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#e0f7fa' }}>
                  <svg className="w-6 h-6" fill="none" stroke="#0cc7ed" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <dl>
                  <dt className="text-sm font-medium text-gray-500">Total Residents</dt>
                  <dd className="text-xl font-bold text-gray-900">{residents.length}</dd>
                </dl>
              </div>
            </div>

            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#e0f7fa' }}>
                  <svg className="w-6 h-6" fill="none" stroke="#0cc7ed" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <dl>
                  <dt className="text-sm font-medium text-gray-500">Goal Met Today</dt>
                  <dd className="text-xl font-bold text-gray-900">{goalMetCount}</dd>
                </dl>
              </div>
            </div>

            {/* Second Row */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#e0f7fa' }}>
                  <svg className="w-6 h-6" fill="none" stroke="#0cc7ed" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <dl>
                  <dt className="text-sm font-medium text-gray-500">Missed 3 Days</dt>
                  <dd className="text-xl font-bold text-gray-900">{missed3DaysCount}</dd>
                </dl>
              </div>
            </div>

            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#e0f7fa' }}>
                  <svg className="w-6 h-6" fill="none" stroke="#0cc7ed" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <dl>
                  <dt className="text-sm font-medium text-gray-500">Goal Met %</dt>
                  <dd className={`text-xl font-bold ${
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
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 relative">
          <div className="space-y-4">
            <div className="text-center w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">Unit Filter</label>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 mx-auto block text-center w-full"
              >
                <option value="all" className="text-center">All Units</option>
                {getUniqueUnits().map(unit => (
                  <option key={unit} value={unit} className="text-center">Unit {unit}</option>
                ))}
              </select>
            </div>
            <div className="text-center w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(parseInt(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 mx-auto block text-center w-full mb-2"
              >
                <option value={3}>Past 3 Days</option>
                <option value={4}>Past 4 Days</option>
                <option value={5}>Past 5 Days</option>
                <option value={6}>Past 6 Days</option>
                <option value={7}>Past 7 Days</option>
              </select>
            </div>
            <div
              className="mt-2 text-sm text-cyan-600 font-medium text-center sticky bottom-0 bg-white py-1 z-10"
              style={{ 
                background: 'white',
                left: 0,
                right: 0
              }}
            >
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
              <h3 className="text-xl leading-6 font-bold text-gray-900">Resident Hydration Data</h3>
              <p className="mt-2 text-sm text-gray-600">
                Detailed view of all residents&apos; hydration goals and consumption
              </p>
            </div>
            
            {/* Action buttons for home managers */}
            {userRole === 'home_manager' && (
              <div className="flex space-x-4">
                {/* Date Range Selector */}
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-6  h-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm"
                  />
                </div>

                {/* Export CSV button */}
                <button
                  onClick={handleExportCSV}
                  disabled={exporting || residents.length === 0}
                  className=" bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg text-sm font-medium flex items-center space-x-2 disabled:opacity-50 transition-colors"
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
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ maxWidth: '200px', width: 'auto' }}>
                  Resident Name
                </th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Goal (mL)
                </th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Average (mL)
                </th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                {filteredDateColumns.map((date) => (
                  <th key={date} className="px-3 py-4 text-left text-xs font-semibold text-cyan-600 uppercase tracking-wider">
                    {formatDateWithoutYear(date)}
                  </th>
                ))}
                <th className="px-3 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Missed 3 Days
                </th>
                 <th className="px-3 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ minWidth: '150px', maxWidth: '200px' }}>
                   Comments
                 </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredResidents.map((resident, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors duration-200">
              <td className="px-3 py-4 text-sm font-medium text-gray-900" style={{ maxWidth: '200px', width: 'auto' }}>
                <div className="flex items-start space-x-2">
                  <div className="break-words min-w-0" title={cleanResidentName(resident.name)}>
                    <div className="font-medium text-gray-900 break-words min-w-0">
                      {cleanResidentName(resident.name)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center space-x-2">
                      <span>{resident.unit || 'Unknown'}</span>
                      {resident.hasFeedingTube && (
                        <div className="relative inline-block">
                          <button
                            onClick={() => handleFeedingTubeClick(resident.name)}
                            className="inline-flex items-center justify-center w-5 h-5 bg-orange-100 hover:bg-orange-200 rounded-full text-orange-600 text-xs transition-colors"
                          >
                            🥤
                          </button>
                          {showFeedingTubePopup === resident.name && (
                            <div className="absolute top-6 left-0 bg-gray-50 text-gray-600 text-xs px-2 py-1 rounded shadow-sm border border-gray-200 z-50 whitespace-nowrap">
                              Feeding tube used
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                    {resident.goal}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                    {resident.averageIntake || 0}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="flex flex-col space-y-2">
                      {/* Progress Bar */}
                      <div className="w-full">
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="h-3 rounded-full bg-gradient-to-r from-cyan-300 to-cyan-500 transition-all duration-300"
                            style={{ 
                              width: `${Math.min((getMostRecentDateValue(resident) / resident.goal) * 100, 100)}%`,
                              background: `linear-gradient(to right, #67e8f9, #0cc7ed)`
                            }}
                          ></div>
                        </div>
                      </div>
                      {/* Percentage Text */}
                      <div className="text-xs font-medium text-gray-600 text-center">
                        {resident.goal === 0 ? 'N/A' : `${Math.min(Math.round((getMostRecentDateValue(resident) / resident.goal) * 100), 100)}%`}
                      </div>
                    </div>
                  </td>
                  {filteredDateColumns.map((date) => (
                    <td key={date} className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                      {resident.dateData?.[date] || 0}
                    </td>
                  ))}
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                      resident.missed3Days === 'yes' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {resident.missed3Days === 'yes' ? 'Yes' : 'No'}
                    </span>
                  </td>
                   <td className="px-3 py-4" style={{ minWidth: '150px', maxWidth: '200px' }}>
                     <div className="space-y-1">
                      {/* Display saved comment or editing area */}
                      {residentComments[resident.name] && !editingComments[resident.name] ? (
                        <div className="space-y-1">
                           <div className="p-2 bg-gray-50 rounded text-xs text-gray-700 min-h-[40px] relative group break-words overflow-hidden">
                             <div className="max-h-12 overflow-hidden" style={{
                               display: '-webkit-box',
                               WebkitLineClamp: 3,
                               WebkitBoxOrient: 'vertical'
                             }}>{residentComments[resident.name]}</div>
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex space-x-1 transition-opacity">
                              <button
                                onClick={() => handleEditComment(resident.name)}
                                className="text-cyan-600 hover:text-cyan-700 text-xs"
                                title="Edit comment"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteComment(resident.name)}
                                className="text-red-500 hover:text-red-600 text-xs"
                                title="Delete comment"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                           <textarea
                             value={editingComments[resident.name] || ''}
                             onChange={(e) => handleCommentChange(resident.name, e.target.value)}
                             placeholder="Add comment..."
                             className="w-full px-2 py-1 pr-8 border border-gray-300 rounded text-xs resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 break-words"
                             rows={2}
                             maxLength={200}
                           />
                          <button
                            onClick={() => handleSaveComment(resident.name)}
                            disabled={savingComments[resident.name] || !editingComments[resident.name]?.trim()}
                            className="absolute top-1 right-1 w-5 h-5 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-300 text-white text-xs rounded flex items-center justify-center transition-colors"
                            title="Save comment"
                          >
                            {savingComments[resident.name] ? '⏳' : '✓'}
                          </button>
                        </div>
                      )}
                    </div>
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
