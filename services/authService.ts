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
  'dana2andrea@gmail.com',
  'thelearninglabhubinfo@gmail.com'
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
          
          // Designated accounts always have Pro. This is decided here (and on the server) from the
          // email list; it is NOT saved to the database, because only the server may change paid status.
          if (isProFreeEmail(userData.email)) {
            let finalName = userData.name;
            if (userData.email.toLowerCase() === 'dana2andrea@gmail.com') finalName = "Dana Hughes";
            if (userData.email.toLowerCase() === 'demo@cahomeschool.com') finalName = "Demo Educator";

            if (userData.name !== finalName) {
              await firestore.updateDoc(firestore.doc(db, 'users', firebaseUser.uid), { name: finalName });
            }
            userData = { ...userData, isPaid: true, accountTier: 'pro', name: finalName };
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

  login: async (email: string, password: string): Promise<User> => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Use namespace access for Firestore methods
    const userDoc = await firestore.getDoc(firestore.doc(db, 'users', firebaseUser.uid));
    
    if (userDoc.exists()) {
      let userData = userDoc.data() as User;
      if (isProFreeEmail(userData.email)) {
        let finalName = userData.name;
        if (userData.email.toLowerCase() === 'dana2andrea@gmail.com') finalName = "Dana Hughes";
        if (userData.email.toLowerCase() === 'demo@cahomeschool.com') finalName = "Demo Educator";
        
        // Designated accounts always have Pro; decided from the email list, never saved from the browser.
        if (userData.name !== finalName) {
          await firestore.updateDoc(firestore.doc(db, 'users', firebaseUser.uid), { name: finalName });
        }
        userData = { ...userData, isPaid: true, accountTier: 'pro', name: finalName };
      }
      return userData;
    } else {
      // User exists in Auth but not in Firestore - create the document
      console.log('User exists in Auth but not in Firestore. Creating user document...');
      const isProFree = isProFreeEmail(email);
      let finalName = firebaseUser.displayName || email.split('@')[0];
      if (email.toLowerCase() === 'dana2andrea@gmail.com') finalName = "Dana Hughes";
      if (email.toLowerCase() === 'demo@cahomeschool.com') finalName = "Demo Educator";
      
      const newUser: User = {
        id: firebaseUser.uid,
        name: finalName,
        email: email.toLowerCase(),
        trialStartedAt: Date.now(),
        isPaid: false,
        searchCount: 0,
        accountTier: 'free',
        subscriptionPlan: 'none',
        consents: {
          terms: true,
          newsletter: false,
          facebook: false
        }
      };

      await firestore.setDoc(firestore.doc(db, 'users', firebaseUser.uid), newUser);
      return isProFree ? { ...newUser, isPaid: true, accountTier: 'pro' } : newUser;
    }
  },

  signUp: async (name: string, email: string, password: string, consents: User['consents']): Promise<User> => {
    try {
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
        isPaid: false,
        searchCount: 0,
        accountTier: 'free',
        subscriptionPlan: 'none',
        consents
      };

      // Use namespace access for Firestore methods
      await firestore.setDoc(firestore.doc(db, 'users', firebaseUser.uid), newUser);
      return isProFree ? { ...newUser, isPaid: true, accountTier: 'pro' } : newUser;
    } catch (error: any) {
      // If email already in use, try to login instead and create Firestore doc if missing
      if (error.code === 'auth/email-already-in-use') {
        console.log('Email already in use. Attempting to login and create Firestore document if missing...');
        try {
          // Try to login with the provided password
          const user = await authService.login(email, password);
          return user;
        } catch (loginError: any) {
          // If login fails, throw the original signup error
          throw error;
        }
      }
      throw error;
    }
  },

  // Email verification (the free trial needs a verified email).
  getEmailVerified: (): boolean => {
    const current = auth.currentUser;
    return current ? current.emailVerified === true : true;
  },

  resendVerification: async (): Promise<void> => {
    if (!auth.currentUser) throw new Error('NOT_LOGGED_IN');
    await sendEmailVerification(auth.currentUser);
  },

  // Re-reads the account from Firebase so a just-clicked verification link is noticed.
  refreshVerification: async (): Promise<boolean> => {
    const current = auth.currentUser;
    if (!current) return false;
    await current.reload();
    await current.getIdToken(true);
    return current.emailVerified === true;
  },

  logout: async () => {
    await signOut(auth);
    
    // Clear all localStorage items
    localStorage.clear();
    
    // Clear all sessionStorage items
    sessionStorage.clear();
    
    // Clear any cookies set by the app (Firebase Auth cookies are handled by signOut)
    // Remove any app-specific cookies if they exist
    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
      // Only clear cookies that are not Firebase-related (Firebase handles its own)
      if (name && !name.startsWith('firebase') && !name.startsWith('__')) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      }
    });
  }
};