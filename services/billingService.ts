import { auth } from '../firebase';

// Opens Stripe's own secure page where a paying family can cancel, change their card or see receipts.
// The server checks WHO is asking (using their sign-in token) and finds their Stripe customer record.
export const openBillingPortal = async (): Promise<void> => {
  const current = auth.currentUser;
  if (!current) throw new Error('Please sign in again.');
  const idToken = await current.getIdToken();

  const response = await fetch('/api/create-portal-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) {
    throw new Error(data.error || 'We could not open the billing page. Please try again.');
  }
  window.location.href = data.url;
};
