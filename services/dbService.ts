import { db } from '../firebase';
import * as firestore from 'firebase/firestore';
import { Student, LearningRecord, FeatureRequest } from '../types';

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

  incrementUserSearch: async (userId: string): Promise<number> => {
    const userRef = firestore.doc(db, 'users', userId);
    await firestore.updateDoc(userRef, {
      searchCount: firestore.increment(1)
    });
    const snap = await firestore.getDoc(userRef);
    return snap.data()?.searchCount || 0;
  },

  updateReviewStatus: async (userId: string): Promise<void> => {
    const userRef = firestore.doc(db, 'users', userId);
    await firestore.updateDoc(userRef, { hasReviewed: true });
  },

  submitFeatureRequest: async (request: FeatureRequest): Promise<string> => {
    const docRef = await firestore.addDoc(firestore.collection(db, 'feature_requests'), request);
    return docRef.id;
  },

  unlockUser: async (userId: string, name: string, code: string): Promise<void> => {
    const userRef = firestore.doc(db, 'users', userId);
    await firestore.updateDoc(userRef, {
      accountTier: 'pro',
      isPaid: true,
      paidAt: Date.now(),
      accessCodeUsed: code,
      name: name 
    });
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