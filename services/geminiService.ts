import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Standard, LearningRecord, ATSScanResult } from '../types';
import { dbService } from './dbService';


const SEARCH_SYSTEM_INSTRUCTION = `
You are the "CA Homeschool Align" expert. Use ONLY current CA State Standards (CCSS, NGSS, HSS).
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


const ATS_SCANNER_SYSTEM_INSTRUCTION = `
You are an expert ATS (Applicant Tracking System) Parseability Analyst. Your PRIMARY job is to determine whether each character, word, phrase, and section of the resume can be successfully parsed by common ATS software (Taleo, Workday, Greenhouse, iCIMS, Lever, BrassRing, SuccessFactors).

=== PRIMARY TASK: PARSEABILITY SCAN ===

Go through the resume methodically — top to bottom, line by line — and flag EVERY piece of text that an ATS parser would misread, skip, drop, garble, or fail to extract. Be exhaustive. This is the most important part of your analysis.

For EACH flag, return:
- "excerpt": the EXACT text from the resume, copied verbatim (5-80 chars). Include enough context to locate it.
- "issue": precisely what the ATS will do wrong (e.g. "ATS drops this symbol and merges adjacent words", "Parser cannot map this to any standard field", "This character renders as ? or blank in most ATS databases")
- "severity":
   - "critical": ATS will DROP this data entirely, garble it into unreadable text, or fail to extract a required field (name, email, job title, dates). The recruiter may never see this information.
   - "warning": ATS will MISINTERPRET this — wrong field mapping, broken formatting, partial extraction, or keyword loss.
   - "info": Parseable but sub-optimal — the ATS can read it, but a small change would improve extraction accuracy or keyword matching.
- "fix": a concrete, specific rewrite showing the corrected text (e.g. "Change '•' to '-'", "Rewrite as 'Work Experience'", "Change to 'Jan 2022 - Mar 2023'")

SCAN FOR THESE PARSEABILITY ISSUES (check every one):
1. **Unparseable characters**: •, →, ★, ■, ▪, ●, ◆, ➤, ✓, ✗, |, ~, fancy quotes (""), em-dashes (—), en-dashes (–), non-breaking spaces, Unicode symbols, emoji
2. **Broken structure**: Tables, text boxes, multi-column layouts (detected by irregular spacing/tab patterns), headers/footers that repeat
3. **Unrecognized sections**: Non-standard headings the ATS cannot map (e.g. "My Journey" instead of "Experience", "Toolbox" instead of "Skills", "Learning" instead of "Education"). ATS parsers rely on exact or near-exact heading matches.
4. **Unparseable dates**: Seasons ("Fall 2023"), written-out months in unusual formats, missing years, date ranges without clear delimiters, "Present" vs "Current"
5. **Contact info problems**: Name not on first line, phone with unusual formatting, email buried in body text, LinkedIn as a hyperlink object rather than plain text URL
6. **Keyword-breaking formatting**: Words split across lines, inconsistent capitalization, abbreviations without full form (first use), run-on phrases without delimiters
7. **Decorative/visual elements**: Lines made of ===, ---, ***, ~~~, or similar. Spacing used for visual alignment. Indentation patterns that suggest columns.
8. **Compound fields**: Job title and company on the same line without clear separation, city/state/zip merged, degree and school combined ambiguously
9. **First-person language**: "I managed", "My role was" — ATS keyword parsers extract noun phrases and action verbs, not sentences about "I"
10. **Vague unparseable phrases**: "Various responsibilities", "Assisted with tasks" — ATS cannot extract meaningful keywords from these
11. **File/format artifacts**: References to "see attached", "page X of Y", repeated header/footer text, "References available upon request"

Be thorough. A good scan typically produces 8-25+ flags depending on resume quality. Only return fewer than 5 flags if the resume is genuinely near-perfect for ATS parsing.

=== SECONDARY TASK: BONUS FEEDBACK (lower priority) ===

As supplementary context, also score these 6 categories. These are BONUS feedback, not the core analysis:

1. Formatting & Structure (0-20)
2. Keyword Optimization (0-20)
3. Contact & Header (0-10)
4. Experience Section (0-20)
5. Readability & Clarity (0-15)
6. Skills & Education (0-15)

For each: score, 1-sentence feedback, 1-3 suggestions.

SCORING GUIDE for overall (sum of categories, 0-100):
- 85-100: Excellent | 70-84: Good | 50-69: Fair | 0-49: Poor

