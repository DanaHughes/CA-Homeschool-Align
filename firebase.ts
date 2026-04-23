import * as firebaseApp from 'firebase/app';
import { getAuth } from 'firebase/auth';
import * as firestore from 'firebase/firestore';

// Vite exposes env vars prefixed with VITE_ on `import.meta.env` at build time.
// These values come from `.env.local` (dev) or `.env.production` (build) or the
// hosting environment. See `.env.example` for the full list.
const env = (import.meta as any).env ?? {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "ca-homeschool-align.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "ca-homeschool-align",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "ca-homeschool-align.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "139982618318",
  appId: env.VITE_FIREBASE_APP_ID || "1:139982618318:web:f156a849ef383dd1b95a9f"
};

if (!firebaseConfig.apiKey) {
  const msg =
    "Firebase config is missing VITE_FIREBASE_API_KEY. " +
    "Create a `.env.local` file in the project root (copy `.env.example`) " +
    "and set VITE_FIREBASE_API_KEY to the Web API Key from your Firebase " +
    "Console (Project Settings → General → Your apps → SDK setup). " +
    "Restart the dev server after editing `.env.local`.";
  console.error(msg);
  throw new Error(msg);
}

const app = !firebaseApp.getApps().length ? firebaseApp.initializeApp(firebaseConfig) : firebaseApp.getApp();

export const auth = getAuth(app);
export const db = firestore.getFirestore(app);
