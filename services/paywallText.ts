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
  subtitleTrial: 'You have {number} free generations available for the next {days} days. Upgrade any time to keep going.',
  subtitleUsedUp:
    'Your free trial has ended. Your saved work and PDF export stay yours. Join our early adopter community to keep creating work samples.',
  badge: 'Special Beta Pricing',
  finePrint:
    'Plans renew automatically until you cancel. Cancel any time under My Account. Beta pricing for early adopters; renewal rates may reflect standard market pricing.'
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

// Earlier wording that was saved as-is from the Admin tab. Treated as "not changed", so families see the new wording.
const OLD_DEFAULTS: Partial<Record<keyof PaywallText, string[]>> = {
  subtitleTrial: ['You still have {number} free trial matches. Upgrade any time to keep going.'],
  subtitleUsedUp: ['Your free trial matches are complete. Join our early adopter community to keep creating work samples.'],
  finePrint: [
    'Plans renew automatically until you cancel. Cancel any time under My Plan. Beta pricing for early adopters; renewal rates may reflect standard market pricing.'
  ]
};

export const PAYWALL_KEYS = Object.keys(DEFAULT_PAYWALL_TEXT) as (keyof PaywallText)[];

// Combines what was saved with the original words. Empty boxes fall back to the original words,
// and over-long text is trimmed, so a mistake in the Admin tab can never leave the screen blank.
export const mergePaywallText = (saved: unknown): PaywallText => {
  const result: PaywallText = { ...DEFAULT_PAYWALL_TEXT };
  if (saved && typeof saved === 'object') {
    for (const key of PAYWALL_KEYS) {
      const value = (saved as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim() && !(OLD_DEFAULTS[key] || []).includes(value.trim())) {
        result[key] = value.trim().slice(0, PAYWALL_LIMITS[key]);
      }
    }
  }
  return result;
};

// Puts the number of free generations left where {number} was typed, and the days left where {days} was typed.
// With exactly 1 left, "generations" (or "matches") becomes singular; the same for 1 day.
export const trialSentence = (template: string, remaining: number, daysLeft: number = 7): string => {
  let filled = template.replace(/\{number\}/g, String(remaining)).replace(/\{days\}/g, String(daysLeft));
  if (remaining === 1) filled = filled.replace(/\bgenerations\b/, 'generation').replace(/\bmatches\b/, 'match');
  if (daysLeft === 1) filled = filled.replace(/\bdays\b/, 'day');
  return filled;
};
