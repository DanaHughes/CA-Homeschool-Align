// Generation history: every work sample the family generates is saved automatically in their account
// (Firestore collection "generations", private to the family), so nothing is ever lost and a work sample
// can be added to a student's Vault later, if the family decides to.
// Photos and drawings are NOT saved here (that is a later decision: it needs storage); the words are.
import type { WorkSampleDraft } from './workSampleDraft';

export interface GenerationRecord {
  id?: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  grade: string;
  subject: string;
  activity: string;
  studentId: string; // the student picked on screen 1 (a suggestion for later); '' if none
  options: any[]; // [{ standard, hook }]
  chosen: any | null;
  content: any | null;
  design: string;
  fields: WorkSampleDraft['fields'] | null;
  showLp: boolean;
  writing: string;
  boxes: string[];
  extraPages: string[];
  textScale: number;
  vaultStudentId?: string; // set when added to a student's Vault
  vaultAt?: number;
}

const EMPTY_FIELDS = { name: '', date: '', lp: '', subject: '', grade: '', standards: '', how: '' };

// Firestore does not accept "undefined", so drop it.
export const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const cap = (s: unknown, n: number): string => (typeof s === 'string' ? s.slice(0, n) : '');

// The parts that change as the family works on the page.
export const progressPatch = (d: Omit<WorkSampleDraft, 'savedAt'>) =>
  clean({
    studentId: d.studentId,
    chosen: d.chosen,
    content: d.content,
    design: d.design,
    fields: d.step === 3 ? d.fields : null,
    showLp: d.showLp,
    writing: cap(d.writing, 20000),
    boxes: (d.boxes || []).map(b => cap(b, 5000)),
    extraPages: (d.extraPages || []).map(p => cap(p, 20000)),
    textScale: d.textScale,
    updatedAt: Date.now()
  });

export const newGeneration = (
  userId: string,
  v: { grade: string; subject: string; activity: string; studentId: string; options: any[] }
): GenerationRecord =>
  clean({
    userId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    grade: v.grade,
    subject: v.subject,
    activity: cap(v.activity, 2000),
    studentId: v.studentId || '',
    options: v.options,
    chosen: null,
    content: null,
    design: 'journal',
    fields: null,
    showLp: false,
    writing: '',
    boxes: ['', '', ''],
    extraPages: [],
    textScale: 100
  });

// Puts a saved generation back on the Generate screen (through the same "work in progress" saving).
export const generationToDraft = (g: GenerationRecord): Omit<WorkSampleDraft, 'savedAt'> & { generationId: string } => {
  const onPage = !!(g.chosen && g.content);
  return {
    generationId: g.id || '',
    step: onPage ? 3 : 2,
    studentId: g.studentId || '',
    grade: g.grade,
    subject: g.subject,
    query: g.activity === 'Uploaded evidence' ? '' : g.activity,
    photo: null,
    onlyUnmet: false,
    options: g.options || [],
    activity: g.activity,
    chosen: g.chosen || null,
    content: g.content || null,
    design: g.design || 'journal',
    fields: g.fields || EMPTY_FIELDS,
    showLp: !!g.showLp,
    writing: g.writing || '',
    boxes: g.boxes && g.boxes.length === 3 ? g.boxes : ['', '', ''],
    extraPages: g.extraPages || [],
    drawing: null,
    textScale: g.textScale || 100,
    saved: !!g.vaultAt
  };
};
