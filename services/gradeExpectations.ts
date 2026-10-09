// Grade-by-grade writing expectations supplied by Dana (2026-10-08).
// These are the plain instructions printed in the "How to complete this page" box.
// They never use level words such as "approaching", "above" or "on grade level".
// The server also reads them to pitch the writing prompt at the right grade.

export const GRADE_CHOICES = ['TK', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const WRITING: Record<string, string> = {
  TK: 'Draw a picture. Write a few letters or a word.',
  K: 'Write one complete idea or sentence. A grown-up may help. Use lowercase letters and spaces between words.',
  '1': 'Write 1 to 6 sentences. Start with a capital letter, end with a period, and try and, but, or because.',
  '2': 'Write a short paragraph of 5 to 6 sentences. Tell who, what, where, when and why.',
  '3': 'Write one paragraph of 5 to 8 sentences with a topic sentence, details and a closing sentence.',
  '4': 'Write 2 or more paragraphs: an introduction, two or more reasons or details, and a conclusion.',
  '5': 'Write a multi-paragraph response with a clear main idea, evidence and a conclusion.',
  '6': 'Write 3 to 5 paragraphs of 5 to 7 sentences each, with a clear thesis and supporting evidence.',
  '7': 'Write 4 to 5 paragraphs of 6 to 8 sentences each. Analyze your evidence and address another point of view.',
  '8': 'Write a full 5-paragraph response or longer with a cohesive argument, transitions and sources.'
};

// Grades 9 to 12 were not in Dana's list, so they use the grade 8 line until she says otherwise.
export const writingExpectation = (grade: string): string => WRITING[grade] || WRITING['8'];

export const isYoungGrade = (grade: string): boolean => ['TK', 'K', '1', '2'].includes(grade);

export const needsContinuationPage = (grade: string): boolean =>
  !['TK', 'K', '1', '2', '3'].includes(grade);

export type PageDesign = 'journal' | 'organizer';

export const guideFor = (design: PageDesign, grade: string): string => {
  if (design === 'organizer') {
    return grade === 'TK' || grade === 'K'
      ? 'Draw a picture in each box to show what you learned. Add a letter or a word if you can.'
      : 'Show what you learned in each box. Draw a picture, write a sentence, or write several sentences.';
  }
  return writingExpectation(grade);
};
