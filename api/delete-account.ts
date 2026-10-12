/**
 * Server-side endpoint: "Delete my account and data".
 * The family's own sign-in token says who is asking, so a person can only ever delete THEIR OWN account.
 * Needs STRIPE_SECRET_KEY to cancel an active subscription first (if there is one).
 */
import Stripe from 'stripe';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp, getDb, verifySignInTokenWithEmail } from './lib/subscriptionAccess.js';
import { COMPLIMENTARY_EMAILS } from './lib/entitlements.js';
import { deleteAccountData } from './lib/deleteAccount.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const header = String(req.headers.authorization || '');
  const idToken = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!idToken) return res.status(401).json({ error: 'Please sign in again.' });

  let who: { uid: string; email: string; emailVerified: boolean };
  try {
    who = await verifySignInTokenWithEmail(idToken);
  } catch (e: any) {
    console.error('[Delete account] Sign-in token rejected:', e?.message);
    return res.status(401).json({ error: 'Please sign in again.' });
  }
  if ((req.body || {}).confirm !== 'DELETE') return res.status(400).json({ error: 'Please type DELETE to confirm.' });

  const db = getDb();
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  try {
    const result = await deleteAccountData(
      {
        getUser: async uid => {
          const snap = await db.doc(`users/${uid}`).get();
          return snap.exists ? snap.data() : undefined;
        },
        cancelSubscription: async subscriptionId => {
          if (!stripeKey) throw new Error('Stripe is not configured');
          const stripe = new Stripe(stripeKey);
          try {
            await stripe.subscriptions.cancel(subscriptionId);
          } catch (e: any) {
            // Already cancelled or not found: nothing left to stop.
            if (e?.code === 'resource_missing' || /No such subscription/i.test(e?.message || '')) return;
            throw e;
          }
        },
        deleteWhere: async (collection, field, value) => {
          const snap = await db.collection(collection).where(field, '==', value).get();
          for (let i = 0; i < snap.docs.length; i += 400) {
            const batch = db.batch();
            snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
          return snap.size;
        },
        deleteDocs: async paths => {
          for (const path of paths) await db.doc(path).delete();
        },
        deleteRedemptions: async uid => {
          let removed = 0;
          const codes = await db.collection('codes').get();
          for (const c of codes.docs) {
            const ref = c.ref.collection('redemptions').doc(uid);
            if ((await ref.get()).exists) { await ref.delete(); removed++; }
          }
          return removed;
        },
        markTrialKey: async key => {
          await db.doc(`trial_keys/${key}`).set({ uid: 'deleted', at: Date.now() }, { merge: true });
        },
        deleteAuthUser: async uid => {
          await getAuth(getAdminApp()).deleteUser(uid);
        }
      },
      { uid: who.uid, email: who.email },
      email => COMPLIMENTARY_EMAILS.includes(String(email || '').toLowerCase())
    );

    if (!result.ok) {
      if (result.error === 'COMPLIMENTARY') return res.status(403).json({ error: 'This account cannot be deleted from here.' });
      return res.status(500).json({ error: 'We could not cancel your subscription, so nothing was deleted. Please try again, or open Manage subscription to cancel first.' });
    }
    console.log(`[Delete account] Removed account ${who.uid}${result.cancelledSubscription ? ' (subscription cancelled)' : ''}`);
    return res.status(200).json({ ok: true, cancelledSubscription: !!result.cancelledSubscription });
  } catch (e: any) {
    console.error('[Delete account] Failed:', e?.message);
    return res.status(500).json({ error: 'Something went wrong. Nothing more was changed; please try again.' });
  }
}
