// The paid plans, in one place so every screen shows the same prices.
// These must match the two prices in Stripe (product "Premium License"):
//   monthly $9.00 USD, yearly $79.00 USD.
export const MONTHLY_PRICE = 9;
export const YEARLY_PRICE = 79;

// How much cheaper the yearly plan is than twelve months of the monthly plan.
export const YEARLY_SAVE_PERCENT = Math.round(((MONTHLY_PRICE * 12 - YEARLY_PRICE) / (MONTHLY_PRICE * 12)) * 100);

export const planLabel = (plan?: string): string => {
  if (plan === 'monthly') return `Monthly ($${MONTHLY_PRICE} per month)`;
  if (plan === 'yearly') return `Yearly ($${YEARLY_PRICE} per year)`;
  return 'Pro';
};
