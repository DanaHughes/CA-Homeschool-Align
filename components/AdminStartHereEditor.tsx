import React, { useState } from 'react';
import { DEFAULT_START_HERE, LIMITS, StartFaq, StartHereContent, StartStep, mergeStartHere } from '../services/startHereContent';
import { RichText } from './RichText';

interface AdminStartHereEditorProps {
  draft: StartHereContent;
  onDraftChange: (content: StartHereContent) => void;
  onSave: (content: StartHereContent) => Promise<void>;
}

const small = 'px-3 py-2 rounded-xl bg-slate-100 text-slate-600 font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 disabled:opacity-30';
const inputCls = 'w-full px-5 py-3 rounded-2xl border-2 border-slate-100 focus:border-[#e7b64f] outline-none font-bold text-slate-700';
const areaCls = 'w-full px-5 py-3 rounded-2xl border-2 border-slate-100 focus:border-[#e7b64f] outline-none font-medium text-slate-700 resize-y';

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const copy = list.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export const AdminStartHereEditor: React.FC<AdminStartHereEditorProps> = ({ draft, onDraftChange, onSave }) => {
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const setSteps = (steps: StartStep[]) => { onDraftChange({ ...draft, steps }); setStatus(null); };
  const setFaqs = (faqs: StartFaq[]) => { onDraftChange({ ...draft, faqs }); setStatus(null); };

  const handleSave = async () => {
    setIsSaving(true);
    setStatus(null);
    try {
      const final = mergeStartHere(draft);
      await onSave(final);
      onDraftChange(final);
      setStatus({ kind: 'ok', text: 'Saved. Families see the changes the next time they open or reload the app.' });
    } catch {
      setStatus({ kind: 'error', text: 'Could not save. The database rules for this page may not be published yet (see the note from Claude), or you are not signed in as the admin.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('Put the original steps and questions back? (Nothing is saved until you press Save.)')) return;
    onDraftChange({ steps: DEFAULT_START_HERE.steps, faqs: DEFAULT_START_HERE.faqs });
    setStatus(null);
  };

  return (
    <div className="space-y-10">
      <p className="text-sm text-slate-500">
        This is the Start Here page families see. In any box, type <span className="font-black">**two stars around words**</span> to make them bold, and <span className="font-mono text-[12px]">[the words](https://the-address)</span> to make a link.
      </p>

      <div className="space-y-4">
        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#e7b64f]">How to use (steps)</h3>
        {draft.steps.map((s, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#367c92]">Step {i + 1}</span>
              <div className="flex gap-2">
                <button type="button" className={small} disabled={i === 0} onClick={() => setSteps(move(draft.steps, i, i - 1))}>Up</button>
                <button type="button" className={small} disabled={i === draft.steps.length - 1} onClick={() => setSteps(move(draft.steps, i, i + 1))}>Down</button>
                <button type="button" className={small} onClick={() => { if (confirm('Delete this step?')) setSteps(draft.steps.filter((_, j) => j !== i)); }}>Delete</button>
              </div>
            </div>
            <input type="text" aria-label={`Step ${i + 1} title`} value={s.title} maxLength={LIMITS.title} onChange={e => setSteps(draft.steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Short title" className={inputCls} />
            <textarea aria-label={`Step ${i + 1} words`} value={s.body} rows={3} maxLength={LIMITS.body} onChange={e => setSteps(draft.steps.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} placeholder="Words" className={areaCls} />
            <p className="text-[11px] text-slate-500 leading-relaxed"><span className="font-black uppercase tracking-widest text-slate-300 text-[9px]">Preview </span><RichText text={s.body} /></p>
          </div>
        ))}
        {draft.steps.length < LIMITS.steps && (
          <button type="button" className={small} onClick={() => setSteps([...draft.steps, { title: '', body: '' }])}>Add a step</button>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#e7b64f]">Frequently asked questions</h3>
        {draft.faqs.map((f, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#367c92]">Question {i + 1}</span>
              <div className="flex gap-2">
                <button type="button" className={small} disabled={i === 0} onClick={() => setFaqs(move(draft.faqs, i, i - 1))}>Up</button>
                <button type="button" className={small} disabled={i === draft.faqs.length - 1} onClick={() => setFaqs(move(draft.faqs, i, i + 1))}>Down</button>
                <button type="button" className={small} onClick={() => { if (confirm('Delete this question?')) setFaqs(draft.faqs.filter((_, j) => j !== i)); }}>Delete</button>
              </div>
            </div>
            <input type="text" aria-label={`Question ${i + 1}`} value={f.q} maxLength={LIMITS.q} onChange={e => setFaqs(draft.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} placeholder="The question" className={inputCls} />
            <textarea aria-label={`Answer ${i + 1}`} value={f.a} rows={4} maxLength={LIMITS.a} onChange={e => setFaqs(draft.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} placeholder="The answer" className={areaCls} />
            <p className="text-[11px] text-slate-500 leading-relaxed"><span className="font-black uppercase tracking-widest text-slate-300 text-[9px]">Preview </span><RichText text={f.a} /></p>
          </div>
        ))}
        {draft.faqs.length < LIMITS.faqs && (
          <button type="button" className={small} onClick={() => setFaqs([...draft.faqs, { q: '', a: '' }])}>Add a question</button>
        )}
      </div>

      {status && <p className={`text-sm font-bold ${status.kind === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>{status.text}</p>}

      <div className="flex flex-wrap gap-3">
        <button onClick={handleSave} disabled={isSaving} className="px-8 py-3 rounded-full bg-gradient-to-r from-[#e7b64f] to-[#f4989c] text-slate-800 font-black text-[10px] uppercase tracking-[0.2em] shadow-md hover:brightness-105 active:scale-95 transition-all disabled:opacity-60">
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={handleReset} className="px-6 py-3 rounded-full bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-200 transition-all">Original steps and questions</button>
      </div>
    </div>
  );
};
