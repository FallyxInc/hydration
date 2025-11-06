'use client';

import { useState, useEffect, useCallback } from 'react';

interface HomeData {
  homeName: string;
  totalResidents: number;
  missed3DaysCount: number;
  goalMetCount: number;
  goalMetPercentage: number;
  averageIntake: number;
  residents: any[];
}

interface ChainAdminDashboardProps {
  chain: string;
}

type GraphMetric = 'missed3Days' | 'residents' | 'goalMet' | 'averageIntake';

export default function ChainAdminDashboard({ chain }: ChainAdminDashboardProps) {
  const [homesData, setHomesData] = useState<HomeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [graphMetric, setGraphMetric] = useState<GraphMetric>('missed3Days');

  const fetchChainData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/chain-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chain }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setHomesData(data.homes || []);
      } else {
        setError(data.error || 'Failed to fetch chain data');
      }
    } catch (err) {
      console.error('Error fetching chain data:', err);
      setError('Failed to fetch chain data');
    } finally {
      setLoading(false);
    }
  }, [chain]);

  useEffect(() => {
    fetchChainData();
  }, [fetchChainData]);

  const getGraphData = () => {
    switch (graphMetric) {
      case 'missed3Days':
        return homesData.map(home => ({
          name: home.homeName,
          value: home.missed3DaysCount
        }));
      case 'residents':
        return homesData.map(home => ({
          name: home.homeName,
          value: home.totalResidents
        }));
      case 'goalMet':
        return homesData.map(home => ({
          name: home.homeName,
          value: home.goalMetCount
        }));
      case 'averageIntake':
        return homesData.map(home => ({
          name: home.homeName,
          value: home.averageIntake
        }));
      default:
        return [];
    }
  };

  const getGraphTitle = () => {
    switch (graphMetric) {
      case 'missed3Days':
        return 'Homes by Number of Missed 3-Day Goal Hits';
      case 'residents':
        return 'Homes by Number of Residents';
      case 'goalMet':
        return 'Homes by Number of Residents Meeting Goals';
      case 'averageIntake':
        return 'Homes by Average Intake (mL)';
      default:
        return '';
    }
  };

  const graphData = getGraphData();
  const maxValue = Math.max(...graphData.map(d => d.value), 1);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 dark:border-cyan-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
        <div className="text-red-800 dark:text-red-300">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-200">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {chain} - Chain Overview
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Comprehensive view of all homes in your chain
        </p>
      </div>

      {/* Graph Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {getGraphTitle()}
          </h3>
          <select
            value={graphMetric}
            onChange={(e) => setGraphMetric(e.target.value as GraphMetric)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400 focus:border-cyan-500 dark:focus:border-cyan-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="missed3Days">Missed 3-Day Goal Hits</option>
            <option value="residents">Number of Residents</option>
            <option value="goalMet">Residents Meeting Goals</option>
            <option value="averageIntake">Average Intake (mL)</option>
          </select>
        </div>

        {/* Bar Chart */}
        <div className="mt-6">
          <div className="flex items-end space-x-4 h-64">
            {graphData.map((data, index) => {
              const height = (data.value / maxValue) * 100;
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full relative">
                    <div
                      className="w-full bg-gradient-to-t from-cyan-500 to-cyan-400 dark:from-cyan-600 dark:to-cyan-500 rounded-t transition-all duration-300 hover:opacity-80"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                      title={`${data.name}: ${data.value}`}
                    />
                  </div>
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 font-medium text-center truncate w-full" title={data.name}>
                    {data.name.length > 15 ? data.name.substring(0, 15) + '...' : data.name}
                  </div>
                  <div className="text-xs font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {data.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Home Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {homesData.map((home, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:shadow-md"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              {home.homeName}
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Residents</span>
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {home.totalResidents}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Missed 3 Days</span>
                <span className={`text-lg font-semibold ${
                  home.missed3DaysCount > 0 
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {home.missed3DaysCount}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Goal Met</span>
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {home.goalMetCount}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Goal Met %</span>
                <span className={`text-lg font-semibold ${
                  home.goalMetPercentage >= 80 
                    ? 'text-green-600 dark:text-green-400' 
                    : home.goalMetPercentage >= 60
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {home.goalMetPercentage}%
                </span>
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Avg Intake</span>
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {home.averageIntake} mL
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {homesData.length === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
          <div className="text-yellow-800 dark:text-yellow-300">
            No homes found for this chain. Please ensure homes are assigned to this chain.
          </div>
        </div>
      )}
    </div>
  );
}

