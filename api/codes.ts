/**
 * Server-side endpoint for promo codes.
 *
 *   action "redeem"     (any signed-in family)  { code }
 *   action "list"       (Dana only)             -> every code, with who used it
 *   action "create"     (Dana only)             { code?, months, maxUses, note? }
 *   action "setActive"  (Dana only)             { code, active }
 *   action "update"     (Dana only)             { code, months?, maxUses?, note?, newCode? }
 *
 * The browser sends the family's sign-in token in the Authorization header. The server checks the
 * token, so the admin actions only work for Dana's own account.
 */
import { getDb, verifySignInTokenWithEmail } from './lib/subscriptionAccess.js';
import { adminStore } from './lib/entitlementsStore.js';
import { codeErrorMessage, createCode, normalizeCode, redeemCode, updateCode } from './lib/codes.js';

const ADMIN_EMAIL = 'dana2andrea@gmail.com';

// Slows down code guessing: at most 10 tries per hour for each account.
const attempts = new Map<string, number[]>();
const tooManyTries = (uid: string, now: number): boolean => {
  const recent = (attempts.get(uid) || []).filter(t => now - t < 3_600_000);
  recent.push(now);
  attempts.set(uid, recent);
  return recent.length > 10;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const header = String(req.headers.authorization || '');
  const idToken = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!idToken) return res.status(401).json({ error: 'Please sign in again.' });

  let who: { uid: string; email: string; emailVerified: boolean };
  try {
    who = await verifySignInTokenWithEmail(idToken);
  } catch (error: any) {
    console.error('[Codes] Sign-in token rejected:', error?.message);
    return res.status(401).json({ error: 'Please sign in again.' });
  }

  const body = req.body || {};
  const now = Date.now();

  try {
    if (body.action === 'redeem') {
      if (!who.emailVerified) {
        return res.status(403).json({ error: 'Please verify your email first. Click the link we sent you, then try your code again.', code: 'EMAIL_NOT_VERIFIED' });
      }
      if (tooManyTries(who.uid, now)) {
        return res.status(429).json({ error: 'Too many tries. Please wait a little while and try again.' });
      }
      const result = await redeemCode(adminStore, { uid: who.uid, email: who.email }, body.code, now);
      if (result.ok === false) return res.status(400).json({ error: codeErrorMessage(result.error), code: result.error });
      return res.status(200).json({ proUntil: result.proUntil, months: result.months });
    }

    // Everything below is for Dana only.
    if (who.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Not allowed.' });

    if (body.action === 'create') {
      const result = await createCode(adminStore, {
        code: body.code,
        months: body.months,
        maxUses: body.maxUses,
        note: body.note
      }, now);
      if (result.ok === false) return res.status(400).json({ error: codeErrorMessage(result.error), code: result.error });
      return res.status(200).json({ code: result.display });
    }

    if (body.action === 'setActive') {
      const id = normalizeCode(body.code);
      const ref = getDb().doc(`codes/${id}`);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: codeErrorMessage('CODE_NOT_FOUND') });
      await ref.set({ active: !!body.active }, { merge: true });
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'update') {
      const id = normalizeCode(body.code);
      const result = await updateCode(adminStore, id, { months: body.months, maxUses: body.maxUses, note: body.note });
      if (result.ok === false) return res.status(400).json({ error: codeErrorMessage(result.error), code: result.error });

      // Renaming: copy the code and everyone who used it to the new name, then remove the old one.
      const newId = body.newCode ? normalizeCode(body.newCode) : id;
      if (newId !== id) {
        if (newId.length < 4 || newId.length > 24) return res.status(400).json({ error: codeErrorMessage('BAD_INPUT'), code: 'BAD_INPUT' });
        const db = getDb();
        const target = db.doc(`codes/${newId}`);
        if ((await target.get()).exists) return res.status(400).json({ error: codeErrorMessage('CODE_EXISTS'), code: 'CODE_EXISTS' });
        const source = db.doc(`codes/${id}`);
        const [data, used] = await Promise.all([source.get(), source.collection('redemptions').get()]);
        await target.set({ ...data.data(), code: String(body.newCode).trim().toUpperCase() });
        for (let i = 0; i < used.docs.length; i += 400) {
          const batch = db.batch();
          used.docs.slice(i, i + 400).forEach(d => batch.set(target.collection('redemptions').doc(d.id), d.data()));
          await batch.commit();
        }
        for (let i = 0; i < used.docs.length; i += 400) {
          const batch = db.batch();
          used.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
        await source.delete();
      }
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'list') {
      const snap = await getDb().collection('codes').get();
      const codes = await Promise.all(snap.docs.map(async d => {
        const data = d.data();
        const used = await d.ref.collection('redemptions').get();
        return {
          code: data.code,
          months: data.months,
          maxUses: data.maxUses,
          uses: data.uses || 0,
          active: data.active !== false,
          note: data.note || '',
          createdAt: data.createdAt || 0,
          redemptions: used.docs
            .map(u => u.data())
            .map(u => ({ email: u.email, name: u.name || '', at: u.at, proUntil: u.proUntil }))
            .sort((a, b) => (b.at || 0) - (a.at || 0))
        };
      }));
      codes.sort((a, b) => b.createdAt - a.createdAt);
      return res.status(200).json({ codes });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (error: any) {
    console.error('[Codes] Failed:', error?.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
