// Keeps a work sample "in progress" safe. Everything the family has done on the Generate screen is
// saved in this browser as they go (nothing is sent anywhere), and put back when they return, so a
// stray click on another tab, a refresh, or a closed window does not lose the page.
// One draft per signed-in account. Drafts older than 14 days are ignored, photos and drawings are dropped after 24 hours,
// and the draft is cleared when the family logs out (a shared computer must not keep a child's photo).

const KEY = (userId: string) => `ws_draft_v1_${userId}`;
const MAX_AGE_MS = 14 * 86_400_000;

export interface WorkSampleDraft {
  savedAt: number;
  step: 1 | 2 | 3;
  studentId: string;
  grade: string;
  subject: string;
  query: string;
  photo: string | null;
  onlyUnmet: boolean;
  options: any[];
  activity: string;
  chosen: any | null;
  content: any | null;
  design: string;
  fields: { name: string; date: string; lp: string; subject: string; grade: string; standards: string; how: string };
  showLp: boolean;
  writing: string;
  boxes: string[];
  extraPages: string[];
  drawing: string | null;
  textScale: number;
  saved: boolean;
  generationId?: string | null; // the History entry this work belongs to
}

export const loadDraft = (userId: string): WorkSampleDraft | null => {
  try {
    const raw = localStorage.getItem(KEY(userId));
    if (!raw) return null;
    const d = JSON.parse(raw) as WorkSampleDraft;
    if (!d || typeof d.savedAt !== 'number' || Date.now() - d.savedAt > MAX_AGE_MS) return null;
    if (d.step !== 2 && d.step !== 3) return null;
    // Privacy: a photo or drawing kept in the browser is dropped after 24 hours (the words are kept longer).
    if (Date.now() - d.savedAt > 86_400_000) return { ...d, photo: null, drawing: null };
    return d;
  } catch {
    return null;
  }
};

// If the browser's storage is full (big photo plus a drawing), keep the words and drop the drawing, then the photo.
export const saveDraft = (userId: string, draft: Omit<WorkSampleDraft, 'savedAt'>): void => {
  const attempts: Omit<WorkSampleDraft, 'savedAt'>[] = [draft, { ...draft, drawing: null }, { ...draft, drawing: null, photo: null }];
  for (const a of attempts) {
    try {
      localStorage.setItem(KEY(userId), JSON.stringify({ ...a, savedAt: Date.now() }));
      return;
    } catch {
      // try the smaller version
    }
  }
};

export const clearDraft = (userId: string): void => {
  try {
    localStorage.removeItem(KEY(userId));
  } catch {
    // nothing to do
  }
};
