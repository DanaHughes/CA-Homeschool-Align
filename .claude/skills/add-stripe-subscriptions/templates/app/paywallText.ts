// The words on the payment screen that Dana can change in the Admin tab ("Payment screen").
// They are saved in the database (settings/paywall). If nothing is saved, or a box is left empty,
// these original words are used. Prices are NOT here: they must match Stripe (see services/plans.ts).

export interface PaywallText {
  heading: string;
  productName: string;
  features: string;
  subtitleTrial: string;
  subtitleUsedUp: string;
  badge: string;
  finePrint: string;
}

export const DEFAULT_PAYWALL_TEXT: PaywallText = {
  heading: 'Unlock Beta License',
  productName: 'Premium License',
  features: 'Work Sample Creation • Standards Matching • Student Vault • Branded PDF Records',
  subtitleTrial: 'You still have {number} free trial matches. Upgrade any time to keep going.',
  subtitleUsedUp: 'Your free trial matches are complete. Join our early adopter community to keep creating work samples.',
  badge: 'Special Beta Pricing',
  finePrint:
    'Plans renew automatically until you cancel. Cancel any time under My Plan. Beta pricing for early adopters; renewal rates may reflect standard market pricing.'
};

export const PAYWALL_LIMITS: Record<keyof PaywallText, number> = {
  heading: 60,
  productName: 60,
  features: 200,
  subtitleTrial: 200,
  subtitleUsedUp: 200,
  badge: 40,
  finePrint: 400
};

export const PAYWALL_KEYS = Object.keys(DEFAULT_PAYWALL_TEXT) as (keyof PaywallText)[];

// Combines what was saved with the original words. Empty boxes fall back to the original words,
// and over-long text is trimmed, so a mistake in the Admin tab can never leave the screen blank.
export const mergePaywallText = (saved: unknown): PaywallText => {
  const result: PaywallText = { ...DEFAULT_PAYWALL_TEXT };
  if (saved && typeof saved === 'object') {
    for (const key of PAYWALL_KEYS) {
      const value = (saved as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) {
        result[key] = value.trim().slice(0, PAYWALL_LIMITS[key]);
      }
    }
  }
  return result;
};

// Puts the number of trial matches left where {number} was typed. With exactly 1 left, "matches" becomes "match".
export const trialSentence = (template: string, remaining: number): string => {
  const filled = template.replace(/\{number\}/g, String(remaining));
  return remaining === 1 ? filled.replace(/\bmatches\b/, 'match') : filled;
};
