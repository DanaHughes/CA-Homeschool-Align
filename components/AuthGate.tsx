import React, { useState } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';

interface AuthGateProps {
  onLogin: (user: User) => void;
  onShowTerms: () => void;
}

const LogoIcon = ({ className = "w-48 h-12" }) => (
  <div className={`${className} bg-gradient-to-r from-[#81adb3] via-[#e7b64f] to-[#f4989c] rounded-full flex items-center justify-center shadow-lg relative transition-all hover:brightness-105 no-print`}>
    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l.707.707M6.343 6.343l.707-.707M8 11h8a2 2 0 012 2v5H6v-5a2 2 0 012-2z" />
    </svg>
    <div className="absolute top-1 right-3 w-3 h-3 bg-white/40 rounded-full border border-white/60"></div>
  </div>
);

export const AuthGate: React.FC<AuthGateProps> = ({ onLogin, onShowTerms }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [requiredConsentsAccepted, setRequiredConsentsAccepted] = useState(false);
  const [facebookAccepted, setFacebookAccepted] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    if (mode === 'signup' && !requiredConsentsAccepted) {
        setError('Agreement to academic tracking terms is required.');
        return;
    }

    setIsLoading(true);
    try {
      if (mode === 'signup') {
        const user = await authService.signUp(name, email, password, { 
          terms: true, 
          newsletter: true, 
          facebook: facebookAccepted 
        });
        setSuccessMsg("Account created! Redirecting to classroom...");
        setTimeout(() => onLogin(user), 1500);
      } else {
        const user = await authService.login(email, password);
        onLogin(user);
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      if (err.message?.includes('auth/invalid-credential') || err.message?.includes('auth/user-not-found')) {
        setError("Account not found or password incorrect.");
      } else if (err.message?.includes('auth/email-already-in-use')) {
        setError("This email is already registered. Try logging in instead, or use a different email.");
      } else if (err.message?.includes('User record not found')) {
        setError("Account found but missing data. Please try logging in - we'll fix this automatically.");
      } else if (err.code === 'permission-denied' || err.message?.includes('permission')) {
        setError("Permission error. Please make sure Firestore rules are deployed in Firebase Console.");
      } else {
        setError(err.message || "Unable to connect. Please check your connection and try again.");
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#81adb3] opacity-10 blur-[100px] rounded-full"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#f4989c] opacity-10 blur-[100px] rounded-full"></div>

      <div className="bg-white p-10 md:p-14 rounded-[3.5rem] shadow-[0_30px_100px_-20px_rgba(0,0,0,0.1)] max-w-md w-full border border-slate-100 relative z-10 animate-fade-in text-center">
        <div className="text-center mb-10">
            <LogoIcon className="mx-auto mb-8" />
            <h1 className="text-4xl font-black text-slate-800 tracking-tighter leading-tight mb-2">
                Homeschool Work Sample Pro
            </h1>
            <p className="text-[#81adb3] text-[11px] font-black uppercase tracking-[0.2em] mb-4 leading-relaxed max-w-[280px] mx-auto">
                MAKING HOMESCHOOL DOABLE.
            </p>
            <p className="text-slate-400 text-[11px] font-medium leading-relaxed max-w-[320px] mx-auto mb-6">
                Turn any homeschool activity into a charter-ready work sample. Just snap a photo or describe the activity, and we'll match standards, generate documentation, and create a polished PDF in seconds.
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 text-left">
          {mode === 'signup' && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-[0.15em]">Account User Name</label>
              <input
                type="text" required value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name or Organization"
                className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:border-[#81adb3] outline-none transition-all placeholder:text-slate-300 font-medium"
              />
            </div>
          )}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-[0.15em]">Email</label>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
              className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:border-[#81adb3] outline-none transition-all placeholder:text-slate-300 font-medium"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-[0.15em]">Password</label>
            <input
              type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:border-[#81adb3] outline-none transition-all placeholder:text-slate-300 font-medium"
            />
          </div>

          {mode === 'signup' && (
            <div className="space-y-4 pt-2">
                <label className="flex items-start gap-4 cursor-pointer group">
                    <input 
                        type="checkbox" checked={requiredConsentsAccepted} onChange={(e) => setRequiredConsentsAccepted(e.target.checked)}
                        className="mt-1 w-5 h-5 rounded-lg border-slate-300 text-[#81adb3] focus:ring-[#81adb3] transition-all" 
                    />
                    <div className="text-[12px] text-slate-500 font-medium leading-relaxed">
                        I agree to the academic tracking <button type="button" onClick={(e) => { e.preventDefault(); onShowTerms(); }} className="text-[#81adb3] font-bold hover:underline">terms and conditions</button>. <span className="text-red-400 font-bold">*</span>
                    </div>
                </label>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 p-5 rounded-3xl text-[11px] font-bold border border-red-100 animate-fade-in shadow-sm">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 text-emerald-700 p-5 rounded-3xl text-[11px] font-bold border border-emerald-100 animate-fade-in shadow-sm">
              {successMsg}
            </div>
          )}

          <button
            type="submit" disabled={isLoading}
            className="w-full py-5 bg-[#e7b64f] hover:bg-[#d9a43a] text-white font-black rounded-2xl shadow-xl shadow-[#e7b64f]/20 transition-all flex justify-center items-center gap-2 transform active:scale-95 uppercase tracking-[0.2em] text-[11px] disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : (mode === 'signup' ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-10 text-center border-t border-slate-50 pt-8">
          <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest flex items-center justify-center gap-2">
            {mode === 'signup' ? 'Already have an account?' : 'New here?'}
            <button 
                onClick={() => {
                  setMode(mode === 'signup' ? 'login' : 'signup');
                  setError('');
                  setSuccessMsg('');
                }}
                className="text-[#e7b64f] hover:underline decoration-2 underline-offset-4"
            >
                {mode === 'signup' ? 'Log In' : 'Join Free'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};