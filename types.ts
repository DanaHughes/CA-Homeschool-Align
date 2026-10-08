
export interface Standard {
  code: string;
  description: string;
  subject: 'ELA' | 'Math' | 'Science' | 'History' | 'Other';
  gradeLevel: string;
  framework: string;
  relevanceReason?: string;
}

export type SubscriptionPlan = 'none' | 'monthly' | 'yearly';

export interface User {
  id: string; 
  name: string;
  email: string;
  trialStartedAt: number;
  isPaid: boolean;
  paidAt?: number;
  accessCodeUsed?: string;
  searchCount: number;
  accountTier: 'free' | 'pro';
  subscriptionPlan: SubscriptionPlan;
  hasReviewed?: boolean;
  consents: {
    terms: boolean;
    newsletter: boolean;
    facebook: boolean;
  };
}

export interface LearningPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface Student {
  id: string;
  userId: string;
  name: string;
  gradeLevel: string;
  // Calendar settings are saved per student, because some families have
  // children enrolled at different charters with different calendars.
  schoolYearLabel?: string;
  schoolYearStart?: string;
  schoolYearEnd?: string;
  learningPeriods?: LearningPeriod[];
}

// A note sent from inside the app (for example a bug report).
// Nothing is emailed; the admin reads these in the Admin tab.
export interface AppMessage {
  id?: string;
  type: 'bug';
  userId: string;
  userEmail: string;
  userName: string;
  accountTier: string;
  message: string;
  page: string;
  appVersion: string;
  browser: string;
  timestamp: number;
  status: 'new' | 'handled';
}

export interface LearningRecord {
  id: string;
  studentId: string;
  standardCode: string;
  standardDescription: string;
  standardSubject: string;
  activityDate: string;
  activityDescription: string;
  timestamp: number;
  matchLogic?: string;
  includeLogic?: boolean;
}

export interface FeatureRequest {
  id?: string;
  userId: string;
  userEmail: string;
  title: string;
  description: string;
  status: 'pending' | 'reviewed' | 'planned' | 'completed';
  timestamp: number;
}

export type TabView = 'search' | 'students' | 'features' | 'admin';
