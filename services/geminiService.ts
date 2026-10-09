import { auth } from '../firebase';
import { Standard, LearningRecord } from '../types';

// All AI calls go through our own server (/api/gemini). The Gemini API key lives
// only on the server and is never included in the code sent to the browser.

const EXPLAIN_FALLBACK = 'During this activity, students can build key academic skills through hands-on learning.';

const callGemini = async (payload: Record<string, unknown>): Promise<any> => {
  const user = auth.currentUser;
  if (!user) throw new Error('NOT_LOGGED_IN');
  const token = await user.getIdToken();

  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'AI_REQUEST_FAILED');
  }
  return data;
};

export const searchStandards = async (
  query: string,
  gradeFilter?: string,
  subjectFilter?: string,
  imageData?: string, // Base64 string
  excludeCodes?: string[]
): Promise<Standard[]> => {
  const data = await callGemini({
    action: 'search',
    query,
    gradeFilter,
    subjectFilter,
    imageData,
    excludeCodes
  });
  return Array.isArray(data.results) ? data.results : [];
};

export const explainStandardMatch = async (standard: Standard, query: string): Promise<string> => {
  try {
    const data = await callGemini({
      action: 'explain',
      standardDescription: standard.description,
      query
    });
    return data.text || EXPLAIN_FALLBACK;
  } catch (e) {
    return EXPLAIN_FALLBACK;
  }
};

export const generateNarrativeSummary = async (records: LearningRecord[], studentName: string): Promise<string> => {
  try {
    const data = await callGemini({
      action: 'narrative',
      studentName,
      records: records.map(r => ({
        activityDescription: r.activityDescription,
        standardCode: r.standardCode,
        standardSubject: r.standardSubject
      }))
    });
    return data.text || 'The student has demonstrated significant progress across multiple subjects through various hands-on learning activities.';
  } catch (e) {
    return 'Progress report generation failed. Please try again later.';
  }
};

// Same plain-language explanation as explainStandardMatch, for a whole list of standards in one request.
export const explainStandards = async (standards: Standard[], query: string): Promise<string[]> => {
  try {
    const data = await callGemini({
      action: 'explainMany',
      descriptions: standards.map(s => s.description),
      query
    });
    const texts: string[] = Array.isArray(data.texts) ? data.texts : [];
    return standards.map((_, i) => texts[i] || EXPLAIN_FALLBACK);
  } catch (e) {
    const msg = String((e as any)?.message || '');
    if (msg === 'DAILY_LIMIT_REACHED' || msg === 'RATE_LIMITED') throw e;
    return standards.map(() => EXPLAIN_FALLBACK);
  }
};

export interface WorkPageContent {
  journalPrompt: string;
  organizerTitle: string;
  organizerLabels: string[];
  organizerCenter: string;
  recommended: 'journal' | 'organizer';
}

// Plain wording used if the AI cannot write the page text, so a page can always be made.
export const fallbackWorkPage = (subject: string): WorkPageContent => ({
  journalPrompt: 'Tell about what you did and what you learned during this activity.',
  organizerTitle: `Show what you learned about ${subject || 'this activity'}.`,
  organizerLabels: ['Part 1', 'Part 2', 'Part 3'],
  organizerCenter: 'My activity',
  recommended: 'journal'
});

export const generateWorkPageContent = async (args: {
  grade: string;
  subject: string;
  activity: string;
  hook: string;
  standardDescription: string;
}): Promise<WorkPageContent> => {
  try {
    const data = await callGemini({ action: 'workpage', ...args });
    const c = data.content;
    if (c && Array.isArray(c.organizerLabels) && c.organizerLabels.length === 3 && c.journalPrompt) {
      return c as WorkPageContent;
    }
  } catch (e) {
    const msg = String((e as any)?.message || '');
    if (msg === 'DAILY_LIMIT_REACHED' || msg === 'RATE_LIMITED') throw e;
  }
  return fallbackWorkPage(args.subject);
};
