import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, copyFile } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const carePlanFile = formData.get('carePlan') as File;
    const hydrationDataFile = formData.get('hydrationData') as File;
    const retirementHome = formData.get('retirementHome') as string;

    if (!carePlanFile || !hydrationDataFile || !retirementHome) {
      return NextResponse.json({ error: 'Missing required files or retirement home' }, { status: 400 });
    }

    // Create retirement home-specific directories
    const homeDir = join(process.cwd(), 'data', retirementHome);
    const carePlansDir = join(homeDir, 'care-plans');
    const hydrationDataDir = join(homeDir, 'hydration-data');

    await mkdir(carePlansDir, { recursive: true });
    await mkdir(hydrationDataDir, { recursive: true });

    // Save uploaded files
    const carePlanBytes = await carePlanFile.arrayBuffer();
    const hydrationDataBytes = await hydrationDataFile.arrayBuffer();

    const carePlanPath = join(carePlansDir, carePlanFile.name);
    const hydrationDataPath = join(hydrationDataDir, hydrationDataFile.name);

    await writeFile(carePlanPath, Buffer.from(carePlanBytes));
    await writeFile(hydrationDataPath, Buffer.from(hydrationDataBytes));

    // Copy Python scripts to home directory
    const scriptsDir = join(homeDir, 'scripts');
    await mkdir(scriptsDir, { recursive: true });

    // Copy the Python processing scripts
    await copyFile(join(process.cwd(), '..', 'careplan.py'), join(scriptsDir, 'careplan.py'));
    await copyFile(join(process.cwd(), '..', 'process_dat_pdf.py'), join(scriptsDir, 'process_dat_pdf.py'));
    await copyFile(join(process.cwd(), '..', 'generate_dashboard_data.py'), join(scriptsDir, 'generate_dashboard_data.py'));

    // Process files using Python scripts
    const csvPath = join(homeDir, 'hydration_goals.csv');
    const jsDataPath = join(homeDir, 'dashboard_data.js');

    // Step 1: Extract care plan data
    await execAsync(`cd ${homeDir} && python3 scripts/careplan.py`);
    
    // Step 2: Process hydration data
    await execAsync(`cd ${homeDir} && python3 scripts/process_dat_pdf.py`);
    
    // Step 3: Generate dashboard data
    await execAsync(`cd ${homeDir} && python3 scripts/generate_dashboard_data.py`);

    // Read the generated data
    const { readFile } = await import('fs/promises');
    let csvData = '';
    let jsData = '';

    try {
      csvData = await readFile(csvPath, 'utf-8');
    } catch (error) {
      console.log('No CSV file generated');
    }

    try {
      jsData = await readFile(jsDataPath, 'utf-8');
    } catch (error) {
      console.log('No JS data file generated');
    }

    return NextResponse.json({
      success: true,
      message: 'Files processed successfully',
        data: {
          csvData,
          jsData,
          retirementHome,
          filesProcessed: {
            carePlan: carePlanFile.name,
            hydrationData: hydrationDataFile.name
          }
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
