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
      residents: any[];
    }> = [];

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
            residents: []
          });
          continue;
        }

        // Get the most recent dashboard file
        const sortedFiles = dashboardFiles.sort().reverse();
        const latestFile = sortedFiles[0];
        const dashboardPath = join(dataDir, latestFile);
        const dashboardContent = await readFile(dashboardPath, 'utf-8');
        const hydrationData = parseDashboardFile(dashboardContent);

        const residents = hydrationData.map((resident: any) => {
          const dateData: { [key: string]: number } = {};
          // Calculate average intake from all data points
          const values = Object.values(resident.data || {}).filter((v: any) => typeof v === 'number') as number[];
          const averageIntake = values.length > 0 
            ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
            : 0;

          return {
            name: resident.name,
            goal: resident.goal || 0,
            missed3Days: resident.missed3Days || 'no',
            averageIntake,
            hasFeedingTube: resident.hasFeedingTube || false
          };
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
          residents
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

