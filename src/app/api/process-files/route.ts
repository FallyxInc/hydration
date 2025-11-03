import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, copyFile, readdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, setDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getHomeIdentifier } from '@/lib/retirementHomeMapping';

const execAsync = promisify(exec);

// Function to upload data to Firestore and PDFs to Firebase Storage (PDFs passed directly)
async function uploadToFirebase(
  homeDir: string,
  retirementHome: string,
  carePlanUploads: { fileName: string; bytes: Uint8Array }[],
  hydrationUploads: { fileName: string; bytes: Uint8Array }[]
) {
  const homeIdentifier = getHomeIdentifier(retirementHome);
  
  if (!db) {
    console.log('⚠️ [FIRESTORE] Database not available, skipping Firestore upload');
    console.log('🔍 [FIRESTORE] Firebase config check:', {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Set' : 'Not set',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Set' : 'Not set'
    });
    return;
  }

  if (!storage) {
    console.log('⚠️ [STORAGE] Firebase Storage not available, skipping Storage upload');
    return;
  }

  console.log('🔥 [FIRESTORE] Starting Firestore upload for retirement home:', retirementHome);
  console.log('🏠 [FIRESTORE] Using home identifier:', homeIdentifier);
  
  try {
    // Read CSV data
    const csvPath = join(homeDir, 'hydration_goals.csv');
    const csvData = await import('fs/promises').then(fs => fs.readFile(csvPath, 'utf-8'));
    console.log('✅ [FIRESTORE] CSV data read successfully');

    // Upload CSV data to Firestore
    const csvDocRef = doc(db, 'retirement-homes', homeIdentifier,'hydration-goals');
    await setDoc(csvDocRef, {
      csvData: csvData,
      timestamp: new Date(),
      retirementHome: retirementHome,
      homeIdentifier: homeIdentifier
    });
    console.log('✅ [FIRESTORE] CSV data uploaded successfully');

    // Find all dashboard_{date}.js files
    const files = await readdir(homeDir);
    const dashboardFiles = files.filter(file => 
      file.startsWith('dashboard_') && 
      file.endsWith('.js') && 
      /dashboard_\d{1,2}_\d{1,2}_\d{4}\.js/.test(file)
    );
    
    console.log(`📊 [FIRESTORE] Found ${dashboardFiles.length} dashboard files: ${dashboardFiles.join(', ')}`);

    // Upload each dashboard file to Firestore
    for (const dashboardFile of dashboardFiles) {
      try {
        const dashboardPath = join(homeDir, dashboardFile);
        const dashboardData = await import('fs/promises').then(fs => fs.readFile(dashboardPath, 'utf-8'));
        
        // Extract date from filename (e.g., dashboard_10_14_2025.js -> 10_14_2025)
        const dateMatch = dashboardFile.match(/dashboard_(\d{1,2}_\d{1,2}_\d{4})\.js/);
        const dateStr = dateMatch ? dateMatch[1] : dashboardFile.replace('dashboard_', '').replace('.js', '');
        
        // Upload to Firestore with date as document ID
        const dashboardDocRef = doc(db, 'retirement-homes', homeIdentifier, 'dashboard-data', dateStr);
        await setDoc(dashboardDocRef, {
          jsData: dashboardData,
          fileName: dashboardFile,
          date: dateStr,
          timestamp: new Date(),
          retirementHome: retirementHome,
          homeIdentifier: homeIdentifier
        });
        console.log(`✅ [FIRESTORE] Dashboard data uploaded successfully: ${dashboardFile} (date: ${dateStr})`);
      } catch (error) {
        console.error(`❌ [FIRESTORE] Failed to upload dashboard file ${dashboardFile}:`, error);
        // Continue with other files even if one fails
      }
    }

    if (dashboardFiles.length === 0) {
      console.log('⚠️ [FIRESTORE] No dashboard_{date}.js files found in home directory');
    }

    // Upload care plan PDFs to Firebase Storage (use provided buffers)
    for (const { fileName, bytes } of carePlanUploads) {
      const storageRef = ref(storage, `retirement-homes/${homeIdentifier}/care-plans/${fileName}`);
      const snapshot = await uploadBytes(storageRef, bytes, { contentType: 'application/pdf' });
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      const carePlanDocRef = doc(db, 'retirement-homes', homeIdentifier, 'care-plans', fileName);
      await setDoc(carePlanDocRef, {
        fileName: fileName,
        storageURL: downloadURL,
        storagePath: storageRef.fullPath,
        timestamp: new Date(),
        retirementHome: retirementHome,
        homeIdentifier: homeIdentifier
      });
      console.log(`✅ [STORAGE] Care plan file uploaded to Storage: ${fileName}`);
    }

    // Upload hydration data PDFs to Firebase Storage (use provided buffers)
    for (const { fileName, bytes } of hydrationUploads) {
      const storageRef = ref(storage, `retirement-homes/${homeIdentifier}/hydration-data/${fileName}`);
      const snapshot = await uploadBytes(storageRef, bytes, { contentType: 'application/pdf' });
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      const hydrationDocRef = doc(db, 'retirement-homes', homeIdentifier, 'hydration-data', fileName);
      await setDoc(hydrationDocRef, {
        fileName: fileName,
        storageURL: downloadURL,
        storagePath: storageRef.fullPath,
        timestamp: new Date(),
        retirementHome: retirementHome,
        homeIdentifier: homeIdentifier
      });
      console.log(`✅ [STORAGE] Hydration data file uploaded to Storage: ${fileName}`);
    }

    console.log('🎉 [FIRESTORE] All data uploaded to Firestore and Storage successfully');
  } catch (error) {
    console.error('❌ [FIRESTORE/STORAGE] Error uploading to Firebase:', error);
    console.error('❌ [FIRESTORE/STORAGE] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code || 'No code',
      stack: error instanceof Error ? error.stack : 'No stack',
      name: (error as any)?.name || 'No name'
    });
    
    const errorCode = (error as any)?.code;
    if (errorCode) {
      console.error('🔍 [FIRESTORE/STORAGE] Firebase error code:', errorCode);
      switch (errorCode) {
        case 'permission-denied':
          console.error('🔍 [FIRESTORE/STORAGE] Permission denied: Check Firebase security rules');
          break;
        case 'storage/unauthorized':
          console.error('🔍 [STORAGE] Unauthorized: Check Storage security rules');
          break;
        case 'storage/unknown':
          console.error('🔍 [STORAGE] Unknown error: Check Storage configuration');
          break;
        case 'unavailable':
          console.error('🔍 [FIRESTORE/STORAGE] Service unavailable: Check Firebase configuration');
          break;
        case 'unauthenticated':
          console.error('🔍 [FIRESTORE/STORAGE] Unauthenticated: User not authenticated');
          break;
        case 'invalid-argument':
          console.error('🔍 [FIRESTORE/STORAGE] Invalid argument: Check data format');
          break;
        case 'failed-precondition':
          console.error('🔍 [FIRESTORE/STORAGE] Failed precondition: Check Firebase setup');
          break;
        default:
          console.error('🔍 [FIRESTORE/STORAGE] Other Firebase error:', errorCode);
      }
    }
    
    throw error;
  }
}

