import { db } from '../firebase';
import * as firestore from 'firebase/firestore';

// The free trial: GENERATIONS available for DAYS days. The days start at the first generation.
// The SERVER enforces this (api/lib/entitlements.ts). This file only reads the numbers so the screens
// can say how much is left. The default numbers match the server's; Dana can change them in the Admin tab.
export const TRIAL_DEFAULT_GENERATIONS = 5;
export const TRIAL_DEFAULT_DAYS = 7;
const DAY_MS = 86_400_000;

export interface TrialStatus {
  started: boolean;
  used: number;
  generations: number;
  days: number;
  remaining: number;
  daysLeft: number;
  endsAt: number | null;
  over: boolean;
}

export const computeTrial = (
  trial: { startedAt?: number; used?: number } | null,
  limits: { trialDays?: number; trialGenerations?: number },
  now: number
): TrialStatus => {
  const generations = limits.trialGenerations && limits.trialGenerations > 0 ? limits.trialGenerations : TRIAL_DEFAULT_GENERATIONS;
  const days = limits.trialDays && limits.trialDays > 0 ? limits.trialDays : TRIAL_DEFAULT_DAYS;
  const started = !!(trial && typeof trial.startedAt === 'number');
  const used = started ? Math.max(0, trial!.used || 0) : 0;
  const endsAt = started ? trial!.startedAt! + days * DAY_MS : null;
  const timeUp = started && endsAt !== null && now > endsAt;
  const over = started && (timeUp || used >= generations);
  return {
    started,
    used,
    generations,
    days,
    remaining: Math.max(0, generations - used),
    daysLeft: started && endsAt !== null ? Math.max(0, Math.ceil((endsAt - now) / DAY_MS)) : days,
    endsAt,
    over
  };
};

export const loadTrialStatus = async (userId: string): Promise<TrialStatus> => {
  let trial: any = null;
  let limits: any = {};
  try {
    const t = await firestore.getDoc(firestore.doc(db, 'trials', userId));
    trial = t.exists() ? t.data() : null;
  } catch (e) {
    // If this cannot be read, show a full trial. The server still enforces the real limits.
    console.warn('Could not read the trial status.', e);
  }
  try {
    const l = await firestore.getDoc(firestore.doc(db, 'settings', 'limits'));
    limits = l.exists() ? l.data() : {};
  } catch (e) {
    limits = {};
  }
  return computeTrial(trial, limits || {}, Date.now());
};

// One short line for the top bar.
export const trialSummary = (t: TrialStatus): string => {
  const gen = (n: number) => `${n} free ${n === 1 ? 'generation' : 'generations'}`;
  if (t.over) return 'Free trial ended';
  if (!t.started) return `${gen(t.generations)} · ${t.days} days`;
  return `${gen(t.remaining)} · ${t.daysLeft} ${t.daysLeft === 1 ? 'day' : 'days'} left`;
};
