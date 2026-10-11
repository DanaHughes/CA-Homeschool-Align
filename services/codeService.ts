import { auth } from '../firebase';

export interface CodeRedemption { email: string; name: string; at: number; proUntil: number }
export interface PromoCode {
  code: string;
  months: number;
  maxUses: number;
  uses: number;
  active: boolean;
  note: string;
  createdAt: number;
  redemptions: CodeRedemption[];
}

// Sends one request to the server's /api/codes with the family's sign-in token.
const call = async (body: Record<string, unknown>): Promise<any> => {
  const current = auth.currentUser;
  if (!current) throw new Error('Please sign in again.');
  const idToken = await current.getIdToken();
  const response = await fetch('/api/codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
};

// A family types their code. Returns the date their free access lasts until (milliseconds).
export const redeemPromoCode = async (code: string): Promise<{ proUntil: number; months: number }> =>
  call({ action: 'redeem', code });

// Admin only (the server refuses anyone else).
export const listPromoCodes = async (): Promise<PromoCode[]> => (await call({ action: 'list' })).codes as PromoCode[];
export const createPromoCode = async (input: { code?: string; months: number; maxUses: number; note?: string }): Promise<string> =>
  (await call({ action: 'create', ...input })).code as string;
export const setPromoCodeActive = async (code: string, active: boolean): Promise<void> => {
  await call({ action: 'setActive', code, active });
};
