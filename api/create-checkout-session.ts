/**
 * Server-side endpoint for CA Homeschool Align
 * Creates a Stripe Checkout Session for the Beta License purchase.
 *
 * Required environment variables:
 *   STRIPE_SECRET_KEY  - Secret key from the Stripe dashboard (sk_live_... or sk_test_...)
 *   STRIPE_PRICE_ID    - Price ID for the Beta License product (price_...)
 *
 * The client POSTs { userId, userEmail, userName } and receives { url }
 * which is then used to redirect the browser to Stripe Checkout.
 */

import Stripe from 'stripe';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!secretKey || !priceId) {
    console.error('[Stripe] Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID');
    return res.status(500).json({
      error: 'Stripe is not configured on the server. Please contact support.'
    });
  }

  const { userId, userEmail, userName } = req.body || {};

  if (!userId || !userEmail) {
    return res.status(400).json({ error: 'Missing user information' });
  }

  const stripe = new Stripe(secretKey);

  try {
    const forwardedProto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host = req.headers.origin || `${forwardedProto}://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: userEmail,
      client_reference_id: userId,
      metadata: {
        userId,
        userName: userName || ''
      },
      success_url: `${host}/?stripe_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${host}/?stripe_canceled=1`
    });

    console.log(`[Stripe] Created checkout session ${session.id} for ${userEmail}`);

    return res.status(200).json({ url: session.url, id: session.id });
  } catch (error: any) {
    console.error('[Stripe] Checkout session error:', error);
    return res.status(500).json({
      error: error?.message || 'Unable to create checkout session'
    });
  }
}
