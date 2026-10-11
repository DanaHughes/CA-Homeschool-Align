import React, { useState } from 'react';
import { DEFAULT_PAYWALL_TEXT, PAYWALL_KEYS, PAYWALL_LIMITS, PaywallText, mergePaywallText } from '../services/paywallText';

interface AdminPaywallEditorProps {
  // The words being edited. The parent keeps them, so a preview does not lose unsaved changes.
  draft: PaywallText;
  onDraftChange: (text: PaywallText) => void;
  onSave: (text: PaywallText) => Promise<void>;
  onPreview: (text: PaywallText, trialRemaining: number) => void;
}

const FIELDS: { key: keyof PaywallText; label: string; help: string; rows: number }[] = [
  { key: 'heading', label: 'Big title', help: 'The large title at the top of the payment screen.', rows: 1 },
  {
    key: 'productName',
    label: 'What they are buying (product name)',
    help: 'Shown in the "You are purchasing" box. Change the name in Stripe too (Product catalog) so receipts match.',
    rows: 1
  },
  { key: 'features', label: 'What is included', help: 'One line under the plans. Use the • symbol between items if you like.', rows: 2 },
  {
    key: 'subtitleTrial',
    label: 'Sentence under the title (free generations still left)',
    help: 'Type {number} where the number of free generations left should appear, and {days} where the days left should appear. For example: You have {number} free generations available for the next {days} days.',
    rows: 2
  },
  { key: 'subtitleUsedUp', label: 'Sentence under the title (free trial over)', help: 'Shown when a family has no free generations or days left.', rows: 2 },
  { key: 'badge', label: 'Small badge above the plans', help: 'For example: Special Beta Pricing. This is a good place for a limited-time note.', rows: 1 },
  { key: 'finePrint', label: 'Fine print (renewal and cancel wording)', help: 'Keep a clear sentence that plans renew automatically and how to cancel.', rows: 3 }
];

export const AdminPaywallEditor: React.FC<AdminPaywallEditorProps> = ({ draft, onDraftChange, onSave, onPreview }) => {
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const change = (key: keyof PaywallText, value: string) => {
    onDraftChange({ ...draft, [key]: value });
    setStatus(null);
  };

  // Empty boxes use the original words, so the result is what families will really see.
  const effective = () => mergePaywallText(draft);

  const handleSave = async () => {
    setIsSaving(true);
    setStatus(null);
    try {
      const final = effective();
      await onSave(final);
      onDraftChange(final);
      setStatus({ kind: 'ok', text: 'Saved. Families see the new words the next time they open the payment screen.' });
    } catch (e: any) {
      setStatus({
        kind: 'error',
        text: 'Could not save. The database rules for this page may not be published yet (see the note from Claude), or you are not signed in as the admin.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('Put the original words back in every box? (Nothing is saved until you press Save.)')) return;
    onDraftChange({ ...DEFAULT_PAYWALL_TEXT });
    setStatus(null);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        These are the words on the screen families see when they choose to upgrade. The prices ($9 and $79) are not here, because they must match Stripe. Leave a box empty to use the original words.
      </p>

      {FIELDS.map(f => (
        <div key={f.key} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <label className="block text-[10px] font-black uppercase tracking-widest text-[#367c92] mb-1">{f.label}</label>
          <p className="text-[11px] text-slate-400 font-medium mb-3">{f.help}</p>
          {f.rows === 1 ? (
            <input
              type="text"
              value={draft[f.key]}
              maxLength={PAYWALL_LIMITS[f.key]}
              onChange={e => change(f.key, e.target.value)}
              className="w-full px-5 py-3 rounded-2xl border-2 border-slate-100 focus:border-[#e7b64f] outline-none font-bold text-slate-700"
            />
          ) : (
            <textarea
              value={draft[f.key]}
              rows={f.rows}
              maxLength={PAYWALL_LIMITS[f.key]}
              onChange={e => change(f.key, e.target.value)}
              className="w-full px-5 py-3 rounded-2xl border-2 border-slate-100 focus:border-[#e7b64f] outline-none font-medium text-slate-700 resize-y"
            />
          )}
          <p className="text-[9px] text-slate-300 font-black uppercase tracking-widest mt-2 text-right">{draft[f.key].length} / {PAYWALL_LIMITS[f.key]}</p>
        </div>
      ))}

      {status && (
        <p className={`text-sm font-bold ${status.kind === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>{status.text}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-8 py-3 rounded-full bg-gradient-to-r from-[#e7b64f] to-[#f4989c] text-slate-800 font-black text-[10px] uppercase tracking-[0.2em] shadow-md hover:brightness-105 active:scale-95 transition-all disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => onPreview(effective(), 5)}
          className="px-6 py-3 rounded-full bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-200 transition-all"
        >
          Preview (trial still going)
        </button>
        <button
          onClick={() => onPreview(effective(), 0)}
          className="px-6 py-3 rounded-full bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-200 transition-all"
        >
          Preview (trial over)
        </button>
        <button
          onClick={handleReset}
          className="px-6 py-3 rounded-full text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:text-red-400 transition-all"
        >
          Original words
        </button>
      </div>
    </div>
  );
};
