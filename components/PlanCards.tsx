import React from 'react';
import { MONTHLY_PRICE, YEARLY_PRICE, YEARLY_SAVE_PERCENT } from '../services/plans';

interface PlanCardsProps {
  onUpgrade: () => void;
}

// Two plan cards plus one button that opens the payment screen. Shown to families who have not upgraded.
export const PlanCards: React.FC<PlanCardsProps> = ({ onUpgrade }) => (
  <div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="p-6 rounded-[2rem] border-2 border-slate-100 bg-white text-center">
        <h4 className="text-3xl font-black text-slate-800 tracking-tighter">${MONTHLY_PRICE}</h4>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mt-1">Per Month</p>
        <p className="text-[11px] text-slate-500 font-medium mt-3 leading-relaxed">Renews every month. Cancel any time.</p>
      </div>
      <div className="p-6 rounded-[2rem] border-2 border-[#e7b64f] bg-[#e7b64f]/5 text-center relative">
        <div className="absolute -top-2.5 right-5 bg-[#e7b64f] text-slate-800 px-3 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">Save {YEARLY_SAVE_PERCENT}%</div>
        <h4 className="text-3xl font-black text-slate-800 tracking-tighter">${YEARLY_PRICE}</h4>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mt-1">Per Year</p>
        <p className="text-[11px] text-slate-500 font-medium mt-3 leading-relaxed">Renews every year. Cancel any time.</p>
      </div>
    </div>
    <button
      onClick={onUpgrade}
      className="mt-6 w-full py-4 rounded-full bg-gradient-to-r from-[#e7b64f] to-[#f4989c] text-slate-800 font-black text-[11px] uppercase tracking-[0.2em] shadow-lg hover:brightness-105 active:scale-[0.99] transition-all"
    >
      See Plans &amp; Upgrade
    </button>
  </div>
);
