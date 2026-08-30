/**
 * Server-side endpoint for Homeschool Work Sample Pro
 * Creates a Stripe Checkout Session for Monthly or Annual License.
 *
 * Required environment variables:
 *   STRIPE_SECRET_KEY        - Secret key from the Stripe dashboard
 *   STRIPE_PRICE_ID_MONTHLY  - Price ID for the monthly plan (price_1UABjoKF7WRtuq4NMUlNRDJ3)
 *   STRIPE_PRICE_ID_ANNUAL   - Price ID for the annual plan  (price_1UABirKF7WRtuq4NPWy8vEBv)
 *
 * The client POSTs { userId, userEmail, userName, plan } and receives { url }
 */

import Stripe from 'stripe';

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

  const { userId, userEmail, userName, plan = 'annual' } = req.body || {};
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
