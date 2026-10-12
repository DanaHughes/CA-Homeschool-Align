/**
 * "Delete my account and data": removes everything the app holds about a family.
 *
 * Removed: the account (sign-in) itself, the user record, students, Vault records, generation history, the free-trial
 * record, usage counters, bug reports and feature requests sent by the family, and the family's entry in any promo
 * code's "who used it" list. An active subscription is cancelled first (so nobody keeps being charged).
 * Kept on purpose: Stripe keeps its own payment records (the law requires invoices to be kept), and a one-way
 * marker of the email address that already used a free trial (so a deleted account cannot be used to farm trials).
 */
import { emailKey } from './entitlements.js';

export interface DeleteDeps {
  getUser: (uid: string) => Promise<any | undefined>;
  cancelSubscription: (subscriptionId: string) => Promise<void>;
  deleteWhere: (collection: string, field: string, value: string) => Promise<number>;
  deleteDocs: (paths: string[]) => Promise<void>;
  deleteRedemptions: (uid: string) => Promise<number>;
  markTrialKey: (key: string) => Promise<void>;
  deleteAuthUser: (uid: string) => Promise<void>;
}

export interface DeleteResult {
  ok: boolean;
  error?: 'COMPLIMENTARY' | 'SUBSCRIPTION_NOT_CANCELLED';
  cancelledSubscription?: boolean;
}

export const deleteAccountData = async (
  deps: DeleteDeps,
  who: { uid: string; email: string },
  isComplimentary: (email: string) => boolean
): Promise<DeleteResult> => {
  // Dana's own accounts cannot be deleted by accident.
  if (isComplimentary(who.email)) return { ok: false, error: 'COMPLIMENTARY' };

  const user = await deps.getUser(who.uid);

  // 1) Stop any billing first. If that fails, nothing else is deleted.
  let cancelled = false;
  const subId = user && typeof user.stripeSubscriptionId === 'string' ? user.stripeSubscriptionId : '';
  if (subId) {
    try {
      await deps.cancelSubscription(subId);
      cancelled = true;
    } catch {
      return { ok: false, error: 'SUBSCRIPTION_NOT_CANCELLED' };
    }
  }

  // 2) Everything the family created.
  for (const collection of ['students', 'records', 'generations', 'messages', 'feature_requests']) {
    await deps.deleteWhere(collection, 'userId', who.uid);
  }
  await deps.deleteRedemptions(who.uid);
  await deps.deleteDocs([`trials/${who.uid}`, `usage/${who.uid}`, `users/${who.uid}`]);

  // 3) Remember only that this email already had a trial (no link back to a person), then remove the sign-in account.
  await deps.markTrialKey(emailKey(who.email));
  await deps.deleteAuthUser(who.uid);
  return { ok: true, cancelledSubscription: cancelled };
};
