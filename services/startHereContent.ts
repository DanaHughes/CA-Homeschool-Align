// The Start Here page: the "How to use" steps and the questions and answers. Dana can edit, add,
// delete and reorder them in the Admin tab ("FAQs & Steps"). Saved in the database (settings/startHere).
// If nothing is saved, these original words are used.
// In any text: **double stars** make bold, and [words](https://address) make a link.

import { BLUEPRINT_URL } from './siteText';

export interface StartStep { title: string; body: string }
export interface StartFaq { q: string; a: string }
export interface StartHereContent { steps: StartStep[]; faqs: StartFaq[] }

export const DEFAULT_START_HERE: StartHereContent = {
  steps: [
    { title: 'Enter your activity', body: 'Enter a photo or key words representing the real life learning activity your child completed. Choose the grade and subject, then add a photo or type a few words about what your child did.' },
    { title: 'Choose a work sample option', body: 'Choose a work sample option that is the best fit for your child from the generated learning artifacts instantly created just for you.' },
    { title: 'Provide activity feedback', body: 'Your child will provide brief proof of knowledge based on the activity they completed. You may choose to include a brief reflection, drawing what they learned, or answering questions about what they learned in their work sample generation.' },
    { title: 'Send it', body: 'Print it, download the PDF, or use "Email or share" to send it to your charter teacher.' }
  ],
  faqs: [
    {
      q: 'Can I add a picture to the work sample?',
      a: 'You may choose to use the photo you uploaded of the activity within the work sample generation, choose a different one from your device or phone, or let your child draw or annotate in the box. You can also print the page so your child can color in the box by hand.'
    },
    {
      q: 'Is my student data private?',
      a: 'Yes. All student data is stored in your private, encrypted account vault. We do not sell or share student identifiers with third parties, districts, or government agencies. Your data is for your exclusive record-keeping use only. Zero-reporting guarantee active.'
    },
    {
      q: 'How do I turn this into charter-approved work samples?',
      a: `The work sample options provided by this tool are a starting point. To create charter-compliant work samples, check out our comprehensive Charter Homeschool Blueprint: [The Charter Homeschool Blueprint](${BLUEPRINT_URL}). This guide shows you how to document learning in formats your charter will accept.`
    }
  ]
};

export const LIMITS = { title: 80, body: 1200, q: 200, a: 2000, steps: 8, faqs: 30 };

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Reads what was saved. Anything missing or broken falls back to the original words.
export const mergeStartHere = (saved: unknown): StartHereContent => {
  const result: StartHereContent = { steps: DEFAULT_START_HERE.steps, faqs: DEFAULT_START_HERE.faqs };
  if (!saved || typeof saved !== 'object') return result;
  const s = saved as Record<string, unknown>;

  if (Array.isArray(s.steps)) {
    const steps = s.steps
      .map((x: any) => ({ title: clean(x?.title, LIMITS.title), body: clean(x?.body, LIMITS.body) }))
      .filter(x => x.title || x.body)
      .slice(0, LIMITS.steps);
    if (steps.length) result.steps = steps;
  }
  if (Array.isArray(s.faqs)) {
    // An empty saved list is allowed on purpose (Dana may delete every question).
    result.faqs = s.faqs
      .map((x: any) => ({ q: clean(x?.q, LIMITS.q), a: clean(x?.a, LIMITS.a) }))
      .filter(x => x.q || x.a)
      .slice(0, LIMITS.faqs);
  }
  return result;
};
