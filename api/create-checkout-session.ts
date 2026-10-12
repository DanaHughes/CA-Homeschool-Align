/**
 * Server-side endpoint for Homeschool Work Sample Pro
 * Creates a Stripe Checkout Session for Monthly or Annual License.
 *
 * Required environment variables:
 *   STRIPE_SECRET_KEY        - Secret key from the Stripe dashboard
 *   STRIPE_PRICE_ID_MONTHLY  - Price ID for the monthly plan ($9 per month)
 *   STRIPE_PRICE_ID_ANNUAL   - Price ID for the annual plan ($79 per year)
 *
 * The client POSTs { userName, plan } with the family's sign-in token in the Authorization header and receives { url }.
 * Who is paying (id and email) comes from the token, never from the request body, and the email must be verified.
 */

import Stripe from 'stripe';
import { verifySignInTokenWithEmail } from './lib/subscriptionAccess.js';

const PRICE_IDS: Record<string, string | undefined> = {
  monthly: process.env.STRIPE_PRICE_ID_MONTHLY,
  annual: process.env.STRIPE_PRICE_ID_ANNUAL
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    console.error('[Stripe] Missing STRIPE_SECRET_KEY');
    return res.status(500).json({
      error: 'Stripe is not configured on the server. Please contact support.'
    });
  }

  const header = String(req.headers.authorization || '');
  const idToken = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!idToken) return res.status(401).json({ error: 'Please sign in again.' });
  let userId = '';
  let userEmail = '';
  try {
    const who = await verifySignInTokenWithEmail(idToken);
    if (!who.emailVerified) {
      return res.status(403).json({ error: 'Please verify your email first. Click the link we sent you, then try again.' });
    }
    userId = who.uid;
    userEmail = who.email;
  } catch (e: any) {
    console.error('[Stripe] Sign-in token rejected:', e?.message);
    return res.status(401).json({ error: 'Please sign in again.' });
  }

  const { userName, plan = 'annual' } = req.body || {};
  const priceId = PRICE_IDS[plan];

  if (!priceId) {
    console.error(`[Stripe] No price ID configured for plan "${plan}"`);
    return res.status(500).json({
      error: 'Selected plan is not configured. Please contact support.'
    });
  }

  if (!userId || !userEmail) {
    return res.status(400).json({ error: 'Missing user information' });
  }

  const stripe = new Stripe(secretKey);

  try {
    const forwardedProto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host = req.headers.origin || `${forwardedProto}://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: userEmail,
      client_reference_id: userId,
      metadata: {
        userId,
        userName: userName || '',
        plan
      },
      success_url: `${host}/?stripe_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${host}/?stripe_canceled=1`
    });

    console.log(`[Stripe] Created ${plan} checkout session ${session.id} for ${userEmail}`);

    return res.status(200).json({ url: session.url, id: session.id });
  } catch (error: any) {
    console.error('[Stripe] Checkout session error:', error);
    return res.status(500).json({
      error: error?.message || 'Unable to create checkout session'
    });
  }
}
