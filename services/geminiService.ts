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
You are an expert ATS (Applicant Tracking System) Resume Analyst. Analyze the provided resume text and evaluate it across these categories:

1. **Formatting & Structure** (0-20): Clean sections, consistent formatting, proper headings (Experience, Education, Skills), no tables/columns/graphics that ATS can't parse.
2. **Keyword Optimization** (0-20): Relevant industry keywords, action verbs, measurable achievements, skills alignment with common job descriptions.
3. **Contact & Header** (0-10): Name, email, phone, LinkedIn, location present and properly formatted at the top.
4. **Experience Section** (0-20): Reverse chronological order, quantified achievements, action verbs, clear job titles and company names, dates included.
5. **Readability & Clarity** (0-15): Concise bullet points, no jargon overload, consistent tense, no spelling/grammar issues, appropriate length.
6. **Skills & Education** (0-15): Relevant skills section, education properly listed, certifications included, no outdated/irrelevant entries.

SCORING GUIDE:
- 85-100: Excellent - Resume is highly ATS-optimized
- 70-84: Good - Minor improvements needed
- 50-69: Fair - Several areas need attention
- 0-49: Poor - Major overhaul recommended

For each category, provide:
- A score
- Brief feedback (1 sentence)
- 1-3 specific, actionable suggestions

CRITICAL — FLAGGED CONTENT DETECTION:
Scan the resume line by line and flag every specific piece of text that a typical ATS parser (Taleo, Workday, Greenhouse, iCIMS, Lever) would misread, skip, or fail to parse. For each flag, return:
- "excerpt": the EXACT text from the resume (copy verbatim, 5-80 characters)
- "issue": what the ATS will do wrong with it (e.g. "ATS will ignore this symbol", "Column layout causes text to merge into gibberish", "Non-standard header — ATS won't recognize this section")
- "severity": "critical" (ATS will drop or garble this data), "warning" (ATS may misinterpret), or "info" (sub-optimal but parseable)
- "fix": a concrete rewrite or action (e.g. "Replace '•' with '-'", "Rename to 'Work Experience'")

Common ATS-unreadable patterns to flag:
- Special characters and symbols (•, →, ★, ■, |, fancy dashes —, em-dashes)
- Non-standard section headings (e.g. "Where I've Worked" instead of "Experience")
- Tables, multi-column layouts (detected by irregular spacing/alignment)
- Dates in non-standard formats (e.g. "Fall 2023" instead of "Sep 2023")
- Missing critical sections (no Experience, Education, or Skills header)
- Acronyms/abbreviations without full form on first use
- URLs that aren't plain text
- All-caps paragraphs (harder to parse than mixed case)
- Excessive formatting markers or decorative lines (===, ---, ***)
- Pronouns and first-person narrative (ATS keyword parsers work better with direct phrases)
- Vague phrases with no measurable outcome (e.g. "Responsible for various tasks")

Return ALL flags found. If the resume is very clean, return at least any info-level optimizations. An empty flaggedContent array is acceptable only for a near-perfect resume.

Also provide:
- An overall score (sum of categories, 0-100)
- A readabilityGrade (Excellent/Good/Fair/Poor based on scoring guide)
- Top 3 most critical issues to fix first
- A 2-3 sentence summary of the resume's ATS readiness
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



