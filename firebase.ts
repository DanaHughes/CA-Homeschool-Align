import * as firebaseApp from 'firebase/app';
import { getAuth } from 'firebase/auth';
import * as firestore from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDLFt3NNimFoZTQIaB2UOCSkfmQbaonN-c",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "ca-homeschool-align.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "ca-homeschool-align",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "ca-homeschool-align.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "139982618318",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:139982618318:web:f156a849ef383dd1b95a9f"
};

// Initialize Firebase only if it hasn't been initialized already
// Use namespace access for initializeApp, getApps, and getApp to avoid named export errors
const app = !firebaseApp.getApps().length ? firebaseApp.initializeApp(firebaseConfig) : firebaseApp.getApp();

export const auth = getAuth(app);
export const db = firestore.getFirestore(app);