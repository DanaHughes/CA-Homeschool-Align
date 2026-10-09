import jsPDF from "jspdf";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Standard, Student, LearningRecord, TabView, User, LearningPeriod, AppMessage } from './types';
import { searchStandards, explainStandardMatch } from './services/geminiService';
import { dbService } from './services/dbService';
import { authService } from './services/authService';
import { StandardCard } from './components/StandardCard';
import { AccessGate } from './components/AccessGate';
import { AuthGate } from './components/AuthGate';
import { WorkSampleFlow } from './components/WorkSampleFlow';
import { InstallPrompt, InstallDirections } from './components/InstallPrompt';
import { buildVaultPdf } from './services/vaultPdf';
import { downloadBlob } from './services/pdfExport';

const FREE_SEARCH_LIMIT = 25;
const PRO_FREE_EMAILS = ['demo@cahomeschool.com', 'dana2andrea@gmail.com'];
const APP_VERSION = "1.6.0"; 
const BLUEPRINT_GUIDE_URL = "https://www.charterhomeschoolhelp.com/products/the-charter-homeschool-blueprint";

const ADMIN_EMAIL = 'dana2andrea@gmail.com';

const LogoIcon = ({ className = "w-24 h-8" }) => (
  <div className={`${className} bg-gradient-to-r from-[#81adb3] via-[#e7b64f] to-[#f4989c] rounded-full flex items-center justify-center shadow-md relative no-print`}>
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l.707.707M6.343 6.343l.707-.707M8 11h8a2 2 0 012 2v5H6v-5a2 2 0 012-2z" />
    </svg>
    <div className="absolute top-0.5 right-1.5 w-2 h-2 bg-white/50 rounded-full border border-white/80"></div>
  </div>
);

