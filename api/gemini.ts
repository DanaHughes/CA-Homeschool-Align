/**
 * Server-side Gemini endpoint for Homeschool Work Sample Pro.
 *
 * The Gemini API key lives ONLY here (server environment variable API_KEY).
 * It is never sent to the browser. The browser calls this endpoint instead,
 * with its Firebase login token, and this endpoint calls Gemini.
 *
 * Required environment variable (set on Cloud Run, NOT at build time):
 *   API_KEY - your Gemini API key
 *
 * Optional:
 *   FIREBASE_API_KEY - the public Firebase web key, used to check login tokens
 *
 * The client POSTs { action: 'search' | 'explain' | 'narrative', ... } with the
 * header "Authorization: Bearer <firebase id token>".
 */

import { GoogleGenAI, Type } from '@google/genai';

const MODEL_NAME = 'gemini-3-flash-preview';

// This web key is public by design (it is also in firebase.ts). It is only used
// to ask Firebase "is this login token real?".
const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY || 'AIzaSyDLFt3NNimFoZTQIaB2UOCSkfmQbaonN-c';

const DAILY_LIMIT = 2000;
const PER_USER_HOURLY_LIMIT = 120;

const SEARCH_SYSTEM_INSTRUCTION = `
You are the "Homeschool Work Sample Pro" expert. Use ONLY current CA State Standards (CCSS, NGSS, HSS).
Find the absolute best 4-6 matches for the described activity or visual evidence.

CRITICAL:
1. Only search within the provided Target Grades and Target Subjects.
2. Return the results as a clean JSON array.
3. Keep descriptions professional and verbatim from CA frameworks.
4. Accuracy is priority.
5. EXCLUSION RULE: If a list of "Excluded Codes" is provided, do NOT return those specific standards. Find alternative standards that also align with the activity to help the parent cover new ground.
`;

const EXPLAINER_SYSTEM_INSTRUCTION = `
You are a practical CA Homeschool Parent Mentor. Explain how an activity meets a standard.
Think like a parent at a playground, not a teacher at a desk.

RULES:
1. NEVER mention standard numbers, codes, or framework names (CCSS/NGSS).
2. BAN ALL ACADEMIC JARGON.
3. USE THIS EXACT PATTERN: "[Specific Context], students can [Practical Action] by [Simple Example]."
4. Return ONLY the plain text. 1 warm, simple sentence max.
`;

const NARRATIVE_SYSTEM_INSTRUCTION = `
You are a Professional CA Charter School Educational Specialist.
Your job is to take a list of activities and standards and write a professional, cohesive "Narrative Summary" for a monthly progress report.
The tone should be academic yet warm, highlighting progress across multiple subjects.
Keep it to 2-3 short, impactful paragraphs.
Do not use bullet points.
Focus on the 'Learning Journey'.
`;

const EXPLAIN_FALLBACK =
  'During this activity, students can build key academic skills through hands-on learning.';

// Simple in-memory counters. They reset when the server restarts or scales to a
// new instance, which is fine as a safety net for a small app.
const userHits = new Map<string, number[]>();
let dayKey = '';
let dayCount = 0;

const str = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.slice(0, max) : '';

async function verifyFirebaseToken(idToken: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      }
    );
    if (!r.ok) return null;
    const data: any = await r.json();
    return data?.users?.[0]?.localId || null;
  } catch {
    return null;
  }
}

