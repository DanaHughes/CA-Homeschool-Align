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
