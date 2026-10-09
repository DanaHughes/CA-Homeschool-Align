import { Student } from '../types';
import { PageDesign } from './gradeExpectations';

// Which Learning Period (if any) the student has saved that covers this date (YYYY-MM-DD).
export const lpForDate = (student: Student | undefined, isoDate: string): string => {
  const lps = student?.learningPeriods || [];
  const hit = lps.find(lp => lp.startDate && lp.endDate && isoDate >= lp.startDate && isoDate <= lp.endDate);
  return hit ? hit.name : '';
};

export const todayIso = (d = new Date()): string => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export const prettyDate = (d = new Date()): string =>
  d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// Page rotation: use the AI's best fit, unless this student just used it, then try another design.
const DESIGNS: PageDesign[] = ['journal', 'organizer'];

export const pickDesign = (recommended: PageDesign, recentlyUsed: PageDesign[]): PageDesign => {
  const last = recentlyUsed[recentlyUsed.length - 1];
  if (recommended !== last) return recommended;
  return DESIGNS.find(d => d !== last) || recommended;
};

export const otherDesign = (current: PageDesign): PageDesign =>
  DESIGNS.find(d => d !== current) || current;

const historyKey = (studentId: string) => `pageHistory_${studentId || 'none'}`;

export const readHistory = (studentId: string): PageDesign[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(historyKey(studentId)) || '[]');
    return Array.isArray(raw) ? raw.filter((d: unknown) => d === 'journal' || d === 'organizer') : [];
  } catch {
    return [];
  }
};

export const writeHistory = (studentId: string, design: PageDesign): void => {
  try {
    const next = [...readHistory(studentId), design].slice(-5);
    localStorage.setItem(historyKey(studentId), JSON.stringify(next));
  } catch {
    /* private windows can block storage; rotation just resets */
  }
};
