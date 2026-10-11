/**
 * Promo codes (free months of Pro). All of this runs on the SERVER, so a family cannot change it.
 *
 * - Dana makes a code in the Admin tab: how many months it gives, how many families may use it, and a note.
 * - A family types the code in the app. The server checks it, counts the use, and sets
 *   users/{uid}.proUntil to "now + months" (or adds on top if they already have time left).
 * - Pro access from a code ends on its own when proUntil passes; nothing renews or charges.
 * - Each family can use a given code once. Who used which code is saved with the code.
 *
 * Database paths:  codes/{CODE}   and   codes/{CODE}/redemptions/{uid}
 */
import type { Store } from './entitlements.js';

export type CodeError =
  | 'BAD_INPUT'
  | 'USES_BELOW_USED'
  | 'CODE_EXISTS'
  | 'CODE_NOT_FOUND'
  | 'CODE_OFF'
  | 'CODE_RAN_OUT'
  | 'CODE_ALREADY_USED_BY_YOU';

export interface CodeWho {
  uid: string;
  email: string;
}

// "wsp 1234-abcd" and "WSP1234ABCD" are the same code.
export const normalizeCode = (raw: unknown): string => String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Letters and numbers that are easy to read aloud (no 0/O, 1/I/L).
const SAFE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// A random code like WSP-K7M2-9QXA. `rand` is injectable so tests are predictable.
export const generateCode = (rand: () => number = Math.random): string => {
  const pick = () => SAFE[Math.floor(rand() * SAFE.length)];
  const block = () => Array.from({ length: 4 }, pick).join('');
  return `WSP-${block()}-${block()}`;
};

// Adds whole calendar months (6 months from Oct 11 is Apr 11).
export const addMonths = (ms: number, months: number): number => {
  const d = new Date(ms);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.getTime();
};

export interface NewCode {
  code?: string;
  months: number;
  maxUses: number;
  note?: string;
}

export const createCode = async (
  store: Store,
  input: NewCode,
  now: number,
  rand: () => number = Math.random
): Promise<{ ok: true; id: string; display: string } | { ok: false; error: CodeError }> => {
  const months = Math.floor(Number(input.months));
  const maxUses = Math.floor(Number(input.maxUses));
  if (!Number.isFinite(months) || months < 1 || months > 60) return { ok: false, error: 'BAD_INPUT' };
  if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 100000) return { ok: false, error: 'BAD_INPUT' };

  const custom = input.code ? normalizeCode(input.code) : '';
  if (input.code && (custom.length < 4 || custom.length > 24)) return { ok: false, error: 'BAD_INPUT' };

  for (let attempt = 0; attempt < 5; attempt++) {
    const display = custom ? String(input.code).trim().toUpperCase() : generateCode(rand);
    const id = normalizeCode(display);
    const made = await store.runTransaction(async tx => {
      if (await tx.get(`codes/${id}`)) return false;
      tx.set(`codes/${id}`, {
        code: display,
        months,
        maxUses,
        uses: 0,
        active: true,
        note: String(input.note || '').slice(0, 200),
        createdAt: now
      });
      return true;
    });
    if (made) return { ok: true, id, display };
    if (custom) return { ok: false, error: 'CODE_EXISTS' };
  }
  return { ok: false, error: 'CODE_EXISTS' };
};

export type RedeemResult =
  | { ok: true; proUntil: number; months: number }
  | { ok: false; error: CodeError };

export const redeemCode = async (store: Store, who: CodeWho, raw: unknown, now: number): Promise<RedeemResult> => {
  const id = normalizeCode(raw);
  if (id.length < 4 || id.length > 24) return { ok: false, error: 'CODE_NOT_FOUND' };

  return store.runTransaction(async tx => {
    const code = await tx.get(`codes/${id}`);
    if (!code) return { ok: false, error: 'CODE_NOT_FOUND' } as RedeemResult;
    if (code.active === false) return { ok: false, error: 'CODE_OFF' } as RedeemResult;

    const already = await tx.get(`codes/${id}/redemptions/${who.uid}`);
    if (already) return { ok: false, error: 'CODE_ALREADY_USED_BY_YOU' } as RedeemResult;
    if ((code.uses || 0) >= (code.maxUses || 0)) return { ok: false, error: 'CODE_RAN_OUT' } as RedeemResult;

    const user = (await tx.get(`users/${who.uid}`)) || {};
    const base = typeof user.proUntil === 'number' && user.proUntil > now ? user.proUntil : now;
    const proUntil = addMonths(base, code.months);

    tx.set(`users/${who.uid}`, { proUntil, accessCodeUsed: code.code }, true);
    tx.set(`codes/${id}`, { uses: (code.uses || 0) + 1 }, true);
    tx.set(`codes/${id}/redemptions/${who.uid}`, {
      uid: who.uid,
      email: who.email,
      name: user.name || '',
      at: now,
      proUntil
    });
    return { ok: true, proUntil, months: code.months } as RedeemResult;
  });
};

export interface CodePatch {
  months?: number;
  maxUses?: number;
  note?: string;
}

// Dana edits a code: free months, how many families may use it, and the note.
// Changing the months only affects families who use the code from now on; people who already
// used it keep the time they were given. The number of families can never go below how many already used it.
export const updateCode = async (
  store: Store,
  raw: unknown,
  patch: CodePatch
): Promise<{ ok: true } | { ok: false; error: CodeError; uses?: number }> => {
  const id = normalizeCode(raw);
  return store.runTransaction(async tx => {
    const code = await tx.get(`codes/${id}`);
    if (!code) return { ok: false, error: 'CODE_NOT_FOUND' } as const;
    const update: Record<string, unknown> = {};
    if (patch.months !== undefined) {
      const months = Math.floor(Number(patch.months));
      if (!Number.isFinite(months) || months < 1 || months > 60) return { ok: false, error: 'BAD_INPUT' } as const;
      update.months = months;
    }
    if (patch.maxUses !== undefined) {
      const maxUses = Math.floor(Number(patch.maxUses));
      if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 100000) return { ok: false, error: 'BAD_INPUT' } as const;
      if (maxUses < (code.uses || 0)) return { ok: false, error: 'USES_BELOW_USED', uses: code.uses || 0 } as const;
      update.maxUses = maxUses;
    }
    if (patch.note !== undefined) update.note = String(patch.note).slice(0, 200);
    tx.set(`codes/${id}`, update, true);
    return { ok: true } as const;
  });
};

// Words shown to the family (and to Dana) for each problem.
export const codeErrorMessage = (error: CodeError): string => {
  switch (error) {
    case 'CODE_NOT_FOUND': return 'That code was not found. Please check it and try again.';
    case 'CODE_OFF': return 'That code is no longer active.';
    case 'CODE_RAN_OUT': return 'I am sorry, that code has run out.';
    case 'CODE_ALREADY_USED_BY_YOU': return 'You have already used that code on this account.';
    case 'USES_BELOW_USED': return 'The number of families cannot be lower than the number who already used the code. To stop new families, use Turn off.';
    case 'CODE_EXISTS': return 'A code with that name already exists. Please pick a different one.';
    default: return 'Please check the number of months (1 to 60), the number of families (1 or more), and the code (4 to 24 letters or numbers).';
  }
};
