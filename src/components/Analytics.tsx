'use client';

import { useState, useEffect, useCallback } from 'react';

interface AnalyticsProps {
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

interface TrendAnalysis {
  decliningTrend: Resident[];
  consistentlyLow: Resident[];
  highRisk: Resident[];
  improvingTrend: Resident[];
  feedingTubeUsers: Resident[];
  lowGoalHighMiss: Resident[];
}

export default function Analytics({ userRole, retirementHome }: AnalyticsProps) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trendAnalysis, setTrendAnalysis] = useState<TrendAnalysis | null>(null);

  const fetchHydrationData = useCallback(async () => {
    try {
      const requestBody = {
        userRole,
        retirementHome
      };
      
      const response = await fetch('/api/hydration-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const processedResidents = (data.residents || []).map((resident: any) => ({
          ...resident,
          unit: extractUnitFromSource(resident.source),
          averageIntake: calculateAverageIntake(resident),
          hasFeedingTube: resident.hasFeedingTube || false
        }));
        setResidents(processedResidents);
        analyzeTrends(processedResidents);
      } else {
        setError(data.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('Error fetching hydration data:', err);
      setError('Failed to fetch hydration data');
    } finally {
      setLoading(false);
    }
  }, [userRole, retirementHome]);

  const extractUnitFromSource = (source: string) => {
    if (!source) return 'Unknown';
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

  const cleanResidentName = (name: string) => {
    return name.replace(/\s+No Middle Name\s*/gi, ' ').trim();
  };

  const analyzeTrends = (residents: Resident[]) => {
    const analysis: TrendAnalysis = {
      decliningTrend: [],
      consistentlyLow: [],
      highRisk: [],
      improvingTrend: [],
      feedingTubeUsers: [],
      lowGoalHighMiss: []
    };

    residents.forEach(resident => {
      if (!resident.dateData) return;

      const dates = Object.keys(resident.dateData).sort((a, b) => {
        const dateA = new Date(a.split('/')[2] + '-' + a.split('/')[0] + '-' + a.split('/')[1]);
        const dateB = new Date(b.split('/')[2] + '-' + b.split('/')[0] + '-' + b.split('/')[1]);
        return dateA.getTime() - dateB.getTime();
      });

      if (dates.length < 3) return;

      const values = dates.map(date => resident.dateData![date] || 0);
      const recentValues = values.slice(-3);
      const earlierValues = values.slice(0, Math.max(1, values.length - 3));

      // Declining trend: recent values are decreasing
      const recentTrend = recentValues[recentValues.length - 1] - recentValues[0];
      if (recentTrend < -100 && recentValues[recentValues.length - 1] < resident.goal * 0.8) {
        analysis.decliningTrend.push(resident);
      }

      // Consistently low: average is below 80% of goal
      if (resident.averageIntake && resident.goal > 0 && resident.averageIntake < resident.goal * 0.8) {
        analysis.consistentlyLow.push(resident);
      }

      // High risk: missed 3 days OR declining trend OR consistently low
      if (resident.missed3Days === 'yes' || 
          analysis.decliningTrend.includes(resident) ||
          analysis.consistentlyLow.includes(resident)) {
        analysis.highRisk.push(resident);
      }

      // Improving trend: recent values are increasing and above goal
      if (recentTrend > 100 && recentValues[recentValues.length - 1] >= resident.goal) {
        analysis.improvingTrend.push(resident);
      }

      // Feeding tube users
      if (resident.hasFeedingTube) {
        analysis.feedingTubeUsers.push(resident);
      }

      // Low goal but high miss rate: goal is low but still missing
      if (resident.goal > 0 && resident.goal < 1000 && resident.missed3Days === 'yes') {
        analysis.lowGoalHighMiss.push(resident);
      }
    });

    // Remove duplicates from highRisk
    analysis.highRisk = analysis.highRisk.filter((resident, index, self) =>
      index === self.findIndex(r => r.name === resident.name)
    );

    setTrendAnalysis(analysis);
  };

  useEffect(() => {
    fetchHydrationData();
  }, [fetchHydrationData]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
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

  const MetricCard = ({ title, count, residents, icon, color, description }: {
    title: string;
    count: number;
    residents: Resident[];
    icon: string;
    color: string;
    description: string;
  }) => (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl`} style={{ backgroundColor: `${color}20` }}>
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
        <div className={`text-3xl font-bold`} style={{ color }}>
          {count}
        </div>
      </div>
      {residents.length > 0 && (
        <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
          {residents.slice(0, 5).map((resident, index) => (
            <div key={index} className="text-sm text-gray-700 p-2 bg-gray-50 rounded">
              <div className="font-medium">{cleanResidentName(resident.name)}</div>
              <div className="text-xs text-gray-500">
                Goal: {resident.goal}mL | Avg: {resident.averageIntake || 0}mL
                {resident.unit && ` | Unit: ${resident.unit}`}
              </div>
            </div>
          ))}
          {residents.length > 5 && (
            <div className="text-xs text-gray-500 text-center pt-2">
              +{residents.length - 5} more
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Preventative Analytics & Trends</h2>
        <p className="text-gray-600">
          Proactive insights to identify at-risk residents and track improvement patterns
        </p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          title="High Risk Residents"
          count={trendAnalysis?.highRisk.length || 0}
          residents={trendAnalysis?.highRisk || []}
          icon="⚠️"
          color="#ef4444"
          description="Residents requiring immediate attention"
        />
        <MetricCard
          title="Declining Trend"
          count={trendAnalysis?.decliningTrend.length || 0}
          residents={trendAnalysis?.decliningTrend || []}
          icon="📉"
          color="#f59e0b"
          description="Recent consumption decreasing"
        />
        <MetricCard
          title="Consistently Low"
          count={trendAnalysis?.consistentlyLow.length || 0}
          residents={trendAnalysis?.consistentlyLow || []}
          icon="📊"
          color="#f59e0b"
          description="Average below 80% of goal"
        />
        <MetricCard
          title="Improving Trend"
          count={trendAnalysis?.improvingTrend.length || 0}
          residents={trendAnalysis?.improvingTrend || []}
          icon="📈"
          color="#10b981"
          description="Recent consumption increasing"
        />
        <MetricCard
          title="Feeding Tube Users"
          count={trendAnalysis?.feedingTubeUsers.length || 0}
          residents={trendAnalysis?.feedingTubeUsers || []}
          icon="🥤"
          color="#3b82f6"
          description="Residents with feeding tubes"
        />
        <MetricCard
          title="Low Goal, High Miss"
          count={trendAnalysis?.lowGoalHighMiss.length || 0}
          residents={trendAnalysis?.lowGoalHighMiss || []}
          icon="🎯"
          color="#f59e0b"
          description="Low goal but still missing"
        />
      </div>

      {/* Detailed Analysis Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* High Risk Section */}
        {trendAnalysis && trendAnalysis.highRisk.length > 0 && (
          <div className="bg-white rounded-lg p-6 shadow-sm border border-red-200">
            <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center">
              <span className="mr-2">⚠️</span>
              High Risk Residents - Action Required
            </h3>
            <div className="space-y-3">
              {trendAnalysis.highRisk.map((resident, index) => (
                <div key={index} className="border-l-4 border-red-500 pl-4 py-2 bg-red-50 rounded">
                  <div className="font-semibold text-gray-900">{cleanResidentName(resident.name)}</div>
                  <div className="text-sm text-gray-600 space-y-1 mt-1">
                    <div>Goal: {resident.goal}mL | Current Avg: {resident.averageIntake || 0}mL</div>
                    <div>Unit: {resident.unit || 'Unknown'}</div>
                    {resident.missed3Days === 'yes' && (
                      <div className="text-red-600 font-medium">⚠️ Missed 3 consecutive days</div>
                    )}
                    {trendAnalysis.decliningTrend.includes(resident) && (
                      <div className="text-orange-600 font-medium">📉 Declining consumption trend</div>
                    )}
                    {trendAnalysis.consistentlyLow.includes(resident) && (
                      <div className="text-orange-600 font-medium">📊 Consistently below goal</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Improving Section */}
        {trendAnalysis && trendAnalysis.improvingTrend.length > 0 && (
          <div className="bg-white rounded-lg p-6 shadow-sm border border-green-200">
            <h3 className="text-xl font-bold text-green-600 mb-4 flex items-center">
              <span className="mr-2">📈</span>
              Improving Residents - Positive Trends
            </h3>
            <div className="space-y-3">
              {trendAnalysis.improvingTrend.map((resident, index) => (
                <div key={index} className="border-l-4 border-green-500 pl-4 py-2 bg-green-50 rounded">
                  <div className="font-semibold text-gray-900">{cleanResidentName(resident.name)}</div>
                  <div className="text-sm text-gray-600 space-y-1 mt-1">
                    <div>Goal: {resident.goal}mL | Current Avg: {resident.averageIntake || 0}mL</div>
                    <div>Unit: {resident.unit || 'Unknown'}</div>
                    <div className="text-green-600 font-medium">✅ Showing improvement and meeting goals</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-3">Preventative Recommendations</h3>
        <ul className="space-y-2 text-blue-800">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>High Risk Residents:</strong> Schedule immediate check-ins and consider adjusting hydration strategies</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>Declining Trends:</strong> Monitor closely and investigate causes for decreased consumption</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>Consistently Low:</strong> Review and potentially adjust daily hydration goals</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>Feeding Tube Users:</strong> Ensure proper tube maintenance and monitoring protocols</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

