import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { userRole, retirementHome } = await request.json();
    
    // Determine data source based on user role
    let csvPath: string;
    
    if (userRole === 'admin') {
      // Admin sees all data - use main CSV
      csvPath = join(process.cwd(), '..', 'hydration_goals.csv');
    } else if (userRole === 'home_manager' && retirementHome) {
      // Home manager sees only their home's data
      csvPath = join(process.cwd(), 'data', retirementHome, 'hydration_goals.csv');
    } else {
      return NextResponse.json({ error: 'Invalid user role or missing retirement home' }, { status: 400 });
    }
    
    try {
      const csvContent = await readFile(csvPath, 'utf-8');
      const lines = csvContent.split('\n');
      const headers = lines[0].split(',');
      
      const residents = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',');
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
          }
        });
        
        return resident;
      });

      return NextResponse.json({ residents });
    } catch (error) {
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
