import React, { useCallback, useEffect, useState } from 'react';
import { PromoCode, createPromoCode, listPromoCodes, setPromoCodeActive } from '../services/codeService';

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export const AdminCodes: React.FC = () => {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [months, setMonths] = useState('6');
  const [maxUses, setMaxUses] = useState('1');
  const [note, setNote] = useState('');
  const [custom, setCustom] = useState('');
  const [creating, setCreating] = useState(false);
  const [justMade, setJustMade] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCodes(await listPromoCodes());
    } catch (e: any) {
      setError(e?.message || 'Could not load the codes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('');
    }
  };

  const make = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    setJustMade('');
    try {
      const made = await createPromoCode({
        code: custom.trim() || undefined,
        months: Number(months),
        maxUses: Number(maxUses),
        note: note.trim()
      });
      setJustMade(made);
      setNote('');
      setCustom('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not make the code.');
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (c: PromoCode) => {
    try {
      await setPromoCodeActive(c.code, !c.active);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not change the code.');
    }
  };

  const input = 'w-full px-5 py-3 rounded-2xl border-2 border-slate-100 focus:border-[#e7b64f] outline-none font-bold text-slate-700';
  const label = 'block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2';

  return (
    <div className="space-y-8">
      <form onSubmit={make} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 space-y-5">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Make a code</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={label} htmlFor="code-months">Free months</label>
            <input id="code-months" type="number" min={1} max={60} value={months} onChange={e => setMonths(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="code-uses">How many families can use it</label>
            <input id="code-uses" type="number" min={1} value={maxUses} onChange={e => setMaxUses(e.target.value)} className={input} />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="code-note">Note to yourself (only you see this)</label>
          <input id="code-note" type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="For example: my friend Sam" className={input} />
        </div>
        <div>
          <label className={label} htmlFor="code-custom">Your own code (optional)</label>
          <input id="code-custom" type="text" value={custom} onChange={e => setCustom(e.target.value)} placeholder="Leave empty and we will make one like WSP-K7M2-9QXA" className={input} />
        </div>
        <button type="submit" disabled={creating} className="px-8 py-4 rounded-full bg-gradient-to-r from-[#e7b64f] to-[#f4989c] text-slate-800 font-black text-[11px] uppercase tracking-[0.2em] shadow-lg hover:brightness-105 disabled:opacity-60">
          {creating ? 'Making...' : 'Make the code'}
        </button>
        {justMade && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5 flex flex-wrap items-center gap-4">
            <span className="text-2xl font-black text-emerald-800 tracking-widest">{justMade}</span>
            <button type="button" onClick={() => copy(justMade)} className="px-5 py-2 rounded-xl bg-white border border-emerald-200 text-[10px] font-black uppercase tracking-widest text-emerald-700">{copied === justMade ? 'Copied' : 'Copy'}</button>
          </div>
        )}
      </form>

      {error && <p className="text-sm font-bold text-red-500">{error}</p>}
      {loading && <p className="text-sm text-slate-400 font-medium">Loading...</p>}
      {!loading && !error && codes.length === 0 && <p className="text-sm text-slate-400 font-medium">No codes yet.</p>}

      {codes.map(c => (
        <div key={c.code} className={`bg-white p-8 rounded-[2rem] shadow-sm border ${c.active ? 'border-slate-100' : 'border-slate-100 opacity-60'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span className="text-xl font-black text-slate-800 tracking-widest">{c.code}</span>
            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${c.active ? 'bg-[#fddc96] text-slate-800' : 'bg-slate-100 text-slate-500'}`}>{c.active ? 'On' : 'Off'}</span>
          </div>
          <p className="text-sm text-slate-600 mb-1">{c.months} free {c.months === 1 ? 'month' : 'months'} • used by {c.uses} of {c.maxUses} {c.maxUses === 1 ? 'family' : 'families'} • made {day(c.createdAt)}</p>
          {c.note && <p className="text-xs text-slate-500 mb-3">Note: {c.note}</p>}
          {c.redemptions.length > 0 && (
            <ul className="text-xs text-slate-600 space-y-1 mb-4">
              {c.redemptions.map(r => (
                <li key={r.email + r.at}>{r.name ? `${r.name} • ` : ''}<a className="text-[#367c92] underline" href={`mailto:${r.email}`}>{r.email}</a> • used {day(r.at)} • free through {day(r.proUntil)}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={() => copy(c.code)} className="text-[9px] font-black text-slate-600 bg-slate-100 uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-slate-200">{copied === c.code ? 'Copied' : 'Copy'}</button>
            <button type="button" onClick={() => toggle(c)} className="text-[9px] font-black text-slate-600 bg-slate-100 uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-slate-200">{c.active ? 'Turn off' : 'Turn on'}</button>
          </div>
        </div>
      ))}
    </div>
  );
};
