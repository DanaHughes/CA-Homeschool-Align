import { auth } from '../firebase';

// Deletes the signed-in family's whole account and data (the server checks who is asking).
export const deleteMyAccount = async (): Promise<{ cancelledSubscription: boolean }> => {
  const current = auth.currentUser;
  if (!current) throw new Error('Please sign in again.');
  const idToken = await current.getIdToken();
  const response = await fetch('/api/delete-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ confirm: 'DELETE' })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return { cancelledSubscription: !!data.cancelledSubscription };
};
