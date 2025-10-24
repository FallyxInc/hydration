import { NextRequest, NextResponse } from 'next/server';
import { rm } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  console.log('🗑️ [DELETE API] Starting home data deletion...');
  
  try {
    const { retirementHome } = await request.json();
    
    console.log('📊 [DELETE API] Request parameters:', { retirementHome });
    
    if (!retirementHome) {
      console.error('❌ [DELETE API] Missing retirement home parameter');
      return NextResponse.json({ error: 'Missing retirement home parameter' }, { status: 400 });
    }

    // Path to the retirement home directory
    const homeDir = join(process.cwd(), 'data', retirementHome);
    
    console.log(`🏠 [DELETE API] Deleting directory: ${homeDir}`);
    
    try {
      // Remove the entire directory and all its contents
      await rm(homeDir, { recursive: true, force: true });
      console.log('✅ [DELETE API] Directory deleted successfully');
    } catch (error) {
      console.log('⚠️ [DELETE API] Directory may not exist or already deleted:', error);
    }

    console.log('🎉 [DELETE API] Home data deletion completed successfully');

    return NextResponse.json({
      success: true,
      message: `All data for ${retirementHome} has been deleted successfully`
    });

  } catch (error) {
    console.error('💥 [DELETE API] Error deleting home data:', error);
    return NextResponse.json(
      { error: 'Failed to delete home data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
