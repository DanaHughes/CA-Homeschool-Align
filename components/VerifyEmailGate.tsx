import React, { useState } from 'react';

interface VerifyEmailGateProps {
  email: string;
  onResend: () => Promise<void>;
  onCheck: () => Promise<boolean>;
  onLogout: () => void;
}

// Shown instead of the app to anyone whose email is not verified yet. Everyone must verify, no exceptions
// (the emails also go to Dana's newsletter), except the complimentary accounts.
export const VerifyEmailGate: React.FC<VerifyEmailGateProps> = ({ email, onResend, onCheck, onLogout }) => {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    setBusy(true);
    setMessage('');
    try {
      await onResend();
      setMessage('Sent. It can take a few minutes. Please check your inbox and your spam or junk folder.');
    } catch {
      setMessage('We could not send it just now. Please wait a minute and try again.');
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    setMessage('');
    try {
      const verified = await onCheck();
      if (!verified) setMessage('Not verified yet. Click the link in the email first, then press this button again.');
    } catch {
      setMessage('We could not check just now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="bg-white p-10 md:p-14 rounded-[3.5rem] shadow-[0_30px_100px_-20px_rgba(0,0,0,0.1)] max-w-md w-full border border-slate-100 text-center animate-fade-in">
        <div className="mx-auto mb-8 w-48 h-12 bg-gradient-to-r from-[#81adb3] via-[#e7b64f] to-[#f4989c] rounded-full flex items-center justify-center shadow-lg relative">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l.707.707M6.343 6.343l.707-.707M8 11h8a2 2 0 012 2v5H6v-5a2 2 0 012-2z" /></svg>
        </div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tighter leading-tight mb-3">Please verify your email</h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-2">
          We sent a link to <span className="font-black">{email}</span>. Click it, then come back here and press the gold button.
        </p>
        <p className="text-[12px] text-slate-400 font-medium leading-relaxed mb-8">
          It can take a few minutes. Check your spam or junk folder too.
        </p>
        <div className="flex flex-col gap-3">
          <button onClick={check} disabled={busy} className="w-full px-8 py-4 rounded-full bg-gradient-to-r from-[#e7b64f] to-[#f4989c] text-slate-800 font-black text-[11px] uppercase tracking-[0.2em] shadow-lg hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-60 min-h-[44px]">
            I have verified it
          </button>
          <button onClick={resend} disabled={busy} className="w-full px-8 py-4 rounded-full bg-white text-slate-700 border-2 border-slate-100 font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-all disabled:opacity-60 min-h-[44px]">
            Send it again
          </button>
          <button onClick={onLogout} className="px-8 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 min-h-[44px]">
            Log out
          </button>
        </div>
        {message && <p className="mt-6 text-sm font-bold text-slate-700">{message}</p>}
      </div>
    </div>
  );
};
