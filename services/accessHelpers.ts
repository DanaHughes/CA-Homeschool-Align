import { User } from '../types';

// True while a promo code's free months have not run out. The server decides and saves proUntil;
// the browser only reads it to decide what to show.
export const hasCodeAccess = (user: Pick<User, 'proUntil'> | null | undefined, now: number = Date.now()): boolean =>
  !!user && typeof user.proUntil === 'number' && user.proUntil > now;
