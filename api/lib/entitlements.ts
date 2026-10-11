/**
 * Who may use the AI, and how much. All of this runs on the SERVER, where families cannot change it.
 *
 * Rules (Dana, 2026-10-11):
 *  - Paying families, families with an unexpired access code, and the complimentary accounts may generate.
 *  - Everyone else gets a free trial: 5 generations, available for 7 days. The 7 days start at the
 *    first generation. Whichever runs out first ends the trial.
 *  - A verified email is required for the trial. Throwaway-email sites are refused. One trial per real
 *    inbox (Gmail dots and +tags count as the same address).
 *  - A global daily cap on free generations is a hard ceiling on cost.
 *  - Paying and code users also have a daily and a monthly safety limit.
 *
 * The numbers can be changed by Dana in the Admin tab (database document settings/limits).
 */

export interface Limits {
  trialDays: number;
  trialGenerations: number;
  freeDailyCap: number;
  proDailyLimit: number;
  proMonthlyLimit: number;
  followupsPerGeneration: number;
  narrativeDailyLimit: number;
}

export const DEFAULT_LIMITS: Limits = {
  trialDays: 7,
  trialGenerations: 5,
  freeDailyCap: 40,
  proDailyLimit: 40,
  proMonthlyLimit: 400,
  followupsPerGeneration: 8,
  narrativeDailyLimit: 5
};

// Accounts that always have Pro for free (same list as the browser; the server needs its own copy).
export const COMPLIMENTARY_EMAILS = [
  'demo@cahomeschool.com',
  'dana2andrea@gmail.com',
  'thelearninglabhubinfo@gmail.com'
];

// Well-known throwaway inbox sites. Not complete (no list ever is), but it stops the lazy ones.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz',
  'sharklasers.com', 'grr.la', 'guerrillamailblock.com', 'pokemail.net', 'spam4.me',
  '10minutemail.com', '10minutemail.net', '10minutemail.org', '20minutemail.com', 'tempmail.com',
  'temp-mail.org', 'temp-mail.io', 'tempmail.net', 'tempmailo.com', 'tempail.com', 'tmpmail.org', 'tmpmail.net',
  'yopmail.com', 'yopmail.net', 'yopmail.fr', 'cool.fr.nf', 'jetable.org', 'nospam.ze.tc',
  'trashmail.com', 'trashmail.net', 'trashmail.de', 'trashmail.io', 'trash-mail.com', 'wegwerfmail.de',
  'getnada.com', 'nada.email', 'maildrop.cc', 'mailnesia.com', 'mailcatch.com', 'mailnull.com',
  'dispostable.com', 'fakeinbox.com', 'fakemailgenerator.com', 'throwawaymail.com', 'throwam.com',
  'mintemail.com', 'emailondeck.com', 'mohmal.com', 'moakt.com', 'spamgourmet.com', 'tempinbox.com',
  'burnermail.io', 'mytemp.email', 'inboxkitten.com', 'discard.email', 'discardmail.com', 'dropmail.me',
  'emailfake.com', 'fakemail.net', 'tempr.email', 'mailpoof.com', 'luxusmail.org', 'anonbox.net',
  'harakirimail.com', 'mail-temporaire.fr', 'e4ward.com', 'spambox.us', 'incognitomail.com', 'mailforspam.com',
  'tmail.ws', 'tmails.net', 'mail.tm', 'internxt.com', 'owlymail.com', 'emltmp.com', 'sute.jp', 'mailbox.in.ua'
]);

export const emailDomain = (email: string): string => (email.split('@')[1] || '').trim().toLowerCase();

export const isDisposableEmail = (email: string): boolean => {
  const domain = emailDomain(email);
  return DISPOSABLE_DOMAINS.has(domain);
};

// One real inbox = one key. For Gmail, dots and +tags are ignored: a.b+x@gmail.com is ab@gmail.com.
export const normalizeEmail = (email: string): string => {
  const lower = String(email || '').trim().toLowerCase();
  const at = lower.lastIndexOf('@');
  if (at < 1) return lower;
  let local = lower.slice(0, at);
  let domain = lower.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  local = local.split('+')[0];
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
};

