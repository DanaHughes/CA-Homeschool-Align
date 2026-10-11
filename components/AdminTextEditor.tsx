import React, { useState } from 'react';
import { DEFAULT_SITE_TEXT, SiteText, TEXT_DEFS, isSafeUrl, mergeSiteText } from '../services/siteText';

interface AdminTextEditorProps {
  draft: SiteText;
  onDraftChange: (text: SiteText) => void;
  onSave: (text: SiteText) => Promise<void>;
}

const GROUPS = Array.from(new Set(TEXT_DEFS.map(d => d.group)));

export const AdminTextEditor: React.FC<AdminTextEditorProps> = ({ draft, onDraftChange, onSave }) => {
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const change = (key: string, value: string) => {
    onDraftChange({ ...draft, [key]: value });
    setStatus(null);
  };

  const badLinks = TEXT_DEFS.filter(d => d.isLink && draft[d.key] && draft[d.key].trim() && !isSafeUrl(draft[d.key]));

  const handleSave = async () => {
    if (badLinks.length) {
      setStatus({ kind: 'error', text: `Please fix the web address first: ${badLinks.map(d => d.label).join(', ')}. It must start with https://` });
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      const final = mergeSiteText(draft);
      await onSave(final);
      onDraftChange(final);
      setStatus({ kind: 'ok', text: 'Saved. Families see the new words the next time they open or reload the app.' });
    } catch {
      setStatus({ kind: 'error', text: 'Could not save. The database rules for this page may not be published yet (see the note from Claude), or you are not signed in as the admin.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetAll = () => {
    if (!confirm('Put the original words back in every box? (Nothing is saved until you press Save.)')) return;
    onDraftChange({ ...DEFAULT_SITE_TEXT });
    setStatus(null);
  };

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-500">
        These are words and web addresses used around the app. Leave a box empty to use the original words. The words on the payment screen are in the "Payment screen" tab, and the Start Here steps and questions are in "FAQs &amp; Steps".
      </p>

      {GROUPS.map(group => (
        <div key={group} className="space-y-4">
          <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#e7b64f]">{group}</h3>
          {TEXT_DEFS.filter(d => d.group === group).map(d => (
            <div key={d.key} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
              <div className="flex items-start justify-between gap-3 mb-1">
                <label htmlFor={`t-${d.key}`} className="block text-[10px] font-black uppercase tracking-widest text-[#367c92]">{d.label}</label>
                <button type="button" onClick={() => change(d.key, d.fallback)} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Original words</button>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mb-3">{d.help}</p>
              {d.rows === 1 ? (
                <input
                  id={`t-${d.key}`}
                  type="text"
                  value={draft[d.key] ?? ''}
                  maxLength={d.limit}
                  onChange={e => change(d.key, e.target.value)}
                  className="w-full px-5 py-3 rounded-2xl border-2 border-slate-100 focus:border-[#e7b64f] outline-none font-bold text-slate-700"
                />
              ) : (
                <textarea
                  id={`t-${d.key}`}
                  value={draft[d.key] ?? ''}
                  rows={d.rows}
                  maxLength={d.limit}
                  onChange={e => change(d.key, e.target.value)}
                  className="w-full px-5 py-3 rounded-2xl border-2 border-slate-100 focus:border-[#e7b64f] outline-none font-medium text-slate-700 resize-y"
                />
              )}
              <p className="text-[9px] text-slate-300 font-black uppercase tracking-widest mt-2 text-right">{(draft[d.key] ?? '').length} / {d.limit}</p>
            </div>
          ))}
        </div>
      ))}

      {status && <p className={`text-sm font-bold ${status.kind === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>{status.text}</p>}

      <div className="flex flex-wrap gap-3">
        <button onClick={handleSave} disabled={isSaving} className="px-8 py-3 rounded-full bg-gradient-to-r from-[#e7b64f] to-[#f4989c] text-slate-800 font-black text-[10px] uppercase tracking-[0.2em] shadow-md hover:brightness-105 active:scale-95 transition-all disabled:opacity-60">
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={handleResetAll} className="px-6 py-3 rounded-full bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-200 transition-all">Original words</button>
      </div>
    </div>
  );
};
