import React, { useCallback, useEffect, useState } from 'react';
import { Student, User } from '../types';
import { dbService } from '../services/dbService';
import { GenerationRecord } from '../services/generationHistory';

interface HistoryPageProps {
  user: User;
  students: Student[];
  // Opens a saved generation on the Generate screen.
  onOpen: (g: GenerationRecord) => void;
  // Adds the chosen standard (with its "how the activity covered it" sentence) to a student's Vault. Returns true if saved.
  onAddToVault: (g: GenerationRecord, studentId: string) => Promise<boolean>;
}

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export const HistoryPage: React.FC<HistoryPageProps> = ({ user, students, onOpen, onAddToVault }) => {
  const [items, setItems] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState<string | null>(null); // id of the item choosing a student
  const [pickStudent, setPickStudent] = useState('');
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems((await dbService.getGenerations(user.id)) as GenerationRecord[]);
    } catch (e) {
      console.warn('Could not load the history:', e);
      setError('Your history could not be loaded right now. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const studentName = (id?: string) => students.find(s => s.id === id)?.name || '';

  const startAdd = (g: GenerationRecord) => {
    setNote('');
    setPicking(g.id!);
    setPickStudent(g.studentId && students.some(s => s.id === g.studentId) ? g.studentId : '');
  };

  const confirmAdd = async (g: GenerationRecord) => {
    if (!pickStudent) { setNote('Please choose a student.'); return; }
    setBusy(g.id!);
    setNote('');
    try {
      const ok = await onAddToVault(g, pickStudent);
      if (ok) {
        await dbService.updateGeneration(g.id!, { vaultStudentId: pickStudent, vaultAt: Date.now() });
        setPicking(null);
        await load();
      } else {
        setNote('That could not be saved. Please try again.');
      }
    } catch {
      setNote('That could not be saved. Please try again.');
    } finally {
      setBusy('');
    }
  };

  const remove = async (g: GenerationRecord) => {
    if (!confirm('Delete this work sample from your history? This cannot be undone. (Anything already added to a Vault stays there.)')) return;
    setBusy(g.id!);
    try {
      await dbService.deleteGeneration(g.id!);
      await load();
    } catch {
      setNote('That could not be deleted. Please try again.');
    } finally {
      setBusy('');
    }
  };

  const btn = 'text-[9px] font-black text-slate-600 bg-slate-100 uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-slate-200 disabled:opacity-40 min-h-[36px]';

  return (
    <div className="animate-fade-in space-y-8 max-w-4xl mx-auto">
      <div className="border-b border-slate-200 pb-6">
        <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter leading-none mb-2">History</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Every work sample you generate is saved here automatically, so nothing is lost. Open one to keep working, or add it to a student's Vault when you decide it belongs there. Photos and drawings are not saved here, only the words.
        </p>
      </div>

      {error && <p className="text-sm font-bold text-red-500">{error}</p>}
      {loading && <p className="text-sm text-slate-400 font-medium">Loading...</p>}
      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-slate-400 font-medium">Nothing here yet. Your next work sample will appear here automatically.</p>
      )}
      {note && <p className="text-sm font-bold text-red-500">{note}</p>}

      {items.map(g => {
        const hasPage = !!(g.chosen && g.content);
        const inVault = !!g.vaultAt;
        return (
          <div key={g.id} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#367c92]">{when(g.createdAt)}</span>
              <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${inVault ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {inVault ? `In ${studentName(g.vaultStudentId) || 'a student'}'s Vault` : 'Not in a Vault'}
              </span>
            </div>
            <p className="text-slate-800 font-bold mb-1">{g.activity}</p>
            <p className="text-xs text-slate-500 mb-4">
              Grade {g.grade} • {g.subject}
              {g.chosen?.standard?.code ? ` • ${g.chosen.standard.code}` : ' • no option chosen yet'}
              {g.studentId && studentName(g.studentId) ? ` • for ${studentName(g.studentId)}` : ''}
            </p>

            {picking === g.id ? (
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500" htmlFor={`pick-${g.id}`}>Add to which student's Vault?</label>
                <select
                  id={`pick-${g.id}`}
                  value={pickStudent}
                  onChange={e => setPickStudent(e.target.value)}
                  className="w-full px-5 py-3 rounded-2xl border-2 border-slate-100 focus:border-[#e7b64f] outline-none font-bold text-slate-700 bg-white"
                >
                  <option value="">Choose a student</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} (Grade {s.gradeLevel})</option>)}
                </select>
                {students.length === 0 && <p className="text-[11px] text-slate-500">You have no students yet. Add one in the Vault tab first.</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => confirmAdd(g)} disabled={busy === g.id} className="px-6 py-3 rounded-full bg-gradient-to-r from-[#e7b64f] to-[#f4989c] text-slate-800 font-black text-[10px] uppercase tracking-[0.2em] shadow-md disabled:opacity-60">{busy === g.id ? 'Saving...' : 'Add to Vault'}</button>
                  <button type="button" onClick={() => setPicking(null)} className={btn}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => onOpen(g)} className={btn}>{hasPage ? 'Open' : 'Open options'}</button>
                {hasPage && !inVault && <button type="button" onClick={() => startAdd(g)} className={btn}>Add to a Vault</button>}
                <button type="button" onClick={() => remove(g)} disabled={busy === g.id} className={btn}>Delete</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
