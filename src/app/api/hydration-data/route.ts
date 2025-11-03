import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getHomeIdentifier } from '@/lib/retirementHomeMapping';

// Function to parse JavaScript dashboard file and extract hydrationData array
function parseDashboardFile(content: string): any[] {
  // Extract the hydrationData array from the JavaScript file
  const match = content.match(/const hydrationData = (\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error('Could not parse dashboard file - hydrationData not found');
  }
  
  try {
    // Use eval to parse the JavaScript array (safe in server context)
    const hydrationData = eval(`(${match[1]})`);
    return hydrationData;
  } catch (error) {
    throw new Error(`Failed to parse hydrationData: ${error}`);
  }
}

// Function to convert date from filename format (MM_DD_YYYY) to CSV format (MM/DD/YYYY)
function convertDateFormat(dateStr: string): string {
  return dateStr.replace(/_/g, '/');
}

// Function to access local dashboard data (fallback)
async function accessLocalData(userRole: string, retirementHome: string) {
  console.log('📁 [LOCAL DATA] Accessing local dashboard files...');
  
  // Determine data directory based on user role
  let dataDir: string;
  
  if (userRole === 'admin') {
    // Admin sees all data - use main data directory
    dataDir = process.cwd();
    console.log('👑 [LOCAL DATA] Admin access - using main data directory:', dataDir);
  } else if (userRole === 'home_manager' && retirementHome) {
    // Home manager sees only their home's data
    dataDir = join(process.cwd(), 'data', retirementHome);
    console.log('🏠 [LOCAL DATA] Home manager access - using home-specific directory:', dataDir);
  } else {
    throw new Error('Invalid user role or missing retirement home');
  }
  
  try {
    // Find all dashboard_{date}.js files
    const files = await readdir(dataDir);
    const dashboardFiles = files.filter(file => 
      file.startsWith('dashboard_') && 
      file.endsWith('.js') && 
      /dashboard_\d{1,2}_\d{1,2}_\d{4}\.js/.test(file)
    );
    
    console.log(`📊 [LOCAL DATA] Found ${dashboardFiles.length} dashboard files: ${dashboardFiles.join(', ')}`);
    
    if (dashboardFiles.length === 0) {
      console.log('⚠️ [LOCAL DATA] No dashboard files found');
      return [];
    }
    
    // Combine all dashboard files into a single resident map
    const residentMap = new Map<string, any>();
    
    for (const dashboardFile of dashboardFiles) {
      try {
        const dashboardPath = join(dataDir, dashboardFile);
        const dashboardContent = await readFile(dashboardPath, 'utf-8');
        
        // Extract date from filename (e.g., dashboard_10_14_2025.js -> 10/14/2025)
        const dateMatch = dashboardFile.match(/dashboard_(\d{1,2}_\d{1,2}_\d{4})\.js/);
        if (!dateMatch) {
          console.log(`⚠️ [LOCAL DATA] Could not extract date from filename: ${dashboardFile}`);
          continue;
        }
        
        const dateStr = convertDateFormat(dateMatch[1]);
        console.log(`📅 [LOCAL DATA] Processing date: ${dateStr} from file: ${dashboardFile}`);
        
        // Parse the JavaScript file
        const hydrationData = parseDashboardFile(dashboardContent);
        console.log(`✅ [LOCAL DATA] Parsed ${hydrationData.length} residents from ${dashboardFile}`);
        
        // Merge data for each resident
        for (const resident of hydrationData) {
          const residentName = resident.name;
          
          if (!residentMap.has(residentName)) {
            // First time seeing this resident - initialize
            residentMap.set(residentName, {
              name: residentName,
              goal: resident.goal || 0,
              source: resident.source || '',
              missed3Days: resident.missed3Days || 'no',
              hasFeedingTube: resident.hasFeedingTube || false,
              dateData: {}
            });
          }
          
          // Add data for this date
          const existingResident = residentMap.get(residentName);
          existingResident.dateData[dateStr] = resident.data || 0;
          
          // Update other fields if they're missing or empty
          if (!existingResident.source && resident.source) {
            existingResident.source = resident.source;
          }
          if (existingResident.missed3Days === 'no' && resident.missed3Days === 'yes') {
            existingResident.missed3Days = 'yes';
          }
        }
      } catch (error) {
        console.error(`❌ [LOCAL DATA] Error processing dashboard file ${dashboardFile}:`, error);
        // Continue with other files
      }
    }
    
    const residents = Array.from(residentMap.values());
    console.log(`✅ [LOCAL DATA] Combined ${residents.length} unique residents from ${dashboardFiles.length} dashboard files`);
    return residents;
  } catch (error) {
    console.log('❌ [LOCAL DATA] Error reading dashboard files:', error);
    return [];
  }
}

// Function to access Firestore dashboard data
async function accessFirestoreData(userRole: string, retirementHome: string) {
  if (!db) {
    console.log('⚠️ [FIRESTORE DATA] Database not available, falling back to local data');
    throw new Error('Firestore Database not available');
  }

  console.log('🔥 [FIRESTORE DATA] Accessing Firestore dashboard data...');
  
  try {
    let dashboardCollectionRef;
    
    if (userRole === 'admin') {
      // Admin sees all data - for now, use the first available home's data
      if (!retirementHome) {
        throw new Error('Admin access requires retirement home parameter');
      }
      const homeIdentifier = getHomeIdentifier(retirementHome);
      dashboardCollectionRef = collection(db, 'retirement-homes', homeIdentifier, 'dashboard-data');
      console.log('👑 [FIRESTORE DATA] Admin access - using dashboard-data collection:', `${homeIdentifier}/dashboard-data`);
    } else if (userRole === 'home_manager' && retirementHome) {
      // Home manager sees only their home's data
      const homeIdentifier = getHomeIdentifier(retirementHome);
      dashboardCollectionRef = collection(db, 'retirement-homes', homeIdentifier, 'dashboard-data');
      console.log('🏠 [FIRESTORE DATA] Home manager access - using dashboard-data collection:', `${homeIdentifier}/dashboard-data`);
    } else {
      throw new Error('Invalid user role or missing retirement home');
    }

    // Get all dashboard documents from Firestore
    console.log('📥 [FIRESTORE DATA] Fetching dashboard documents from Firestore...');
    const dashboardDocs = await getDocs(dashboardCollectionRef);
    
    if (dashboardDocs.empty) {
      console.log('❌ [FIRESTORE DATA] No dashboard documents found in Firestore');
      throw new Error('Dashboard data not found in Firestore');
    }
    
    console.log(`📊 [FIRESTORE DATA] Found ${dashboardDocs.size} dashboard documents`);
    
    // Combine all dashboard files into a single resident map
    const residentMap = new Map<string, any>();
    
    dashboardDocs.forEach((docSnapshot) => {
      try {
        const data = docSnapshot.data();
        const jsData = data.jsData;
        const dateStr = convertDateFormat(docSnapshot.id); // doc ID is in format MM_DD_YYYY
        
        if (!jsData) {
          console.log(`⚠️ [FIRESTORE DATA] Dashboard document ${docSnapshot.id} has no jsData field`);
          return;
        }
        
        console.log(`📅 [FIRESTORE DATA] Processing date: ${dateStr} from document: ${docSnapshot.id}`);
        
        // Parse the JavaScript file
        const hydrationData = parseDashboardFile(jsData);
        console.log(`✅ [FIRESTORE DATA] Parsed ${hydrationData.length} residents from document ${docSnapshot.id}`);
        
        // Merge data for each resident
        for (const resident of hydrationData) {
          const residentName = resident.name;
          
          if (!residentMap.has(residentName)) {
            // First time seeing this resident - initialize
            residentMap.set(residentName, {
              name: residentName,
              goal: resident.goal || 0,
              source: resident.source || '',
              missed3Days: resident.missed3Days || 'no',
              hasFeedingTube: resident.hasFeedingTube || false,
              dateData: {}
            });
          }
          
          // Add data for this date
          const existingResident = residentMap.get(residentName);
          existingResident.dateData[dateStr] = resident.data || 0;
          
          // Update other fields if they're missing or empty
          if (!existingResident.source && resident.source) {
            existingResident.source = resident.source;
          }
          if (existingResident.missed3Days === 'no' && resident.missed3Days === 'yes') {
            existingResident.missed3Days = 'yes';
          }
        }
      } catch (error) {
        console.error(`❌ [FIRESTORE DATA] Error processing dashboard document ${docSnapshot.id}:`, error);
        // Continue with other documents
      }
    });
    
    const residents = Array.from(residentMap.values());
    console.log(`✅ [FIRESTORE DATA] Combined ${residents.length} unique residents from ${dashboardDocs.size} dashboard documents`);
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
