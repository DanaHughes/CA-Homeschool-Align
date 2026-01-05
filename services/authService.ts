import { auth, db } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendEmailVerification
} from 'firebase/auth';
import * as firestore from 'firebase/firestore';
import { User } from '../types';

const PRO_FREE_EMAILS = [
  'demo@cahomeschool.com',
  'dana2andrea@gmail.com'
];

const isProFreeEmail = (email: string) => email && PRO_FREE_EMAILS.includes(email.toLowerCase());

export const authService = {
  subscribeToAuth: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Use namespace access for Firestore methods
        const userDoc = await firestore.getDoc(firestore.doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          let userData = userDoc.data() as User;
          
          // Ensure designated accounts are always pro
          if (isProFreeEmail(userData.email)) {
            if (!userData.isPaid || userData.accountTier !== 'pro') {
              await firestore.updateDoc(firestore.doc(db, 'users', firebaseUser.uid), {
                isPaid: true,
                accountTier: 'pro'
              });
              userData = { ...userData, isPaid: true, accountTier: 'pro' };
            }
          }
          callback(userData);
        } else {
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  },

  signUp: async (name: string, email: string, password: string, consents: User['consents']): Promise<User> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    try {
      await sendEmailVerification(firebaseUser);
    } catch (e) {
      console.error("Could not send verification email:", e);
    }

    const isProFree = isProFreeEmail(email);
    let finalName = name;
    if (email.toLowerCase() === 'dana2andrea@gmail.com') {
      finalName = "Dana Hughes";
    } else if (email.toLowerCase() === 'demo@cahomeschool.com') {
      finalName = 'Demo Educator';
    }

    const newUser: User = {
      id: firebaseUser.uid,
      name: finalName,
      email: email.toLowerCase(),
      trialStartedAt: Date.now(),
      isPaid: isProFree,
      searchCount: 0,
      accountTier: isProFree ? 'pro' : 'free',
      subscriptionPlan: 'none',
      consents
    };

    // Use namespace access for Firestore methods
    await firestore.setDoc(firestore.doc(db, 'users', firebaseUser.uid), newUser);
    return newUser;
  },

  login: async (email: string, password: string): Promise<User> => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Use namespace access for Firestore methods
    const userDoc = await firestore.getDoc(firestore.doc(db, 'users', userCredential.user.uid));
    if (userDoc.exists()) {
      let userData = userDoc.data() as User;
      if (isProFreeEmail(userData.email)) {
        let finalName = userData.name;
        if (userData.email.toLowerCase() === 'dana2andrea@gmail.com') finalName = "Dana Hughes";
        if (userData.email.toLowerCase() === 'demo@cahomeschool.com') finalName = "Demo Educator";
        
        userData = { ...userData, isPaid: true, accountTier: 'pro', name: finalName };
      }
      return userData;
    } else {
      throw new Error("User record not found.");
    }
  },

  logout: async () => {
    await signOut(auth);
  }
};