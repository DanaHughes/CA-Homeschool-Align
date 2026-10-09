import React, { useEffect, useRef, useState } from 'react';
import { Standard, Student, LearningRecord, User } from '../types';
import {
  searchStandards,
  explainStandards,
  generateWorkPageContent,
  WorkPageContent
} from '../services/geminiService';
import {
  GRADE_CHOICES,
  PageDesign,
  guideFor,
  isYoungGrade,
  needsContinuationPage
} from '../services/gradeExpectations';
import { shrinkImage } from '../services/imageUtils';
import {
  lpForDate,
  todayIso,
  prettyDate,
  pickDesign,
  otherDesign,
  readHistory,
  writeHistory
} from '../services/workSampleHelpers';

const SUBJECTS = ['ELA', 'Math', 'Science', 'History'];

const PALETTE: [string, string][] = [
  ['Black', '#1f2937'], ['Brown', '#7a4a21'], ['Red', '#d62839'], ['Orange', '#f28c28'],
  ['Yellow', '#f2c230'], ['Green', '#2e9e5b'], ['Blue', '#2a6fdb'], ['Purple', '#7b3fb8'], ['Pink', '#f4989c']
];

const LOADING_MESSAGES = [
  'Reading your activity…',
  'Finding California standards…',
  'Writing your work sample options…'
];

type Tool = 'none' | 'pen' | 'erase';

interface Option {
  standard: Standard;
  hook: string;
}

interface Props {
  user: User;
  students: Student[];
  records: LearningRecord[];
  isPro: boolean;
  freeLimit: number;
  onNeedPaywall: () => void;
  onSearchUsed: () => Promise<void>;
  onAddStudent: () => void;
  onSaveRecord: (r: { standard: Standard; studentId: string; activityText: string; matchLogic: string }) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Picture box: shows the photo and lets the child draw on top of it.
// ---------------------------------------------------------------------------
interface PictureBoxProps {
  photo: string | null;
  drawing: string | null;
  onDrawing: (dataUrl: string | null) => void;
  tool: Tool;
  color: string;
  size: number;
  clearTick: number;
  onAddPhoto: () => void;
  hint?: string;
}

const PictureBox: React.FC<PictureBoxProps> = ({ photo, drawing, onDrawing, tool, color, size, clearTick, onAddPhoto, hint }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);
  const snapshot = useRef<string | null>(drawing);
  const lastClear = useRef(clearTick);

  const setup = () => {
    const c = cv.current, w = wrap.current;
    if (!c || !w) return;
    const r = w.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (snapshot.current) {
      const im = new Image();
      im.onload = () => ctx.drawImage(im, 0, 0, r.width, r.height);
      im.src = snapshot.current;
    }
  };

  useEffect(() => {
    setup();
    const w = wrap.current;
    if (!w || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setup());
    ro.observe(w);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (clearTick === lastClear.current) return;
    lastClear.current = clearTick;
    snapshot.current = null;
    const c = cv.current;
    const ctx = c?.getContext('2d');
    if (c && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.restore();
    }
    onDrawing(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTick]);

  const pos = (e: React.PointerEvent) => {
    const b = cv.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'none') return;
    const ctx = cv.current?.getContext('2d');
    if (!ctx) return;
    painting.current = true;
    cv.current!.setPointerCapture(e.pointerId);
    ctx.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
    ctx.lineWidth = tool === 'erase' ? 18 : size;
    ctx.strokeStyle = color;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!painting.current) return;
    const ctx = cv.current?.getContext('2d');
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const up = () => {
    if (!painting.current) return;
    painting.current = false;
    const c = cv.current;
    if (c) {
      snapshot.current = c.toDataURL();
      onDrawing(snapshot.current);
    }
  };

