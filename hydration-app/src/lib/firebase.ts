import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'placeholder',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'placeholder.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'placeholder',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'placeholder.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'placeholder',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'placeholder',
};

// Only initialize Firebase if we have real config values
let app: FirebaseApp | null;
let auth: Auth | null;
let db: Firestore | null;
let storage: FirebaseStorage | null;


console.log("Firebase Config during deployment:");
console.log("apiKey:", firebaseConfig.apiKey || firebaseConfig.apiKey != 'placeholder' ? "SET" : "UNDEFINED");
console.log("authDomain:", firebaseConfig.authDomain || firebaseConfig.authDomain != 'placeholder.firebaseapp.com' ? "SET" : "UNDEFINED");
console.log("projectId:", firebaseConfig.projectId || firebaseConfig.projectId != 'placeholder' ? "SET" : "UNDEFINED");
console.log(firebaseConfig); // Log the full object

if (firebaseConfig.apiKey !== 'placeholder' && firebaseConfig.projectId !== 'placeholder') {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    app = null;
    auth = null;
    db = null;
    storage = null;
  }
} else {
  // Create null objects for build time
  app = null;
  auth = null;
  db = null;
  storage = null;
}

export { auth, db, storage };
export default app;
