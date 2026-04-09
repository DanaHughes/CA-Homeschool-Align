
import React, { useState, useRef } from 'react';
import { ATSScanResult, ATSFlag } from '../types';
import { scanResume } from '../services/geminiService';

interface ATSResumeScannerProps {
  isPro: boolean;
  onUpgradeRequest: () => void;
}

const ScoreRing = ({ score, size = 120 }: { score: number; size?: number }) => {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 85 ? '#10b981' : score >= 70 ? '#e7b64f' : score >= 50 ? '#f97316' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth="10" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth="10" fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-slate-800">{score}</span>
        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">/ 100</span>
      </div>
    </div>
  );
};

const CategoryBar = ({ name, score, maxScore, feedback, suggestions }: {
  name: string; score: number; maxScore: number; feedback: string; suggestions: string[];
}) => {
  const [expanded, setExpanded] = useState(false);
  const pct = (score / maxScore) * 100;
  const barColor = pct >= 85 ? 'bg-emerald-500' : pct >= 70 ? 'bg-[#e7b64f]' : pct >= 50 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="border border-slate-100 rounded-2xl p-5 bg-white hover:border-[#81adb3]/30 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-700">{name}</h4>
        <span className="text-[11px] font-black text-slate-500">{score}<span className="text-slate-300">/{maxScore}</span></span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5 mb-3">
        <div className={`h-2.5 rounded-full transition-all duration-700 ease-out ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[12px] text-slate-500 font-medium mb-2">{feedback}</p>

      {suggestions.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[9px] font-black text-[#81adb3] hover:text-[#6d969c] flex items-center gap-1.5 uppercase tracking-widest mt-1 transition-colors"
        >
          <div className={`p-0.5 rounded bg-[#81adb3]/10 transform transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {suggestions.length} Suggestion{suggestions.length > 1 ? 's' : ''}
        </button>
      )}

      {expanded && (
        <ul className="mt-3 space-y-2 animate-fade-in">
          {suggestions.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-slate-600 font-medium leading-relaxed">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#e7b64f] flex-shrink-0" />
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const severityConfig = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700 ring-red-200',
    icon: 'text-red-400',
    label: 'Critical',
    barColor: 'bg-red-400',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700 ring-amber-200',
    icon: 'text-amber-400',
    label: 'Warning',
    barColor: 'bg-amber-400',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700 ring-blue-200',
    icon: 'text-blue-400',
    label: 'Info',
    barColor: 'bg-blue-400',
  },
};

const FlaggedItem = ({ flag }: { flag: ATSFlag }) => {
  const config = severityConfig[flag.severity] || severityConfig.info;

  return (
    <div className={`rounded-2xl border ${config.border} ${config.bg} overflow-hidden`}>
      <div className={`h-1 ${config.barColor}`} />
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <code className="text-[12px] font-bold text-slate-800 bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200 break-all leading-relaxed">
            {flag.excerpt}
          </code>
          <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md ring-1 flex-shrink-0 ${config.badge}`}>
            {config.label}
          </span>
        </div>
        <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
          <span className={`font-black ${config.icon}`}>Issue: </span>{flag.issue}
        </p>
        <div className="flex items-start gap-2 bg-white/60 rounded-xl px-4 py-3 border border-slate-100">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[12px] text-emerald-700 font-bold leading-relaxed">{flag.fix}</p>
        </div>
      </div>
    </div>
  );
};

export const ATSResumeScanner: React.FC<ATSResumeScannerProps> = ({ isPro, onUpgradeRequest }) => {
  const [resumeText, setResumeText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ATSScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScan = async () => {
    if (!isPro) {
      onUpgradeRequest();
      return;
    }

    if (!resumeText.trim()) {
      setError('Please paste your resume text to scan.');
      return;
    }

    if (resumeText.trim().length < 50) {
      setError('Resume text seems too short. Please paste your full resume.');
      return;
    }

    setError(null);
    setIsScanning(true);
    setScanResult(null);

    try {
      const result = await scanResume(resumeText);
      setScanResult(result);
    } catch (err: any) {
      if (err.message === "DAILY_LIMIT_REACHED") {
        setError("Daily scan limit reached. Please try again tomorrow.");
      } else {
        setError("Scan failed. Please try again.");
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/plain') {
      setError('Please upload a .txt file. For best results, copy-paste your resume text directly.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setResumeText(text);
        setError(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleReset = () => {
    setScanResult(null);
    setResumeText('');
    setError(null);
  };

  const gradeColor = (grade: string) => {
    switch (grade) {
      case 'Excellent': return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
      case 'Good': return 'bg-[#e7b64f]/15 text-[#b8922e] ring-[#e7b64f]/30';
      case 'Fair': return 'bg-orange-100 text-orange-700 ring-orange-200';
      case 'Poor': return 'bg-red-100 text-red-700 ring-red-200';
      default: return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  };

  return (
    <div className="animate-fade-in space-y-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#81adb3]/10 rounded-full">
          <svg className="w-4 h-4 text-[#81adb3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-[9px] font-black text-[#81adb3] uppercase tracking-widest">ATS Resume Scanner</span>
        </div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tighter">
          How ATS-Ready Is Your Resume?
        </h2>
        <p className="text-sm text-slate-500 font-medium max-w-xl mx-auto leading-relaxed">
          Paste your resume below and get instant feedback on how well it will perform with Applicant Tracking Systems. Get a readability score and actionable suggestions.
        </p>
      </div>

      {/* Input Section */}
      {!scanResult && (
        <div className="bg-white p-8 md:p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">Your Resume</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[9px] font-black text-[#81adb3] uppercase tracking-widest hover:text-[#6d969c] transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload .txt
              </button>
              <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
              {resumeText && (
                <button
                  onClick={() => { setResumeText(''); setError(null); }}
                  className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <textarea
            value={resumeText}
            onChange={(e) => { setResumeText(e.target.value); setError(null); }}
            placeholder="Paste your full resume text here...&#10;&#10;Tip: Copy everything from your resume document (name, contact info, experience, education, skills) and paste it here for the most accurate analysis."
            className="w-full h-64 px-6 py-5 rounded-2xl border border-slate-100 outline-none font-medium text-sm text-slate-700 leading-relaxed resize-none focus:border-[#81adb3]/40 focus:ring-2 focus:ring-[#81adb3]/10 transition-all placeholder:text-slate-300"
          />

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 rounded-xl border border-red-100">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[11px] font-bold text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={isScanning || !resumeText.trim()}
            className="w-full py-5 bg-[#81adb3] text-white font-black rounded-2xl uppercase tracking-widest text-[11px] hover:bg-[#6d969c] transition-all shadow-lg shadow-[#81adb3]/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isScanning ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scanning Resume...
              </span>
            ) : !isPro ? (
              'Unlock Pro to Scan'
            ) : (
              'Scan My Resume'
            )}
          </button>
        </div>
      )}

      {/* Scanning Animation */}
      {isScanning && (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <div className="relative mb-8">
            <div className="w-16 h-16 border-4 border-[#81adb3]/20 border-t-[#81adb3] rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#e7b64f] animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <p className="text-[#81adb3] font-black text-[10px] uppercase tracking-[0.25em] animate-pulse">Analyzing ATS Compatibility...</p>
        </div>
      )}

      {/* Results Section */}
      {scanResult && (
        <div className="space-y-8 animate-fade-in">
          {/* Overall Score Card */}
          <div className="bg-white p-8 md:p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <ScoreRing score={scanResult.overallScore} />
              <div className="flex-1 text-center md:text-left space-y-3">
                <div className="flex items-center gap-3 justify-center md:justify-start">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tighter">ATS Readability Score</h3>
                  <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg ring-1 ${gradeColor(scanResult.readabilityGrade)}`}>
                    {scanResult.readabilityGrade}
                  </span>
                </div>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">{scanResult.summary}</p>
              </div>
            </div>
          </div>

          {/* Top Issues */}
          {scanResult.topIssues.length > 0 && (
            <div className="bg-[#e7b64f]/5 p-8 md:p-10 rounded-[3rem] border border-[#e7b64f]/20">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-[#b8922e] mb-5 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Fix These First
              </h3>
              <div className="space-y-3">
                {scanResult.topIssues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-[#e7b64f] text-white rounded-lg flex items-center justify-center font-black text-[10px] flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-700 font-medium leading-relaxed">{issue}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flagged Content */}
          {scanResult.flaggedContent && scanResult.flaggedContent.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.96l-6.93-12a2 2 0 00-3.5 0l-6.93 12A2 2 0 005.07 19z" />
                  </svg>
                  ATS-Unreadable Content Flagged
                </h3>
                <div className="flex items-center gap-2">
                  {(() => {
                    const counts = { critical: 0, warning: 0, info: 0 };
                    scanResult.flaggedContent.forEach(f => { counts[f.severity] = (counts[f.severity] || 0) + 1; });
                    return (
                      <>
                        {counts.critical > 0 && <span className="px-2 py-0.5 text-[8px] font-black bg-red-100 text-red-700 rounded-md ring-1 ring-red-200">{counts.critical} Critical</span>}
                        {counts.warning > 0 && <span className="px-2 py-0.5 text-[8px] font-black bg-amber-100 text-amber-700 rounded-md ring-1 ring-amber-200">{counts.warning} Warning</span>}
                        {counts.info > 0 && <span className="px-2 py-0.5 text-[8px] font-black bg-blue-100 text-blue-700 rounded-md ring-1 ring-blue-200">{counts.info} Info</span>}
                      </>
                    );
                  })()}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 font-medium px-2">
                These exact excerpts from your resume will be misread, skipped, or garbled by common ATS parsers (Taleo, Workday, Greenhouse, iCIMS). Fix them for a higher pass-through rate.
              </p>
              <div className="grid grid-cols-1 gap-4">
                {scanResult.flaggedContent
                  .sort((a, b) => {
                    const order = { critical: 0, warning: 1, info: 2 };
                    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
                  })
                  .map((flag, i) => (
                    <FlaggedItem key={i} flag={flag} />
                  ))}
              </div>
            </div>
          )}

          {/* Category Breakdown */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 px-2">Detailed Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scanResult.categories.map((cat, i) => (
                <CategoryBar key={i} {...cat} />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleReset}
              className="flex-1 py-4 bg-[#81adb3] text-white font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-[#6d969c] transition-all shadow-lg shadow-[#81adb3]/20 active:scale-[0.98]"
            >
              Scan Another Resume
            </button>
            <button
              onClick={() => {
                setResumeText('');
                setScanResult(null);
              }}
              className="flex-1 py-4 bg-white text-slate-600 font-black rounded-2xl uppercase tracking-widest text-[10px] border border-slate-200 hover:border-slate-300 transition-all active:scale-[0.98]"
            >
              Start Fresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
