/**
 * Server-side endpoint for Homeschool Work Sample Pro
 * Verifies a Stripe Checkout Session after the user returns from Stripe.
 *
 * Required environment variables:
 *   STRIPE_SECRET_KEY - Secret key from the Stripe dashboard.
 *
 * The client POSTs { sessionId } and receives { paid, userId, userEmail }
 * which the client then uses to mark the user as paid in Firestore.
 */

import Stripe from 'stripe';
import { actionFromCheckoutSession, applyAction } from './lib/subscriptionAccess.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('[Stripe] Missing STRIPE_SECRET_KEY');
    return res.status(500).json({ error: 'Stripe is not configured on the server.' });
  }

  const { sessionId } = req.body || {};
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Missing session ID' });
  }

  const stripe = new Stripe(secretKey);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === 'paid';

    console.log(`[Stripe] Verified session ${sessionId}: paid=${paid}`);

    // Once Stripe confirms the payment, the SERVER marks the account as Pro (never the browser).
    // If that fails (for example the database permission is not set up yet), "activated" is false
    // and the caller may fall back to the older browser-side unlock.
    let activated = false;
    if (paid) {
      try {
        const action = actionFromCheckoutSession(session);
        if (action) {
          await applyAction(action);
          activated = true;
        }
      } catch (activationError: any) {
        console.error('[Stripe] Could not activate account on the server:', activationError?.message);
      }
    }

    return res.status(200).json({
      paid,
      activated,
      userId: session.client_reference_id,
      userEmail: session.customer_email,
      userName: (session.metadata && session.metadata.userName) || '',
      amount: session.amount_total,
      currency: session.currency
    });
  } catch (error: any) {
    console.error('[Stripe] Verification error:', error);
    return res.status(500).json({
      error: error?.message || 'Unable to verify session'
    });
  }
}