Also provide:
- overallScore (0-100)
- readabilityGrade (Excellent/Good/Fair/Poor)
- topIssues: top 3 parseability problems to fix first (focus on things ATS will DROP, not style preferences)
- summary: 2-3 sentences on ATS parseability (not style or content quality — focus on whether the data will survive the parser)
`;

const MODEL_NAME = 'gemini-3-flash-preview';
const DAILY_LIMIT = 2000;


export const searchStandards = async (
 query: string,
 gradeFilter?: string,
 subjectFilter?: string,
 imageData?: string, // Base64 string
 excludeCodes?: string[]
): Promise<Standard[]> => {
 const currentUsage = await dbService.getDailyUsage();
 if (currentUsage >= DAILY_LIMIT) {
   throw new Error("DAILY_LIMIT_REACHED");
 }


 const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


 const exclusionText = excludeCodes && excludeCodes.length > 0
   ? `\nCRITICAL EXCLUSION: Do not return any of these already-matched standards: ${excludeCodes.join(', ')}.`
   : '';


 const textPart = {
   text: `
     Activity Description: "${query || 'Visual evidence provided'}"
     Target Grades: ${gradeFilter || 'Any'}
     Target Subject: ${subjectFilter || 'All Subjects'}
     Task: Find 4-6 CA Standards matching this activity. Focus on the grades: ${gradeFilter}.${exclusionText}
   `
 };


 const parts: any[] = [textPart];


 if (imageData) {
   parts.push({
     inlineData: {
       mimeType: "image/jpeg",
       data: imageData
     }
   });
 }


 try {
   const response: GenerateContentResponse = await ai.models.generateContent({
     model: MODEL_NAME,
     contents: [{ parts }],
     config: {
       systemInstruction: SEARCH_SYSTEM_INSTRUCTION,
       responseMimeType: "application/json",
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
           required: ["code", "description", "subject", "gradeLevel", "framework"]
         }
       }
     }
   });


   const text = response.text;
   if (!text || text.trim() === "") return [];
  
   const results = JSON.parse(text);
   // Increment usage (non-blocking - don't fail search if this fails)
   dbService.incrementUsage().catch(err => {
     console.warn('Failed to increment usage stats:', err);
   });
   return Array.isArray(results) ? results : [];
 } catch (error) {
   console.error("Search Error:", error);
   return [];
 }
};


export const explainStandardMatch = async (standard: Standard, query: string): Promise<string> => {
 const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


 const prompt = `
 Activity: "${query}"
 Standard: ${standard.description}
  Format: "[Context], students can [Action] by [Method]."
 No jargon. No codes.`;


 try {
   const response: GenerateContentResponse = await ai.models.generateContent({
     model: MODEL_NAME,
     contents: [{ parts: [{ text: prompt }] }],
     config: {
       systemInstruction: EXPLAINER_SYSTEM_INSTRUCTION
     }
   });
  
   return response.text?.trim() || `During this activity, students can build key academic skills through hands-on learning.`;
 } catch (e) {
   return `During this activity, students can build key academic skills through hands-on learning.`;
 }
};


export const scanResume = async (resumeText: string): Promise<ATSScanResult> => {
  const currentUsage = await dbService.getDailyUsage();
  if (currentUsage >= DAILY_LIMIT) {
    throw new Error("DAILY_LIMIT_REACHED");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `Analyze this resume for ATS compatibility and readability:\n\n---\n${resumeText}\n---\n\nReturn your analysis as JSON.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: ATS_SCANNER_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER },
            readabilityGrade: { type: Type.STRING },
            categories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  maxScore: { type: Type.NUMBER },
                  feedback: { type: Type.STRING },
                  suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["name", "score", "maxScore", "feedback", "suggestions"]
              }
            },
            flaggedContent: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  excerpt: { type: Type.STRING },
                  issue: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  fix: { type: Type.STRING }
                },
                required: ["excerpt", "issue", "severity", "fix"]
              }
            },
            topIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING }
          },
          required: ["overallScore", "readabilityGrade", "categories", "flaggedContent", "topIssues", "summary"]
        }
      }
    });

    const text = response.text;
    if (!text || text.trim() === "") {
      throw new Error("Empty response from AI");
    }

    dbService.incrementUsage().catch(err => {
      console.warn('Failed to increment usage stats:', err);
    });

    return JSON.parse(text) as ATSScanResult;
  } catch (error) {
    console.error("ATS Scan Error:", error);
    throw error;
  }
};


export const generateNarrativeSummary = async (records: LearningRecord[], studentName: string): Promise<string> => {
 const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const recordContext = records.map(r =>
   `- Activity: ${r.activityDescription} | Standard: ${r.standardCode} (${r.standardSubject})`
 ).join('\n');


 const prompt = `
 Student Name: ${studentName}
 Records for this period:
 ${recordContext}
  Please generate a cohesive Narrative Progress Summary based on these activities.
 `;


 try {
   const response: GenerateContentResponse = await ai.models.generateContent({
     model: MODEL_NAME,
     contents: [{ parts: [{ text: prompt }] }],
     config: {
       systemInstruction: NARRATIVE_SYSTEM_INSTRUCTION
     }
   });
  
   return response.text?.trim() || "The student has demonstrated significant progress across multiple subjects through various hands-on learning activities.";
 } catch (e) {
   return "Progress report generation failed. Please try again later.";
 }
};