export async function POST(request: NextRequest) {
  console.log('🚀 [API] Starting file processing request...');
  
  try {
    const formData = await request.formData();
    const retirementHome = formData.get('retirementHome') as string;
    const carePlanCount = parseInt(formData.get('carePlanCount') as string) || 0;
    const hydrationDataCount = parseInt(formData.get('hydrationDataCount') as string) || 0;

    console.log('📊 [API] Request parameters:', {
      retirementHome,
      carePlanCount,
      hydrationDataCount
    });

    if (carePlanCount === 0 || hydrationDataCount === 0 || !retirementHome) {
      console.error('❌ [API] Missing required files or retirement home');
      return NextResponse.json({ error: 'Missing required files or retirement home' }, { status: 400 });
    }

    // Extract all care plan files
    const carePlanFiles: File[] = [];
    for (let i = 0; i < carePlanCount; i++) {
      const file = formData.get(`carePlan_${i}`) as File;
      if (file) {
        carePlanFiles.push(file);
        console.log(`📄 [API] Extracted care plan file ${i}: ${file.name} (${file.size} bytes)`);
      }
    }

    // Extract all hydration data files
    const hydrationDataFiles: File[] = [];
    for (let i = 0; i < hydrationDataCount; i++) {
      const file = formData.get(`hydrationData_${i}`) as File;
      if (file) {
        hydrationDataFiles.push(file);
        console.log(`💧 [API] Extracted hydration data file ${i}: ${file.name} (${file.size} bytes)`);
      }
    }

    console.log(`📁 [API] Total files extracted: ${carePlanFiles.length} care plans, ${hydrationDataFiles.length} hydration data files`);

    // Create retirement home-specific directories
    const homeDir = join(process.cwd(), 'data', retirementHome);
    const carePlansDir = join(homeDir, 'care-plans');
    const hydrationDataDir = join(homeDir, 'hydration-data');

    console.log(`🏠 [API] Creating directories for retirement home: ${retirementHome}`);
    console.log(`📁 [API] Home directory: ${homeDir}`);
    console.log(`📄 [API] Care plans directory: ${carePlansDir}`);
    console.log(`💧 [API] Hydration data directory: ${hydrationDataDir}`);

    await mkdir(carePlansDir, { recursive: true });
    await mkdir(hydrationDataDir, { recursive: true });
    console.log('✅ [API] Directories created successfully');

    // Save all uploaded files
    console.log(`💾 [API] Saving ${carePlanFiles.length} care plan files and ${hydrationDataFiles.length} hydration data files`);
    
    // Save files locally and collect buffers for Firebase upload
    const carePlanUploads: { fileName: string; bytes: Uint8Array }[] = [];
    for (const file of carePlanFiles) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = join(carePlansDir, file.name);
      await writeFile(path, Buffer.from(bytes));
      carePlanUploads.push({ fileName: file.name, bytes });
      console.log(`✅ [API] Saved care plan: ${file.name} to ${path}`);
    }
    
    const hydrationUploads: { fileName: string; bytes: Uint8Array }[] = [];
    for (const file of hydrationDataFiles) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = join(hydrationDataDir, file.name);
      await writeFile(path, Buffer.from(bytes));
      hydrationUploads.push({ fileName: file.name, bytes });
      console.log(`✅ [API] Saved hydration data: ${file.name} to ${path}`);
    }

    console.log('✅ [API] All files saved successfully');

    // Copy Python scripts to home directory
    const scriptsDir = join(homeDir, 'scripts');
    await mkdir(scriptsDir, { recursive: true });
    console.log(`🐍 [API] Created scripts directory: ${scriptsDir}`);

    // Copy the Python processing scripts
    console.log('📋 [API] Copying Python scripts to home directory...');
    await copyFile(join(process.cwd(), 'python', 'careplan.py'), join(scriptsDir, 'careplan.py'));
    console.log('✅ [API] Copied careplan.py');
    await copyFile(join(process.cwd(), 'python', 'process_dat_pdf.py'), join(scriptsDir, 'process_dat_pdf.py'));
    console.log('✅ [API] Copied process_dat_pdf.py');
    await copyFile(join(process.cwd(), 'python', 'generate_dashboard_data.py'), join(scriptsDir, 'generate_dashboard_data.py'));
    console.log('✅ [API] Copied generate_dashboard_data.py');
    console.log('✅ [API] All Python scripts copied successfully');

    // Process files using Python scripts
    const csvPath = join(homeDir, 'hydration_goals.csv');

    // Install Python packages first (prefer python3 -m pip; fallback gracefully)
    console.log('🐍 [PYTHON] Installing required packages...');
    try {
      await execAsync(`python3 -m pip install --user --break-system-packages PyPDF2 pdfminer.six`);
      console.log('✅ [PYTHON] Packages installed successfully via python3 -m pip');
    } catch (pipErr) {
      console.log('⚠️ [PYTHON] python3 -m pip failed or missing, attempting ensurepip...', pipErr);
      try {
        await execAsync(`python3 -m ensurepip --upgrade || true`);
        await execAsync(`python3 -m pip install --user --break-system-packages PyPDF2 pdfminer.six`);
        console.log('✅ [PYTHON] Packages installed after bootstrapping pip');
      } catch (error) {
        console.log('⚠️ [PYTHON] Package installation unavailable. Proceeding; scripts may import preinstalled libs if present.', error);
      }
    }

    // Step 1: Extract care plan data
    console.log('🐍 [PYTHON] Step 1: Processing care plan...');
    console.log(`🐍 [PYTHON] Running: cd "${homeDir}" && python3 scripts/careplan.py`);
    try {
      const carePlanResult = await execAsync(`cd "${homeDir}" && python3 scripts/careplan.py`);
      console.log('✅ [PYTHON] Care plan processing completed');
      console.log('📊 [PYTHON] Care plan output:', carePlanResult.stdout);
      if (carePlanResult.stderr) {
        console.log('⚠️ [PYTHON] Care plan warnings:', carePlanResult.stderr);
      }
    } catch (error) {
      console.error('❌ [PYTHON] Care plan processing failed:', error);
      throw error;
    }

    // Step 2: Process hydration data (handles both regular and extra files automatically)
    console.log('🐍 [PYTHON] Step 2: Processing hydration data...');
    console.log(`🐍 [PYTHON] Running: cd "${homeDir}" && python3 scripts/process_dat_pdf.py`);
    try {
      const hydrationResult = await execAsync(`cd "${homeDir}" && python3 scripts/process_dat_pdf.py`);
      console.log('✅ [PYTHON] Hydration data processing completed');
      console.log('📊 [PYTHON] Hydration data output:', hydrationResult.stdout);
      if (hydrationResult.stderr) {
        console.log('⚠️ [PYTHON] Hydration data warnings:', hydrationResult.stderr);
      }
    } catch (error) {
      console.error('❌ [PYTHON] Hydration data processing failed:', error);
      throw error;
    }

    // Step 3: Generate dashboard data
    console.log('🐍 [PYTHON] Step 3: Generating dashboard data...');
    console.log(`🐍 [PYTHON] Running: cd "${homeDir}" && python3 scripts/generate_dashboard_data.py`);
    try {
      const dashboardResult = await execAsync(`cd "${homeDir}" && python3 scripts/generate_dashboard_data.py`);
      console.log('✅ [PYTHON] Dashboard data generation completed');
      console.log('📊 [PYTHON] Dashboard data output:', dashboardResult.stdout);
      if (dashboardResult.stderr) {
        console.log('⚠️ [PYTHON] Dashboard data warnings:', dashboardResult.stderr);
      }
    } catch (error) {
      console.error('❌ [PYTHON] Dashboard data generation failed:', error);
      throw error;
    }

    // Read the generated data
    console.log('📖 [API] Reading generated data files...');
    const { readFile } = await import('fs/promises');
    let csvData = '';
    const dashboardDataFiles: { fileName: string; data: string }[] = [];

    try {
      csvData = await readFile(csvPath, 'utf-8');
      console.log(`✅ [API] CSV data read successfully (${csvData.length} characters)`);
    } catch (error) {
      console.log('❌ [API] CSV file not found or could not be read:', error);
    }

    // Find and read all dashboard_{date}.js files
    try {
      const files = await readdir(homeDir);
      const dashboardFiles = files.filter(file => 
        file.startsWith('dashboard_') && 
        file.endsWith('.js') && 
        /dashboard_\d{1,2}_\d{1,2}_\d{4}\.js/.test(file)
      );
      
      console.log(`📊 [API] Found ${dashboardFiles.length} dashboard files to read`);
      
      for (const dashboardFile of dashboardFiles) {
        try {
          const dashboardPath = join(homeDir, dashboardFile);
          const dashboardData = await readFile(dashboardPath, 'utf-8');
          dashboardDataFiles.push({ fileName: dashboardFile, data: dashboardData });
          console.log(`✅ [API] Dashboard file read successfully: ${dashboardFile} (${dashboardData.length} characters)`);
        } catch (error) {
          console.log(`❌ [API] Dashboard file not found or could not be read: ${dashboardFile}`, error);
        }
      }
    } catch (error) {
      console.log('❌ [API] Could not read dashboard files:', error);
    }

    // Upload PDFs (via provided buffers) and processed data to Firebase
    console.log('🔥 [API] Attempting to upload PDFs and processed data to Firebase...');
    try {
      await uploadToFirebase(homeDir, retirementHome, carePlanUploads, hydrationUploads);
      console.log('✅ [API] Firebase upload completed successfully');
    } catch (firestoreError) {
      console.error('❌ [API] Firestore upload failed:', firestoreError);
      console.log('⚠️ [API] Continuing with local data despite Firestore upload failure');
      // Don't throw the error - continue with the response
    }

    console.log('🎉 [API] File processing completed successfully!');
    console.log('📊 [API] Final summary:', {
      carePlanFiles: carePlanFiles.length,
      hydrationDataFiles: hydrationDataFiles.length,
      csvDataLength: csvData.length,
      dashboardFilesCount: dashboardDataFiles.length,
      retirementHome
    });

    return NextResponse.json({
      success: true,
      message: 'Files processed successfully',
      csvData,
      dashboardDataFiles,
      fileCounts: {
        carePlans: carePlanFiles.length,
        hydrationData: hydrationDataFiles.length,
        dashboardFiles: dashboardDataFiles.length
      }
    });

  } catch (error) {
    console.error('Error processing files:', error);
    return NextResponse.json(
      { error: 'Failed to process files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
