import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where, Firestore } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const revalidate = 120; // Caching for 120 seconds

export async function GET(request: NextRequest) {
  try {
    if (!db || db === null) {
      return NextResponse.json({ 
        error: 'Firebase not initialized. Please check environment variables.' 
      }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');

    if (!chain) {
      return NextResponse.json({ 
        error: 'Chain parameter is required' 
      }, { status: 400 });
    }

    let fbdb = db as Firestore;
    const querySnapshot = await getDocs(collection(fbdb, 'users'));
    
    const homes: Array<{ name: string; chain?: string }> = [];
    querySnapshot.docs.forEach(doc => {
      const userData = doc.data();
      if (userData.role === 'home_manager' && userData.retirementHome) {
        const userChain = userData.chain || '';
        if (userChain.toLowerCase().trim() === chain.toLowerCase().trim()) {
          homes.push({
            name: userData.retirementHome,
            chain: userChain
          });
        }
      }
    });

    // Remove duplicates
    const uniqueHomes = Array.from(new Map(homes.map(home => [home.name, home])).values());
    
    return NextResponse.json({ 
      success: true, 
      homes: uniqueHomes.map(h => h.name).sort() 
    });
  } catch (error: any) {
    console.error('Error fetching homes by chain:', error);
    return NextResponse.json(
      { error: 'Failed to fetch homes', details: error.message },
      { status: 500 }
    );
  }
}

