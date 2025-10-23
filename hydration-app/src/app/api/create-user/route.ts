import { NextRequest, NextResponse } from 'next/server';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, role } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Note: In a production environment, you should use Firebase Admin SDK
    // to create users server-side. This is a simplified example.
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      return NextResponse.json({
        success: true,
        message: 'User created successfully',
        user: {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          name,
          role
        }
      });
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Failed to create user', details: error.message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