  return (
    <div ref={wrap} className="ws-pic" style={{ position: 'relative', width: '100%', flex: 1, minHeight: 190 }}>
      {photo && <img alt="Your photo" src={photo} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />}
      {hint && !photo && <span style={{ position: 'absolute', top: 6, left: 8, right: 8 }}>{hint}</span>}
      <canvas
        ref={cv}
        aria-label="Picture box: draw here, or click to add a photo"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => { if (tool === 'none') onAddPhoto(); }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: tool === 'none' ? 'pointer' : 'crosshair' }}
      />
      {tool === 'none' && (
        <span className="no-print" style={{ position: 'absolute', right: 8, bottom: 8, fontSize: 12, background: '#1f2937', color: '#fff', borderRadius: 999, padding: '4px 10px', pointerEvents: 'none', opacity: 0.85 }}>
          {photo ? 'Click to change the photo' : 'Click to add a photo'}
        </span>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Printing: hide everything on the page except the work sample, print, then put it back.
// ---------------------------------------------------------------------------
const printElement = (el: HTMLElement) => {
  const hidden: HTMLElement[] = [];
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement;
    if (parent) {
      Array.from(parent.children).forEach(ch => {
        if (ch !== node && ch instanceof HTMLElement && ch.style.display !== 'none') {
          ch.dataset.wsPrevDisplay = ch.style.display;
          ch.style.display = 'none';
          hidden.push(ch);
        }
      });
    }
    node = parent;
  }
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    hidden.forEach(ch => {
      ch.style.display = ch.dataset.wsPrevDisplay || '';
      delete ch.dataset.wsPrevDisplay;
    });
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
  // Some phones do not wait for the print window; restore a little later either way.
  setTimeout(restore, 2500);
};

// ---------------------------------------------------------------------------
// The whole flow: 1) the activity, 2) work sample options, 3) your page.
// ---------------------------------------------------------------------------
export const WorkSampleFlow: React.FC<Props> = ({
  user, students, records, isPro, freeLimit, onNeedPaywall, onSearchUsed, onAddStudent, onSaveRecord
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Screen 1
  const [studentId, setStudentId] = useState('');
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [query, setQuery] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [onlyUnmet, setOnlyUnmet] = useState(false);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);

  // Screen 2
  const [options, setOptions] = useState<Option[]>([]);
  const [activity, setActivity] = useState('');
  const [openStd, setOpenStd] = useState<number | null>(null);
  const [pageLoading, setPageLoading] = useState(false);

  // Screen 3
  const [chosen, setChosen] = useState<Option | null>(null);
  const [content, setContent] = useState<WorkPageContent | null>(null);
  const [design, setDesign] = useState<PageDesign>('journal');
  const [fields, setFields] = useState({ name: '', date: '', lp: '', subject: '', grade: '', standards: '', how: '' });
  const [showLp, setShowLp] = useState(false);
  const [writing, setWriting] = useState('');
  const [boxes, setBoxes] = useState(['', '', '']);
  const [extraPages, setExtraPages] = useState<string[]>([]);
  const [drawing, setDrawing] = useState<string | null>(null);
  const [clearTick, setClearTick] = useState(0);
  const [tool, setTool] = useState<Tool>('none');
  const [color, setColor] = useState(PALETTE[0][1]);
  const [thick, setThick] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const student = students.find(s => s.id === studentId);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length), 2500);
    return () => clearInterval(t);
  }, [loading]);

  const chooseStudent = (id: string) => {
    if (id === 'ADD_NEW') { onAddStudent(); return; }
    setStudentId(id);
    const s = students.find(x => x.id === id);
    if (s && GRADE_CHOICES.includes(s.gradeLevel)) setGrade(s.gradeLevel);
  };

  const takePhoto = async (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 25 * 1024 * 1024) {
      setFormError('That photo is very large. Please choose one under 25MB.');
      return;
    }
    try {
      setPhoto(await shrinkImage(file));
      setFormError('');
    } catch {
      setFormError('Sorry, that photo could not be read. Please try a different one.');
    }
  };

  // Paste or drag a photo onto the page while viewing the work sample.
  useEffect(() => {
    if (step !== 3) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items || [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') === 0) {
          takePhoto(items[i].getAsFile());
          e.preventDefault();
          break;
        }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [step]);

  const explainLimitError = (e: any): boolean => {
    const msg = String(e?.message || '');
    if (msg === 'DAILY_LIMIT_REACHED') {
      alert('The AI has reached its daily limit. Please try again tomorrow.');
      return true;
    }
    if (msg === 'RATE_LIMITED') {
      alert("You're creating very quickly. Please wait a few minutes and try again.");
      return true;
    }
    return false;
  };

  const handleGenerate = async () => {
    setFormError('');
    if (!grade) { setFormError('Please choose a grade level.'); return; }
    if (!subject) { setFormError('Please choose a subject.'); return; }
    if (!query.trim() && !photo) { setFormError('Please add a photo or describe the activity.'); return; }
    if (!isPro && user.searchCount >= freeLimit) { onNeedPaywall(); return; }

    const activityText = query.trim() || 'Uploaded evidence';
    setLoading(true);
    setMsgIndex(0);
    try {
      let excludeCodes: string[] | undefined;
      if (onlyUnmet && studentId) {
        const now = new Date();
        const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
        const syStart = new Date(startYear, 6, 1).getTime();
        excludeCodes = records
          .filter(r => r.studentId === studentId && r.timestamp >= syStart)
          .map(r => r.standardCode);
      }
      const base64 = photo ? photo.split(',')[1] : undefined;
      const standards = await searchStandards(query, grade, subject, base64, excludeCodes);
      let list: Option[] = [];
      if (standards.length > 0) {
        const hooks = await explainStandards(standards, query.trim() || 'the provided evidence');
        list = standards.map((standard, i) => ({ standard, hook: hooks[i] }));
      }
      setOptions(list);
      setActivity(activityText);
      setOpenStd(null);
      if (!isPro) await onSearchUsed();
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      console.error('Generate error:', e);
      if (!explainLimitError(e)) {
        setFormError("Sorry, that didn't work. Please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChoose = async (opt: Option) => {
    setPageLoading(true);
    try {
      const c = await generateWorkPageContent({
        grade,
        subject,
        activity,
        hook: opt.hook,
        standardDescription: opt.standard.description
      });
      const d = pickDesign(c.recommended, readHistory(studentId));
      writeHistory(studentId, d);
      const lp = lpForDate(student, todayIso());
      setContent(c);
      setChosen(opt);
      setDesign(d);
      setFields({
        name: student?.name || '',
        date: prettyDate(),
        lp,
        subject,
        grade,
        standards: opt.standard.code,
        how: opt.hook
      });
      setShowLp(!!lp);
      setWriting('');
      setBoxes(['', '', '']);
      setExtraPages([]);
      setDrawing(null);
      setTool('none');
      setSaved(false);
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      console.error('Page error:', e);
      if (!explainLimitError(e)) alert('Sorry, the page could not be made. Please try again.');
    } finally {
      setPageLoading(false);
    }
  };

  const swapDesign = () => {
    const next = otherDesign(design);
    setDesign(next);
    writeHistory(studentId, next);
  };

  const handleSave = async () => {
    if (!chosen || !studentId) return;
    setSaving(true);
    const ok = await onSaveRecord({ standard: chosen.standard, studentId, activityText: activity, matchLogic: chosen.hook });
    setSaving(false);
    if (ok) setSaved(true);
  };

  const young = isYoungGrade(fields.grade);

  // ----- small building blocks -----
  const chipClass = (on: boolean) =>
    `px-5 py-3 rounded-2xl border-2 text-[11px] font-black uppercase tracking-widest transition-all min-h-[44px] ${
      on ? 'bg-[#e7b64f] border-[#e7b64f] text-slate-900' : 'bg-white border-slate-200 text-slate-500 hover:border-[#81adb3]'
    }`;

  const toolClass = (on: boolean) =>
    `px-4 py-3 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest min-h-[44px] transition-all ${
      on ? 'bg-[#81adb3] border-[#81adb3] text-slate-900' : 'bg-white border-slate-200 text-slate-500 hover:border-[#81adb3]'
    }`;

  const crumb = (n: number, label: string) => (
    <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${step === n ? 'text-[#367c92]' : 'text-slate-400'}`}>
      {n} · {label}
    </span>
  );

  const hiddenFile = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="hidden"
      aria-label="Add a photo"
      onChange={e => { takePhoto(e.target.files?.[0]); e.target.value = ''; }}
    />
  );

  const pictureBox = (minHeight?: number) => (
    <PictureBox
      photo={photo}
      drawing={drawing}
      onDrawing={setDrawing}
      tool={tool}
      color={color}
      size={thick ? 8 : 3}
      clearTick={clearTick}
      onAddPhoto={() => fileRef.current?.click()}
      hint="Draw or paste in a picture of your learning activity in this box."
    />
  );

  const fieldRow = (label: string, key: 'name' | 'date' | 'lp' | 'subject' | 'grade' | 'standards', auto: boolean, id: string) => (
    <div className="ws-field">
      <label htmlFor={id}>{label}:</label>
      <input
        id={id}
        type="text"
        className={`ws-input ${auto ? 'ws-auto' : ''}`}
        value={fields[key]}
        onChange={e => setFields(f => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  const sheetTop = (
    <>
      {fieldRow('First and Last Name', 'name', !!student, 'ws-name')}
      {fieldRow('Date of learning activity', 'date', true, 'ws-date')}
      {showLp && fieldRow('Learning Period', 'lp', true, 'ws-lp')}
      {fieldRow('Subject', 'subject', true, 'ws-subject')}
      {fieldRow('Grade Level', 'grade', true, 'ws-grade')}
      {fieldRow('Standard(s) covered', 'standards', true, 'ws-standards')}
      <div className="ws-field">
        <label htmlFor="ws-how">How did the activity cover the standard(s)?</label>
        <textarea
          id="ws-how"
          className="ws-input ws-auto ws-how"
          value={fields.how}
          onChange={e => setFields(f => ({ ...f, how: e.target.value }))}
        />
      </div>
    </>
  );

  const guideBox = (
    <div className="ws-guide">
      <div className="ws-guide-title">How to complete this page</div>
      <div>{guideFor(design, fields.grade)}</div>
    </div>
  );

  const arrowSvgs = [
    <svg key="a" viewBox="0 0 40 36" aria-hidden="true" style={{ width: '100%', height: 36 }}><path d="M2 32 L30 8" stroke="#1f2937" strokeWidth="5" strokeLinecap="round" /><path d="M22 6 L36 4 L34 18Z" fill="#1f2937" /></svg>,
    <svg key="b" viewBox="0 0 40 36" aria-hidden="true" style={{ width: '100%', height: 36 }}><path d="M2 18 L30 18" stroke="#1f2937" strokeWidth="5" strokeLinecap="round" /><path d="M26 6 L38 18 L26 30Z" fill="#1f2937" /></svg>,
    <svg key="c" viewBox="0 0 40 36" aria-hidden="true" style={{ width: '100%', height: 36 }}><path d="M2 4 L30 28" stroke="#1f2937" strokeWidth="5" strokeLinecap="round" /><path d="M34 18 L36 32 L22 30Z" fill="#1f2937" /></svg>
  ];

  const journalPage = content && (
    <div className="ws-page">
      {sheetTop}
      <div style={{ flex: 1.25, minHeight: 200, display: 'flex', flexDirection: 'column' }}>{pictureBox()}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <label htmlFor="ws-write" style={{ marginBottom: 4 }}>{content.journalPrompt}</label>
        <textarea
          id="ws-write"
          className={`ws-write ${young ? 'primary' : ''}`}
          rows={7}
          value={writing}
          onChange={e => setWriting(e.target.value)}
        />
      </div>
      {guideBox}
      <div className="ws-foot">© 2026 Charter Homeschool Help</div>
    </div>
  );

  const organizerPage = content && (
    <div className="ws-page">
      {sheetTop}
      <div className="ws-auto" style={{ padding: '2px 6px' }}>{content.organizerTitle}</div>
      <div className="ws-org">
        <div className="ws-org-center">
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{pictureBox()}</div>
          <div className="ws-org-cap">{content.organizerCenter}</div>
        </div>
        {[0, 1, 2].map(k => (
          <React.Fragment key={k}>
            <div className="ws-org-arrow" style={{ gridRow: k + 1 }}>{arrowSvgs[k]}</div>
            <div className="ws-org-box" style={{ gridRow: k + 1 }}>
              <label htmlFor={`ws-box-${k}`}>{content.organizerLabels[k]}</label>
              <textarea
                id={`ws-box-${k}`}
                value={boxes[k]}
                onChange={e => setBoxes(b => b.map((v, i) => (i === k ? e.target.value : v)))}
              />
            </div>
          </React.Fragment>
        ))}
      </div>
      {guideBox}
      <div className="ws-foot">© 2026 Charter Homeschool Help</div>
    </div>
  );

  // ----- screens -----
  return (
    <div className="animate-fade-in space-y-10 max-w-4xl mx-auto">
      <div className="text-center no-print">
        <h2 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tighter mb-3 leading-tight">
          Create a <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#81adb3] via-[#e7b64f] to-[#f4989c]">Work Sample</span>
        </h2>
        <p className="text-[#81adb3] font-black text-[11px] uppercase tracking-[0.3em] mb-3">MAKING HOMESCHOOL DOABLE.</p>
        <p className="text-slate-400 text-[9px] font-medium uppercase tracking-wider italic">Independent tool. Not affiliated with the State of California or any public education agency.</p>
      </div>

      <div className="flex flex-wrap gap-3 justify-center no-print" aria-label="Progress">
        {crumb(1, 'The activity')}<span className="text-slate-300">›</span>
        {crumb(2, 'Work sample option')}<span className="text-slate-300">›</span>
        {crumb(3, 'Your page')}
      </div>

      {hiddenFile}

      {/* SCREEN 1 */}
      {step === 1 && !loading && (
        <section className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-lg space-y-8 no-print" aria-label="Choose and generate">
          <div className="space-y-3">
            <label htmlFor="ws-student" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Student</label>
            <select
              id="ws-student"
              value={studentId}
              onChange={e => chooseStudent(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 bg-white font-black text-slate-800 outline-none focus:border-[#81adb3]"
            >
              <option value="">No student selected</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} (Grade {s.gradeLevel})</option>)}
              <option value="ADD_NEW">+ Add a student</option>
            </select>
            {studentId && (
              <label className="flex items-center gap-3 text-[11px] font-bold text-slate-500 cursor-pointer">
                <input type="checkbox" checked={onlyUnmet} onChange={e => setOnlyUnmet(e.target.checked)} className="w-5 h-5 accent-[#81adb3]" />
                Only show standards not yet in {student?.name}'s Vault this school year
              </label>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3"><span className="w-8 h-8 rounded-full bg-[#81adb3] text-slate-900 font-black text-xs flex items-center justify-center">1</span><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select one grade level</span></div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Grade level">
              {GRADE_CHOICES.map(g => (
                <button key={g} type="button" aria-pressed={grade === g} onClick={() => setGrade(g)} className={chipClass(grade === g)}>{g}</button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3"><span className="w-8 h-8 rounded-full bg-[#e7b64f] text-slate-900 font-black text-xs flex items-center justify-center">2</span><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select one subject</span></div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Subject">
              {SUBJECTS.map(s => (
                <button key={s} type="button" aria-pressed={subject === s} onClick={() => setSubject(s)} className={chipClass(subject === s)}>{s}</button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3"><span className="w-8 h-8 rounded-full bg-[#f4989c] text-slate-900 font-black text-xs flex items-center justify-center">3</span><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Add a photo or describe the activity</span></div>
            <div className="flex flex-wrap items-center gap-3 border-2 border-slate-200 rounded-3xl p-2 pl-4">
              <button type="button" onClick={() => fileRef.current?.click()} className={`flex items-center gap-2 px-4 py-3 rounded-full text-[11px] font-black uppercase tracking-widest min-h-[44px] ${photo ? 'bg-[#81adb3]/20 text-[#367c92]' : 'text-[#367c92] hover:bg-slate-50'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" strokeWidth={2} /></svg>
                {photo ? 'Change photo' : 'Add a photo'}
              </button>
              {photo && (
                <span className="flex items-center gap-2">
                  <img src={photo} alt="Your photo" className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                  <button type="button" onClick={() => setPhoto(null)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-400">Remove</button>
                </span>
              )}
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                aria-label="Describe the activity"
                placeholder="Describe the activity (for example: built a volcano model)"
                className="flex-1 min-w-[200px] bg-transparent outline-none font-semibold text-lg text-slate-700 placeholder:text-slate-300 py-3"
              />
            </div>
          </div>

          {formError && <p className="text-sm font-bold text-red-500" role="alert">{formError}</p>}

          <button
            type="button"
            onClick={handleGenerate}
            className="w-full px-12 py-6 bg-gradient-to-r from-[#e7b64f] to-[#f4989c] text-slate-900 font-black rounded-[2.5rem] hover:shadow-2xl transition-all shadow-xl text-sm uppercase tracking-widest"
          >
            Generate Work Sample Options
          </button>
        </section>
      )}

      {step === 1 && loading && (
        <section className="bg-white p-14 rounded-[2.5rem] border border-slate-100 shadow-lg flex flex-col items-center gap-6 no-print" role="status" aria-live="polite">
          <div className="w-14 h-14 border-4 border-[#81adb3]/20 border-t-[#81adb3] rounded-full animate-spin" />
          <p className="text-[#367c92] font-black text-[10px] uppercase tracking-[0.25em] text-center">{LOADING_MESSAGES[msgIndex]}</p>
        </section>
      )}

      {/* SCREEN 2 */}
      {step === 2 && (
        <section className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-lg space-y-8 no-print" aria-label="Work sample options">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Work sample options</div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Click on the work sample option that sounds like the best fit for your child, or is best aligned to an I Can Statement or Standard goal for your child.
              </p>
            </div>
            <button type="button" onClick={() => setStep(1)} className="px-5 py-3 rounded-2xl border-2 border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-[#81adb3] min-h-[44px]">Change activity</button>
          </div>

          {options.length === 0 ? (
            <div className="text-center py-12 max-w-xl mx-auto">
              <p className="text-slate-800 font-black uppercase tracking-widest text-[11px] mb-3">No options found</p>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                We couldn't find a California standard for this activity. Try describing it a little differently, or choose another grade or subject. All learning is valuable, even when the standards don't capture it perfectly.
              </p>
              <button type="button" onClick={() => setStep(1)} className="px-6 py-3 bg-[#81adb3] text-slate-900 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-[#6d969c] transition-all shadow-lg">Try again</button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {options.map((opt, i) => {
                const open = openStd === i;
                return (
                  <div key={opt.standard.code + i} className="border-2 border-slate-100 rounded-[2rem] p-6 flex flex-col gap-4 bg-white">
                    <span className="self-start px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-[10px] font-black uppercase tracking-widest">Work sample option {i + 1}</span>
                    <p className="font-serif italic text-[16px] leading-relaxed text-slate-800">{opt.hook}</p>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenStd(open ? null : i)}
                      className="self-start flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#367c92] min-h-[36px]"
                    >
                      <span style={{ display: 'inline-block', transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none' }}>▸</span>
                      Standard alignment for this activity
                    </button>
                    {open && (
                      <div className="rounded-2xl bg-[#81adb3]/15 p-4 space-y-2">
                        <div className="font-mono text-xs tracking-widest text-slate-500">{opt.standard.code}</div>
                        <div className="font-serif text-sm leading-relaxed text-slate-700">{opt.standard.description}</div>
                      </div>
                    )}
                    <div className="mt-auto">
                      <button
                        type="button"
                        disabled={pageLoading}
                        onClick={() => handleChoose(opt)}
                        className="w-full py-4 bg-[#e7b64f] text-slate-900 font-black rounded-2xl uppercase tracking-widest text-[11px] hover:bg-[#d9a43a] transition-all shadow-md disabled:opacity-50"
                      >
                        {pageLoading ? 'Making your page…' : 'Use this option'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SCREEN 3 */}
      {step === 3 && content && chosen && (
        <section className="ws-card bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-lg" aria-label="Your work sample">
          <div className="no-print flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Your work sample</div>
              <p className="text-sm text-slate-500 italic">Your standards and details are filled in. Type or draw right on the page, or print it and do it by hand.</p>
            </div>
            <button type="button" onClick={() => setStep(2)} className="px-5 py-3 rounded-2xl border-2 border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-[#81adb3] min-h-[44px]">Pick a different option</button>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2 mb-6" role="group" aria-label="Page tools">
            <button type="button" onClick={() => fileRef.current?.click()} className={toolClass(false)}>Add a photo</button>
            <button type="button" aria-pressed={tool === 'pen'} onClick={() => setTool(tool === 'pen' ? 'none' : 'pen')} className={toolClass(tool === 'pen')}>Draw</button>
            <button type="button" aria-pressed={tool === 'erase'} onClick={() => setTool(tool === 'erase' ? 'none' : 'erase')} className={toolClass(tool === 'erase')}>Eraser</button>
            <span className="inline-flex items-center gap-2 px-2" role="group" aria-label="Pen color">
              {PALETTE.map(([name, hex]) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`${name} pen`}
                  aria-pressed={color === hex}
                  onClick={() => { setColor(hex); setTool('pen'); }}
                  style={{ width: 30, height: 30, borderRadius: 999, background: hex, border: '3px solid #fff', boxShadow: color === hex ? '0 0 0 3px #367c92' : '0 0 0 2px #e2e8f0' }}
                />
              ))}
            </span>
            <button type="button" onClick={() => setThick(t => !t)} aria-pressed={thick} className={toolClass(thick)}>{thick ? 'Thin pen' : 'Thick pen'}</button>
            <button type="button" onClick={() => setClearTick(t => t + 1)} className={toolClass(false)}>Clear drawing</button>
            {needsContinuationPage(fields.grade) && (
              <button type="button" onClick={() => setExtraPages(p => [...p, ''])} className={toolClass(false)}>Add a continuation page</button>
            )}
            <button type="button" onClick={swapDesign} className={toolClass(false)}>Show me a different page</button>
          </div>

          <div ref={printRef} className="ws-sheets">
            {design === 'journal' ? journalPage : organizerPage}
            {extraPages.map((text, i) => (
              <div key={i} className="ws-page">
                <div className="ws-field">
                  <label htmlFor={`ws-cname-${i}`}>First and Last Name:</label>
                  <input id={`ws-cname-${i}`} type="text" className="ws-input" value={fields.name} onChange={e => setFields(f => ({ ...f, name: e.target.value }))} />
                </div>
                <label htmlFor={`ws-cw-${i}`}>Continue your writing here (page {i + 2}).</label>
                <textarea
                  id={`ws-cw-${i}`}
                  className={`ws-write ${young ? 'primary' : ''}`}
                  style={{ flex: 1 }}
                  value={text}
                  onChange={e => setExtraPages(p => p.map((t, k) => (k === i ? e.target.value : t)))}
                />
                <div className="ws-foot">© 2026 Charter Homeschool Help</div>
              </div>
            ))}
          </div>

          <div className="no-print flex flex-wrap justify-center gap-3 mt-8">
            <button type="button" onClick={() => printRef.current && printElement(printRef.current)} className="px-8 py-4 bg-[#81adb3] text-slate-900 font-black rounded-2xl uppercase tracking-widest text-[11px] hover:bg-[#6d969c] transition-all shadow-lg">Print or save as PDF</button>
            {studentId ? (
              <button type="button" disabled={saving || saved} onClick={handleSave} className="px-8 py-4 bg-[#e7b64f] text-slate-900 font-black rounded-2xl uppercase tracking-widest text-[11px] hover:bg-[#d9a43a] transition-all shadow-lg disabled:opacity-60">
                {saved ? `Saved to ${student?.name}'s Vault ✓` : saving ? 'Saving…' : 'Save to Student Vault'}
              </button>
            ) : (
              <span className="self-center text-[11px] text-slate-400 font-bold">Choose a student on the first screen to save this to their Vault.</span>
            )}
            <button type="button" onClick={() => { setStep(1); setQuery(''); setPhoto(null); setOptions([]); }} className="px-8 py-4 border-2 border-slate-200 text-slate-500 font-black rounded-2xl uppercase tracking-widest text-[11px] hover:border-[#81adb3] transition-all">Start a new work sample</button>
          </div>
          <p className="no-print text-center text-xs text-slate-400 mt-4"><span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 4, background: '#fddc96', verticalAlign: '-2px', marginRight: 6 }} />Gold highlight = filled in for you. Change anything before printing.</p>
        </section>
      )}
    </div>
  );
};
