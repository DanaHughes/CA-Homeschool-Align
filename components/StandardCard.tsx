
import React, { useState } from 'react';
import { Standard } from '../types';
import { explainStandardMatch } from '../services/geminiService';

interface StandardCardProps {
  standard: Standard;
  onSelect?: (s: Standard) => void;
  isSelected?: boolean;
  isPro?: boolean;
  onUpgradeRequest?: () => void;
  searchQuery?: string;
}

export const StandardCard: React.FC<StandardCardProps> = ({ 
    standard, onSelect, isSelected, isPro = false, onUpgradeRequest, searchQuery 
}) => {
  const [showLogic, setShowLogic] = useState(false);
  const [logicText, setLogicText] = useState<string | undefined>(standard.relevanceReason);
  const [isLoadingLogic, setIsLoadingLogic] = useState(false);

  const subjectColor = {
    'ELA': 'bg-blue-50 text-blue-700 border-blue-200',
    'Math': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Science': 'bg-purple-50 text-purple-700 border-purple-200',
    'History': 'bg-amber-50 text-amber-700 border-amber-200',
    'Other': 'bg-slate-50 text-slate-700 border-slate-200',
  }[standard.subject] || 'bg-slate-50 text-slate-700 border-slate-200';

  const handleToggleLogic = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPro) {
        onUpgradeRequest?.();
        return;
    }
    
    if (showLogic) {
      setShowLogic(false);
      return;
    }

    setShowLogic(true);
    // Fetch logic if we don't have it yet
    if (!logicText) {
      setIsLoadingLogic(true);
      const context = searchQuery || "the provided evidence";
      const reason = await explainStandardMatch(standard, context);
      setLogicText(reason);
      setIsLoadingLogic(false);
    }
  };

  // Always show the toggle for Inferred Match Logic to ensure visibility on all devices
  const canShowLogic = true; 

  return (
    <div className={`relative p-6 border rounded-[2rem] shadow-sm transition-all duration-300 group ${isSelected ? 'border-[#81adb3] bg-[#81adb3]/5 ring-1 ring-[#81adb3]' : 'border-slate-100 bg-white hover:border-[#81adb3]/40'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-2 flex-wrap">
          <span className={`px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest border ${subjectColor}`}>
            {standard.subject}
          </span>
          <span className="px-2.5 py-1 text-[9px] font-bold bg-slate-50 text-slate-500 rounded-lg border border-slate-200 uppercase tracking-widest">
            {standard.gradeLevel}
          </span>
        </div>
      </div>

      <h4 className="font-mono text-[10px] font-black text-slate-400 mb-3 tracking-widest">{standard.code}</h4>
      
      <div className="relative min-h-[80px]">
        <p className={`text-slate-600 text-[13.5px] leading-relaxed mb-4 font-serif transition-all duration-500 ${isPro ? '' : 'blur-[4px] select-none opacity-40 group-hover:opacity-60'}`}>
          {isPro ? standard.description : "Standard description hidden in free tier. Join Pro to see full academic alignment."}
        </p>
        {!isPro && (
            <div className="absolute inset-0 flex items-center justify-center">
                <button onClick={(e) => { e.stopPropagation(); onUpgradeRequest?.(); }} className="px-5 py-2.5 bg-slate-800 text-white text-[10px] font-black rounded-xl shadow-lg uppercase tracking-widest border border-slate-700 transition-transform active:scale-95">
                    Unlock Pro
                </button>
            </div>
        )}
      </div>
      
      {canShowLogic && (
        <div className={`mt-4 pt-4 border-t border-slate-50 transition-all ${!isPro ? 'opacity-50' : ''}`}>
           <button onClick={handleToggleLogic} className="text-[9px] font-black text-[#81adb3] hover:text-[#6d969c] flex items-center gap-1.5 focus:outline-none uppercase tracking-widest group/logic transition-colors">
             <div className={`p-1 rounded bg-[#81adb3]/10 transform transition-transform ${showLogic ? 'rotate-180' : ''}`}>
               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
             </div>
             Inferred Match Logic {!isPro && '🔒'}
           </button>

           {showLogic && isPro && (
             <div className="mt-3 p-5 bg-slate-100/50 rounded-2xl border border-slate-100 animate-fade-in shadow-inner">
                <p className="text-[9px] font-black text-[#81adb3] uppercase tracking-[0.25em] mb-2 leading-none">THE ACADEMIC HOOK:</p>
                {isLoadingLogic ? (
                  <div className="flex items-center gap-2 text-slate-400 text-[12px] font-medium py-1">
                    <div className="w-1.5 h-1.5 bg-[#81adb3] rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-[#81adb3] rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span>Mapping...</span>
                  </div>
                ) : (
                  <p className="text-[13.5px] text-slate-700 italic font-medium leading-relaxed font-serif">
                    {logicText || "Mapping this activity to the framework hooks..."}
                  </p>
                )}
             </div>
           )}
        </div>
      )}

      {isPro && onSelect && (
        <button
          onClick={() => onSelect({ ...standard, relevanceReason: logicText })}
          className={`mt-6 w-full py-4 text-[10px] font-black rounded-2xl flex items-center justify-center gap-2 transition-all transform active:scale-95 uppercase tracking-widest ${isSelected ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-[#81adb3] text-white hover:bg-[#6d969c] shadow-lg shadow-[#81adb3]/20'}`}
        >
          {isSelected ? (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg> Added to Log</>
          ) : '+ Add to Record'}
        </button>
      )}
    </div>
  );
};
