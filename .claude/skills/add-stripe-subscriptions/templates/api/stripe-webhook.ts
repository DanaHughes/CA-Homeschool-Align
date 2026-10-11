/**
 * Server-side endpoint for Stripe's webhook messages.
 * Stripe calls this address by itself when something happens (a payment, a cancel).
 *
 * Required environment variables:
 *   STRIPE_SECRET_KEY      - the restricted key
 *   STRIPE_WEBHOOK_SECRET  - the "signing secret" Stripe shows for this webhook (starts with whsec_)
 *
 * The body must be the RAW bytes Stripe sent (server.ts sets that up for this route),
 * because the signature check fails if the body is changed in any way.
 */

import Stripe from 'stripe';
import { actionFromEvent, applyAction } from './lib/subscriptionAccess.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    console.error('[Stripe webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Webhook is not configured on the server.' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || !Buffer.isBuffer(req.body)) {
    return res.status(400).json({ error: 'Missing signature or body' });
  }

  const stripe = new Stripe(secretKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error: any) {
    console.error('[Stripe webhook] Signature check failed:', error?.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    const action = actionFromEvent(event);
    if (action) {
      await applyAction(action);
      console.log(`[Stripe webhook] ${event.type} -> ${action.type}`);
    } else {
      console.log(`[Stripe webhook] ${event.type} ignored`);
    }
    return res.status(200).json({ received: true });
  } catch (error: any) {
    // A 500 makes Stripe try again later, so a short database hiccup does not lose a payment.
    console.error('[Stripe webhook] Could not update access:', error);
    return res.status(500).json({ error: 'Could not update access' });
  }
}