// A safe document name for the email key (the database does not allow "/" in names).
export const emailKey = (email: string): string => normalizeEmail(email).replace(/[\/#?\[\]]/g, '_');

export const isComplimentary = (email: string): boolean => COMPLIMENTARY_EMAILS.includes(String(email || '').toLowerCase());

// ----- a tiny database interface, so the rules can be tested without the real database -----
export interface Tx {
  get(path: string): Promise<any | undefined>;
  set(path: string, data: Record<string, any>, merge?: boolean): void;
}
export interface Store {
  runTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

export interface Who {
  uid: string;
  email: string;
  emailVerified: boolean;
}

export type BlockCode =
  | 'EMAIL_NOT_VERIFIED'
  | 'DISPOSABLE_EMAIL'
  | 'TRIAL_ALREADY_USED'
  | 'TRIAL_ENDED'
  | 'TRIAL_USED_UP'
  | 'FREE_DAILY_CAP'
  | 'PRO_DAILY_LIMIT'
  | 'PRO_MONTHLY_LIMIT'
  | 'NO_ACTIVE_GENERATION'
  | 'NARRATIVE_LIMIT';

export type Decision =
  | { ok: true; pro: boolean; remaining?: number; endsAt?: number }
  | { ok: false; code: BlockCode };

const DAY_MS = 86_400_000;
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const ym = (ms: number) => new Date(ms).toISOString().slice(0, 7);

const isPro = (user: any, email: string, now: number): boolean =>
  isComplimentary(email) || !!(user && user.isPaid === true) || !!(user && typeof user.proUntil === 'number' && user.proUntil > now);

// Called once at the start of every generation (the "search" step).
export const authorizeGeneration = async (store: Store, who: Who, limits: Limits, now: number): Promise<Decision> => {
  return store.runTransaction(async tx => {
    const user = await tx.get(`users/${who.uid}`);
    const pro = isPro(user, who.email, now);

    if (pro) {
      // Complimentary accounts are exempt from the safety limits so Dana can test freely.
      if (!isComplimentary(who.email)) {
        const usage = (await tx.get(`usage/${who.uid}`)) || {};
        const day = ymd(now);
        const month = ym(now);
        const dayCount = usage.day === day ? usage.dayCount || 0 : 0;
        const monthCount = usage.month === month ? usage.monthCount || 0 : 0;
        if (dayCount >= limits.proDailyLimit) return { ok: false, code: 'PRO_DAILY_LIMIT' } as Decision;
        if (monthCount >= limits.proMonthlyLimit) return { ok: false, code: 'PRO_MONTHLY_LIMIT' } as Decision;
        tx.set(`usage/${who.uid}`, { day, dayCount: dayCount + 1, month, monthCount: monthCount + 1 }, true);
      }
      return { ok: true, pro: true } as Decision;
    }

    // ----- free trial -----
    if (!who.emailVerified) return { ok: false, code: 'EMAIL_NOT_VERIFIED' } as Decision;

    let trial = await tx.get(`trials/${who.uid}`);
    if (!trial) {
      if (isDisposableEmail(who.email)) return { ok: false, code: 'DISPOSABLE_EMAIL' } as Decision;
      const key = emailKey(who.email);
      const claimed = await tx.get(`trial_keys/${key}`);
      if (claimed && claimed.uid !== who.uid) return { ok: false, code: 'TRIAL_ALREADY_USED' } as Decision;
      trial = { startedAt: now, used: 0, key };
    }

    const endsAt = trial.startedAt + limits.trialDays * DAY_MS;
    if (now > endsAt) return { ok: false, code: 'TRIAL_ENDED' } as Decision;
    if ((trial.used || 0) >= limits.trialGenerations) return { ok: false, code: 'TRIAL_USED_UP' } as Decision;

    // global ceiling on free generations per day
    const counterPath = `counters/free_${ymd(now)}`;
    const counter = (await tx.get(counterPath)) || {};
    const todays = counter.count || 0;
    if (todays >= limits.freeDailyCap) return { ok: false, code: 'FREE_DAILY_CAP' } as Decision;

    const used = (trial.used || 0) + 1;
    tx.set(`trials/${who.uid}`, { startedAt: trial.startedAt, used, key: trial.key, lastGenAt: now, followups: 0 }, true);
    tx.set(`trial_keys/${trial.key}`, { uid: who.uid, at: trial.startedAt }, true);
    tx.set(counterPath, { count: todays + 1 }, true);
    return { ok: true, pro: false, remaining: limits.trialGenerations - used, endsAt } as Decision;
  });
};

// Called for the steps that follow a generation (explain, explainMany, workpage).
export const authorizeFollowup = async (store: Store, who: Who, limits: Limits, now: number): Promise<Decision> => {
  return store.runTransaction(async tx => {
    const user = await tx.get(`users/${who.uid}`);
    if (isPro(user, who.email, now)) return { ok: true, pro: true } as Decision;

    const trial = await tx.get(`trials/${who.uid}`);
    const recent = trial && typeof trial.lastGenAt === 'number' && now - trial.lastGenAt < 30 * 60_000;
    if (!trial || !recent || (trial.followups || 0) >= limits.followupsPerGeneration) {
      return { ok: false, code: 'NO_ACTIVE_GENERATION' } as Decision;
    }
    tx.set(`trials/${who.uid}`, { followups: (trial.followups || 0) + 1 }, true);
    return { ok: true, pro: false } as Decision;
  });
};

// If the AI itself fails right after a free generation was counted, give that use back.
export const refundGeneration = async (store: Store, who: Who, now: number): Promise<void> => {
  await store.runTransaction(async tx => {
    const trial = await tx.get(`trials/${who.uid}`);
    if (!trial || (trial.used || 0) < 1) return;
    const counterPath = `counters/free_${ymd(now)}`;
    const counter = (await tx.get(counterPath)) || {};
    tx.set(`trials/${who.uid}`, { used: trial.used - 1 }, true);
    if ((counter.count || 0) > 0) tx.set(counterPath, { count: counter.count - 1 }, true);
  });
};

// The Vault's "narrative summary" stays available after the trial, with a small daily limit.
export const authorizeNarrative = async (store: Store, who: Who, limits: Limits, now: number): Promise<Decision> => {
  return store.runTransaction(async tx => {
    const user = await tx.get(`users/${who.uid}`);
    const pro = isPro(user, who.email, now);
    if (isComplimentary(who.email)) return { ok: true, pro } as Decision;
    const usage = (await tx.get(`usage/${who.uid}`)) || {};
    const day = ymd(now);
    const count = usage.narrDay === day ? usage.narrCount || 0 : 0;
    if (count >= limits.narrativeDailyLimit) return { ok: false, code: 'NARRATIVE_LIMIT' } as Decision;
    tx.set(`usage/${who.uid}`, { narrDay: day, narrCount: count + 1 }, true);
    return { ok: true, pro } as Decision;
  });
};

// Reads the numbers Dana can change; anything missing or silly falls back to the defaults.
export const mergeLimits = (saved: any): Limits => {
  const result: Limits = { ...DEFAULT_LIMITS };
  if (saved && typeof saved === 'object') {
    (Object.keys(DEFAULT_LIMITS) as (keyof Limits)[]).forEach(key => {
      const v = saved[key];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 100000) result[key] = Math.floor(v);
    });
  }
  return result;
};
