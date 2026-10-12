import React, { useState } from 'react';
import { deleteMyAccount } from '../services/accountService';

interface DeleteAccountCardProps {
  hasSubscription: boolean;
  isComplimentary: boolean;
  onDeleted: () => void;
}

// "Delete my account and data" (My Account page). Asks twice: a clear explanation, then the word DELETE.
export const DeleteAccountCard: React.FC<DeleteAccountCardProps> = ({ hasSubscription, isComplimentary, onDeleted }) => {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (isComplimentary) return null;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteMyAccount();
      onDeleted();
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-3">Privacy</p>
      <h2 className="text-2xl font-black text-slate-800 tracking-tighter mb-2">Delete my account and data</h2>
      <p className="text-sm text-slate-600 leading-relaxed mb-6">
        You can remove everything we hold about you at any time. It takes effect right away and cannot be undone.
      </p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="px-8 py-4 rounded-full border-2 border-red-200 text-red-500 font-black text-[11px] uppercase tracking-[0.2em] hover:bg-red-50 transition-all min-h-[44px]">
          Delete my account and data
        </button>
      ) : (
        <div className="rounded-[2rem] bg-red-50/60 border border-red-100 p-6 space-y-4" role="alertdialog" aria-label="Delete my account and data">
          <p className="text-sm font-black text-slate-800">This will permanently delete:</p>
          <ul className="text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1">
            <li>Your account and sign-in</li>
            <li>All students in your Vault and every saved record</li>
            <li>Your generation History</li>
            <li>Your free-trial and usage records, and any messages you sent us</li>
          </ul>
          {hasSubscription && (
            <p className="text-sm font-black text-red-600 leading-relaxed">
              Your subscription will be cancelled right away, with no refund for the current period.
            </p>
          )}
          <p className="text-[12px] text-slate-500 leading-relaxed">
            Our payment provider (Stripe) keeps its own payment records, as the law requires. If you want a copy of your Vault first, use Export Vault in the Vault tab before deleting.
          </p>
          <div>
            <label htmlFor="delete-confirm" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Type DELETE to confirm</label>
            <input
              id="delete-confirm"
              type="text"
              value={typed}
              onChange={e => { setTyped(e.target.value); setError(''); }}
              autoComplete="off"
              className="w-full px-5 py-3 rounded-2xl border-2 border-red-100 focus:border-red-300 outline-none font-bold text-slate-700 bg-white"
            />
          </div>
          {error && <p className="text-sm font-black text-red-600" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={confirm}
              disabled={busy || typed.trim() !== 'DELETE'}
              className="px-8 py-4 rounded-full bg-red-500 text-white font-black text-[11px] uppercase tracking-[0.2em] disabled:opacity-40 min-h-[44px]"
            >
              {busy ? 'Deleting...' : 'Delete everything'}
            </button>
            <button onClick={() => { setOpen(false); setTyped(''); setError(''); }} disabled={busy} className="px-8 py-4 rounded-full bg-white border-2 border-slate-100 text-slate-600 font-black text-[11px] uppercase tracking-[0.2em] min-h-[44px]">
              Keep my account
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
