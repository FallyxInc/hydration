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
  longTermImproving: Array<Resident & { improvementWeeks: number; avgImprovement: number }>;
  sustainedImprovement: Array<Resident & { weeksAboveGoal: number; improvementRate: number }>;
  weekOverWeekImproving: Array<Resident & { weeklyChange: number }>;
  monthOverMonthImproving: Array<Resident & { monthlyChange: number }>;
  decliningLongTerm: Array<Resident & { declineWeeks: number; avgDecline: number }>;
}

export default function Analytics({ userRole, retirementHome }: AnalyticsProps) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trendAnalysis, setTrendAnalysis] = useState<TrendAnalysis | null>(null);
  const [expandedLists, setExpandedLists] = useState<{
    highRisk: boolean;
    improving: boolean;
  }>({
    highRisk: false,
    improving: false
  });

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

  const parseDate = (dateStr: string): Date => {
    const parts = dateStr.split('/');
    return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
  };


  const analyzeTrends = (residents: Resident[]) => {
    const analysis: TrendAnalysis = {
      decliningTrend: [],
      consistentlyLow: [],
      highRisk: [],
      improvingTrend: [],
      feedingTubeUsers: [],
      lowGoalHighMiss: [],
      longTermImproving: [],
      sustainedImprovement: [],
      weekOverWeekImproving: [],
      monthOverMonthImproving: [],
      decliningLongTerm: []
    };

    residents.forEach(resident => {
      if (!resident.dateData) return;

      const dates = Object.keys(resident.dateData).sort((a, b) => {
        const dateA = parseDate(a);
        const dateB = parseDate(b);
        return dateA.getTime() - dateB.getTime();
      });

      if (dates.length < 3) return;

      const values = dates.map(date => resident.dateData![date] || 0);

      // Short-term analysis (last 3 days)
      const recentValues = values.slice(-3);
      const earlierValues = values.slice(0, Math.max(1, values.length - 3));
      const recentTrend = recentValues[recentValues.length - 1] - recentValues[0];

      // Declining trend: recent values are decreasing
      if (recentTrend < -100 && recentValues[recentValues.length - 1] < resident.goal * 0.8) {
        analysis.decliningTrend.push(resident);
      }

      // Consistently low: average is below 80% of goal
      if (resident.averageIntake && resident.goal > 0 && resident.averageIntake < resident.goal * 0.8) {
        analysis.consistentlyLow.push(resident);
      }

      // Improving trend: recent values are increasing and above goal
      if (recentTrend > 100 && recentValues[recentValues.length - 1] >= resident.goal) {
        analysis.improvingTrend.push(resident);
      }

      // Feeding tube users
      if (resident.hasFeedingTube) {
        analysis.feedingTubeUsers.push(resident);
      }

      // Low goal but high miss rate
      if (resident.goal > 0 && resident.goal < 1000 && resident.missed3Days === 'yes') {
        analysis.lowGoalHighMiss.push(resident);
      }

      // LONG-TERM ANALYSIS
      if (dates.length >= 7) {
        // Week-over-week analysis
        const lastWeek = values.slice(-7);
        const previousWeek = values.slice(-14, -7);
        if (previousWeek.length === 7 && lastWeek.length === 7) {
          const lastWeekAvg = lastWeek.reduce((a, b) => a + b, 0) / 7;
          const previousWeekAvg = previousWeek.reduce((a, b) => a + b, 0) / 7;
          const weeklyChange = lastWeekAvg - previousWeekAvg;
          
          if (weeklyChange > 50 && lastWeekAvg >= resident.goal * 0.9) {
            analysis.weekOverWeekImproving.push({
              ...resident,
              weeklyChange: Math.round(weeklyChange)
            });
          }
        }

        // Long-term improvement tracking (weeks of improvement)
        const weeksOfData = Math.ceil(dates.length / 7);
        if (weeksOfData >= 2) {
          const weeklyAverages: number[] = [];
          for (let i = 0; i < values.length; i += 7) {
            const weekValues = values.slice(i, i + 7);
            if (weekValues.length > 0) {
              weeklyAverages.push(weekValues.reduce((a, b) => a + b, 0) / weekValues.length);
            }
          }

          // Count consecutive weeks of improvement
          let improvementWeeks = 0;
          let totalImprovement = 0;
          for (let i = weeklyAverages.length - 1; i > 0; i--) {
            const improvement = weeklyAverages[i] - weeklyAverages[i - 1];
            if (improvement > 30) {
              improvementWeeks++;
              totalImprovement += improvement;
            } else {
              break;
            }
          }

          if (improvementWeeks >= 2) {
            analysis.longTermImproving.push({
              ...resident,
              improvementWeeks,
              avgImprovement: Math.round(totalImprovement / improvementWeeks)
            });
          }

          // Sustained improvement: consecutive weeks above goal
          let weeksAboveGoal = 0;
          for (let i = weeklyAverages.length - 1; i >= 0; i--) {
            if (weeklyAverages[i] >= resident.goal) {
              weeksAboveGoal++;
            } else {
              break;
            }
          }

          if (weeksAboveGoal >= 2 && weeklyAverages.length >= 3) {
            const recentAvg = weeklyAverages.slice(-3).reduce((a, b) => a + b, 0) / 3;
            const earlierAvg = weeklyAverages.slice(0, Math.max(1, weeklyAverages.length - 3)).reduce((a, b) => a + b, 0) / Math.max(1, weeklyAverages.length - 3);
            const improvementRate = recentAvg - earlierAvg;
            
            if (improvementRate > 50) {
              analysis.sustainedImprovement.push({
                ...resident,
                weeksAboveGoal,
                improvementRate: Math.round(improvementRate)
              });
            }
          }

          // Long-term declining trend
          let declineWeeks = 0;
          let totalDecline = 0;
          for (let i = weeklyAverages.length - 1; i > 0; i--) {
            const decline = weeklyAverages[i - 1] - weeklyAverages[i];
            if (decline > 30) {
              declineWeeks++;
              totalDecline += decline;
            } else {
              break;
            }
          }

          if (declineWeeks >= 2 && weeklyAverages[weeklyAverages.length - 1] < resident.goal * 0.85) {
            analysis.decliningLongTerm.push({
              ...resident,
              declineWeeks,
              avgDecline: Math.round(totalDecline / declineWeeks)
            });
          }
        }

        // Month-over-month analysis (if we have 30+ days of data)
        if (dates.length >= 30) {
          const lastMonth = values.slice(-30);
          const previousMonth = values.slice(-60, -30);
          if (previousMonth.length >= 14 && lastMonth.length >= 14) {
            const lastMonthAvg = lastMonth.reduce((a, b) => a + b, 0) / lastMonth.length;
            const previousMonthAvg = previousMonth.reduce((a, b) => a + b, 0) / previousMonth.length;
            const monthlyChange = lastMonthAvg - previousMonthAvg;
            
            if (monthlyChange > 100 && lastMonthAvg >= resident.goal * 0.9) {
              analysis.monthOverMonthImproving.push({
                ...resident,
                monthlyChange: Math.round(monthlyChange)
              });
            }
          }
        }
      }

      // High risk: missed 3 days OR declining trend OR consistently low OR long-term declining
      if (resident.missed3Days === 'yes' || 
          analysis.decliningTrend.includes(resident) ||
          analysis.consistentlyLow.includes(resident) ||
          analysis.decliningLongTerm.some(r => r.name === resident.name)) {
        analysis.highRisk.push(resident);
      }
    });

    // Remove duplicates from highRisk
    analysis.highRisk = analysis.highRisk.filter((resident, index, self) =>
      index === self.findIndex(r => r.name === resident.name)
    );

    // Sort by improvement/decline amounts
    analysis.longTermImproving.sort((a, b) => b.avgImprovement - a.avgImprovement);
    analysis.sustainedImprovement.sort((a, b) => b.improvementRate - a.improvementRate);
    analysis.weekOverWeekImproving.sort((a, b) => b.weeklyChange - a.weeklyChange);
    analysis.monthOverMonthImproving.sort((a, b) => b.monthlyChange - a.monthlyChange);
    analysis.decliningLongTerm.sort((a, b) => b.avgDecline - a.avgDecline);

    setTrendAnalysis(analysis);
  };

  useEffect(() => {
    fetchHydrationData();
  }, [fetchHydrationData]);

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

  const MetricCard = ({ title, count, residents, icon, color, description }: {
    title: string;
    count: number;
    residents: Resident[];
    icon: string;
    color: string;
    description: string;
  }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl`} style={{ backgroundColor: `${color}20` }}>
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
          </div>
        </div>
        <div className={`text-3xl font-bold`} style={{ color }}>
          {count}
        </div>
      </div>
      {residents.length > 0 && (
        <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
          {residents.slice(0, 5).map((resident, index) => (
            <div key={index} className="text-sm text-gray-700 dark:text-gray-300 p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="font-medium">{cleanResidentName(resident.name)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Goal: {resident.goal}mL | Avg: {resident.averageIntake || 0}mL
                {resident.unit && ` | Unit: ${resident.unit}`}
              </div>
            </div>
          ))}
          {residents.length > 5 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
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
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-200">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Preventative Analytics & Trends</h2>
        <p className="text-gray-600 dark:text-gray-300">
          Proactive insights to identify at-risk residents and track improvement patterns
        </p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="High Risk Residents"
          count={trendAnalysis?.highRisk.length || 0}
          residents={trendAnalysis?.highRisk || []}
          icon="⚠️"
          color="#ef4444"
          description="Residents requiring immediate attention"
        />
        <MetricCard
          title="Declining Trend & Consistently Low"
          count={(trendAnalysis?.decliningTrend.length || 0) + (trendAnalysis?.consistentlyLow.length || 0)}
          residents={[...(trendAnalysis?.decliningTrend || []), ...(trendAnalysis?.consistentlyLow || [])].filter((resident, index, self) =>
            index === self.findIndex(r => r.name === resident.name)
          )}
          icon="📉"
          color="#f59e0b"
          description="Declining consumption or consistently below goal"
        />
        <MetricCard
          title="Improving Trend"
          count={trendAnalysis?.improvingTrend.length || 0}
          residents={trendAnalysis?.improvingTrend || []}
          icon="📈"
          color="#10b981"
          description="Recent consumption increasing"
        />
      </div>

      {/* Long-Term Trend Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-200">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Long-Term Trend Analysis</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          Holistic analysis of improvement patterns over weeks and months to identify genuine, sustained progress
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Long-Term Improving"
            count={trendAnalysis?.longTermImproving.length || 0}
            residents={trendAnalysis?.longTermImproving || []}
            icon="🌟"
            color="#10b981"
            description="2+ consecutive weeks improving"
          />
          <MetricCard
            title="Sustained Improvement"
            count={trendAnalysis?.sustainedImprovement.length || 0}
            residents={trendAnalysis?.sustainedImprovement || []}
            icon="✨"
            color="#10b981"
            description="2+ weeks above goal, improving"
          />
          <MetricCard
            title="Week-over-Week"
            count={trendAnalysis?.weekOverWeekImproving.length || 0}
            residents={trendAnalysis?.weekOverWeekImproving || []}
            icon="📅"
            color="#10b981"
            description="Improved this week vs last"
          />
          <MetricCard
            title="Month-over-Month"
            count={trendAnalysis?.monthOverMonthImproving.length || 0}
            residents={trendAnalysis?.monthOverMonthImproving || []}
            icon="📆"
            color="#10b981"
            description="Improved this month vs last"
          />
        </div>
      </div>

      {/* Detailed Analysis Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* High Risk Section */}
        {trendAnalysis && trendAnalysis.highRisk.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-red-200 dark:border-red-800 transition-colors duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-red-600 dark:text-red-400 flex items-center">
                <span className="mr-2">⚠️</span>
                High Risk Residents - Action Required
              </h3>
              {trendAnalysis.highRisk.length > 3 && (
                <button
                  onClick={() => setExpandedLists({ ...expandedLists, highRisk: !expandedLists.highRisk })}
                  className="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium"
                >
                  {expandedLists.highRisk ? 'Show Less' : `Show All (${trendAnalysis.highRisk.length})`}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {(expandedLists.highRisk ? trendAnalysis.highRisk : trendAnalysis.highRisk.slice(0, 3)).map((resident, index) => {
                const longTermDecline = trendAnalysis.decliningLongTerm.find(r => r.name === resident.name);
                return (
                  <div key={index} className="border-l-4 border-red-500 dark:border-red-400 pl-4 py-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{cleanResidentName(resident.name)}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1 mt-1">
                      <div>Goal: {resident.goal}mL | Current Avg: {resident.averageIntake || 0}mL</div>
                      <div>Unit: {resident.unit || 'Unknown'}</div>
                      {resident.missed3Days === 'yes' && (
                        <div className="text-red-600 font-medium">⚠️ Missed 3 consecutive days</div>
                      )}
                      {trendAnalysis.decliningTrend.includes(resident) && (
                        <div className="text-orange-600 font-medium">📉 Declining consumption trend</div>
                      )}
                      {longTermDecline && (
                        <div className="text-red-600 font-medium">📉 Long-term decline: {longTermDecline.declineWeeks} weeks, avg -{longTermDecline.avgDecline}mL/week</div>
                      )}
                      {trendAnalysis.consistentlyLow.includes(resident) && (
                        <div className="text-orange-600 font-medium">📊 Consistently below goal</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Improving Section */}
        {trendAnalysis && trendAnalysis.improvingTrend.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-green-200 dark:border-green-800 transition-colors duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-green-600 dark:text-green-400 flex items-center">
                <span className="mr-2">📈</span>
                Improving Residents - Positive Trends
              </h3>
              {trendAnalysis.improvingTrend.length > 3 && (
                <button
                  onClick={() => setExpandedLists({ ...expandedLists, improving: !expandedLists.improving })}
                  className="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium"
                >
                  {expandedLists.improving ? 'Show Less' : `Show All (${trendAnalysis.improvingTrend.length})`}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {(expandedLists.improving ? trendAnalysis.improvingTrend : trendAnalysis.improvingTrend.slice(0, 3)).map((resident, index) => (
                <div key={index} className="border-l-4 border-green-500 dark:border-green-400 pl-4 py-2 bg-green-50 dark:bg-green-900/20 rounded">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{cleanResidentName(resident.name)}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1 mt-1">
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

      {/* Long-Term Improvement Details */}
      {(trendAnalysis && (trendAnalysis.longTermImproving.length > 0 || trendAnalysis.sustainedImprovement.length > 0 || trendAnalysis.weekOverWeekImproving.length > 0 || trendAnalysis.monthOverMonthImproving.length > 0)) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-green-200 dark:border-green-800 transition-colors duration-200">
          <h3 className="text-xl font-bold text-green-600 dark:text-green-400 mb-4 flex items-center">
            <span className="mr-2">🌟</span>
            Genuine Long-Term Improvement - Sustained Progress
          </h3>
          
          {/* Long-Term Improving */}
          {trendAnalysis.longTermImproving.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Consecutive Weeks of Improvement</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {trendAnalysis.longTermImproving.slice(0, 6).map((resident, index) => (
                  <div key={index} className="border-l-4 border-green-500 dark:border-green-400 pl-4 py-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{cleanResidentName(resident.name)}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1 mt-1">
                      <div>Goal: {resident.goal}mL | Avg: {resident.averageIntake || 0}mL</div>
                      <div className="text-green-600 font-medium">
                        ✨ {resident.improvementWeeks} consecutive weeks improving | Avg +{resident.avgImprovement}mL/week
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sustained Improvement */}
          {trendAnalysis.sustainedImprovement.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Sustained Above Goal</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {trendAnalysis.sustainedImprovement.slice(0, 6).map((resident, index) => (
                  <div key={index} className="border-l-4 border-green-500 dark:border-green-400 pl-4 py-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{cleanResidentName(resident.name)}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1 mt-1">
                      <div>Goal: {resident.goal}mL | Avg: {resident.averageIntake || 0}mL</div>
                      <div className="text-green-600 font-medium">
                        ✅ {resident.weeksAboveGoal} weeks above goal | Improvement rate: +{resident.improvementRate}mL
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Week-over-Week */}
          {trendAnalysis.weekOverWeekImproving.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Week-over-Week Improvement</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {trendAnalysis.weekOverWeekImproving.slice(0, 6).map((resident, index) => (
                  <div key={index} className="border-l-4 border-green-500 dark:border-green-400 pl-4 py-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{cleanResidentName(resident.name)}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1 mt-1">
                      <div>Goal: {resident.goal}mL | Avg: {resident.averageIntake || 0}mL</div>
                      <div className="text-green-600 font-medium">
                        📈 Improved by +{resident.weeklyChange}mL this week vs last week
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Month-over-Month */}
          {trendAnalysis.monthOverMonthImproving.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Month-over-Month Improvement</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {trendAnalysis.monthOverMonthImproving.slice(0, 6).map((resident, index) => (
                  <div key={index} className="border-l-4 border-green-500 dark:border-green-400 pl-4 py-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{cleanResidentName(resident.name)}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1 mt-1">
                      <div>Goal: {resident.goal}mL | Avg: {resident.averageIntake || 0}mL</div>
                      <div className="text-green-600 font-medium">
                        📆 Improved by +{resident.monthlyChange}mL this month vs last month
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

