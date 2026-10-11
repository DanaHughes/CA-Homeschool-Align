/**
 * Server-side endpoint: opens Stripe's "customer portal" for a paying family
 * (cancel, update card, receipts).
 *
 * Required environment variables:
 *   STRIPE_SECRET_KEY - the restricted key
 *
 * The browser sends the family's sign-in token in the Authorization header. The server
 * checks the token, so a person can only ever open THEIR OWN billing page.
 * The portal itself must be switched on once in Stripe: Settings > Billing > Customer portal.
 */

import Stripe from 'stripe';
import { getStripeCustomerId, verifySignInToken } from './lib/subscriptionAccess.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('[Stripe] Missing STRIPE_SECRET_KEY');
    return res.status(500).json({ error: 'Billing is not configured on the server.' });
  }

  const header = String(req.headers.authorization || '');
  const idToken = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!idToken) {
    return res.status(401).json({ error: 'Please sign in again.' });
  }

  let userId = '';
  try {
    userId = await verifySignInToken(idToken);
  } catch (error: any) {
    console.error('[Stripe portal] Sign-in token rejected:', error?.message);
    return res.status(401).json({ error: 'Please sign in again.' });
  }

  try {
    const customerId = await getStripeCustomerId(userId);
    if (!customerId) {
      return res.status(404).json({ error: 'No billing record was found for this account.' });
    }

    const forwardedProto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host = req.headers.origin || `${forwardedProto}://${req.headers.host}`;

    const stripe = new Stripe(secretKey);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${host}/`
    });
    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('[Stripe portal] Could not open the portal:', error?.message);
    const notSetUp = /configuration/i.test(error?.message || '');
    return res.status(500).json({
      error: notSetUp
        ? 'The billing page is not switched on yet. Please contact support.'
        : 'We could not open the billing page. Please try again.'
    });
  }
}
