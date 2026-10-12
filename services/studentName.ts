// Student privacy (Dana, 2026-10-12): the app only stores a student's FIRST NAME and LAST INITIAL, like "Maya R.".
// A first name alone is fine too. Full last names are not accepted.

export type NameCheck = { ok: true; name: string } | { ok: false; message: string };

const MESSAGE = 'To protect your child\'s privacy, please use a first name and a last initial only, like Maya R. (a first name alone is fine too).';

export const checkStudentName = (raw: string): NameCheck => {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, message: 'Please enter a name.' };

  const words = text.split(' ');
  if (words.length > 2) return { ok: false, message: MESSAGE };

  // First name: letters, apostrophes and hyphens only (no digits, no email addresses, no dots).
  const first = words[0];
  if (!/^[\p{L}][\p{L}'’-]{0,19}$/u.test(first)) return { ok: false, message: MESSAGE };

  let name = first.charAt(0).toLocaleUpperCase() + first.slice(1);
  if (words.length === 2) {
    // The second word must be a single letter, with or without a period.
    const initial = words[1];
    if (!/^[\p{L}]\.?$/u.test(initial)) return { ok: false, message: MESSAGE };
    name += ' ' + initial.charAt(0).toLocaleUpperCase() + '.';
  }
  return { ok: true, name };
};
