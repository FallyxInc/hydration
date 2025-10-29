import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, Firestore } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const revalidate = 120;

export async function GET(request: NextRequest) {
  try {
    // Check if Firebase is available
    if (!db || db === null) {
      return NextResponse.json({ 
        error: 'Firebase not initialized. Please check environment variables.' 
      }, { status: 500 });
    }

    console.log('🏠 [API] Fetching retirement homes from users collection...');
    
    let fbdb = db as Firestore;
    const querySnapshot = await getDocs(collection(fbdb, 'users'));
    
    // Extract unique retirement homes from users
    const retirementHomes = new Set<string>();
    
    querySnapshot.docs.forEach(doc => {
      const userData = doc.data();
      if (userData.retirementHome && userData.retirementHome.trim()) {
        retirementHomes.add(userData.retirementHome.trim());
      }
    });
    
    const retirementHomesList = Array.from(retirementHomes).sort();
    
    console.log('✅ [API] Found retirement homes:', retirementHomesList);

    return NextResponse.json({
      success: true,
      retirementHomes: retirementHomesList
    }, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=120'
      }
    });

  } catch (error: any) {
    console.error('❌ [API] Error fetching retirement homes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch retirement homes', details: error.message },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}
