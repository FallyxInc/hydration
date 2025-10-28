import { NextRequest, NextResponse } from 'next/server';
import { addDoc, collection, Firestore } from 'firebase/firestore';
import { createUserWithEmailAndPassword, Auth } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {

    // Check if Firebase is available
    if (!db || db === null || !auth || auth === null) {
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

    // Create Firebase Auth user first
    let fbauth = auth as Auth;
    const userCredential = await createUserWithEmailAndPassword(fbauth, email, password);
    const firebaseUser = userCredential.user;

    // Then create the user document in Firestore
    let fbdb = db as Firestore;
    const userDoc = await addDoc(collection(fbdb, 'users'), {
      name,
      email,
      role,
      retirementHome,
      createdAt: new Date(),
      firebaseUid: firebaseUser.uid
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
