
import React, { useState } from 'react';

interface AccessGateUser {
  id: string;
  email: string;
  name?: string;
}

interface AccessGateProps {
  user?: AccessGateUser | null;
  onUnlock: (name: string, code: string) => void;
  onCancel?: () => void;
}

const LogoIcon = ({ className = "w-16 h-16" }) => (
  <div className={`${className} relative flex items-center justify-center bg-gradient-to-br from-[#81adb3] via-[#e7b64f] to-[#f4989c] rounded-2xl shadow-xl transition-transform hover:scale-105`}>
    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l.707.707M6.343 6.343l.707-.707M8 11h8a2 2 0 012 2v5H6v-5a2 2 0 012-2z" />
    </svg>
  </div>
);

export const AccessGate: React.FC<AccessGateProps> = ({ user, onUnlock, onCancel }) => {
  const [inputCode, setInputCode] = useState('');
  const [userName, setUserName] = useState(user?.name || '');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');

  const envCode = process.env.VITE_ACCESS_CODE;
  const validCode = (envCode || 'TEACH2025').trim().toUpperCase();

  const handleStripeCheckout = async () => {
    const nameAttempt = userName.trim();
    if (!nameAttempt) {
      setError('Please enter your Account User Name first.');
      return;
    }
    if (!user) {
      setError('You must be logged in to start checkout.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Persist the chosen name so we can apply it after the Stripe redirect return.
      sessionStorage.setItem('pending_stripe_name', nameAttempt);

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          userName: nameAttempt,
          plan: selectedPlan
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Unable to start Stripe checkout.');
      }

      // Redirect the browser to Stripe Checkout.
      window.location.href = data.url;
    } catch (err: any) {
      console.error('Stripe checkout error:', err);
      sessionStorage.removeItem('pending_stripe_name');
      setError(err?.message || 'Stripe checkout is unavailable. Please try again later.');
      setIsProcessing(false);
    }
  };

  const handleCheckout = (provider: string) => {
    if (provider === 'stripe') {
      handleStripeCheckout();
      return;
    }

    const nameAttempt = userName.trim();
    if (!nameAttempt) {
      setError('Please enter your Account User Name first.');
      return;
    }
    setIsProcessing(true);
    // Simulate payment processing for non-Stripe providers (Google Pay, Square placeholders)
    setTimeout(() => {
      onUnlock(nameAttempt, `BETA_CHECKOUT_${provider.toUpperCase()}`);
      setIsProcessing(false);
    }, 2500);
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const userAttempt = inputCode.trim().toUpperCase();
    const nameAttempt = userName.trim();

    if (!nameAttempt) { setError('Name is required for license registry.'); return; }
    if (userAttempt === validCode) {
      setIsProcessing(true);
      setTimeout(() => onUnlock(nameAttempt, userAttempt), 1000);
    } else {
      setError('Invalid code. Check your Stan Store receipt.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center z-[150] p-6 font-sans">
      <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-2xl max-w-lg w-full border border-slate-100 animate-fade-in relative overflow-hidden">
        
        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-10">
            <LogoIcon className="mb-6" />
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-2 tracking-tighter leading-none">Unlock Beta License</h1>
            <p className="text-slate-500 text-sm font-medium px-4">Your 25 trial matches are complete. Join our early adopter community to continue aligning your classroom.</p>
        </div>

        {/* Name Registration */}
        <div className="mb-10">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest text-center">Step 1: Confirm Registry Identity</label>
            <input
              type="text" required value={userName}
              onChange={(e) => { setUserName(e.target.value); setError(''); }}
              placeholder="Name or Organization for Transcripts"
              className="w-full px-8 py-5 rounded-[2rem] border-2 border-slate-100 focus:ring-4 focus:ring-[#e7b64f]/10 focus:border-[#e7b64f] outline-none transition-all placeholder:text-slate-200 text-center font-bold text-slate-700"
            />
        </div>

        {/* Plan Selector */}
        <div className="mb-10 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#81adb3] text-white px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg z-10">Special Beta Pricing</div>

            <div className="grid grid-cols-2 gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedPlan('monthly')}
                  className={`p-6 rounded-[2rem] border-2 transition-all text-center ${
                    selectedPlan === 'monthly'
                      ? 'border-[#81adb3] bg-[#81adb3]/5 shadow-lg'
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                    <h4 className="text-3xl font-black text-slate-800 tracking-tighter">$7.99</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mt-1">Per Month</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlan('annual')}
                  className={`p-6 rounded-[2rem] border-2 transition-all text-center relative ${
                    selectedPlan === 'annual'
                      ? 'border-[#e7b64f] bg-[#e7b64f]/5 shadow-lg'
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                    <div className="absolute -top-2.5 right-4 bg-[#e7b64f] text-white px-3 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">Save 38%</div>
                    <h4 className="text-3xl font-black text-slate-800 tracking-tighter">$59</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mt-1">Per Year</p>
                </button>
            </div>

            <div className="mt-6 text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 leading-relaxed">
                   Unlimited Standards Alignment • Infinite Vault Storage • Official PDF Transcripts • Lifetime Beta Badge
                </p>
            </div>

            <div className="mt-4">
                <p className="text-[8px] font-bold text-[#f4989c] uppercase tracking-widest text-center leading-relaxed">
                   Beta pricing for early adopters. Renewal rates may reflect standard market pricing.
                </p>
            </div>
        </div>
        
        {/* Secure Payment Options */}
        <div className="space-y-4">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.25em] text-center mb-4">Secure Checkout Powered by</p>
            
            <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => handleCheckout('stripe')}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M13.911 8.612c0-.574-.498-.822-1.362-.822-.851 0-1.796.155-2.685.474l-.367-3.238c.948-.362 2.035-.556 3.238-.556 2.66 0 4.413 1.294 4.413 3.613 0 3.353-4.524 3.93-4.524 5.224 0 .477.411.754 1.23.754.912 0 2.022-.244 3.012-.662l.354 3.123c-1.012.445-2.221.682-3.486.682-2.73 0-4.341-1.363-4.341-3.614 0-3.327 4.524-4.041 4.524-5.003M19.345 5.253H23l-1.328 12.5H18.017l1.328-12.5zM4.655 5.253h3.655L6.982 17.753H3.327L4.655 5.253zM10.024 5.253h3.655l-.337 3.123h-3.655l.337-3.123z"/></svg>
                    Pay with Stripe
                </button>
                
                <div className="flex gap-3">
                    <button 
                      onClick={() => handleCheckout('google')}
                      className="flex-grow py-4 bg-white border-2 border-slate-100 text-slate-800 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-50 transition-all"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
                        Google Pay
                    </button>
                    <button 
                      onClick={() => handleCheckout('square')}
                      className="flex-grow py-4 bg-white border-2 border-slate-100 text-slate-800 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-50 transition-all"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0H5C2.239 0 0 2.239 0 5V19C0 21.761 2.239 24 5 24H19C21.761 24 24 21.761 24 19V5C24 2.239 21.761 0 19 0ZM19 19H5V5H19V19ZM17 12V7H7V17H12V15H9V9H15V12H17Z"/></svg>
                        Square
                    </button>
                </div>
            </div>
        </div>

        {error && (
            <div className="mt-6 bg-red-50 text-red-500 text-[10px] font-black p-4 rounded-2xl flex items-center gap-2 justify-center border border-red-100 animate-fade-in">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
        )}

        <div className="mt-10 pt-8 border-t border-slate-50 text-center space-y-4">
            {showCodeInput ? (
                <form onSubmit={handleCodeSubmit} className="space-y-4 animate-fade-in">
                    <input
                      type="password" required value={inputCode}
                      onChange={(e) => { setInputCode(e.target.value); setError(''); }}
                      placeholder="ENTER ACCESS CODE"
                      className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-[#81adb3]/10 focus:border-[#81adb3] outline-none transition-all font-mono tracking-widest text-center"
                    />
                    <div className="flex gap-2">
                        <button type="submit" className="flex-grow py-4 bg-slate-800 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest">Verify Code</button>
                        <button type="button" onClick={() => setShowCodeInput(false)} className="px-6 py-4 bg-slate-100 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cancel</button>
                    </div>
                </form>
            ) : (
                <div className="flex flex-col items-center gap-4">
                    <button onClick={() => setShowCodeInput(true)} className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-[#81adb3] transition-colors underline underline-offset-4 decoration-1">I already have an access code</button>
                    {onCancel && <button onClick={onCancel} className="text-[10px] font-black text-[#81adb3] uppercase tracking-widest hover:text-slate-600 transition-colors">Continue with Trial Tier</button>}
                </div>
            )}
        </div>

        {isProcessing && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-fade-in">
             <div className="w-12 h-12 border-4 border-[#81adb3]/20 border-t-[#81adb3] rounded-full animate-spin mb-4"></div>
             <p className="text-[10px] font-black text-[#81adb3] uppercase tracking-widest animate-pulse">Redirecting to Secure Checkout...</p>
          </div>
        )}
      </div>
    </div>
  );
};
