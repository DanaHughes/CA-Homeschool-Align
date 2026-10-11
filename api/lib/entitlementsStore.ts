/**
 * Connects the trial rules (entitlements.ts) to the real database, using the server's own access.
 */
import { getDb } from './subscriptionAccess.js';
import { DEFAULT_LIMITS, Limits, Store, mergeLimits } from './entitlements.js';

export const adminStore: Store = {
  runTransaction: fn =>
    getDb().runTransaction(async t =>
      fn({
        get: async (path: string) => {
          const snap = await t.get(getDb().doc(path));
          return snap.exists ? snap.data() : undefined;
        },
        set: (path: string, data: Record<string, any>, merge?: boolean) => {
          t.set(getDb().doc(path), data, { merge: !!merge });
        }
      })
    )
};

// The numbers Dana can change in the Admin tab (settings/limits). Cached for a minute.
let cached: { at: number; value: Limits } | null = null;
export const getLimits = async (): Promise<Limits> => {
  const now = Date.now();
  if (cached && now - cached.at < 60_000) return cached.value;
  try {
    const snap = await getDb().doc('settings/limits').get();
    const value = mergeLimits(snap.exists ? snap.data() : {});
    cached = { at: now, value };
    return value;
  } catch (e) {
    console.error('[Limits] Could not read settings/limits; using the defaults.', e);
    return DEFAULT_LIMITS;
  }
};
