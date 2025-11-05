import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where, Firestore } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

// Function to parse JavaScript dashboard file
function parseDashboardFile(content: string): any[] {
  const match = content.match(/const hydrationData = (\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error('Could not parse dashboard file - hydrationData not found');
  }
  try {
    const hydrationData = eval(`(${match[1]})`);
    return hydrationData;
  } catch (error) {
    throw new Error(`Failed to parse hydrationData: ${error}`);
  }
}

// Function to convert date format
function convertDateFormat(dateStr: string): string {
  return dateStr.replace(/_/g, '/');
}

export async function POST(request: NextRequest) {
  try {
    if (!db || db === null) {
      return NextResponse.json({ 
        error: 'Firebase not initialized. Please check environment variables.' 
      }, { status: 500 });
    }

    const { chain } = await request.json();

    if (!chain) {
      return NextResponse.json({ 
        error: 'Chain parameter is required' 
      }, { status: 400 });
    }

    // Get all homes for this chain
    let fbdb = db as Firestore;
    const querySnapshot = await getDocs(collection(fbdb, 'users'));
    
    const homes: string[] = [];
    querySnapshot.docs.forEach(doc => {
      const userData = doc.data();
      if (userData.role === 'home_manager' && userData.retirementHome) {
        const userChain = userData.chain || '';
        if (userChain.toLowerCase().trim() === chain.toLowerCase().trim()) {
          homes.push(userData.retirementHome);
        }
      }
    });

    const uniqueHomes = Array.from(new Set(homes));
    
    // Aggregate data for all homes in the chain
    const homeData: Array<{
      homeName: string;
      totalResidents: number;
      missed3DaysCount: number;
      goalMetCount: number;
      goalMetPercentage: number;
      averageIntake: number;
      downwardTrendingCount: number;
      residents: any[];
    }> = [];

    // Helper function to parse date
    function parseDate(dateStr: string): Date {
      const parts = dateStr.split('/');
      return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    }

    for (const homeName of uniqueHomes) {
      try {
        const dataDir = join(process.cwd(), 'data', homeName);
        const files = await readdir(dataDir);
        const dashboardFiles = files.filter(file => 
          file.startsWith('dashboard_') && 
          file.endsWith('.js') && 
          /dashboard_\d{1,2}_\d{1,2}_\d{4}\.js/.test(file)
        );

        if (dashboardFiles.length === 0) {
          homeData.push({
            homeName,
            totalResidents: 0,
            missed3DaysCount: 0,
            goalMetCount: 0,
            goalMetPercentage: 0,
            averageIntake: 0,
            downwardTrendingCount: 0,
            residents: []
          });
          continue;
        }

        // Aggregate data from all dashboard files to get historical data
        const residentMap = new Map<string, any>();
        
        for (const dashboardFile of dashboardFiles) {
          try {
            const dashboardPath = join(dataDir, dashboardFile);
            const dashboardContent = await readFile(dashboardPath, 'utf-8');
            const dateMatch = dashboardFile.match(/dashboard_(\d{1,2}_\d{1,2}_\d{4})\.js/);
            if (!dateMatch) continue;
            
            const dateStr = convertDateFormat(dateMatch[1]);
            const hydrationData = parseDashboardFile(dashboardContent);

            for (const resident of hydrationData) {
              const residentName = resident.name;
              if (!residentMap.has(residentName)) {
                residentMap.set(residentName, {
                  name: residentName,
                  goal: resident.goal || 0,
                  missed3Days: resident.missed3Days || 'no',
                  hasFeedingTube: resident.hasFeedingTube || false,
                  dateData: {}
                });
              }
              const existingResident = residentMap.get(residentName);
              existingResident.dateData[dateStr] = resident.data || 0;
            }
          } catch (error) {
            console.error(`Error processing file ${dashboardFile}:`, error);
          }
        }

        // Process residents and calculate metrics
        const residents = Array.from(residentMap.values()).map((resident: any) => {
          const dates = Object.keys(resident.dateData).sort((a, b) => {
            const dateA = parseDate(a);
            const dateB = parseDate(b);
            return dateA.getTime() - dateB.getTime();
          });
          
          const values = dates.map(date => resident.dateData[date] || 0);
          const averageIntake = values.length > 0 
            ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
            : 0;

          return {
            ...resident,
            averageIntake,
            dateData: resident.dateData,
            dates,
            values
          };
        });

        // Calculate downward trending residents
        let downwardTrendingCount = 0;
        residents.forEach((resident: any) => {
          if (resident.dates && resident.dates.length >= 3 && resident.values && resident.values.length >= 3) {
            const recentValues = resident.values.slice(-3);
            const recentTrend = recentValues[recentValues.length - 1] - recentValues[0];
            // Declining trend: recent values are decreasing by more than 100mL and current value is below 80% of goal
            if (recentTrend < -100 && recentValues[recentValues.length - 1] < resident.goal * 0.8) {
              downwardTrendingCount++;
            }
          }
        });

        const missed3DaysCount = residents.filter((r: any) => r.missed3Days === 'yes').length;
        const goalMetCount = residents.filter((r: any) => {
          return r.averageIntake >= (r.goal * 0.9);
        }).length;
        const goalMetPercentage = residents.length > 0 
          ? Math.round((goalMetCount / residents.length) * 100)
          : 0;
        const totalAverageIntake = residents.length > 0
          ? Math.round(residents.reduce((sum, r: any) => sum + r.averageIntake, 0) / residents.length)
          : 0;

        homeData.push({
          homeName,
          totalResidents: residents.length,
          missed3DaysCount,
          goalMetCount,
          goalMetPercentage,
          averageIntake: totalAverageIntake,
          downwardTrendingCount,
          residents: residents.map((r: any) => ({
            name: r.name,
            goal: r.goal,
            missed3Days: r.missed3Days,
            averageIntake: r.averageIntake,
            hasFeedingTube: r.hasFeedingTube
          }))
        });
      } catch (error) {
        console.error(`Error processing home ${homeName}:`, error);
        homeData.push({
          homeName,
          totalResidents: 0,
          missed3DaysCount: 0,
          goalMetCount: 0,
          goalMetPercentage: 0,
          averageIntake: 0,
          downwardTrendingCount: 0,
          residents: []
        });
      }
    }

    return NextResponse.json({
      success: true,
      chain,
      homes: homeData
    });
  } catch (error: any) {
    console.error('Error fetching chain data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chain data', details: error.message },
      { status: 500 }
    );
  }
}

