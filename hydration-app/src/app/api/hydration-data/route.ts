import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  console.log('🚀 [HYDRATION DATA API] Starting hydration data request...');
  
  try {
    const { userRole, retirementHome } = await request.json();
    
    console.log('📊 [HYDRATION DATA API] Request parameters:', { userRole, retirementHome });
    
    // Determine data source based on user role
    let csvPath: string;
    
    if (userRole === 'admin') {
      // Admin sees all data - use main CSV
      csvPath = join(process.cwd(), '..', 'hydration_goals.csv');
      console.log('👑 [HYDRATION DATA API] Admin access - using main CSV:', csvPath);
    } else if (userRole === 'home_manager' && retirementHome) {
      // Home manager sees only their home's data
      csvPath = join(process.cwd(), 'data', retirementHome, 'hydration_goals.csv');
      console.log('🏠 [HYDRATION DATA API] Home manager access - using home-specific CSV:', csvPath);
    } else {
      console.log('❌ [HYDRATION DATA API] Error: Invalid user role or missing retirement home', { userRole, retirementHome });
      return NextResponse.json({ 
        error: 'Invalid user role or missing retirement home',
        details: { userRole, retirementHome }
      }, { status: 400 });
    }
    
    try {
      console.log('📖 [HYDRATION DATA API] Reading CSV file:', csvPath);
      const csvContent = await readFile(csvPath, 'utf-8');
      console.log(`✅ [HYDRATION DATA API] CSV file read successfully (${csvContent.length} characters)`);
      
      const lines = csvContent.split('\n');
      const headers = lines[0].split(',');
      console.log('📊 [HYDRATION DATA API] CSV headers:', headers);
      console.log(`📊 [HYDRATION DATA API] Total lines in CSV: ${lines.length}`);
      
      const residents = lines.slice(1).filter(line => line.trim()).map(line => {
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
        
        headers.forEach((header, index) => {
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

      console.log(`✅ [HYDRATION DATA API] Processed ${residents.length} residents`);
      console.log('🎉 [HYDRATION DATA API] Hydration data request completed successfully');

      return NextResponse.json({ residents });
    } catch (error) {
      console.log('❌ [HYDRATION DATA API] CSV file not found or could not be read:', error);
      // If no CSV file exists, return empty data
      return NextResponse.json({ residents: [] });
    }
  } catch (error) {
    console.error('Error reading hydration data:', error);
    return NextResponse.json(
      { error: 'Failed to read hydration data' },
      { status: 500 }
    );
  }
}
