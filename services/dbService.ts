import { db } from '../firebase';
import * as firestore from 'firebase/firestore';
import { Student, LearningRecord, FeatureRequest, AppMessage } from '../types';

export const dbService = {
  getDailyUsage: async (): Promise<number> => {
    const today = new Date().toISOString().split('T')[0];
    const usageRef = firestore.doc(db, 'system_stats', `usage_${today}`);
    const snap = await firestore.getDoc(usageRef);
    return snap.exists() ? snap.data().count || 0 : 0;
  },

  incrementUsage: async (): Promise<number> => {
    const today = new Date().toISOString().split('T')[0];
    const usageRef = firestore.doc(db, 'system_stats', `usage_${today}`);
    return await firestore.runTransaction(db, async (transaction) => {
      const snap = await transaction.get(usageRef);
      if (!snap.exists()) {
        transaction.set(usageRef, { count: 1 });
        return 1;
      }
      const newCount = (snap.data().count || 0) + 1;
      transaction.update(usageRef, { count: newCount });
      return newCount;
    });
  },

  updateReviewStatus: async (userId: string): Promise<void> => {
    const userRef = firestore.doc(db, 'users', userId);
    await firestore.updateDoc(userRef, { hasReviewed: true });
  },

  submitFeatureRequest: async (request: FeatureRequest): Promise<string> => {
    const docRef = await firestore.addDoc(firestore.collection(db, 'feature_requests'), request);
    return docRef.id;
  },

  submitMessage: async (message: Omit<AppMessage, 'id'>): Promise<string> => {
    const docRef = await firestore.addDoc(firestore.collection(db, 'messages'), message);
    return docRef.id;
  },

  // Admin only (the database rules refuse everyone else).
  getMessages: async (): Promise<AppMessage[]> => {
    const snap = await firestore.getDocs(firestore.collection(db, 'messages'));
    return snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as AppMessage))
      .sort((a, b) => b.timestamp - a.timestamp);
  },

  setMessageStatus: async (messageId: string, status: 'new' | 'handled'): Promise<void> => {
    await firestore.updateDoc(firestore.doc(db, 'messages', messageId), { status });
  },

  deleteMessage: async (messageId: string): Promise<void> => {
    await firestore.deleteDoc(firestore.doc(db, 'messages', messageId));
  },

  // Words on the payment screen. Anyone signed in can read; only the admin can save (database rules).
  getPaywallText: async (): Promise<Record<string, unknown>> => {
    try {
      const snap = await firestore.getDoc(firestore.doc(db, 'settings', 'paywall'));
      return snap.exists() ? (snap.data() as Record<string, unknown>) : {};
    } catch (e) {
      console.warn('Could not load the payment screen text; using the original words.', e);
      return {};
    }
  },

  setPaywallText: async (text: Record<string, string>): Promise<void> => {
    await firestore.setDoc(firestore.doc(db, 'settings', 'paywall'), { ...text, updatedAt: Date.now() });
  },

  // Editable wording (Admin > Text & Links) and the Start Here steps and questions (Admin > FAQs & Steps).
  getSiteText: async (): Promise<Record<string, unknown>> => {
    try {
      const snap = await firestore.getDoc(firestore.doc(db, 'settings', 'siteText'));
      return snap.exists() ? (snap.data() as Record<string, unknown>) : {};
    } catch (e) {
      console.warn('Could not load the saved wording; using the original words.', e);
      return {};
    }
  },

  setSiteText: async (text: Record<string, string>): Promise<void> => {
    await firestore.setDoc(firestore.doc(db, 'settings', 'siteText'), { ...text, updatedAt: Date.now() });
  },

  getStartHere: async (): Promise<Record<string, unknown>> => {
    try {
      const snap = await firestore.getDoc(firestore.doc(db, 'settings', 'startHere'));
      return snap.exists() ? (snap.data() as Record<string, unknown>) : {};
    } catch (e) {
      console.warn('Could not load the Start Here page; using the original words.', e);
      return {};
    }
  },

  setStartHere: async (content: { steps: unknown[]; faqs: unknown[] }): Promise<void> => {
    await firestore.setDoc(firestore.doc(db, 'settings', 'startHere'), { ...content, updatedAt: Date.now() });
  },

  getStudents: async (userId: string): Promise<Student[]> => {
    const q = firestore.query(firestore.collection(db, 'students'), firestore.where('userId', '==', userId));
    const querySnapshot = await firestore.getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
  },

  addStudent: async (student: Omit<Student, 'id'>): Promise<string> => {
    const docRef = await firestore.addDoc(firestore.collection(db, 'students'), student);
    return docRef.id;
  },

  updateStudent: async (studentId: string, data: Partial<Student>): Promise<void> => {
    const ref = firestore.doc(db, 'students', studentId);
    await firestore.updateDoc(ref, data);
  },

  deleteStudent: async (studentId: string): Promise<void> => {
    await firestore.deleteDoc(firestore.doc(db, 'students', studentId));
  },

  getRecords: async (studentId: string): Promise<LearningRecord[]> => {
    // We remove the Firestore orderBy and sort in-memory.
    // This bypasses the need for the user to create composite indexes in the Firebase Console.
    const q = firestore.query(
      firestore.collection(db, 'records'), 
      firestore.where('studentId', '==', studentId)
    );
    const querySnapshot = await firestore.getDocs(q);
    const records = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LearningRecord));
    
    // Sort by timestamp descending
    return records.sort((a, b) => b.timestamp - a.timestamp);
  },

  addRecord: async (record: any): Promise<string> => {
    const docRef = await firestore.addDoc(firestore.collection(db, 'records'), record);
    return docRef.id;
  },

  updateRecord: async (recordId: string, data: Partial<LearningRecord>): Promise<void> => {
    const ref = firestore.doc(db, 'records', recordId);
    await firestore.updateDoc(ref, data);
  },

  deleteRecord: async (recordId: string): Promise<void> => {
    await firestore.deleteDoc(firestore.doc(db, 'records', recordId));
  }
};