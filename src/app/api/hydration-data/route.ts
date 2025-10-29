import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getHomeIdentifier } from '@/lib/retirementHomeMapping';

// Function to access local CSV data (fallback)
async function accessLocalData(userRole: string, retirementHome: string) {
  console.log('📁 [LOCAL DATA] Accessing local CSV data...');
  
  // Determine data source based on user role
  let csvPath: string;
  
  if (userRole === 'admin') {
    // Admin sees all data - use main CSV
    csvPath = join(process.cwd(), 'hydration_goals.csv');
    console.log('👑 [LOCAL DATA] Admin access - using main CSV:', csvPath);
  } else if (userRole === 'home_manager' && retirementHome) {
    // Home manager sees only their home's data
    csvPath = join(process.cwd(), 'data', retirementHome, 'hydration_goals.csv');
    console.log('🏠 [LOCAL DATA] Home manager access - using home-specific CSV:', csvPath);
  } else {
    throw new Error('Invalid user role or missing retirement home');
  }
  
  try {
    console.log('📖 [LOCAL DATA] Reading CSV file:', csvPath);
    const csvContent = await readFile(csvPath, 'utf-8');
    console.log(`✅ [LOCAL DATA] CSV file read successfully (${csvContent.length} characters)`);
    
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');
    console.log('📊 [LOCAL DATA] CSV headers:', headers);
    console.log(`📊 [LOCAL DATA] Total lines in CSV: ${lines.length}`);
    
    const residents = lines.slice(1).filter((line: string) => line.trim()).map((line: string) => {
      // Parse CSV line properly handling quoted fields
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      const resident: any = {};
      
      headers.forEach((header: string, index: number) => {
        const value = values[index]?.replace(/"/g, '').trim();
        switch (header.trim()) {
          case 'Resident Name':
            resident.name = value;
            break;
          case 'mL Goal':
            resident.goal = parseFloat(value) || 0;
            break;
          case 'Source File':
            resident.source = value;
            break;
          case 'Missed 3 Days':
            resident.missed3Days = value;
            break;
          case 'Day 14':
            resident.day14 = parseFloat(value) || 0;
            break;
          case 'Day 15':
            resident.day15 = parseFloat(value) || 0;
            break;
          case 'Day 16':
            resident.day16 = parseFloat(value) || 0;
            break;
          case 'Yesterdays':
            resident.yesterday = parseFloat(value) || 0;
            break;
          case 'Has Feeding Tube':
            resident.hasFeedingTube = value === 'Yes';
            break;
        }
      });
      
      return resident;
    });

    console.log(`✅ [LOCAL DATA] Processed ${residents.length} residents`);
    return residents;
  } catch (error) {
    console.log('❌ [LOCAL DATA] CSV file not found or could not be read:', error);
    return [];
  }
}

// Function to access Firestore data
async function accessFirestoreData(userRole: string, retirementHome: string) {
  if (!db) {
    console.log('⚠️ [FIRESTORE DATA] Database not available, falling back to local data');
    throw new Error('Firestore Database not available');
  }

  console.log('🔥 [FIRESTORE DATA] Accessing Firestore data...');
  
  try {
    let csvDocRef;
    
    if (userRole === 'admin') {
      // Admin sees all data - for now, use the first available home's data
      // In the future, this could be enhanced to aggregate data from all homes
      if (!retirementHome) {
        throw new Error('Admin access requires retirement home parameter');
      }
      const homeIdentifier = getHomeIdentifier(retirementHome);
      csvDocRef = doc(db, 'retirement-homes', homeIdentifier, 'data', 'hydration-goals');
      console.log('👑 [FIRESTORE DATA] Admin access - using home-specific CSV:', `${homeIdentifier}/data/hydration-goals`);
    } else if (userRole === 'home_manager' && retirementHome) {
      // Home manager sees only their home's data
      const homeIdentifier = getHomeIdentifier(retirementHome);
      csvDocRef = doc(db, 'retirement-homes', homeIdentifier, 'data', 'hydration-goals');
      console.log('🏠 [FIRESTORE DATA] Home manager access - using home-specific CSV:', `${homeIdentifier}/data/hydration-goals`);
    } else {
      throw new Error('Invalid user role or missing retirement home');
    }

    // Get CSV data from Firestore
    console.log('📥 [FIRESTORE DATA] Fetching document from Firestore...');
    const csvDoc = await getDoc(csvDocRef);
    
    if (!csvDoc.exists()) {
      console.log('❌ [FIRESTORE DATA] Document does not exist in Firestore');
      console.log('🔍 [FIRESTORE DATA] Document path:', csvDocRef.path);
      throw new Error('CSV data not found in Firestore');
    }
    
    const csvData = csvDoc.data();
    if (!csvData || !csvData.csvData) {
      console.log('❌ [FIRESTORE DATA] Document exists but has no csvData field');
      console.log('🔍 [FIRESTORE DATA] Document data:', csvData);
      throw new Error('CSV data field not found in Firestore document');
    }
    
    const csvContent = csvData.csvData;
    console.log(`✅ [FIRESTORE DATA] CSV content fetched successfully (${csvContent.length} characters)`);
    
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');
    console.log('📊 [FIRESTORE DATA] CSV headers:', headers);
    console.log(`📊 [FIRESTORE DATA] Total lines in CSV: ${lines.length}`);
    
    const residents = lines.slice(1).filter((line: string) => line.trim()).map((line: string) => {
      // Parse CSV line properly handling quoted fields
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      const resident: any = {};
      
      headers.forEach((header: string, index: number) => {
        const value = values[index]?.replace(/"/g, '').trim();
        switch (header.trim()) {
          case 'Resident Name':
            resident.name = value;
            break;
          case 'mL Goal':
            resident.goal = parseFloat(value) || 0;
            break;
          case 'Source File':
            resident.source = value;
            break;
          case 'Missed 3 Days':
            resident.missed3Days = value;
            break;
          case 'Day 14':
            resident.day14 = parseFloat(value) || 0;
            break;
          case 'Day 15':
            resident.day15 = parseFloat(value) || 0;
            break;
          case 'Day 16':
            resident.day16 = parseFloat(value) || 0;
            break;
          case 'Yesterdays':
            resident.yesterday = parseFloat(value) || 0;
            break;
          case 'Has Feeding Tube':
            resident.hasFeedingTube = value === 'Yes';
            break;
        }
      });
      
      return resident;
    });

    console.log(`✅ [FIRESTORE DATA] Processed ${residents.length} residents`);
    return residents;
  } catch (error) {
    console.error('❌ [FIRESTORE DATA] Error accessing Firestore:', error);
    console.error('❌ [FIRESTORE DATA] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code || 'No code',
      stack: error instanceof Error ? error.stack : 'No stack'
    });
    
    // Check for specific Firestore error codes
    const errorCode = (error as any)?.code;
    if (errorCode) {
      console.error('🔍 [FIRESTORE DATA] Firestore error code:', errorCode);
      switch (errorCode) {
        case 'permission-denied':
          console.error('🔍 [FIRESTORE DATA] Permission denied: Check Firestore security rules');
          break;
        case 'unavailable':
          console.error('🔍 [FIRESTORE DATA] Service unavailable: Check Firestore configuration');
          break;
        case 'unauthenticated':
          console.error('🔍 [FIRESTORE DATA] Unauthenticated: User not authenticated');
          break;
        case 'invalid-argument':
          console.error('🔍 [FIRESTORE DATA] Invalid argument: Check data format');
          break;
        case 'failed-precondition':
          console.error('🔍 [FIRESTORE DATA] Failed precondition: Check Firestore setup');
          break;
        default:
          console.error('🔍 [FIRESTORE DATA] Other Firestore error:', errorCode);
      }
    }
    
    throw error;
  }
}

export async function POST(request: NextRequest) {
  console.log('🚀 [HYDRATION DATA API] Starting hydration data request...');
  
  try {
    console.log('📊 [HYDRATION DATA API] Request headers:', Object.fromEntries(request.headers.entries()));
    console.log('📊 [HYDRATION DATA API] Request method:', request.method);
    console.log('📊 [HYDRATION DATA API] Request URL:', request.url);
    
    let userRole, retirementHome;
    
    // Try to parse as JSON first
    try {
      const body = await request.json();
      userRole = body.userRole;
      retirementHome = body.retirementHome;
      console.log('📊 [HYDRATION DATA API] Request body parsed as JSON successfully:', { userRole, retirementHome });
    } catch (jsonError) {
      console.log('📊 [HYDRATION DATA API] JSON parsing failed, trying form data...');
      
      // If JSON fails, try form data
      try {
        const formData = await request.formData();
        userRole = formData.get('userRole') as string;
        retirementHome = formData.get('retirementHome') as string;
        console.log('📊 [HYDRATION DATA API] Request body parsed as form data successfully:', { userRole, retirementHome });
      } catch (formError) {
        console.error('❌ [HYDRATION DATA API] Both JSON and form data parsing failed');
        console.error('JSON Error:', jsonError);
        console.error('Form Error:', formError);
        
        // Get raw body for debugging
        const rawBody = await request.text();
        console.log('📊 [HYDRATION DATA API] Raw request body:', rawBody);
        
        return NextResponse.json({ 
          error: 'Invalid request body format',
          details: 'Could not parse as JSON or form data',
          rawBody: rawBody.substring(0, 200) + '...' // First 200 chars for debugging
        }, { status: 400 });
      }
    }
    
    // Validate user role and retirement home
    if (!userRole || (userRole === 'home_manager' && !retirementHome)) {
      console.log('❌ [HYDRATION DATA API] Error: Invalid user role or missing retirement home', { userRole, retirementHome });
      return NextResponse.json({ 
        error: 'Invalid user role or missing retirement home',
        details: { userRole, retirementHome }
      }, { status: 400 });
    }

    // Try Firestore first, fallback to local data
    let residents: any[] = [];
    
    try {
      console.log('🔥 [HYDRATION DATA API] Attempting to fetch data from Firestore...');
      residents = await accessFirestoreData(userRole, retirementHome);
      console.log('✅ [HYDRATION DATA API] Successfully fetched data from Firestore');
    } catch (firestoreError) {
      console.log('⚠️ [HYDRATION DATA API] Firestore failed, falling back to local data:', firestoreError);
      try {
        residents = await accessLocalData(userRole, retirementHome);
        console.log('✅ [HYDRATION DATA API] Successfully fetched data from local storage');
      } catch (localError) {
        console.log('❌ [HYDRATION DATA API] Both Firestore and local data access failed:', localError);
        return NextResponse.json({ residents: [] });
      }
    }

    console.log('🎉 [HYDRATION DATA API] Hydration data request completed successfully');
    return NextResponse.json({ residents });
  } catch (error) {
    console.error('Error reading hydration data:', error);
    return NextResponse.json(
      { error: 'Failed to read hydration data' },
      { status: 500 }
    );
  }
}
