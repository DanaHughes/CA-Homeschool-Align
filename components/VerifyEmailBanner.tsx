import React, { useState } from 'react';

interface VerifyEmailBannerProps {
  email: string;
  onResend: () => Promise<void>;
  onCheck: () => Promise<boolean>;
}

// Shown to families who have not clicked the link in their "verify your email" message.
// The free trial needs a verified email.
export const VerifyEmailBanner: React.FC<VerifyEmailBannerProps> = ({ email, onResend, onCheck }) => {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    setBusy(true);
    setMessage('');
    try {
      await onResend();
      setMessage('Sent. Please check your inbox and your spam folder.');
    } catch (e) {
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
    } catch (e) {
      setMessage('We could not check just now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mb-8 bg-[#fddc96]/40 border border-[#e7b64f]/40 rounded-[2rem] px-6 py-5 animate-fade-in no-print" role="status">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-700 mb-1">Please verify your email</p>
      <p className="text-sm text-slate-600 leading-relaxed mb-4">
        Your free generations start after you verify your email. We sent a link to <span className="font-black">{email}</span>. Click it, then come back and press the second button.
      </p>
      <div className="flex flex-wrap gap-3">
        <button onClick={resend} disabled={busy} className="px-6 py-2.5 rounded-full bg-white text-slate-700 border-2 border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 transition-all disabled:opacity-60">Send it again</button>
        <button onClick={check} disabled={busy} className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#e7b64f] to-[#f4989c] text-slate-800 text-[10px] font-black uppercase tracking-[0.2em] shadow-md hover:brightness-105 active:scale-95 transition-all disabled:opacity-60">I have verified it</button>
      </div>
      {message && <p className="mt-3 text-sm font-bold text-slate-700">{message}</p>}
    </div>
  );
};
