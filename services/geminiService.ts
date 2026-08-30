import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Standard, LearningRecord } from '../types';
import { dbService } from './dbService';


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



