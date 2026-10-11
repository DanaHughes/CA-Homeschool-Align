/**
 * Server-only helper that turns Stripe payment facts into access in the database.
 *
 * Why this lives on the server: the browser cannot be trusted to say "this person paid".
 * Only the server, after Stripe has confirmed a payment, may mark an account as Pro.
 *
 * The server reaches the Firebase database as the Cloud Run "Default compute service account".
 * That account must have the "Cloud Datastore User" role in the Firebase project
 * (ca-homeschool-align). See CLAUDE.md.
 */

import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

type Plan = 'none' | 'monthly' | 'yearly';

// What should happen in the database for one Stripe event.
export type AccessAction =
  | {
      type: 'activate';
      userId: string;
      userName: string;
      plan: Plan;
      sessionId: string;
      customerId: string;
      subscriptionId: string;
    }
  | { type: 'reactivate'; subscriptionId: string }
  | { type: 'deactivate'; subscriptionId: string };

const toPlan = (raw: unknown): Plan => {
  if (raw === 'monthly') return 'monthly';
  if (raw === 'annual' || raw === 'yearly') return 'yearly';
  return 'none';
};

const idOf = (value: any): string =>
  typeof value === 'string' ? value : value && typeof value.id === 'string' ? value.id : '';

// A finished Checkout Session that is really paid -> activate the buyer.
export const actionFromCheckoutSession = (session: any): AccessAction | null => {
  if (!session || session.payment_status !== 'paid') return null;
  const userId = typeof session.client_reference_id === 'string' ? session.client_reference_id : '';
  if (!userId) return null;
  const meta = session.metadata || {};
  return {
    type: 'activate',
    userId,
    userName: typeof meta.userName === 'string' ? meta.userName : '',
    plan: toPlan(meta.plan),
    sessionId: String(session.id || ''),
    customerId: idOf(session.customer),
    subscriptionId: idOf(session.subscription)
  };
};

// Subscription changes (renewal, cancel, failed payment) -> keep access in step with Stripe.
export const actionFromSubscription = (sub: any, deleted: boolean): AccessAction | null => {
  const subscriptionId = idOf(sub);
  if (!subscriptionId) return null;
  if (deleted) return { type: 'deactivate', subscriptionId };
  const status = sub && sub.status;
  // past_due keeps access while Stripe retries the card; these statuses end it.
  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    return { type: 'deactivate', subscriptionId };
  }
  if (status === 'active' || status === 'trialing') {
    return { type: 'reactivate', subscriptionId };
  }
  return null;
};

export const actionFromEvent = (event: any): AccessAction | null => {
  const object = event && event.data && event.data.object;
  switch (event && event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return actionFromCheckoutSession(object);
    case 'customer.subscription.deleted':
      return actionFromSubscription(object, true);
    case 'customer.subscription.updated':
      return actionFromSubscription(object, false);
    default:
      return null;
  }
};

const getAdminApp = () =>
  getApps()[0] ||
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'ca-homeschool-align'
  });

export const getDb = () => getFirestore(getAdminApp());

// Proves WHO is asking: turns the sign-in token the browser sends into the person's user id.
// Throws if the token is missing, expired or fake.
export const verifySignInToken = async (idToken: string): Promise<string> => {
  const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
  return decoded.uid;
};

// Same check, but returns the person's id AND email (used for the admin-only code tools).
export const verifySignInTokenWithEmail = async (idToken: string): Promise<{ uid: string; email: string }> => {
  const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
  return { uid: decoded.uid, email: String(decoded.email || '').toLowerCase() };
};

// The Stripe customer record saved on the person's account when they paid (empty if none).
export const getStripeCustomerId = async (userId: string): Promise<string> => {
  const snap = await getDb().collection('users').doc(userId).get();
  const value = snap.exists ? snap.data()?.stripeCustomerId : '';
  return typeof value === 'string' ? value : '';
};

const usersBySubscription = async (db: FirebaseFirestore.Firestore, subscriptionId: string) => {
  const snap = await db.collection('users').where('stripeSubscriptionId', '==', subscriptionId).get();
  return snap.docs;
};

export const applyAction = async (action: AccessAction): Promise<void> => {
  const db = getDb();

  if (action.type === 'activate') {
    const update: Record<string, unknown> = {
      accountTier: 'pro',
      isPaid: true,
      paidAt: Date.now(),
      accessCodeUsed: `STRIPE_${action.sessionId}`,
      subscriptionPlan: action.plan,
      stripeCustomerId: action.customerId,
      stripeSubscriptionId: action.subscriptionId
    };
    if (action.userName) update.name = action.userName;
    // merge: true so a missing account document is created rather than failing.
    await db.collection('users').doc(action.userId).set(update, { merge: true });
    return;
  }

  const docs = await usersBySubscription(db, action.subscriptionId);
  for (const doc of docs) {
    if (action.type === 'deactivate') {
      await doc.ref.update({ accountTier: 'free', isPaid: false, subscriptionPlan: 'none' });
    } else {
      await doc.ref.update({ accountTier: 'pro', isPaid: true });
    }
  }
};