const ThinkingState = ({ message }: { message?: string }) => {
  const [msgIndex, setMsgIndex] = useState(0);
  const messages = ["Consulting CA Frameworks...", "Mapping adventure hooks...", "Finding the math in the magic...", "Translating play into standards...", "Almost there..."];
  useEffect(() => {
    const timer = setInterval(() => setMsgIndex((prev) => (prev + 1) % messages.length), 2500);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in no-print">
      <div className="relative mb-8">
        <div className="w-16 h-16 border-4 border-[#81adb3]/20 border-t-[#81adb3] rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#e7b64f] animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
        </div>
      </div>
      <p className="text-[#81adb3] font-black text-[10px] uppercase tracking-[0.25em] animate-pulse text-center px-6">{message || messages[msgIndex]}</p>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('search');
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [query, setQuery] = useState('');
  const [lastSearchDescription, setLastSearchDescription] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  
  const [schoolYearFilter, setSchoolYearFilter] = useState('All');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [searchResults, setSearchResults] = useState<Standard[]>([]);
  
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [onlyUnmetStandards, setOnlyUnmetStandards] = useState(false);

  // PDF export options
  const [pdfIncludeMatchLogic, setPdfIncludeMatchLogic] = useState(true);
  const [pdfIncludeDateWindow, setPdfIncludeDateWindow] = useState(true);

  const [featureTitle, setFeatureTitle] = useState('');
  const [featureDesc, setFeatureDesc] = useState('');
  const [isSubmittingFeature, setIsSubmittingFeature] = useState(false);

  const [showPaywall, setShowPaywall] = useState(false);
  const [pendingStandardToSave, setPendingStandardToSave] = useState<Standard | null>(null);
  const [showStudentSelectModal, setShowStudentSelectModal] = useState(false);
  const [pendingStripeSession, setPendingStripeSession] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('stripe_session_id');
  });
  const [stripeStatusMessage, setStripeStatusMessage] = useState<string | null>(null);
  
  // Custom student add/edit modal states
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentModalMode, setStudentModalMode] = useState<'add' | 'edit'>('add');
  const [studentModalName, setStudentModalName] = useState('');
  const [studentModalGrade, setStudentModalGrade] = useState('K');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [pendingAutoSave, setPendingAutoSave] = useState<Standard | null>(null);
  
  // Date editing modal
  const [showDateModal, setShowDateModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LearningRecord | null>(null);
  const [editingDate, setEditingDate] = useState('');
  
  // School year configuration
  const [schoolYearLabel, setSchoolYearLabel] = useState('');
  const [schoolYearStart, setSchoolYearStart] = useState('');
  const [schoolYearEnd, setSchoolYearEnd] = useState('');
  const [showSchoolYearModal, setShowSchoolYearModal] = useState(false);

  // Learning Period states
  const [learningPeriods, setLearningPeriods] = useState<LearningPeriod[]>([]);
  const [editingLP, setEditingLP] = useState<LearningPeriod | null>(null);
  const [lpName, setLpName] = useState('');
  const [lpStartDate, setLpStartDate] = useState('');
  const [lpEndDate, setLpEndDate] = useState('');
  const [showLPModal, setShowLPModal] = useState(false);
  const [showLPCalendar, setShowLPCalendar] = useState(false);
  const [selectedLPForExport, setSelectedLPForExport] = useState<string>('');

  // Copy calendar settings to other students
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyTargetIds, setCopyTargetIds] = useState<string[]>([]);
  const [isCopying, setIsCopying] = useState(false);

  // Report a bug
  const [showBugModal, setShowBugModal] = useState(false);
  const [bugText, setBugText] = useState('');
  const [isSendingBug, setIsSendingBug] = useState(false);

  // Admin: in-app messages
  const [adminMessages, setAdminMessages] = useState<AppMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  
  const resultsRef = useRef<HTMLDivElement>(null);

  const ALL_GRADES = ['TK', 'K', '1', '2', '3', '4', '5', '6', '7', '8'];

  useEffect(() => {
    const lastVersion = localStorage.getItem('app_version');
    if (lastVersion && lastVersion !== APP_VERSION) {
      setShowUpdatePrompt(true);
    } else {
      localStorage.setItem('app_version', APP_VERSION);
    }
  }, []);

  useEffect(() => {
    setIsAppLoading(true);
    return authService.subscribeToAuth((u) => {
      setUser(u);
      setIsAppLoading(false);
    });
  }, []);

  // Detect return from Stripe Checkout and unlock the user once payment is verified.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    if (params.get('stripe_canceled')) {
      setStripeStatusMessage('Checkout canceled. You can continue your trial or try again.');
      const url = new URL(window.location.href);
      url.searchParams.delete('stripe_canceled');
      window.history.replaceState({}, '', url.toString());
    }

    if (!pendingStripeSession || !user) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/verify-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: pendingStripeSession })
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;

        if (response.ok && data.paid && data.userId === user.id) {
          const pendingName =
            sessionStorage.getItem('pending_stripe_name') || data.userName || user.name;
          await dbService.unlockUser(user.id, pendingName, `STRIPE_${pendingStripeSession}`);
          setUser({
            ...user,
            isPaid: true,
            name: pendingName,
            accountTier: 'pro'
          });
          sessionStorage.removeItem('pending_stripe_name');
          setShowPaywall(false);
          setStripeStatusMessage('Payment confirmed. Your Beta License is now active.');
        } else if (response.ok && !data.paid) {
          setStripeStatusMessage('Payment is still processing. Please refresh in a moment.');
        } else {
          setStripeStatusMessage(data.error || 'We could not verify your payment. Please contact support.');
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Stripe verification failed:', e);
          setStripeStatusMessage('We could not verify your payment. Please contact support.');
        }
      } finally {
        if (!cancelled) {
          const url = new URL(window.location.href);
          url.searchParams.delete('stripe_session_id');
          window.history.replaceState({}, '', url.toString());
          setPendingStripeSession(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStripeSession, user?.id]);


  const fetchData = async (currentUser?: User | null) => {
    // Use passed user or fall back to state user to avoid stale closure issues
    const userToUse = currentUser ?? user;
    if (!userToUse?.id) {
      console.warn('fetchData called without valid user');
      return;
    }

    setIsDataLoading(true);
    try {
      const fetchedStudents = await dbService.getStudents(userToUse.id);
      setStudents(fetchedStudents);
      
      if (!selectedStudentId && fetchedStudents.length > 0) {
        handleStudentSelect(fetchedStudents[0].id, fetchedStudents);
      }

      // ISSUE #1 FIX: Parallel fetching with Promise.all
      // Only fetch records if we have students
      if (fetchedStudents.length > 0) {
        const recordArrays = await Promise.all(
          fetchedStudents.map(student => dbService.getRecords(student.id))
        );
        const allRecords = recordArrays.flat();
        console.log('📚 Loaded records from Firestore:', allRecords.length);
        setRecords(allRecords);
      } else {
        // If no students, clear records to avoid stale data
        setRecords([]);
      }
    } catch (error: any) {
      console.error('❌ Error fetching data:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        name: error?.name,
        stack: error?.stack
      });
      
      // Log specific permission errors
      if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
        console.error('🔒 PERMISSION ERROR DETECTED');
        console.error('This usually means:');
        console.error('1. Firestore rules are not deployed');
        console.error('2. User is not authenticated');
        console.error('3. Data structure mismatch (missing userId field)');
        console.error('Current user ID:', userToUse.id);
      }
      
      // Don't clear existing data on error, just log it
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      // Clear data when user logs out
      setStudents([]);
      setRecords([]);
      setViewingStudentId(null);
      setActiveTab('search');
      return;
    }
    // Pass user explicitly to avoid stale closure
    fetchData(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleStudentSelect = (id: string, currentStudents = students) => {
    if (id === 'ADD_NEW') {
        handleAddNewStudent();
        return;
    }
    setSelectedStudentId(id);
    if (id === '') return; 

    const student = currentStudents.find(s => s.id === id);
    if (student) {
        setSelectedGrades(prev => {
            if (prev.includes(student.gradeLevel)) return prev;
            const updated = [student.gradeLevel, ...prev].slice(0, 3);
            return updated;
        });
    }
  };

  // From inside a student's vault: jump to the Match screen with this student already chosen.
  const startActivityForStudent = (studentId: string) => {
    handleStudentSelect(studentId);
    setActiveTab('search');
    setViewingStudentId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleGrade = (grade: string) => {
    setSelectedGrades(prev => {
        if (prev.includes(grade)) return prev.filter(g => g !== grade);
        if (prev.length >= 3) return [grade, prev[0], prev[1]];
        return [...prev, grade];
    });
  };

  const handleAddNewStudent = async (autoSaveStandard?: Standard): Promise<string | null> => {
    if (!user) return null;
    
    // Open custom modal
    setStudentModalMode('add');
    setStudentModalName('');
    setStudentModalGrade('K');
    setPendingAutoSave(autoSaveStandard || null);
    setShowStudentModal(true);
    
    return null; // Actual save happens in modal submit
  };

  const executeAddStudent = async () => {
    if (!user || !studentModalName.trim()) return;
    
    setIsSyncing(true);
    setShowStudentModal(false);
    
    try {
        const id = await dbService.addStudent({
            userId: user.id,
            name: studentModalName.trim(),
            gradeLevel: studentModalGrade
        });
        await fetchData(user);
        handleStudentSelect(id);
        
        if (pendingAutoSave) {
          await executeSave(pendingAutoSave, id);
          setPendingAutoSave(null);
        }
        
        // Reset modal state
        setStudentModalName('');
        setStudentModalGrade('K');
        
        return id;
    } finally {
        setIsSyncing(false);
    }
  };

  const handleEditStudent = async (student: Student) => {
    // Open custom modal
    setStudentModalMode('edit');
    setStudentModalName(student.name);
    setStudentModalGrade(student.gradeLevel);
    setEditingStudent(student);
    setShowStudentModal(true);
  };

  const executeEditStudent = async () => {
    if (!editingStudent || !studentModalName.trim()) return;
    
    setIsSyncing(true);
    setShowStudentModal(false);
    
    try {
        await dbService.updateStudent(editingStudent.id, { 
          name: studentModalName.trim(), 
          gradeLevel: studentModalGrade 
        });
        await fetchData(user);
        
        // Reset modal state
        setStudentModalName('');
        setStudentModalGrade('K');
        setEditingStudent(null);
    } finally {
        setIsSyncing(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm("Delete this student and all records? This cannot be undone.")) return;
    setIsSyncing(true);
    try {
        await dbService.deleteStudent(studentId);
        if (viewingStudentId === studentId) setViewingStudentId(null);
        if (selectedStudentId === studentId) setSelectedStudentId('');
        await fetchData(user);
    } finally {
        setIsSyncing(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm("Remove this standard from the vault?")) return;
    setIsSyncing(true);
    try {
        await dbService.deleteRecord(recordId);
        setRecords(prev => prev.filter(r => r.id !== recordId));
    } finally {
        setIsSyncing(false);
    }
  };

  const handleEditRecordDate = (record: LearningRecord) => {
    setEditingRecord(record);
    // Convert "MM/DD/YYYY" to "YYYY-MM-DD" for input type="date"
    const parts = record.activityDate.split('/');
    if (parts.length === 3) {
      const formatted = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      setEditingDate(formatted);
    } else {
      setEditingDate(new Date().toISOString().split('T')[0]);
    }
    setShowDateModal(true);
  };

  const executeDateEdit = async () => {
    if (!editingRecord || !editingDate) return;
    
    setIsSyncing(true);
    setShowDateModal(false);
    
    try {
      // Convert "YYYY-MM-DD" back to "MM/DD/YYYY"
      const date = new Date(editingDate);
      const formatted = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
      
      const updatedRecord = {
        ...editingRecord,
        activityDate: formatted
      };
      
      await dbService.updateRecord(editingRecord.id, { activityDate: formatted });
      setRecords(prev => prev.map(r => r.id === editingRecord.id ? updatedRecord : r));
      
      setEditingRecord(null);
      setEditingDate('');
    } finally {
      setIsSyncing(false);
    }
  };

  // Calendar settings (school year + Learning Periods) are saved on each student
  // in the account database, so they follow the family to any device.
  const saveStudentCalendar = async (
    studentId: string,
    calendar: { schoolYearLabel: string; schoolYearStart: string; schoolYearEnd: string; learningPeriods: LearningPeriod[] }
  ): Promise<boolean> => {
    try {
      await dbService.updateStudent(studentId, calendar);
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...calendar } : s));
      return true;
    } catch (error) {
      console.error('Could not save calendar settings:', error);
      alert('Sorry, your calendar settings could not be saved. Please check your internet connection and try again.');
      return false;
    }
  };

  const saveSchoolYearConfig = async () => {
    if (!viewingStudentId) return;
    const saved = await saveStudentCalendar(viewingStudentId, {
      schoolYearLabel, schoolYearStart, schoolYearEnd, learningPeriods
    });
    if (saved) setShowSchoolYearModal(false);
  };

  // Learning Period functions
  const saveLearningPeriod = async () => {
    if (!viewingStudentId) return;
    if (!lpName || !lpStartDate || !lpEndDate) {
      alert('Please fill in all learning period fields.');
      return;
    }

    const newLP: LearningPeriod = editingLP
      ? { ...editingLP, name: lpName, startDate: lpStartDate, endDate: lpEndDate }
      : { id: Date.now().toString(), name: lpName, startDate: lpStartDate, endDate: lpEndDate };

    const updatedLPs = editingLP
      ? learningPeriods.map(lp => lp.id === editingLP.id ? newLP : lp)
      : [...learningPeriods, newLP];

    const saved = await saveStudentCalendar(viewingStudentId, {
      schoolYearLabel, schoolYearStart, schoolYearEnd, learningPeriods: updatedLPs
    });
    if (!saved) return;

    setLearningPeriods(updatedLPs);
    setLpName('');
    setLpStartDate('');
    setLpEndDate('');
    setEditingLP(null);
    setShowLPModal(false);
  };

  const deleteLearningPeriod = async (id: string) => {
    if (!viewingStudentId) return;
    if (!confirm('Are you sure you want to delete this learning period?')) return;

    const updatedLPs = learningPeriods.filter(lp => lp.id !== id);
    const saved = await saveStudentCalendar(viewingStudentId, {
      schoolYearLabel, schoolYearStart, schoolYearEnd, learningPeriods: updatedLPs
    });
    if (saved) setLearningPeriods(updatedLPs);
  };

  // Copy the open student's school year + Learning Periods to the students ticked in the copy window.
  const copyCalendarToStudents = async () => {
    if (!viewingStudentId || copyTargetIds.length === 0) return;
    setIsCopying(true);
    try {
      const calendar = { schoolYearLabel, schoolYearStart, schoolYearEnd, learningPeriods };
      for (const targetId of copyTargetIds) {
        const ok = await saveStudentCalendar(targetId, calendar);
        if (!ok) return;
      }
      setShowCopyModal(false);
      setCopyTargetIds([]);
      alert(`Calendar copied to ${copyTargetIds.length} student${copyTargetIds.length === 1 ? '' : 's'}.`);
    } finally {
      setIsCopying(false);
    }
  };

  // Older versions saved these dates in this web browser only. If this student has
  // no saved calendar yet and the browser still has old dates, offer to use them.
  const getBrowserSavedCalendar = () => {
    try {
      const label = localStorage.getItem('schoolYearLabel') || '';
      const start = localStorage.getItem('schoolYearStart') || '';
      const end = localStorage.getItem('schoolYearEnd') || '';
      let lps: LearningPeriod[] = [];
      if (user) {
        const raw = localStorage.getItem(`learningPeriods_${user.id}`);
        if (raw) lps = JSON.parse(raw);
      }
      if (!label && !start && !end && lps.length === 0) return null;
      return { schoolYearLabel: label, schoolYearStart: start, schoolYearEnd: end, learningPeriods: lps };
    } catch {
      return null;
    }
  };

  const useBrowserCalendarForStudent = async () => {
    const found = getBrowserSavedCalendar();
    if (!found || !viewingStudentId) return;
    const saved = await saveStudentCalendar(viewingStudentId, found);
    if (saved) {
      setSchoolYearLabel(found.schoolYearLabel);
      setSchoolYearStart(found.schoolYearStart);
      setSchoolYearEnd(found.schoolYearEnd);
      setLearningPeriods(found.learningPeriods);
    }
  };

  const handleSubmitBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugText.trim() || !user) return;
    setIsSendingBug(true);
    try {
      await dbService.submitMessage({
        type: 'bug',
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        accountTier: user.accountTier,
        message: bugText.trim(),
        page: activeTab,
        appVersion: APP_VERSION,
        browser: navigator.userAgent,
        timestamp: Date.now(),
        status: 'new'
      });
      setBugText('');
      setShowBugModal(false);
      alert('Thank you! Your note was sent. If we need more details, we will email you.');
    } catch (error) {
      console.error('Could not send bug report:', error);
      alert('Sorry, your note could not be sent. Please try again in a few minutes.');
    } finally {
      setIsSendingBug(false);
    }
  };

  const loadAdminMessages = async () => {
    setIsLoadingMessages(true);
    setMessagesError('');
    try {
      setAdminMessages(await dbService.getMessages());
    } catch (error) {
      console.error('Could not load messages:', error);
      setMessagesError('Messages could not be loaded. The updated database rules may not be published yet.');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const openEditLP = (lp: LearningPeriod) => {
    setEditingLP(lp);
    setLpName(lp.name);
    setLpStartDate(lp.startDate);
    setLpEndDate(lp.endDate);
    setShowLPModal(true);
  };

  const getCurrentLP = () => {
    const today = new Date().getTime();
    return learningPeriods.find(lp => {
      const start = new Date(lp.startDate).getTime();
      const end = new Date(lp.endDate).getTime();
      return today >= start && today <= end;
    });
  };

  const getLPRecordCount = (lpId: string) => {
    const lp = learningPeriods.find(p => p.id === lpId);
    if (!lp) return 0;
    
    const startTime = new Date(lp.startDate).getTime();
    const endTime = new Date(lp.endDate).getTime();
    
    return records.filter(r => {
      const recordTime = new Date(r.activityDate).getTime();
      return recordTime >= startTime && recordTime <= endTime && (!viewingStudentId || r.studentId === viewingStudentId);
    }).length;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const currentLP = getCurrentLP();

  // Load the open student's calendar settings (school year + Learning Periods)
  useEffect(() => {
    const student = students.find(s => s.id === viewingStudentId);
    setSchoolYearLabel(student?.schoolYearLabel || '');
    setSchoolYearStart(student?.schoolYearStart || '');
    setSchoolYearEnd(student?.schoolYearEnd || '');
    setLearningPeriods(student?.learningPeriods || []);
  }, [viewingStudentId, students]);

  // Admin: load messages when the Admin tab opens
  useEffect(() => {
    if (activeTab === 'admin' && user?.email === ADMIN_EMAIL) loadAdminMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.email]);

  const handleUpdateRefresh = () => {
    localStorage.setItem('app_version', APP_VERSION);
    window.location.reload();
  };

  // ISSUE #7 FIX: Add 5MB file size guard
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Please upload an image under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSearch = async () => {
    if ((!query.trim() && !selectedImage) || !user) return;
    
    // ISSUE #4 FIX: Enforce grade selection when no student is selected
    if (!selectedStudentId && selectedGrades.length === 0) {
        alert("Please select a Target Student or at least one Grade Level to search.");
        return;
    }

    const isPro = user.isPaid || PRO_FREE_EMAILS.includes(user.email.toLowerCase());
    if (!isPro && user.searchCount >= FREE_SEARCH_LIMIT) { 
      setShowPaywall(true); 
      return; 
    }

    // ISSUE #3 FIX: Store activity description at search-time
    const activityText =
      query.trim() ||
      (selectedImage ? "Uploaded evidence" : "") ||
      "Activity Evidence Logged";

    setLastSearchDescription(activityText);

    setIsSearching(true);
    setHasSearched(true);
    setSearchResults([]); 

    try {
      const base64Data = selectedImage?.split(',')[1];
      const gradesString = selectedGrades.length > 0 ? selectedGrades.join(', ') : undefined;
      
      let excludeCodes: string[] | undefined = undefined;
      if (onlyUnmetStandards && selectedStudentId) {
        const currentYear = new Date().getFullYear();
        const schoolYearStart = new Date().getMonth() >= 6 ? currentYear : currentYear - 1;
        const syStartTime = new Date(schoolYearStart, 6, 1).getTime();
        
        excludeCodes = records
          .filter(r => r.studentId === selectedStudentId && r.timestamp >= syStartTime)
          .map(r => r.standardCode);
      }

      const results = await searchStandards(
        query, 
        gradesString, 
        subjectFilter === 'All' ? undefined : subjectFilter,
        base64Data,
        excludeCodes
      );
      setSearchResults(results || []);
      if (!isPro) {
        const newCount = await dbService.incrementUserSearch(user.id);
        setUser({ ...user, searchCount: newCount });
      }
    } catch (e: any) {
      console.error("Search Error:", e);
      const msg = String(e?.message || '');
      if (msg === 'DAILY_LIMIT_REACHED') {
        alert("The AI has reached its daily limit. Please try again tomorrow.");
      } else if (msg === 'RATE_LIMITED') {
        alert("You're searching very quickly. Please wait a few minutes and try again.");
      } else {
        alert("Sorry, the search didn't work. Please check your connection and try again.");
      }
    } finally { 
      setIsSearching(false); 
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); 
    }
  };

  const executeSave = async (standard: Standard, studentId: string) => {
    if (!user) return;

    setIsSavingRecord(true);

    // ISSUE #2 FIX: Rename to canIncludeMatchLogic for clarity
    const canIncludeMatchLogic =
      user.isPaid ||
      PRO_FREE_EMAILS.includes(user.email.toLowerCase()) ||
      user.searchCount < FREE_SEARCH_LIMIT;

    try {
      // ✅ PERFORMANCE FIX: Generate match logic on-demand (not during search)
      // This keeps the initial search fast and only generates logic when user saves
      let logicText = '';
      if (canIncludeMatchLogic) {
        try {
          logicText = await explainStandardMatch(
            standard, 
            lastSearchDescription || query || "this activity"
          );
        } catch (e) {
          console.error("Match logic generation failed:", e);
          logicText = ''; // Fall back to no logic if generation fails
        }
      }

      const recordData = {
        userId: user.id,
        studentId: studentId,
        standardCode: standard.code,
        standardDescription: standard.description,
        standardSubject: standard.subject,
        activityDate: new Date().toLocaleDateString(),
        activityDescription: lastSearchDescription || "Activity Evidence Logged",
        timestamp: Date.now(),
        matchLogic: logicText,
        includeLogic: canIncludeMatchLogic && !!logicText
      };

      const id = await dbService.addRecord(recordData);
      const newRecord = { id, ...recordData } as LearningRecord;
      setRecords(prev => [newRecord, ...prev]);
      
      // Automatically navigate to Vault tab and show the student's records
      setActiveTab('students');
      setViewingStudentId(studentId);
      
      console.log('✅ Record saved successfully:', { 
        id, 
        studentId, 
        standardCode: standard.code,
        totalRecords: records.length + 1
      });
    } catch (e: any) {
      console.error("❌ Save Error:", e);
      alert("Failed to save record. Please try again.");
    } finally {
      setIsSavingRecord(false);
    }
  };

  // Used by the Work Sample screens: counts one free-trial use after a successful generate.
  const countWorkSampleUse = async () => {
    if (!user) return;
    const newCount = await dbService.incrementUserSearch(user.id);
    setUser({ ...user, searchCount: newCount });
  };

  // Used by the Work Sample screens: saves the text record to the Vault without leaving the page.
  const saveWorkSampleRecord = async (r: { standard: Standard; studentId: string; activityText: string; matchLogic: string }): Promise<boolean> => {
    if (!user) return false;
    try {
      const recordData = {
        userId: user.id,
        studentId: r.studentId,
        standardCode: r.standard.code,
        standardDescription: r.standard.description,
        standardSubject: r.standard.subject,
        activityDate: new Date().toLocaleDateString(),
        activityDescription: r.activityText || 'Activity Evidence Logged',
        timestamp: Date.now(),
        matchLogic: r.matchLogic,
        includeLogic: !!r.matchLogic
      };
      const id = await dbService.addRecord(recordData);
      setRecords(prev => [{ id, ...recordData } as LearningRecord, ...prev]);
      return true;
    } catch (e) {
      console.error('Save error:', e);
      alert('Sorry, this could not be saved to the Vault. Please try again.');
      return false;
    }
  };

  const handleSaveToRecord = async (standard: Standard, targetStudentId?: string) => {
    if (!user) return;

    // If coming from modal selection, save directly
    if (targetStudentId) {
      setShowStudentSelectModal(false);
      setPendingStandardToSave(null);
      await executeSave(standard, targetStudentId);
      return;
    }

    // No students yet - show modal to create one
    if (students.length === 0) {
      setPendingStandardToSave(standard);
      setShowStudentSelectModal(true);
      return;
    }

    // Exactly 1 student - auto-save to that student
    if (students.length === 1) {
      await executeSave(standard, students[0].id);
      return;
    }

    // 2+ students - ALWAYS show modal to let user choose
    setPendingStandardToSave(standard);
    setShowStudentSelectModal(true);
  };

  const filteredRecords = useMemo(() => {
    if (!viewingStudentId) return [];
    
    let filtered = records.filter(record => record.studentId === viewingStudentId);

    if (pdfIncludeDateWindow) {
// LP filtering takes priority
      if (selectedLPForExport) {
        const lp = learningPeriods.find(p => p.id === selectedLPForExport);
        if (lp) {
          const startTime = new Date(lp.startDate).getTime();
          const endTime = new Date(lp.endDate).getTime();
          filtered = filtered.filter(r => {
            const recordTime = new Date(r.activityDate).getTime();
            return recordTime >= startTime && recordTime <= endTime;
          });
        }
      } else if (schoolYearFilter !== 'All') {
        const [startYearStr] = schoolYearFilter.split('-');
        const startYear = parseInt(startYearStr);
        const syStart = new Date(startYear, 6, 1).getTime(); 
        const syEnd = new Date(startYear + 1, 5, 30, 23, 59, 59).getTime(); 
        filtered = filtered.filter(r => r.timestamp >= syStart && r.timestamp <= syEnd);
      }
      if (startDateFilter) {
        const start = new Date(startDateFilter).getTime();
        filtered = filtered.filter(r => r.timestamp >= start);
      }
      if (endDateFilter) {
        const end = new Date(endDateFilter).setHours(23, 59, 59, 999);
        filtered = filtered.filter(r => r.timestamp <= end);
      }
    }

    return filtered;
}, [records, viewingStudentId, schoolYearFilter, startDateFilter, endDateFilter, pdfIncludeDateWindow, selectedLPForExport, learningPeriods]);
  const standardFrequencies = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRecords.forEach(r => {
      counts[r.standardCode] = (counts[r.standardCode] || 0) + 1;
    });
    return counts;
  }, [filteredRecords]);

  // ISSUE #6 FIX: CSV-safe header format
  const handleExportCSV = () => {
    if (!filteredRecords.length || !viewingStudentId) return;
    const student = students.find(s => s.id === viewingStudentId);
    
    const headers = ["Date", "Activity Description", "Standard Code", "Subject", "Standard Description", "Match Logic"];
    const rows = filteredRecords.map(r => [
        r.activityDate,
        `"${r.activityDescription.replace(/"/g, '""')}"`,
        r.standardCode,
        r.standardSubject,
        `"${r.standardDescription.replace(/"/g, '""')}"`,
        `"${(r.matchLogic || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n")
      + "\n\n"
      + `"HOMESCHOOL WORK SAMPLE PRO - PRIVATE STUDENT VAULT EXPORT","","","","",""\n`
      + `"CONFIDENTIAL: This data is for personal use and is not shared with any external agencies.","","","","",""\n`
      + `"ZERO-REPORTING GUARANTEE ACTIVE","","","","",""\n`
      + `"Generated by: ${user?.name}","","","","",""`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Student_Vault_Export_${student?.name || 'Student'}_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Branded PDF of the student's Vault (see services/vaultPdf.ts)
  const handleDownloadPDF = async () => {
    if (!filteredRecords.length || !viewingStudentId) return;

    const student = students.find(s => s.id === viewingStudentId);
    if (!student) return;

    const parts: string[] = [];
    if (pdfIncludeDateWindow) {
      if (selectedLPForExport) {
        const lp = learningPeriods.find(p => p.id === selectedLPForExport);
        if (lp) parts.push(`Learning Period: ${lp.name}`);
      } else if (schoolYearFilter !== 'All') {
        parts.push(`School Year ${schoolYearFilter}`);
      }
      if (startDateFilter) parts.push(`From ${startDateFilter}`);
      if (endDateFilter) parts.push(`To ${endDateFilter}`);
    }

    try {
      const { blob, fileName } = await buildVaultPdf({
        student,
        records: filteredRecords,
        filterText: parts.join('  |  '),
        includeLogic: pdfIncludeMatchLogic,
        preparedBy: user?.name || ''
      });
      downloadBlob(blob, fileName);
    } catch (e) {
      console.error('Vault PDF error:', e);
      alert('Sorry, the PDF could not be made. Please try again.');
    }
  };

  const handleSubmitFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!featureTitle.trim() || !user) return;
    setIsSubmittingFeature(true);
    try {
        const timestamp = Date.now();
        const requestData = {
            userId: user.id,
            userEmail: user.email,
            title: featureTitle,
            description: featureDesc,
            status: 'pending' as const,
            timestamp
        };
        
        await dbService.submitFeatureRequest(requestData);

        try {
          fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...requestData,
              userName: user.name,
              appVersion: APP_VERSION
            })
          }).catch(e => console.error("Email sync failed:", e));
        } catch (err) {
          console.log("Email notification not available");
        }

        setFeatureTitle('');
        setFeatureDesc('');
        alert("Request added to the development queue. Thank you for building with us!");
    } finally {
        setIsSubmittingFeature(false);
    }
  };

  const activeViewingStudent = students.find(s => s.id === viewingStudentId);
  const isPro = user?.isPaid || (user && PRO_FREE_EMAILS.includes(user.email.toLowerCase()));
  const hasProAccess = isPro || (user && user.searchCount < FREE_SEARCH_LIMIT);

  if (isAppLoading) return null;
  if (!user) return <AuthGate onLogin={setUser} onShowTerms={() => setShowTermsModal(true)} />;
  
  if (showPaywall && !isPro) return <AccessGate
    user={user}
    onUnlock={(name, code) => {
      dbService.unlockUser(user.id, name, code).then(() => {
        setUser({ ...user, isPaid: true, name: name, accountTier: 'pro' });
        setShowPaywall(false);
      });
    }}
    onCancel={() => setShowPaywall(false)}
  />;

  return (
    <div className="min-h-screen flex flex-col font-sans relative pb-32 md:pb-0">
      {stripeStatusMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[2000] max-w-md w-[92%] no-print">
          <div className="bg-white border border-[#81adb3]/30 shadow-2xl rounded-3xl px-6 py-4 flex items-start gap-3 animate-fade-in">
            <div className="flex-grow text-[11px] font-bold text-slate-700 tracking-wide leading-relaxed">
              {stripeStatusMessage}
            </div>
            <button
              onClick={() => setStripeStatusMessage(null)}
              className="text-slate-300 hover:text-slate-500 text-lg leading-none font-black"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {showTermsModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 no-print">
            <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl max-w-3xl w-full border border-slate-100 animate-fade-in max-h-[85vh] overflow-y-auto">
                <h3 className="text-3xl font-black text-slate-800 tracking-tighter mb-4">Terms of Use & Vault Privacy</h3>
                <p className="text-sm text-slate-500 mb-6 font-medium">Homeschool Work Sample Pro</p>
                <div className="space-y-6 text-slate-600 text-[13px] leading-relaxed">
                    <p className="font-medium">By using Homeschool Work Sample Pro, including any associated web or mobile application (the "Application" or "App"), you agree to the following Terms of Use and Vault Privacy Policy ("Terms"). If you do not agree to these Terms, do not use the Application.</p>
                    <p className="italic text-slate-500">Homeschool Work Sample Pro is an independent educational planning and documentation tool designed to support homeschool families.</p>
                    
                    <section>
                        <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-3">1. Purpose of the Application</h4>
                        <p className="mb-3">Homeschool Work Sample Pro provides tools that help homeschool families interpret learning activities and organize them in relation to California academic standards for personal record-keeping purposes only.</p>
                        <p>The Application is intended to assist families in understanding how learning activities may align with commonly used educational frameworks. It does not provide official approvals, certifications, or guarantees of acceptance by any school, charter organization, or educational authority.</p>
                    </section>
                    
                    <section>
                        <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-3">2. No Government or Charter Affiliation</h4>
                        <p className="mb-2">Homeschool Work Sample Pro is not affiliated with, endorsed by, sponsored by, or approved by:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                            <li>The State of California</li>
                            <li>The California Department of Education</li>
                            <li>Any charter school, charter network, or school district</li>
                            <li>Any public education agency or governmental entity</li>
                        </ul>
                        <p>References to California standards are provided solely for informational and organizational purposes.</p>
                    </section>
                    
                    <section>
                        <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-3">3. Charter Employment Disclosure</h4>
                        <p className="mb-3">The creator of Homeschool Work Sample Pro is an educator currently employed within the California charter homeschool system. This Application is offered independently and does not represent the policies, practices, or positions of any employer or educational organization.</p>
                        <p>Use of this Application does not create access to internal systems, preferential treatment, or official guidance from any charter school or educational institution.</p>
                    </section>
                    
                    <section>
                        <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-3">4. Free Use, Trial Limits, and Student Vault Access</h4>
                        <p className="font-bold mb-2">Free Matches</p>
                        <p className="mb-3">New users may perform up to 25 free standard matches without a paid plan. These matches are intended to allow families to explore the matching functionality of the Application.</p>
                        <p className="font-bold mb-2">Paid Plan Requirement</p>
                        <p className="mb-2">After the first 25 free matches:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                            <li>A paid plan is required to create or maintain a Student Vault</li>
                            <li>A paid plan is required to save, organize, or retain matched standards within student profiles</li>
                        </ul>
                        <p className="font-bold mb-2">Available Plans</p>
                        <p className="mb-2">Homeschool Work Sample Pro may offer the following paid plans, as displayed at checkout or within the Application:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                            <li>Monthly subscription plans</li>
                            <li>Annual subscription plans</li>
                        </ul>
                        <p>Pricing, billing frequency, and included features are clearly disclosed at the time of purchase and may change over time.</p>
                    </section>
                    
                    <section>
                        <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-3">5. Payments, Billing, and Cancellations</h4>
                        <ul className="list-disc list-inside space-y-2 ml-4 mb-3">
                            <li>Paid plans are billed in advance according to the selected billing cycle</li>
                            <li>Monthly plans renew monthly until canceled</li>
                            <li>Annual plans renew annually until canceled</li>
                        </ul>
                        <p>You may cancel your subscription at any time. Cancellation will take effect at the end of the current billing cycle. No partial refunds are provided for unused time unless otherwise required by law.</p>
                    </section>
                    
                    <section>
                        <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-3">6. Student Vault Data & Retention</h4>
                        <p className="font-bold mb-2">Active Accounts</p>
                        <p className="mb-3">For users with an active paid plan, Student Vault data is retained for the duration of the subscription.</p>
                        <p className="font-bold mb-2">Inactive or Canceled Accounts</p>
                        <p className="mb-2">If a subscription lapses or is canceled:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                            <li>Student Vault data may be retained for a limited period to prevent accidental data loss</li>
                            <li>Continued access to vault features may be restricted until a paid plan is restored</li>
                        </ul>
                        <p>Users may request deletion of Student Vault data or full account deletion at any time.</p>
                    </section>
                    
                    <section>
                        <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-3">7. Privacy & Data Ownership</h4>
                        <p className="mb-3">All Student Vault data is private to the account holder.</p>
                        <p className="mb-2">Homeschool Work Sample Pro:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                            <li>Does not sell student data</li>
                            <li>Does not share student data with schools, districts, or government agencies</li>
                            <li>Does not automatically report or submit information to any external entity</li>
                        </ul>
                        <p>Data exports are initiated solely by the user and remain under the user's control.</p>
                    </section>
                    
                    <section>
                        <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-3">8. AI Guidance Disclaimer</h4>
                        <p className="mb-3">The Application uses AI-powered tools to generate alignment suggestions.</p>
                        <p className="mb-2">These outputs:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                            <li>Are informational only</li>
                            <li>Require parent review and judgment</li>
                            <li>Do not constitute professional, legal, or educational advice</li>
                        </ul>
                        <p>Homeschool Work Sample Pro makes no guarantees regarding acceptance of documentation by any school or educational program.</p>
                    </section>
                    
                    <section>
                        <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-3">9. Limitation of Liability</h4>
                        <p className="mb-3">Use of Homeschool Work Sample Pro is at the user's discretion and risk. The Application is provided "as is" without warranties of any kind.</p>
                        <p className="mb-2">Homeschool Work Sample Pro is not responsible for:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                            <li>Educational decisions made by users</li>
                            <li>Rejection of documentation by schools or charters</li>
                            <li>Compliance outcomes related to homeschool programs</li>
                        </ul>
                    </section>
                    
                    <section>
                        <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-3">10. Intellectual Property</h4>
                        <p>All Application content, design, branding, and software are the intellectual property of Homeschool Work Sample Pro and may not be copied, reproduced, or redistributed without permission.</p>
                        <p className="font-medium mt-2">© Homeschool Work Sample Pro. All rights reserved.</p>
                    </section>
                    
                    <section>
                        <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-3">11. Changes to These Terms</h4>
                        <p>These Terms may be updated periodically. Continued use of the Application after changes are posted constitutes acceptance of the revised Terms.</p>
                    </section>
                </div>
                <button onClick={() => setShowTermsModal(false)} className="mt-10 w-full py-4 bg-slate-800 text-white font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-slate-700 transition-all">I Understand & Accept</button>
            </div>
        </div>
      )}

      {(isSavingRecord || (isDataLoading && activeTab === 'search' && !hasSearched)) && (
        <div className="fixed inset-0 z-[400] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in no-print">
          <ThinkingState message={isSavingRecord ? "Syncing to your Vault..." : "Accessing your Student Vault..."} />
        </div>
      )}

      {showDateModal && editingRecord && (
        <div className="fixed inset-0 z-[800] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 no-print">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-md w-full animate-fade-in border border-slate-100">
            <h3 className="text-2xl font-black text-slate-800 mb-6 tracking-tighter text-center">
              Edit Activity Date
            </h3>
            
            <div className="mb-6">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Activity Date
              </label>
              <input
                type="date"
                value={editingDate}
                onChange={(e) => setEditingDate(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 outline-none font-medium text-slate-800 focus:border-[#81adb3] transition-colors"
                autoFocus
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDateModal(false);
                  setEditingRecord(null);
                  setEditingDate('');
                }}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={executeDateEdit}
                className="flex-1 py-4 bg-[#81adb3] text-white font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-[#6d969c] transition-all shadow-lg"
              >
                Save Date
              </button>
            </div>
          </div>
        </div>
      )}

      {showCopyModal && viewingStudentId && (
        <div className="fixed inset-0 z-[800] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 no-print">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-lg w-full animate-fade-in border border-slate-100 max-h-[85vh] overflow-y-auto">
            <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tighter text-center">Copy Calendar</h3>
            <p className="text-sm text-slate-500 mb-6 text-center">
              Copy {activeViewingStudent?.name}'s school year dates and {learningPeriods.length} Learning Period{learningPeriods.length === 1 ? '' : 's'} to the students you tick below.
            </p>
            <div className="space-y-3">
              {students.filter(s => s.id !== viewingStudentId).map(s => {
                const hasCalendar = !!(s.schoolYearLabel || s.schoolYearStart || s.schoolYearEnd || (s.learningPeriods && s.learningPeriods.length > 0));
                return (
                  <label key={s.id} className="flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 cursor-pointer hover:border-[#81adb3] transition-colors">
                    <input
                      type="checkbox"
                      checked={copyTargetIds.includes(s.id)}
                      onChange={(e) => setCopyTargetIds(prev => e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id))}
                      className="w-5 h-5 accent-[#81adb3]"
                    />
                    <span className="flex-1">
                      <span className="block font-black text-slate-800 text-sm">{s.name}</span>
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Grade {s.gradeLevel}{hasCalendar ? ' • has a calendar (will be replaced)' : ''}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowCopyModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all">Cancel</button>
              <button
                onClick={copyCalendarToStudents}
                disabled={copyTargetIds.length === 0 || isCopying}
                className="flex-1 py-4 bg-[#81adb3] text-white font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-[#6d969c] transition-all shadow-lg disabled:opacity-40"
              >
                {isCopying ? 'Copying...' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBugModal && (
        <div className="fixed inset-0 z-[800] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 no-print">
          <form onSubmit={handleSubmitBug} className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-lg w-full animate-fade-in border border-slate-100">
            <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tighter text-center">Report a Bug</h3>
            <p className="text-sm text-slate-500 mb-6 text-center">Tell us what happened and what you expected. We will see your name and email with it, so we can follow up.</p>
            <textarea
              value={bugText}
              onChange={(e) => setBugText(e.target.value)}
              maxLength={4000}
              placeholder="What went wrong?"
              className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 outline-none font-medium h-40 focus:border-[#81adb3] transition-colors"
            />
            <div className="flex gap-3 mt-8">
              <button type="button" onClick={() => setShowBugModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all">Cancel</button>
              <button type="submit" disabled={!bugText.trim() || isSendingBug} className="flex-1 py-4 bg-[#e7b64f] text-slate-900 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-[#d9a43a] transition-all shadow-lg disabled:opacity-40">
                {isSendingBug ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showSchoolYearModal && (
        <div className="fixed inset-0 z-[800] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 no-print">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-lg w-full animate-fade-in border border-slate-100">
            <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tighter text-center">
              School Year Configuration
            </h3>
            <p className="text-sm text-slate-500 mb-6 text-center">These dates are saved for {activeViewingStudent?.name || 'this student'} only. Use them to filter vault exports by learning period.</p>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  School Year Label (e.g., "2024-2025")
                </label>
                <input
                  type="text"
                  value={schoolYearLabel}
                  onChange={(e) => setSchoolYearLabel(e.target.value)}
                  placeholder="2024-2025"
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 outline-none font-medium text-slate-800 focus:border-[#81adb3] transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  School Year Start Date
                </label>
                <input
                  type="date"
                  value={schoolYearStart}
                  onChange={(e) => setSchoolYearStart(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 outline-none font-medium text-slate-800 focus:border-[#81adb3] transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  School Year End Date
                </label>
                <input
                  type="date"
                  value={schoolYearEnd}
                  onChange={(e) => setSchoolYearEnd(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 outline-none font-medium text-slate-800 focus:border-[#81adb3] transition-colors"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowSchoolYearModal(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={saveSchoolYearConfig}
                className="flex-1 py-4 bg-[#81adb3] text-white font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-[#6d969c] transition-all shadow-lg"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {showLPModal && (
        <div className="fixed inset-0 z-[800] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 no-print">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-md w-full animate-fade-in border border-slate-100">
            <h3 className="text-2xl font-black text-slate-800 mb-6 tracking-tighter text-center">
              {editingLP ? 'Edit Period' : 'New Learning Period'}
            </h3>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Period Name
                </label>
                <input
                  type="text"
                  value={lpName}
                  onChange={(e) => setLpName(e.target.value)}
                  placeholder='e.g., "LP 1", "Q1", "Fall Semester"'
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 outline-none font-medium text-slate-800 focus:border-[#81adb3] transition-colors"
                  autoFocus
                />
                <p className="text-xs text-slate-400 mt-2 font-medium">Create learning periods, quarters, semesters, or any custom date range</p>
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={lpStartDate}
                  onChange={(e) => setLpStartDate(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 outline-none font-medium text-slate-800 focus:border-[#81adb3] transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={lpEndDate}
                  onChange={(e) => setLpEndDate(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 outline-none font-medium text-slate-800 focus:border-[#81adb3] transition-colors"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  setShowLPModal(false);
                  setEditingLP(null);
                  setLpName('');
                  setLpStartDate('');
                  setLpEndDate('');
                }}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={saveLearningPeriod}
                disabled={!lpName || !lpStartDate || !lpEndDate}
                className="flex-1 py-4 bg-[#81adb3] text-white font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-[#6d969c] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {editingLP ? 'Update Period' : 'Create Period'}
              </button>
            </div>
          </div>
        </div>
      )}


      {showLPCalendar && (
        <div className="fixed inset-0 z-[800] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 no-print">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-2xl w-full animate-fade-in border border-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter">Learning Period Calendar</h3>
              <button
                onClick={() => setShowLPCalendar(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {learningPeriods.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-slate-600 font-black text-sm mb-4 uppercase tracking-widest">No learning periods yet</p>
                <p className="text-sm text-slate-400 font-medium mb-8">Create periods to organize your records and track progress</p>
                <button
                  onClick={() => {
                    setShowLPCalendar(false);
                    setShowLPModal(true);
                  }}
                  className="px-10 py-5 bg-[#81adb3] text-white font-black rounded-3xl uppercase tracking-[0.2em] text-[10px] shadow-xl hover:bg-[#6d969c] transition-all"
                >
                  Create First Period
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {[...learningPeriods].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()).map(lp => {
                  const recordCount = getLPRecordCount(lp.id);
                  const isCurrentLP = currentLP?.id === lp.id;
                  const isPast = new Date(lp.endDate).getTime() < new Date().getTime();
                  
                  return (
                    <div
                      key={lp.id}
                      className={`border-2 rounded-3xl p-6 transition-all ${
                        isCurrentLP ? 'border-yellow-400 bg-yellow-50/30' : 'border-slate-200 hover:border-[#81adb3]/30 hover:bg-slate-50/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h4 className="font-black text-slate-800 text-lg tracking-tight">{lp.name}</h4>
                            {isCurrentLP && (
                              <span className="px-3 py-1 bg-yellow-400 text-yellow-900 rounded-full text-[9px] font-black uppercase tracking-widest">
                                Current
                              </span>
                            )}
                            {isPast && !isCurrentLP && (
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 font-medium mb-3">
                            {formatDate(lp.startDate)} - {formatDate(lp.endDate)}
                          </p>
                          <p className="text-sm text-[#81adb3] font-black uppercase tracking-widest">
                            {recordCount} record{recordCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditLP(lp)}
                            className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-[#81adb3]/10 hover:text-[#81adb3] transition-colors"
                            title="Edit period"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            onClick={() => deleteLearningPeriod(lp.id)}
                            className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-colors"
                            title="Delete period"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                <button
                  onClick={() => {
                    setShowLPCalendar(false);
                    setShowLPModal(true);
                  }}
                  className="w-full py-5 border-2 border-dashed border-slate-300 rounded-3xl text-slate-600 hover:border-[#81adb3]/30 hover:text-[#81adb3] transition-colors font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                  New Period
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showStudentModal && (
        <div className="fixed inset-0 z-[800] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 no-print">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-md w-full animate-fade-in border border-slate-100">
            <h3 className="text-2xl font-black text-slate-800 mb-6 tracking-tighter text-center">
              {studentModalMode === 'add' ? 'Add New Student' : 'Edit Student'}
            </h3>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Student Name
                </label>
                <input
                  type="text"
                  value={studentModalName}
                  onChange={(e) => setStudentModalName(e.target.value)}
                  placeholder="Enter student name"
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 outline-none font-medium text-slate-800 focus:border-[#81adb3] transition-colors"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Grade Level
                </label>
                <select
                  value={studentModalGrade}
                  onChange={(e) => setStudentModalGrade(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 outline-none font-medium text-slate-800 focus:border-[#81adb3] transition-colors cursor-pointer bg-white"
                >
                  {/* A student saved earlier with a grade outside TK to 8 keeps that grade when edited. */}
                  {(ALL_GRADES.includes(studentModalGrade) ? ALL_GRADES : [...ALL_GRADES, studentModalGrade]).map(grade => (
                    <option key={grade} value={grade}>Grade {grade}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  setShowStudentModal(false);
                  setStudentModalName('');
                  setStudentModalGrade('K');
                  setEditingStudent(null);
                  setPendingAutoSave(null);
                }}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={studentModalMode === 'add' ? executeAddStudent : executeEditStudent}
                disabled={!studentModalName.trim()}
                className="flex-1 py-4 bg-[#81adb3] text-white font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-[#6d969c] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {studentModalMode === 'add' ? 'Add Student' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showStudentSelectModal && (
        <div className="fixed inset-0 z-[700] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 no-print">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-sm w-full animate-fade-in text-center border border-slate-100">
             <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tighter">
               {students.length === 0 ? "No student found" : "Which student?"}
             </h3>
             <p className="text-slate-500 text-xs font-medium mb-8">
               {students.length === 0 
                ? "Create or select a Target Student to save this record." 
                : "Select which profile should store this alignment record."}
             </p>
             <div className="space-y-3">
                {students.map(s => (
                  <button 
                    key={s.id} 
                    onClick={() => pendingStandardToSave && handleSaveToRecord(pendingStandardToSave, s.id)}
                    className="w-full py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-[11px] text-slate-700 uppercase tracking-widest hover:border-[#81adb3] hover:bg-white transition-all transform active:scale-95"
                  >
                    {s.name} (Grade {s.gradeLevel})
                  </button>
                ))}
                
                <button 
                  onClick={() => {
                    setShowStudentSelectModal(false);
                    if (pendingStandardToSave) {
                      handleAddNewStudent(pendingStandardToSave).then(id => {
                        setPendingStandardToSave(null);
                      });
                    }
                  }}
                  className="w-full py-5 bg-[#81adb3]/5 border-2 border-[#81adb3]/20 rounded-2xl font-black text-[11px] text-[#81adb3] uppercase tracking-widest hover:bg-[#81adb3] hover:text-white transition-all transform active:scale-95"
                >
                  {students.length === 0 ? "Create Student" : "+ Add New Student"}
                </button>
             </div>
             <button onClick={() => { setShowStudentSelectModal(false); setPendingStandardToSave(null); }} className="mt-8 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-red-400 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 z-[600] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 no-print">
            <div className="bg-white p-10 md:p-14 rounded-[3.5rem] shadow-2xl max-w-lg w-full border border-slate-100 animate-fade-in relative overflow-hidden">
                <div className="official-header flex flex-col items-center mb-10 text-center">
                    <div className="w-16 h-16 bg-[#e7b64f]/10 rounded-2xl flex items-center justify-center text-[#e7b64f] mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    </div>
                    <h3 className="text-3xl font-black text-slate-800 tracking-tighter mb-2 leading-none">Vault Export</h3>
                    <p className="text-slate-400 text-sm font-medium">Preparing {filteredRecords.length} records for {activeViewingStudent?.name}.</p>
                </div>
                <div className="space-y-4">
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-6 text-center">
                        <div className="flex items-center justify-center gap-3 text-emerald-600 mb-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                            <p className="text-[10px] font-black uppercase tracking-widest">Sovereignty Guarantee</p>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic">
                            Zero-reporting guarantee active. This data is private by default.
                        </p>
                    </div>

                    {learningPeriods.length > 0 && (
                        <div className="mb-6">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                Filter by Learning Period (Optional)
                            </label>
                            <select
                                value={selectedLPForExport}
                                onChange={(e) => setSelectedLPForExport(e.target.value)}
                                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 outline-none font-medium text-slate-800 focus:border-[#81adb3] transition-colors bg-white cursor-pointer"
                            >
                                <option value="">All Records (No LP Filter)</option>
                                {learningPeriods.map(lp => (
                                    <option key={lp.id} value={lp.id}>
                                        {lp.name} ({formatDate(lp.startDate)} - {formatDate(lp.endDate)})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    
                    {/* PHASE 3: Export options UI */}
                    <div className="space-y-4 mb-6">
                        <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={pdfIncludeMatchLogic} 
                                onChange={(e) => setPdfIncludeMatchLogic(e.target.checked)}
                                className="w-5 h-5 rounded border-slate-300 text-[#81adb3] focus:ring-[#81adb3]"
                            />
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Include Match Logic</span>
                        </label>
                        
                        <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={pdfIncludeDateWindow} 
                                onChange={(e) => setPdfIncludeDateWindow(e.target.checked)}
                                className="w-5 h-5 rounded border-slate-300 text-[#81adb3] focus:ring-[#81adb3]"
                            />
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Apply Date Filters</span>
                        </label>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={handleDownloadPDF}
                            className="flex-1 py-4 bg-[#e7b64f] text-white font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-[#d9a43a] transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>
                            Download PDF
                        </button>
                        
                        <button 
                            onClick={handleExportCSV}
                            className="flex-1 py-4 bg-[#81adb3] text-white font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-[#6d969c] transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                            Export CSV
                        </button>
                    </div>
                    
                    <div className="pt-6 flex flex-col items-center">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-4 text-center max-w-md">
                            Need help turning match logic into charter-approved work samples? <a href={BLUEPRINT_GUIDE_URL} target="_blank" rel="noopener noreferrer" className="text-[#81adb3] font-black hover:underline underline-offset-2">Check out our comprehensive Charter Homeschool Blueprint</a>.
                        </p>
                        <button onClick={() => setShowExportModal(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {showUpdatePrompt && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[1000] no-print animate-fade-in w-[90%] max-w-sm">
           <div className="bg-slate-900 text-white px-6 py-4 rounded-[2rem] shadow-2xl flex items-center justify-between border border-white/10 ring-4 ring-[#e7b64f]/30">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-emerald-400 rounded-full animate-ping"></div>
                <p className="text-[10px] font-black uppercase tracking-widest">Update (v{APP_VERSION})</p>
              </div>
              <button 
                onClick={handleUpdateRefresh}
                className="bg-[#e7b64f] text-white px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg active:scale-95"
              >
                Refresh Now
              </button>
           </div>
        </div>
      )}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] md:hidden w-[90%] max-w-sm no-print">
        <div className="bg-slate-900/95 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 p-2 flex items-center justify-between shadow-2xl ring-1 ring-white/10">
            <button 
                onClick={() => { 
                  setActiveTab('search'); 
                  setViewingStudentId(null);
                }}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-300 ${activeTab === 'search' ? 'text-[#e7b64f] scale-110' : 'text-slate-500 opacity-60'}`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <span className="text-[8px] font-black uppercase tracking-widest">Match</span>
            </button>
            <button 
                onClick={() => { 
                  setActiveTab('students'); 
                  setViewingStudentId(null);
                }}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-300 ${activeTab === 'students' ? 'text-[#81adb3] scale-110' : 'text-slate-500 opacity-60'}`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                <span className="text-[8px] font-black uppercase tracking-widest">Vault</span>
            </button>
            <button 
                onClick={() => { 
                  setActiveTab('features'); 
                  setViewingStudentId(null);
                }}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-300 ${activeTab === 'features' ? 'text-[#f4989c] scale-110' : 'text-slate-500 opacity-60'}`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z"/></svg>
                <span className="text-[8px] font-black uppercase tracking-widest">Start Here</span>
            </button>
            {user?.email === ADMIN_EMAIL && (
              <button
                onClick={() => { setActiveTab('admin'); setViewingStudentId(null); }}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-300 ${activeTab === 'admin' ? 'text-[#367c92] scale-110' : 'text-slate-500 opacity-60'}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l9 6 9-6M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"/></svg>
                <span className="text-[8px] font-black uppercase tracking-widest">Admin</span>
              </button>
            )}
        </div>
      </div>

      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100 no-print">
        <div className="max-w-7xl mx-auto px-6 h-24 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <LogoIcon />
                <div>
                   <div className="flex items-center gap-2">
                      <h1 className="text-xl font-black text-slate-800 tracking-tighter">CA Homeschool <span className="text-[#e7b64f]">Align</span></h1>
                      {isPro && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase rounded-md tracking-widest ring-1 ring-emerald-200">Pro</span>}
                   </div>
                   <span className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">
                    v{APP_VERSION} • {isPro ? 'Beta License Active' : `${Math.max(0, FREE_SEARCH_LIMIT - (user?.searchCount || 0))} Trial Matches Remaining`}
                   </span>
                </div>
            </div>
            <nav className="hidden md:flex items-center gap-8">
               <button onClick={() => { 
                 setActiveTab('search'); 
                 setViewingStudentId(null);
               }} className={`text-[10px] font-black uppercase tracking-[0.2em] ${activeTab === 'search' ? 'text-[#e7b64f]' : 'text-slate-400 hover:text-slate-600 transition-colors'}`}>Match</button>
               <button onClick={() => { 
                 setActiveTab('students'); 
                 setViewingStudentId(null);
               }} className={`text-[10px] font-black uppercase tracking-[0.2em] ${activeTab === 'students' ? 'text-[#e7b64f]' : 'text-slate-400 hover:text-slate-600 transition-colors'}`}>Vault</button>
               <button onClick={() => { 
                 setActiveTab('features'); 
                 setViewingStudentId(null);
               }} className={`text-[10px] font-black uppercase tracking-[0.2em] ${activeTab === 'features' ? 'text-[#e7b64f]' : 'text-slate-400 hover:text-slate-600 transition-colors'}`}>Start Here</button>
               {user?.email === ADMIN_EMAIL && (
                 <button onClick={() => {
                   setActiveTab('admin');
                   setViewingStudentId(null);
                 }} className={`text-[10px] font-black uppercase tracking-[0.2em] ${activeTab === 'admin' ? 'text-[#e7b64f]' : 'text-slate-400 hover:text-slate-600 transition-colors'}`}>Admin</button>
               )}
            </nav>
            <button onClick={async () => {
              await authService.logout();
              // Navigate to home page after logout
              setActiveTab('search');
              setViewingStudentId(null);
            }} className="text-[8px] font-black text-slate-300 uppercase tracking-widest hover:text-red-400 transition-colors">Logout</button>
        </div>
      </header>

      {user && <InstallPrompt />}

      <main className="flex-grow max-w-7xl mx-auto px-6 py-12 w-full z-10 mb-20">
            {activeTab === 'search' && user && (
              <WorkSampleFlow
                user={user}
                students={students}
                records={records}
                isPro={!!isPro}
                freeLimit={FREE_SEARCH_LIMIT}
                onNeedPaywall={() => setShowPaywall(true)}
                onSearchUsed={countWorkSampleUse}
                onAddStudent={() => { handleAddNewStudent(); }}
                onSaveRecord={saveWorkSampleRecord}
              />
            )}

            {activeTab === 'students' && (
               <div className="animate-fade-in space-y-12">
                   <div className="flex flex-col md:flex-row justify-between items-end border-b border-slate-200 pb-8 no-print gap-4">
                       <div>
                           {viewingStudentId && <button onClick={() => { 
                             setViewingStudentId(null); 
                             setSchoolYearFilter('All'); 
                             setStartDateFilter(''); 
                             setEndDateFilter('');
                           }} className="text-[10px] font-black text-[#81adb3] uppercase tracking-widest mb-2 no-print">← Back to Student Vault</button>}
                           <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter leading-none mb-1">{viewingStudentId ? activeViewingStudent?.name : 'Student Vault'}</h2>
                           {schoolYearLabel && (
                             <p className="text-[#e7b64f] text-xs font-black uppercase tracking-widest mb-1">
                               School Year: {schoolYearLabel}
                               {schoolYearStart && schoolYearEnd && ` (${new Date(schoolYearStart).toLocaleDateString()} - ${new Date(schoolYearEnd).toLocaleDateString()})`}
                             </p>
                           )}
                           <p className="text-slate-400 text-sm font-medium no-print">Private storage for academic alignment records.</p>
                       </div>
                       <div className="flex gap-4">
                         {!viewingStudentId && (
                           <button onClick={() => handleAddNewStudent()} className="text-[9px] font-black text-white bg-[#e7b64f] uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#d9a43a] transition-all shadow-lg no-print flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4"/></svg>
                              + Add New Student
                           </button>
                         )}
                         {viewingStudentId && (
                           <>
                             <button onClick={() => setShowSchoolYearModal(true)} className="text-[9px] font-black text-slate-600 bg-slate-100 uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-slate-200 transition-all no-print flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                School Year
                             </button>
                             <button onClick={() => setShowLPCalendar(true)} className="text-[9px] font-black text-slate-600 bg-slate-100 uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-slate-200 transition-all no-print flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                LP Date Ranges
                                {learningPeriods.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-white/30 rounded text-[8px]">{learningPeriods.length}</span>}
                             </button>
                             {students.length > 1 && (
                               <button onClick={() => { setCopyTargetIds([]); setShowCopyModal(true); }} className="text-[9px] font-black text-slate-600 bg-slate-100 uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-slate-200 transition-all no-print">
                                  Copy Calendar to Other Students
                               </button>
                             )}
                             <p className="text-[8px] text-slate-400 font-medium mt-1 no-print">*LP = Learning Period</p>
                           </>
                         )}
                         {viewingStudentId && (
                            <button onClick={() => startActivityForStudent(viewingStudentId)} className="text-[9px] font-black text-slate-900 bg-[#e7b64f] uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#d9a43a] transition-all shadow-lg no-print flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4"/></svg>
                                Add an Activity
                            </button>
                         )}
                         {viewingStudentId && (
                            <button onClick={() => setShowExportModal(true)} className="text-[9px] font-black text-white bg-[#81adb3] uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#6d969c] transition-all shadow-lg no-print flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                Export Vault
                            </button>
                         )}
                         <button onClick={() => fetchData(user)} className="text-[9px] font-black text-[#81adb3] uppercase tracking-widest border border-[#81adb3]/20 px-4 py-2 rounded-xl hover:bg-[#81adb3]/5 transition-colors no-print">
                            {isSyncing || isDataLoading ? "Syncing..." : "Refresh Vault"}
                         </button>
                       </div>
                   </div>

                   {viewingStudentId && !schoolYearLabel && !schoolYearStart && !schoolYearEnd && learningPeriods.length === 0 && getBrowserSavedCalendar() && (
                     <div className="bg-[#fddc96]/40 border border-[#e7b64f]/40 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                       <p className="text-sm text-slate-700 font-medium">We found school year dates saved in this web browser from an earlier version. Use them for {activeViewingStudent?.name}? They will then be saved in your account.</p>
                       <button onClick={useBrowserCalendarForStudent} className="text-[9px] font-black text-slate-800 bg-[#e7b64f] uppercase tracking-widest px-4 py-3 rounded-xl hover:bg-[#d9a43a] transition-all shrink-0">Use These Dates</button>
                     </div>
                   )}

                   {!viewingStudentId ? (
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 no-print">
                           {isDataLoading ? (
                              <div className="col-span-full py-20"><ThinkingState message="Opening Vault..." /></div>
                           ) : students.length > 0 ? (
                               <>
                                   {students.map(student => (
                                       <div key={student.id} className="group bg-white rounded-[3rem] p-10 shadow-sm border border-slate-100 hover:shadow-2xl transition-all relative text-center flex flex-col items-center">
                                           <div onClick={() => {
                                             setViewingStudentId(student.id);
                                             setActiveTab('students');
                                           }} className="cursor-pointer w-full flex flex-col items-center">
                                               <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6 group-hover:bg-[#81adb3]/10 group-hover:text-[#81adb3] transition-colors">
                                                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                                               </div>
                                               <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-1">Student Profile: {student.name}</h3>
                                               <span className="px-4 py-1.5 bg-slate-50 text-slate-500 text-[10px] font-black rounded-full uppercase tracking-widest block w-fit mx-auto ring-1 ring-slate-100">Grade {student.gradeLevel}</span>
                                           </div>
                                           <div className="mt-8 flex gap-3">
                                               <button onClick={() => handleEditStudent(student)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-[#81adb3]/10 hover:text-[#81adb3] transition-colors">
                                                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                               </button>
                                               <button onClick={() => handleDeleteStudent(student.id)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-colors">
                                                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                               </button>
                                           </div>
                                       </div>
                                   ))}
                                   <div onClick={() => handleAddNewStudent()} className="group bg-white rounded-[3rem] p-10 shadow-sm border-2 border-slate-100 border-dashed hover:shadow-2xl transition-all relative text-center flex flex-col items-center cursor-pointer justify-center min-h-[360px]">
                                       <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6 group-hover:bg-[#e7b64f]/10 group-hover:text-[#e7b64f] transition-colors">
                                          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4"/></svg>
                                       </div>
                                       <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-1">+ Add New Student</h3>
                                   </div>
                               </>
                           ) : (
                             <div className="col-span-full py-20 text-center flex flex-col items-center animate-fade-in">
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Vault Empty</h3>
                                <button onClick={() => handleAddNewStudent()} className="px-10 py-5 bg-[#e7b64f] text-white font-black rounded-3xl uppercase tracking-[0.2em] text-[10px] shadow-xl">Initialize Student Profile</button>
                             </div>
                           )}
                       </div>
                   ) : activeViewingStudent && (
                       <div className="space-y-12 max-w-6xl mx-auto animate-fade-in">
                           <div className="transcript-container bg-white p-8 md:p-12 rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden relative">
                                <div className="official-header flex flex-col items-center mb-12 pb-6 border-b border-slate-100 text-center relative">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.35em] mb-2">PRIVATE VAULT EXPORT • ACADEMIC RECORD</p>
                                    <h3 className="text-5xl md:text-6xl font-black text-slate-800 uppercase tracking-tighter mb-2 leading-none">{activeViewingStudent.name}</h3>
                                    <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em] mb-4">GRADE {activeViewingStudent.gradeLevel}</p>
                                    <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 flex items-center gap-2">
                                        <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                                        <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Confidential Parent Record</p>
                                    </div>
                                    <button onClick={() => handleEditStudent(activeViewingStudent)} className="absolute top-0 right-0 p-3 text-slate-300 hover:text-[#81adb3] transition-colors no-print">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                    </button>
                                </div>
                                <div className="space-y-10">
                                    {filteredRecords.length > 0 ? filteredRecords.map(record => {
                                        const freq = standardFrequencies[record.standardCode] || 1;
                                        return (
                                            <div key={record.id} className="record-row group/row grid grid-cols-1 md:grid-cols-[140px_1fr_2.5fr] gap-8 p-6 border-t border-slate-100 hover:bg-slate-50/30 transition-colors relative">
                                                <div className="flex items-center gap-2">
                                                  <div className="text-[11px] font-mono text-slate-500 pt-1 uppercase tracking-wider">{record.activityDate}</div>
                                                  <button 
                                                    onClick={() => handleEditRecordDate(record)} 
                                                    className="opacity-0 group-hover/row:opacity-100 p-1 text-slate-300 hover:text-[#81adb3] transition-all no-print"
                                                    title="Edit date"
                                                  >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                                  </button>
                                                </div>
                                                <div className="font-bold text-[15px] text-slate-800 italic pt-1 leading-snug">"{record.activityDescription}"</div>
                                                <div className="space-y-6">
                                                    <div className="flex gap-3 flex-wrap items-center">
                                                        <span className="standard-code px-3 py-1 bg-slate-800 text-white text-[10px] font-black rounded uppercase tracking-widest">{record.standardCode}</span>
                                                        {freq > 1 && <span className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-[#81adb3] text-white text-[9px] font-black rounded uppercase tracking-[0.15em] shadow-sm">Matched {freq}x</span>}
                                                        <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded uppercase tracking-widest">{record.standardSubject}</span>
                                                        <button onClick={() => handleDeleteRecord(record.id)} className="ml-auto opacity-0 group-hover/row:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all no-print">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                                        </button>
                                                    </div>
                                                    <p className="text-[13.5px] text-slate-700 leading-relaxed font-serif">{record.standardDescription}</p>
                                                    {record.matchLogic && (
                                                        <div className="match-logic-box p-6 bg-slate-100/50 rounded-2xl border border-slate-100 shadow-inner">
                                                            <p className="text-[14.5px] text-slate-700 italic font-medium leading-relaxed font-serif">{record.matchLogic}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }) : (
                                        <div className="text-center py-20 flex flex-col items-center gap-6">
                                            <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">No Student Vault entries found for this Student Profile.</p>
                                            {viewingStudentId && (
                                              <button onClick={() => startActivityForStudent(viewingStudentId)} className="px-8 py-4 bg-[#e7b64f] text-slate-900 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-[#d9a43a] transition-all shadow-lg no-print">
                                                  + Add the First Activity
                                              </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                           </div>
                       </div>
                   )}
               </div>
            )}

            {activeTab === 'admin' && user?.email === ADMIN_EMAIL && (
              <div className="animate-fade-in space-y-8 max-w-4xl mx-auto">
                <div className="flex items-end justify-between border-b border-slate-200 pb-6">
                  <div>
                    <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter leading-none mb-1">Admin</h2>
                    <p className="text-[#e7b64f] text-xs font-black uppercase tracking-widest">In-App Messages</p>
                  </div>
                  <button onClick={loadAdminMessages} className="text-[9px] font-black text-[#81adb3] uppercase tracking-widest border border-[#81adb3]/20 px-4 py-2 rounded-xl hover:bg-[#81adb3]/5 transition-colors">
                    {isLoadingMessages ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
                <p className="text-sm text-slate-500">Nothing is emailed from the app. Each note below shows the account it came from, so you can email that person yourself.</p>
                {messagesError && <p className="text-sm font-bold text-red-500">{messagesError}</p>}
                {!messagesError && !isLoadingMessages && adminMessages.length === 0 && (
                  <p className="text-sm text-slate-400 font-medium">No messages yet.</p>
                )}
                {adminMessages.map(m => (
                  <div key={m.id} className={`bg-white p-8 rounded-[2rem] shadow-sm border ${m.status === 'new' ? 'border-[#e7b64f]' : 'border-slate-100 opacity-70'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#367c92]">Bug report • {new Date(m.timestamp).toLocaleString()}</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${m.status === 'new' ? 'bg-[#fddc96] text-slate-800' : 'bg-slate-100 text-slate-500'}`}>{m.status === 'new' ? 'New' : 'Handled'}</span>
                    </div>
                    <p className="text-slate-800 font-medium whitespace-pre-wrap mb-4">{m.message}</p>
                    <p className="text-xs text-slate-500 mb-1"><span className="font-black uppercase tracking-widest">From:</span> {m.userName} • <a className="text-[#367c92] underline" href={`mailto:${m.userEmail}`}>{m.userEmail}</a> • {m.accountTier} account</p>
                    <p className="text-xs text-slate-400 mb-4 break-words"><span className="font-black uppercase tracking-widest">Details:</span> screen "{m.page}", app v{m.appVersion}, {m.browser}</p>
                    <div className="flex gap-3">
                      <button
                        onClick={async () => { await dbService.setMessageStatus(m.id!, m.status === 'new' ? 'handled' : 'new'); loadAdminMessages(); }}
                        className="text-[9px] font-black text-slate-600 bg-slate-100 uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-slate-200 transition-all"
                      >
                        {m.status === 'new' ? 'Mark Handled' : 'Mark New'}
                      </button>
                      <button
                        onClick={async () => { if (!confirm('Delete this message for good?')) return; await dbService.deleteMessage(m.id!); loadAdminMessages(); }}
                        className="text-[9px] font-black text-red-400 uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-red-50 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'features' && (
                <div className="animate-fade-in space-y-12 max-w-4xl mx-auto">
                    <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                        <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase tracking-tighter">How to use Align</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-3">
                                <div className="w-10 h-10 bg-[#81adb3]/10 text-[#81adb3] rounded-2xl flex items-center justify-center font-black text-sm">1</div>
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-800">Select Context</h4>
                                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Pick a Target Student or Grade focus levels.</p>
                            </div>
                            <div className="space-y-3">
                                <div className="w-10 h-10 bg-[#e7b64f]/10 text-[#e7b64f] rounded-2xl flex items-center justify-center font-black text-sm">2</div>
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-800">Input Activity</h4>
                                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Type your activity or upload a photo.</p>
                            </div>
                            <div className="space-y-3">
                                <div className="w-10 h-10 bg-[#f4989c]/10 text-[#f4989c] rounded-2xl flex items-center justify-center font-black text-sm">3</div>
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-800">Add to Vault</h4>
                                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Save the match to your private vault.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                        <h2 className="text-2xl font-black text-slate-800 mb-8 uppercase tracking-tighter">Frequently Asked Questions</h2>
                        <div className="space-y-6">
                            <div className="border-b border-slate-100 pb-6">
                                <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-3">Can I select multiple grade levels for one student?</h3>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    Yes, you can select up to 3 grade levels when searching. This feature is designed for "family-style" homeschooling where multiple children participate in the same lesson. However, <span className="font-black">when saving standards to a student's vault, you must only save standards that match their legal grade level</span> for charter compliance. The tool allows you to see matches across grades, but each student's vault should only contain standards appropriate for their enrolled grade.
                                </p>
                            </div>
                            <div className="border-b border-slate-100 pb-6">
                                <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-3">Is my student data private?</h3>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    Yes. All student data is stored in your private, encrypted account vault. We do not sell or share student identifiers with third parties, districts, or government agencies. Your data is for your exclusive record-keeping use only. Zero-reporting guarantee active.
                                </p>
                            </div>
                            <div className="border-b border-slate-100 pb-6">
                                <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-3">What does "match logic" mean?</h3>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    Match logic is a parent-friendly explanation of how your activity connects to a CA standard. It translates educational jargon into practical language. Pro users receive match logic automatically; free trial users get it for their first 25 searches.
                                </p>
                            </div>
                            <div className="pb-6">
                                <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-3">How do I turn this into charter-approved work samples?</h3>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    The inferred match logic provided by this tool is a starting point. To create charter-compliant work samples, Check out our comprehensive Charter Homeschool Blueprint: <a href={BLUEPRINT_GUIDE_URL} target="_blank" rel="noopener noreferrer" className="text-[#81adb3] font-black hover:underline">The Charter Homeschool Blueprint</a>. This guide shows you how to document learning in formats your charter will accept.
                                </p>
                            </div>
                        </div>
                    </div>

                    <InstallDirections />

                    <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                        <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tighter">Request a Feature</h3>
                        <form onSubmit={handleSubmitFeature} className="space-y-4 max-w-2xl mx-auto text-left">
                            <input type="text" value={featureTitle} onChange={e => setFeatureTitle(e.target.value)} placeholder="Topic" className="w-full px-6 py-4 rounded-2xl border border-slate-100 outline-none font-medium" />
                            <textarea value={featureDesc} onChange={e => setFeatureDesc(e.target.value)} placeholder="Description" className="w-full px-6 py-4 rounded-2xl border border-slate-100 outline-none font-medium h-32" />
                            <button type="submit" disabled={isSubmittingFeature} className="w-full py-4 bg-[#e7b64f] text-white font-black rounded-2xl uppercase tracking-widest text-[10px]">{isSubmittingFeature ? 'Submitting...' : 'Submit'}</button>
                        </form>
                    </div>

                    <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 text-center">
                        <h3 className="text-xl font-black text-slate-800 mb-3 uppercase tracking-tighter">Something Not Working?</h3>
                        <p className="text-sm text-slate-500 mb-6">Let us know what went wrong and we will look into it.</p>
                        <button onClick={() => setShowBugModal(true)} className="px-8 py-4 bg-[#e7b64f] text-slate-900 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-[#d9a43a] transition-all">Report a Bug</button>
                    </div>
                </div>
            )}
      </main>

      <footer className="w-full py-6 border-t border-slate-100 bg-white/50 backdrop-blur-sm mt-auto no-print">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
            © {new Date().getFullYear()} Homeschool Work Sample Pro | All Rights Reserved
          </p>
        </div>
      </footer>
    </div>
  );
}

