import React, { useState } from 'react';
import { User } from '../types';
import { PlanCards } from './PlanCards';
import { RedeemCode } from './RedeemCode';
import { hasCodeAccess } from '../services/accessHelpers';
import { planLabel } from '../services/plans';
import { openBillingPortal } from '../services/billingService';
import { TrialStatus } from '../services/trialService';

interface PlanPageProps {
  user: User;
  isPro: boolean;
  isComplimentary: boolean;
  trial: TrialStatus;
  onUpgrade: () => void;
  onCodeRedeemed: (proUntil: number) => void;
}

const prettyDate = (ms?: number): string =>
  ms ? new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';

export const PlanPage: React.FC<PlanPageProps> = ({ user, isPro, isComplimentary, trial, onUpgrade, onCodeRedeemed }) => {
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState('');

  const handleManage = async () => {
    setIsOpening(true);
    setError('');
    try {
      await openBillingPortal();
    } catch (e: any) {
      setError(e?.message || 'We could not open the billing page. Please try again.');
      setIsOpening(false);
    }
  };

  const hasBilling = !!user.stripeCustomerId;
  const onCode = !isComplimentary && !user.isPaid && hasCodeAccess(user);

  return (
    <div className="animate-fade-in space-y-8 max-w-3xl mx-auto">
      <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#367c92] mb-3">My Account</p>

        {isComplimentary && (
          <>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter mb-3">Pro, complimentary</h2>
            <p className="text-sm text-slate-600 leading-relaxed">Your account has free Pro access. There is nothing to pay and nothing to manage here.</p>
          </>
        )}

        {onCode && (
          <>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter mb-1">Pro: free access</h2>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">Through {prettyDate(user.proUntil)}</p>
            <p className="text-sm text-slate-600 leading-relaxed mb-8">Your promo code gives you free Pro access. Nothing is charged and nothing renews. Before it ends, you can choose a plan if you want to keep going.</p>
            <div className="mb-8"><RedeemCode onRedeemed={onCodeRedeemed} /></div>
            <PlanCards onUpgrade={onUpgrade} />
          </>
        )}

        {!onCode && !isComplimentary && isPro && (
          <>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter mb-1">Pro: {planLabel(user.subscriptionPlan)}</h2>
            {user.paidAt ? <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">Member since {prettyDate(user.paidAt)}</p> : <div className="mb-4" />}

            {hasBilling ? (
              <>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  Open Stripe's secure page to cancel, update your card, or see your receipts. If you cancel, you keep Pro through the end of the period you have already paid for.
                </p>
                <button
                  onClick={handleManage}
                  disabled={isOpening}
                  className="w-full sm:w-auto px-10 py-4 rounded-full bg-gradient-to-r from-[#e7b64f] to-[#f4989c] text-slate-800 font-black text-[11px] uppercase tracking-[0.2em] shadow-lg hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-60"
                >
                  {isOpening ? 'Opening...' : 'Manage subscription'}
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-600 leading-relaxed">
                Your Pro access is active. The self-service billing page is not linked to this account yet. If you need to cancel or change your card, use "Report a bug" in the FAQs on the Start Here page and we will help you.
              </p>
            )}
          </>
        )}

        {!isPro && (
          <>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter mb-3">{trial.over ? 'Free trial ended' : 'Free trial'}</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-8">
              {trial.over
                ? 'Your free trial has ended. Your saved work and PDF export stay yours. Choose a plan to keep creating work samples.'
                : trial.started
                  ? <>You have <span className="font-black">{trial.remaining}</span> free {trial.remaining === 1 ? 'generation' : 'generations'} available for the next <span className="font-black">{trial.daysLeft}</span> {trial.daysLeft === 1 ? 'day' : 'days'}. Upgrade any time to keep going.</>
                  : <>You have <span className="font-black">{trial.generations}</span> free generations available for <span className="font-black">{trial.days}</span> days. Your {trial.days} days start with your first one.</>}
            </p>
            <div className="mb-8"><RedeemCode onRedeemed={onCodeRedeemed} /></div>
            <PlanCards onUpgrade={onUpgrade} />
          </>
        )}

        {error && (
          <div className="mt-6 bg-red-50 text-red-500 text-[11px] font-black p-4 rounded-2xl border border-red-100">{error}</div>
        )}
      </div>
    </div>
  );
};
