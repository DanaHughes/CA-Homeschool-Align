import React, { useState } from 'react';
import { redeemPromoCode } from '../services/codeService';

interface RedeemCodeProps {
  // Called after a code works, with the date (milliseconds) the free access lasts until.
  onRedeemed: (proUntil: number) => void;
}

const prettyDate = (ms: number): string =>
  new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

export const RedeemCode: React.FC<RedeemCodeProps> = ({ onRedeemed }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<number | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setError('Please type your code.'); return; }
    setBusy(true);
    setError('');
    try {
      const result = await redeemPromoCode(code);
      setDone(result.proUntil);
      onRedeemed(result.proUntil);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-[1.5rem] bg-emerald-50 border border-emerald-100 px-6 py-5 text-center">
        <p className="text-sm font-black text-emerald-800">Your code worked!</p>
        <p className="text-[12px] text-emerald-700 font-medium mt-1">You have free Pro access through {prettyDate(done)}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[1.5rem] bg-slate-50 border border-slate-100 px-6 py-5">
      <label htmlFor="promo-code" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">Have a code?</label>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="promo-code"
          type="text"
          value={code}
          onChange={e => { setCode(e.target.value); setError(''); }}
          placeholder="Type your code"
          autoCapitalize="characters"
          autoComplete="off"
          className="flex-1 px-5 py-3 rounded-2xl border-2 border-slate-100 focus:border-[#e7b64f] outline-none font-bold text-slate-700 text-center uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-300"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-8 py-3 rounded-2xl bg-gradient-to-r from-[#e7b64f] to-[#f4989c] text-slate-800 font-black text-[11px] uppercase tracking-[0.2em] shadow-md hover:brightness-105 disabled:opacity-60 min-h-[44px]"
        >
          {busy ? 'Checking...' : 'Use code'}
        </button>
      </div>
      {error && <p className="mt-3 text-[11px] font-black text-red-500 text-center">{error}</p>}
    </form>
  );
};
