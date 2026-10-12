/**
 * Publishes the database rules (firestore.rules in this project) automatically.
 *
 * Dana does not want to paste rules into the Firebase console by hand. Every time the server starts after an update,
 * it compares the rules file shipped with the app against the rules currently published in Firebase and, only when
 * they differ, publishes the file. Firebase checks the rules for mistakes before it accepts them.
 *
 * It needs the permission "Firebase Rules Admin" for the server's service account in the Firebase project.
 * Without that permission it only writes a note in the log; nothing else is affected.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { getAdminApp } from './subscriptionAccess.js';

export interface RulesDeps {
  readLocal: () => string;
  readPublished: () => Promise<string | null>;
  publish: (source: string) => Promise<void>;
  log: (message: string) => void;
}

// Line endings and trailing spaces do not count as a difference.
export const normalizeRules = (text: string): string =>
  String(text || '').replace(/\r\n/g, '\n').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').trim();

export const publishRulesIfChanged = async (deps: RulesDeps): Promise<'published' | 'unchanged' | 'skipped' | 'failed'> => {
  try {
    const local = deps.readLocal();
    if (!local || !/rules_version/.test(local) || !/service cloud\.firestore/.test(local)) {
      deps.log('[Rules] The rules file looks wrong or empty, so nothing was published.');
      return 'skipped';
    }
    const published = await deps.readPublished();
    if (published !== null && normalizeRules(published) === normalizeRules(local)) {
      deps.log('[Rules] The published database rules are already up to date.');
      return 'unchanged';
    }
    await deps.publish(local);
    deps.log('[Rules] The new database rules were published.');
    return 'published';
  } catch (e: any) {
    deps.log(`[Rules] Could not publish the database rules: ${e?.message || e}. (The server needs the "Firebase Rules Admin" permission in the Firebase project.)`);
    return 'failed';
  }
};

// The real thing, used by the server when it starts on Cloud Run.
export const publishRulesOnStart = async (): Promise<void> => {
  const rules = getSecurityRules(getAdminApp());
  await publishRulesIfChanged({
    readLocal: () => readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8'),
    readPublished: async () => {
      try {
        const set = await rules.getFirestoreRuleset();
        return set.source?.[0]?.content ?? null;
      } catch {
        return null;
      }
    },
    publish: async source => { await rules.releaseFirestoreRulesetFromSource(source); },
    log: m => console.log(m)
  });
};
