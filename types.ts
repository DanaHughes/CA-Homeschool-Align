
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

export interface Student {
  id: string;
  userId: string;
  name: string;
  gradeLevel: string;
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

export interface ATSScoreCategory {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
  suggestions: string[];
}

export interface ATSScanResult {
  overallScore: number;
  readabilityGrade: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  categories: ATSScoreCategory[];
  topIssues: string[];
  summary: string;
}

export type TabView = 'search' | 'students' | 'features' | 'ats';