function checkLimits(uid: string): 'ok' | 'user' | 'daily' {
  const today = new Date().toISOString().split('T')[0];
  if (dayKey !== today) {
    dayKey = today;
    dayCount = 0;
  }
  if (dayCount >= DAILY_LIMIT) return 'daily';

  const now = Date.now();
  const recent = (userHits.get(uid) || []).filter(t => now - t < 3600_000);
  if (recent.length >= PER_USER_HOURLY_LIMIT) {
    userHits.set(uid, recent);
    return 'user';
  }
  recent.push(now);
  userHits.set(uid, recent);
  dayCount += 1;
  return 'ok';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error('[Gemini] Missing API_KEY environment variable');
    return res.status(500).json({ error: 'AI service is not configured on the server.' });
  }

  // 1. Only signed-in users may use the AI.
  const authHeader = String(req.headers.authorization || '');
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const uid = idToken ? await verifyFirebaseToken(idToken) : null;
  if (!uid) {
    return res.status(401).json({ error: 'Please log in again.' });
  }

  // 2. Safety limits.
  const limit = checkLimits(uid);
  if (limit === 'daily') {
    return res.status(429).json({ error: 'DAILY_LIMIT_REACHED' });
  }
  if (limit === 'user') {
    return res.status(429).json({ error: 'RATE_LIMITED' });
  }

  const body = req.body || {};
  const ai = new GoogleGenAI({ apiKey });

  try {
    if (body.action === 'search') {
      const query = str(body.query, 2000);
      const gradeFilter = str(body.gradeFilter, 100);
      const subjectFilter = str(body.subjectFilter, 100);
      const excludeCodes: string[] = Array.isArray(body.excludeCodes)
        ? body.excludeCodes.slice(0, 500).map((c: unknown) => str(c, 40)).filter(Boolean)
        : [];
      const imageData = str(body.imageData, 10_000_000);

      const exclusionText = excludeCodes.length > 0
        ? `\nCRITICAL EXCLUSION: Do not return any of these already-matched standards: ${excludeCodes.join(', ')}.`
        : '';

      const parts: any[] = [{
        text: `
     Activity Description: "${query || 'Visual evidence provided'}"
     Target Grades: ${gradeFilter || 'Any'}
     Target Subject: ${subjectFilter || 'All Subjects'}
     Task: Find 4-6 CA Standards matching this activity. Focus on the grades: ${gradeFilter}.${exclusionText}
   `
      }];
      if (imageData) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageData } });
      }

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ parts }],
        config: {
          systemInstruction: SEARCH_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                code: { type: Type.STRING },
                description: { type: Type.STRING },
                subject: { type: Type.STRING },
                gradeLevel: { type: Type.STRING },
                framework: { type: Type.STRING }
              },
              required: ['code', 'description', 'subject', 'gradeLevel', 'framework']
            }
          }
        }
      });

      const text = response.text;
      if (!text || text.trim() === '') return res.status(200).json({ results: [] });
      const results = JSON.parse(text);
      return res.status(200).json({ results: Array.isArray(results) ? results : [] });
    }

    if (body.action === 'explain') {
      const description = str(body.standardDescription, 2000);
      const query = str(body.query, 2000);
      const prompt = `
 Activity: "${query}"
 Standard: ${description}
  Format: "[Context], students can [Action] by [Method]."
 No jargon. No codes.`;
      try {
        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: [{ parts: [{ text: prompt }] }],
          config: { systemInstruction: EXPLAINER_SYSTEM_INSTRUCTION }
        });
        return res.status(200).json({ text: response.text?.trim() || EXPLAIN_FALLBACK });
      } catch (e) {
        console.error('[Gemini] explain error:', e);
        return res.status(200).json({ text: EXPLAIN_FALLBACK });
      }
    }

    if (body.action === 'narrative') {
      const studentName = str(body.studentName, 200);
      const records: any[] = Array.isArray(body.records) ? body.records.slice(0, 300) : [];
      const recordContext = records
        .map(r => `- Activity: ${str(r?.activityDescription, 500)} | Standard: ${str(r?.standardCode, 40)} (${str(r?.standardSubject, 40)})`)
        .join('\n');
      const prompt = `
 Student Name: ${studentName}
 Records for this period:
 ${recordContext}
  Please generate a cohesive Narrative Progress Summary based on these activities.
 `;
      try {
        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: [{ parts: [{ text: prompt }] }],
          config: { systemInstruction: NARRATIVE_SYSTEM_INSTRUCTION }
        });
        return res.status(200).json({
          text: response.text?.trim() ||
            'The student has demonstrated significant progress across multiple subjects through various hands-on learning activities.'
        });
      } catch (e) {
        console.error('[Gemini] narrative error:', e);
        return res.status(200).json({ text: 'Progress report generation failed. Please try again later.' });
      }
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error: any) {
    console.error('[Gemini] Error:', error);
    return res.status(500).json({ error: 'The AI service had a problem. Please try again.' });
  }
}
