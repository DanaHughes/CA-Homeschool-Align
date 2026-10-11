import React from 'react';

interface BlueprintPopupProps {
  text: string;
  buttonText: string;
  closeText: string;
  url: string;
  onClose: () => void;
}

// Shown once, when a family closes the payment screen without subscribing.
export const BlueprintPopup: React.FC<BlueprintPopupProps> = ({ text, buttonText, closeText, url, onClose }) => (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md overflow-y-auto z-[160] font-sans no-print" role="dialog" aria-modal="true" aria-label="Another way to get started">
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="bg-white p-8 md:p-10 rounded-[3rem] shadow-2xl max-w-md w-full border border-slate-100 animate-fade-in text-center">
        <p className="text-slate-700 text-base font-medium leading-relaxed whitespace-pre-line mb-8">{text}</p>
        <div className="flex flex-col gap-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="block w-full px-8 py-4 rounded-full bg-gradient-to-r from-[#e7b64f] to-[#f4989c] text-slate-800 font-black text-[11px] uppercase tracking-[0.2em] shadow-lg hover:brightness-105 min-h-[44px]"
          >
            {buttonText}
          </a>
          <button type="button" onClick={onClose} className="px-8 py-3 text-[10px] font-black text-[#367c92] uppercase tracking-widest hover:text-slate-600 min-h-[44px]">
            {closeText}
          </button>
        </div>
      </div>
    </div>
  </div>
);
