import React, { useEffect, useState } from 'react';
import {
  InstallKind,
  detectInstallKind,
  currentEnv,
  isTouchDevice,
  isInstalledApp,
  shouldAutoShow,
  snoozePrompt,
  neverShowPrompt,
  installSteps,
  canOneTapInstall,
  runOneTapInstall,
  onInstallAvailabilityChange
} from '../services/installHelpers';

interface ModalProps {
  onClose: () => void;
  // The automatic pop-up offers "Maybe later" and "Don't show again". The Start Here card does not.
  auto?: boolean;
}

const InstallModal: React.FC<ModalProps> = ({ onClose, auto }) => {
  const kind: InstallKind = detectInstallKind(currentEnv());
  const [oneTap, setOneTap] = useState(canOneTapInstall());
  const info = installSteps(kind);

  useEffect(() => onInstallAvailabilityChange(() => setOneTap(canOneTapInstall())), []);

  const install = async () => {
    const accepted = await runOneTapInstall();
    if (accepted) {
      neverShowPrompt();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[900] bg-slate-900/50 backdrop-blur-md flex items-end sm:items-center justify-center p-4 no-print" role="dialog" aria-modal="true" aria-label="Add to your home screen">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-4 mb-5">
          <img src="/icons/icon-192.png" alt="" className="w-16 h-16 rounded-2xl shadow-md" />
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">Add this app to your home screen</h3>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#367c92] mt-1">One tap to open, like any app</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed mb-5">
          Keep your work sample maker on your {kind === 'ios' || kind === 'android' || kind === 'inapp' ? 'phone or tablet' : 'computer'} so you can open it full screen, any time, without searching for the link.
        </p>

        {oneTap && kind !== 'inapp' ? (
          <button type="button" onClick={install} className="w-full py-4 mb-4 bg-gradient-to-r from-[#e7b64f] to-[#f4989c] text-slate-900 font-black rounded-2xl uppercase tracking-widest text-[11px] shadow-lg">
            Add to home screen
          </button>
        ) : (
          <div className="bg-[#81adb3]/10 rounded-3xl p-5 mb-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#367c92] mb-3">{info.title}</p>
            <ol className="space-y-3">
              {info.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-700 leading-snug">
                  <span className="flex-none w-6 h-6 rounded-full bg-[#e7b64f] text-slate-900 text-xs font-black flex items-center justify-center">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            {info.note && <p className="text-xs text-slate-500 mt-4">{info.note}</p>}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => { if (auto) snoozePrompt(); onClose(); }} className="w-full py-3 rounded-2xl border-2 border-slate-200 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:border-[#81adb3] min-h-[44px]">
            {auto ? 'Maybe later' : 'Close'}
          </button>
          {auto && (
            <button type="button" onClick={() => { neverShowPrompt(); onClose(); }} className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 min-h-[40px]">
              Don't show this again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Automatic pop-up: phones and tablets only, never when already installed, and not again for
// two weeks after "Maybe later".
export const InstallPrompt: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isInstalledApp()) return;
    if (!isTouchDevice(detectInstallKind(currentEnv()))) return;
    if (!shouldAutoShow()) return;
    const t = setTimeout(() => setOpen(true), 6000);
    return () => clearTimeout(t);
  }, []);

  return open ? <InstallModal auto onClose={() => setOpen(false)} /> : null;
};

// Permanent directions on the Start Here page.
export const InstallDirections: React.FC = () => {
  const [open, setOpen] = useState(false);
  const installed = isInstalledApp();

  return (
    <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 text-center">
      <h3 className="text-xl font-black text-slate-800 mb-3 uppercase tracking-tighter">Add This App to Your Home Screen</h3>
      {installed ? (
        <p className="text-sm text-slate-500">You're already using the home screen app. Nothing more to do.</p>
      ) : (
        <>
          <p className="text-sm text-slate-500 mb-6 max-w-xl mx-auto">Open it with one tap, full screen, like any other app. It takes about 20 seconds.</p>
          <button type="button" onClick={() => setOpen(true)} className="px-8 py-4 bg-[#e7b64f] text-slate-900 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-[#d9a43a] transition-all">Show me how</button>
        </>
      )}
      {open && <InstallModal onClose={() => setOpen(false)} />}
    </div>
  );
};
