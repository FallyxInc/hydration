import { NextRequest, NextResponse } from 'next/server';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {

    // Check if Firebase is available
    if (!db || db === null) {
      return NextResponse.json({ 
        error: 'Firebase not initialized. Please check environment variables.' 
      }, { status: 500 });
    }
    const { name, email, password, role, retirementHome } = await request.json();

    if (!email || !password || !name || !retirementHome) {
      return NextResponse.json({ 
        error: 'Name, email, password, and retirement home are required' 
      }, { status: 400 });
    }

    // For now, just create the user document in Firestore
    // The actual Firebase Auth user creation should be done client-side
    const userDoc = await addDoc(collection(db, 'users'), {
      name,
      email,
      role,
      retirementHome,
      createdAt: new Date(),
      // Add a flag to indicate this user needs to be created in Auth
      needsAuthCreation: true
    });

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: userDoc.id,
        name,
        email,
        role,
        retirementHome
      }
    });

  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user', details: error.message },
      { status: 500 }
    );
  }
}
