import { useState, useEffect, useMemo } from 'react';
import { db, firebase } from '../../firebase';
import { EMPTY_STATE } from '../../utils/constants';
import { todayISO, nowISO, generateId, calcTradeDerived, formatCurrency, formatWeekRange, getWeekBounds, calculateWeekStats } from '../../utils/helpers';
import { emailTemplates, sendEmail } from '../../utils/emailService';
import { Avatar } from '../shared/StarRatingAvatar';
import Icons from '../shared/Icons';
import DashboardPage from '../dashboard/Dashboard';
import TradeLogPage from '../tradelog/TradeLog';
import CalendarPage from '../calendar/CalendarPage';
import GoalsPage from '../goals/GoalsPage';
import SetupsPage from '../setups/SetupsPage';
import MistakesPage from '../mistakes/MistakesPage';
import { MentorAssignmentsTab, MentorCheckinsTab, MentorSessionsTab } from './MentorTabs';

// =============================================================================
// STUDENTS PAGE (for mentors)
// =============================================================================
export default function StudentsPage({ userProfile, isMobile }) {
  const [students, setStudents] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [loadingStudentData, setLoadingStudentData] = useState(false);
  const [activeJournalTab, setActiveJournalTab] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [dashboardView, setDashboardView] = useState('dashboard');
  const [allStudentData, setAllStudentData] = useState({});
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [tradeFeedback, setTradeFeedback] = useState([]);
  const [tradeFlags, setTradeFlags] = useState([]);
  const [tradeQuestions, setTradeQuestions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [weeklyCheckins, setWeeklyCheckins] = useState([]);
  const [sessions, setSessions] = useState([]);

  const journalTabs = [
    { id: 'dashboard', label: 'Dashboard' }, { id: 'tradelog', label: 'Trade Log' },
    { id: 'calendar', label: 'Calendar' }, { id: 'goals', label: 'Goals' },
    { id: 'setups', label: 'Setups' }, { id: 'mistakes', label: 'Mistakes' },
    { id: 'assignments', label: 'Assignments' }, { id: 'checkins', label: 'Check-ins' },
    { id: 'sessions', label: 'Sessions' },
  ];

  // Load students list
  useEffect(() => {
    if (!userProfile?.uid) return;
    let all = { mentees: [], students: [] };
    const update = () => {
      const combined = [...all.mentees, ...all.students];
      setStudents(combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i));
      setLoading(false);
    };
    const unsub1 = db.collection('mentorships').doc(userProfile.uid).collection('mentees').onSnapshot(snap => { all.mentees = snap.docs.map(d => ({ id: d.id, ...d.data() })); update(); }, err => { all.mentees = []; update(); });
    const unsub2 = db.collection('mentorships').doc(userProfile.uid).collection('students').onSnapshot(snap => { all.students = snap.docs.map(d => ({ id: d.id, ...d.data() })); update(); }, err => { all.students = []; update(); });
    return () => { unsub1(); unsub2(); };
  }, [userProfile?.uid]);

  // Load all student data for dashboard
  useEffect(() => {
    if (!students.length) { setLoadingDashboard(false); return; }
    const unsubs = [];
    students.forEach(s => {
      unsubs.push(db.collection('users').doc(s.id).collection('journalData').doc('state').onSnapshot(doc => {
        if (doc.exists) setAllStudentData(p => ({ ...p, [s.id]: { ...p[s.id], trades: doc.data().trades || [] } }));
      }));
      unsubs.push(db.collection('users').doc(s.id).collection('assignments').onSnapshot(snap => {
        setAllStudentData(p => ({ ...p, [s.id]: { ...p[s.id], assignments: snap.docs.map(d => ({ id: d.id, ...d.data() })) } }));
      }));
      unsubs.push(db.collection('users').doc(s.id).collection('weeklyCheckins').orderBy('weekStart', 'desc').onSnapshot(snap => {
        setAllStudentData(p => ({ ...p, [s.id]: { ...p[s.id], checkins: snap.docs.map(d => ({ id: d.id, ...d.data() })) } }));
      }));
      unsubs.push(db.collection('users').doc(s.id).collection('tradeQuestions').orderBy('createdAt', 'desc').onSnapshot(
        snap => setAllStudentData(p => ({ ...p, [s.id]: { ...p[s.id], questions: snap.docs.map(d => ({ id: d.id, ...d.data() })) } })),
        () => setAllStudentData(p => ({ ...p, [s.id]: { ...p[s.id], questions: [] } }))
      ));
    });
    setLoadingDashboard(false);
    return () => unsubs.forEach(u => u());
  }, [students]);

  // Load selected student details
  useEffect(() => {
    if (!selectedStudent?.id) {
      setTradeFeedback([]); setTradeFlags([]); setAssignments([]); setWeeklyCheckins([]); setSessions([]);
      return;
    }
    const id = selectedStudent.id;
    const unsubs = [
      db.collection('users').doc(id).collection('tradeFeedback').orderBy('createdAt', 'desc').onSnapshot(s => setTradeFeedback(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      db.collection('users').doc(id).collection('tradeFlags').onSnapshot(s => setTradeFlags(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      db.collection('users').doc(id).collection('assignments').orderBy('createdAt', 'desc').onSnapshot(s => setAssignments(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      db.collection('users').doc(id).collection('weeklyCheckins').orderBy('weekStart', 'desc').onSnapshot(s => setWeeklyCheckins(s.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    const unsub5 = db.collection('users').doc(id).collection('tradeQuestions').orderBy('createdAt', 'desc').onSnapshot(s => setTradeQuestions(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setTradeQuestions([]));
    const unsub6 = db.collection('users').doc(id).collection('sessions').orderBy('dateTime', 'desc').onSnapshot(s => setSessions(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setSessions([]));
    return () => { unsubs.forEach(u => u()); unsub5(); unsub6(); };
  }, [selectedStudent?.id]);

  const createNotification = async (studentId, type, title, message, link = null) => {
    try {
      await db.collection('users').doc(studentId).collection('notifications').add({ type, title, message, link, read: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    } catch {}
  };

  const addFeedback = async (tradeId, type, content) => {
    if (!selectedStudent?.id || !content.trim()) return;
    try {
      await db.collection('users').doc(selectedStudent.id).collection('tradeFeedback').add({ tradeId, mentorId: userProfile.uid, mentorName: userProfile.displayName, type, content: content.trim(), createdAt: firebase.firestore.FieldValue.serverTimestamp(), read: false });
      await createNotification(selectedStudent.id, 'feedback', `${userProfile.displayName} left feedback`, content.trim().substring(0, 100), 'tradelog');
      return true;
    } catch { return false; }
  };

  const addFlag = async (tradeId, flagType, note = '') => {
    if (!selectedStudent?.id) return;
    try {
      const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp; const FieldValue = firebase.firestore.FieldValue;
      const existing = tradeFlags.find(f => f.tradeId === tradeId);
      if (existing) {
        await db.collection('users').doc(selectedStudent.id).collection('tradeFlags').doc(existing.id).update({ flagType, note, updatedAt: serverTimestamp() });
      } else {
        await db.collection('users').doc(selectedStudent.id).collection('tradeFlags').add({ tradeId, mentorId: userProfile.uid, mentorName: userProfile.displayName, flagType, note, status: 'open', createdAt: serverTimestamp() });
        await createNotification(selectedStudent.id, 'flag', `${userProfile.displayName} flagged a trade`, `${flagType}${note ? ': ' + note.substring(0, 50) : ''}`, 'tradelog');
      }
      return true;
    } catch { return false; }
  };

  const removeFlag = async (tradeId) => {
    if (!selectedStudent?.id) return;
    const f = tradeFlags.find(f => f.tradeId === tradeId);
    if (f) await db.collection('users').doc(selectedStudent.id).collection('tradeFlags').doc(f.id).delete();
  };

  const toggleFlagStatus = async (tradeId) => {
    if (!selectedStudent?.id) return;
    const f = tradeFlags.find(f => f.tradeId === tradeId);
    if (f) await db.collection('users').doc(selectedStudent.id).collection('tradeFlags').doc(f.id).update({ status: f.status === 'open' ? 'resolved' : 'open' });
  };

  const answerQuestion = async (questionId, answer) => {
    if (!selectedStudent?.id || !answer.trim()) return false;
    try {
      await db.collection('users').doc(selectedStudent.id).collection('tradeQuestions').doc(questionId).update({ answer: answer.trim(), answeredAt: firebase.firestore.FieldValue.serverTimestamp(), mentorId: userProfile.uid, mentorName: userProfile.displayName, status: 'answered' });
      await createNotification(selectedStudent.id, 'question_answered', `${userProfile.displayName} answered your question`, answer.trim().substring(0, 100), 'tradelog');
      return true;
    } catch { return false; }
  };

  const resolveQuestion = async (questionId) => {
    if (!selectedStudent?.id) return false;
    try { await db.collection('users').doc(selectedStudent.id).collection('tradeQuestions').doc(questionId).update({ status: 'resolved' }); return true; } catch { return false; }
  };

  const createSession = async (data) => {
    if (!selectedStudent?.id) return false;
    try {
      await db.collection('users').doc(selectedStudent.id).collection('sessions').add({ ...data, scheduledBy: 'mentor', scheduledById: userProfile.uid, scheduledByName: userProfile.displayName, studentId: selectedStudent.id, studentName: selectedStudent.displayName, status: 'confirmed', notes: '', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      await createNotification(selectedStudent.id, 'session', `${userProfile.displayName} scheduled a session`, `${data.topic}`, 'sessions');
      return true;
    } catch { return false; }
  };

  const updateSessionStatus = async (sessionId, status, notes = null) => {
    if (!selectedStudent?.id) return false;
    try {
      const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;
      const upd = { status, updatedAt: serverTimestamp() };
      if (notes !== null) upd.notes = notes;
      if (status === 'completed') upd.completedAt = serverTimestamp();
      await db.collection('users').doc(selectedStudent.id).collection('sessions').doc(sessionId).update(upd);
      return true;
    } catch { return false; }
  };

  const deleteSession = async (id) => {
    if (!selectedStudent?.id) return;
    await db.collection('users').doc(selectedStudent.id).collection('sessions').doc(id).delete();
  };

  const createAssignment = async (data) => {
    if (!selectedStudent?.id) return false;
    try {
      const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;
      const ref = await db.collection('users').doc(selectedStudent.id).collection('assignments').add({ ...data, mentorId: userProfile.uid, mentorName: userProfile.displayName, status: 'assigned', studentNotes: '', mentorReview: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), completedAt: null });
      if (data.hasChallenge && data.challenge) {
        const challenge = { id: generateId(), assignmentId: ref.id, fromMentor: true, mentorName: userProfile.displayName, name: `${data.title} (Challenge)`, type: data.challenge.type, condition: data.challenge.type === 'winrate' ? 'win_rate' : data.challenge.type === 'profit' ? 'by_date' : data.challenge.type === 'trades' ? 'in_trades' : data.challenge.type === 'streak' ? 'profitable_days' : 'max_loss_days', targetValue: data.challenge.type === 'profit' ? data.challenge.target : 0, targetPercent: data.challenge.type === 'winrate' ? data.challenge.target : 0, tradeLimit: data.challenge.tradesRequired || 0, streakDays: data.challenge.type === 'streak' ? data.challenge.target : 0, maxLossAmount: data.challenge.type === 'max_loss' ? data.challenge.target : 0, endDate: data.challenge.endDate || data.dueDate || '', startDate: todayISO(), createdAt: nowISO() };
        const stateDoc = await db.collection('users').doc(selectedStudent.id).collection('journalData').doc('state').get();
        const cur = stateDoc.exists ? stateDoc.data() : { challenges: [] };
        await db.collection('users').doc(selectedStudent.id).collection('journalData').doc('state').set({ ...cur, challenges: [...(cur.challenges || []), challenge] }, { merge: true });
      }
      await createNotification(selectedStudent.id, 'assignment', `${userProfile.displayName} assigned you homework`, data.title, 'assignments');
      return true;
    } catch { return false; }
  };

  const updateAssignment = async (id, updates) => {
    if (!selectedStudent?.id) return false;
    try {
      const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;
      await db.collection('users').doc(selectedStudent.id).collection('assignments').doc(id).update({ ...updates, updatedAt: serverTimestamp() });
      if (updates.mentorReview) await createNotification(selectedStudent.id, 'assignment_reviewed', `${userProfile.displayName} reviewed your assignment`, 'Check your assignment for feedback', 'assignments');
      return true;
    } catch { return false; }
  };

  const deleteAssignment = async (id) => {
    if (!selectedStudent?.id) return false;
    try {
      const doc = await db.collection('users').doc(selectedStudent.id).collection('assignments').doc(id).get();
      await db.collection('users').doc(selectedStudent.id).collection('assignments').doc(id).delete();
      if (doc.data()?.hasChallenge) {
        const s = await db.collection('users').doc(selectedStudent.id).collection('journalData').doc('state').get();
        if (s.exists) await db.collection('users').doc(selectedStudent.id).collection('journalData').doc('state').update({ challenges: (s.data().challenges || []).filter(c => c.assignmentId !== id) });
      }
      return true;
    } catch { return false; }
  };

  const createCheckin = async (data) => {
    if (!selectedStudent?.id) return false;
    try {
      const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;
      const existing = weeklyCheckins.find(c => c.weekStart === data.weekStart);
      if (existing) {
        await db.collection('users').doc(selectedStudent.id).collection('weeklyCheckins').doc(existing.id).update({ ...data, updatedAt: serverTimestamp() });
      } else {
        await db.collection('users').doc(selectedStudent.id).collection('weeklyCheckins').add({ ...data, mentorId: userProfile.uid, mentorName: userProfile.displayName, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await createNotification(selectedStudent.id, 'checkin', `${userProfile.displayName} wrote your weekly check-in`, data.focusForNextWeek ? `Focus: ${data.focusForNextWeek.substring(0, 60)}` : 'View your weekly review', 'checkins');
      }
      return true;
    } catch { return false; }
  };

  const deleteCheckin = async (id) => {
    if (!selectedStudent?.id) return;
    await db.collection('users').doc(selectedStudent.id).collection('weeklyCheckins').doc(id).delete();
  };

  const calculateChallengeProgress = (challenge, trades) => {
    if (!challenge || !trades) return { current: 0, progress: 0, status: 'active' };
    const ct = trades.filter(t => t.entryDate >= challenge.startDate && t.entryDate <= (challenge.endDate || todayISO())).map(t => ({ ...t, derived: calcTradeDerived(t) }));
    const closed = ct.filter(t => !t.derived.isOpen);
    switch (challenge.type) {
      case 'profit': { const p = closed.reduce((s, t) => s + (t.derived.pnlFinal || 0), 0); return { current: p, progress: Math.min(100, (p / challenge.target) * 100), status: p >= challenge.target ? 'completed' : 'active' }; }
      case 'winrate': { const w = closed.filter(t => t.derived.winLoss === 'W'); const wr = closed.length > 0 ? (w.length / closed.length) * 100 : 0; const tr = challenge.tradesRequired || 20; return { current: wr, tradesCompleted: closed.length, tradesRequired: tr, progress: Math.min(100, (closed.length / tr) * 100), status: closed.length >= tr ? (wr >= challenge.target ? 'completed' : 'failed') : 'active' }; }
      case 'trades': return { current: ct.length, progress: Math.min(100, (ct.length / challenge.target) * 100), status: ct.length >= challenge.target ? 'completed' : 'active' };
      case 'streak': { const dp = {}; closed.forEach(t => { const d = t.exitDate || t.entryDate; dp[d] = (dp[d] || 0) + (t.derived.pnlFinal || 0); }); let max = 0, cur = 0; Object.keys(dp).sort().forEach(d => { if (dp[d] > 0) { cur++; max = Math.max(max, cur); } else cur = 0; }); return { current: max, progress: Math.min(100, (max / challenge.target) * 100), status: max >= challenge.target ? 'completed' : 'active' }; }
      case 'max_loss': { const ls = closed.filter(t => (t.derived.pnlFinal || 0) < 0); const ml = ls.length > 0 ? Math.min(...ls.map(t => t.derived.pnlFinal)) : 0; const ok = Math.abs(ml) <= challenge.target; return { current: ml, progress: ok ? 100 : 0, status: ok ? 'active' : 'failed' }; }
      default: return { current: 0, progress: 0, status: 'active' };
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault(); setError(''); setSuccess(''); setInviting(true);
    try {
      const snap = await db.collection('users').where('email', '==', inviteEmail.toLowerCase().trim()).get();
      if (snap.empty) { setError('No user found with that email.'); return; }
      const doc = snap.docs[0], data = doc.data();
      if (data.role === 'mentor') { setError('That user is a mentor account.'); return; }
      if (data.mentorId) { setError('That trader already has a mentor.'); return; }
      if (students.find(s => s.email === inviteEmail.toLowerCase().trim())) { setError('Already invited.'); return; }
      const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;
      await db.collection('mentorships').doc(userProfile.uid).collection('students').doc(doc.id).set({ email: data.email, displayName: data.displayName, photoURL: data.photoURL || null, status: 'pending', invitedAt: serverTimestamp() });
      await db.collection('users').doc(doc.id).update({ pendingMentorId: userProfile.uid, pendingMentorName: userProfile.displayName, pendingMentorEmail: userProfile.email });
      await sendEmail(emailTemplates.mentorInvite(userProfile.displayName, data.email));
      setSuccess(`Invite sent to ${data.displayName}!`); setInviteEmail('');
    } catch { setError('Failed to send invite. Please try again.'); }
    finally { setInviting(false); }
  };

  const loadStudentData = async (student) => {
    if (student.status !== 'active') { setError('This student has not accepted your invite yet.'); return; }
    setLoadingStudentData(true); setSelectedStudent(student); setActiveJournalTab('dashboard');
    try {
      const doc = await db.collection('users').doc(student.id).collection('journalData').doc('state').get();
      setStudentData(doc.exists ? doc.data() : EMPTY_STATE);
    } catch { setError('Failed to load student data.'); }
    finally { setLoadingStudentData(false); }
  };

  const removeStudent = async (id) => {
    if (!confirm('Remove this student?')) return;
    try {
      const FieldValue = firebase.firestore.FieldValue;
      await db.collection('mentorships').doc(userProfile.uid).collection('students').doc(id).delete();
      await db.collection('users').doc(id).update({ mentorId: FieldValue.delete(), mentorName: FieldValue.delete(), pendingMentorId: FieldValue.delete(), pendingMentorName: FieldValue.delete(), pendingMentorEmail: FieldValue.delete() });
      if (selectedStudent?.id === id) { setSelectedStudent(null); setStudentData(null); }
    } catch { setError('Failed to remove student.'); }
  };

  const currentWeek = getWeekBounds();

  const dashboardData = useMemo(() => {
    const studentsNeedingCheckin = [], studentsNeedingAttention = [], completedAssignmentsToReview = [], overdueAssignments = [], pendingQuestions = [], recentActivity = [];
    let total = 0, totalPnL = 0, totalWins = 0, totalClosed = 0;
    students.forEach(student => {
      const d = allStudentData[student.id] || {}, trades = d.trades || [], asns = d.assignments || [], checkins = d.checkins || [], questions = d.questions || [];
      if (!checkins.some(c => c.weekStart === currentWeek.start) && student.status === 'active') studentsNeedingCheckin.push({ ...student, weekStats: calculateWeekStats(trades, currentWeek.start, currentWeek.end) });
      questions.forEach(q => { if (q.status === 'asked') pendingQuestions.push({ student, question: q }); });
      const ws = calculateWeekStats(trades, currentWeek.start, currentWeek.end);
      total += ws.totalTrades; totalPnL += ws.totalPnL;
      const wt = trades.filter(t => { const d = t.exitDate || t.entryDate; return d >= currentWeek.start && d <= currentWeek.end; }).map(t => ({ ...t, derived: calcTradeDerived(t) })).filter(t => !t.derived.isOpen);
      totalClosed += wt.length; totalWins += wt.filter(t => t.derived.winLoss === 'W').length;
      const dp = {}; wt.forEach(t => { const d = t.exitDate || t.entryDate; dp[d] = (dp[d] || 0) + (t.derived.pnlFinal || 0); });
      if (Object.values(dp).filter(p => p < 0).length >= 2) studentsNeedingAttention.push({ type: 'red_days', student, message: `had ${Object.values(dp).filter(p => p < 0).length} red days this week` });
      const today = todayISO();
      asns.forEach(a => {
        if (a.dueDate && a.dueDate < today && ['assigned','in_progress'].includes(a.status)) overdueAssignments.push({ student, assignment: a });
        if (a.status === 'completed' && !a.mentorReview) completedAssignmentsToReview.push({ student, assignment: a });
        if (a.completedAt) recentActivity.push({ type: 'assignment_completed', student, assignment: a, timestamp: a.completedAt?.toDate?.() || new Date(), message: `completed "${a.title}"` });
      });
      if (trades.length > 0) { const sorted = [...trades].sort((a, b) => (b.exitDate || b.entryDate).localeCompare(a.exitDate || a.entryDate)); const last = sorted[0]?.exitDate || sorted[0]?.entryDate; if (last && Math.floor((new Date() - new Date(last)) / 86400000) >= 5) studentsNeedingAttention.push({ type: 'inactive', student, message: `hasn't traded in ${Math.floor((new Date() - new Date(last)) / 86400000)} days` }); }
    });
    overdueAssignments.forEach(({ student, assignment }) => studentsNeedingAttention.push({ type: 'overdue', student, assignment, message: `has overdue assignment "${assignment.title}"` }));
    recentActivity.sort((a, b) => b.timestamp - a.timestamp);
    return { studentsNeedingCheckin, studentsNeedingAttention, completedAssignmentsToReview, pendingQuestions, recentActivity: recentActivity.slice(0, 10), totalTradesThisWeek: total, totalPnLThisWeek: totalPnL, avgWinRate: totalClosed > 0 ? (totalWins / totalClosed) * 100 : 0 };
  }, [students, allStudentData, currentWeek.start]);

  const getStudentStatus = (id) => {
    const ws = calculateWeekStats((allStudentData[id] || {}).trades || [], currentWeek.start, currentWeek.end);
    if (ws.totalTrades === 0) return { color: 'gray', label: 'No trades' };
    if (ws.totalPnL > 0 || ws.winRate > 55) return { color: 'green', label: 'On Track' };
    if (ws.totalPnL >= -50 && ws.winRate >= 45) return { color: 'yellow', label: 'Break-even' };
    return { color: 'red', label: 'Struggling' };
  };

  const noop = () => {};

  // Student journal view
  if (selectedStudent) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-3">
            <button onClick={() => { setSelectedStudent(null); setStudentData(null); setActiveJournalTab('dashboard'); setTradeFeedback([]); setTradeFlags([]); }} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              <span className="hidden sm:inline">Back to Students</span>
            </button>
            <div className="flex items-center gap-3"><Avatar user={selectedStudent} size="md"/><div><h2 className="font-semibold text-gray-900">{selectedStudent.displayName}'s Journal</h2><p className="text-xs text-gray-500">{selectedStudent.email}</p></div></div>
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-sm font-medium border border-amber-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg><span>Read-Only</span>
            </div>
          </div>
          <div className="border-t border-gray-200 px-4">
            <div className="flex gap-1 overflow-x-auto">
              {journalTabs.map(t => <button key={t.id} onClick={() => setActiveJournalTab(t.id)} className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeJournalTab===t.id?'text-blue-600 border-blue-600':'text-gray-500 border-transparent hover:text-gray-700'}`}>{t.label}</button>)}
            </div>
          </div>
        </div>
        <div>
          {loadingStudentData ? <div className="flex items-center justify-center h-64"><div className="text-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"/><p className="text-gray-500">Loading journal...</p></div></div> : !studentData ? null : (() => {
            switch (activeJournalTab) {
              case 'dashboard': return <DashboardPage state={studentData} setState={noop} setActivePage={noop} setSelectedDate={setSelectedDate} isMobile={isMobile} isReadOnly={true}/>;
              case 'tradelog': return <TradeLogPage state={studentData} setState={noop} isMobile={isMobile} isReadOnly={true} isMentorView={true} tradeFeedback={tradeFeedback} tradeFlags={tradeFlags} onAddFeedback={addFeedback} onAddFlag={addFlag} onRemoveFlag={removeFlag} onToggleFlagStatus={toggleFlagStatus} tradeQuestions={tradeQuestions} onAnswerQuestion={answerQuestion} onResolveQuestion={resolveQuestion} userProfile={userProfile}/>;
              case 'calendar': return <CalendarPage state={studentData} setState={noop} selectedDate={selectedDate} setSelectedDate={setSelectedDate} isMobile={isMobile} isReadOnly={true}/>;
              case 'goals': return <GoalsPage state={studentData} setState={noop} isMobile={isMobile} isReadOnly={true}/>;
              case 'setups': return <SetupsPage state={studentData} setState={noop} isMobile={isMobile} isReadOnly={true}/>;
              case 'mistakes': return <MistakesPage state={studentData} setState={noop} isMobile={isMobile} isReadOnly={true}/>;
              case 'assignments': return <MentorAssignmentsTab assignments={assignments} studentData={studentData} selectedStudent={selectedStudent} onCreateAssignment={createAssignment} onUpdateAssignment={updateAssignment} onDeleteAssignment={deleteAssignment} calculateChallengeProgress={calculateChallengeProgress} isMobile={isMobile}/>;
              case 'checkins': return <MentorCheckinsTab checkins={weeklyCheckins} studentData={studentData} selectedStudent={selectedStudent} onCreateCheckin={createCheckin} onDeleteCheckin={deleteCheckin} onCreateAssignment={createAssignment} isMobile={isMobile}/>;
              case 'sessions': return <MentorSessionsTab sessions={sessions} selectedStudent={selectedStudent} userProfile={userProfile} onCreateSession={createSession} onUpdateStatus={updateSessionStatus} onDeleteSession={deleteSession} isMobile={isMobile}/>;
              default: return null;
            }
          })()}
        </div>
      </div>
    );
  }

  // Dashboard / list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">{dashboardView==='dashboard'?'Mentor Dashboard':'My Students'}</h1><p className="text-sm text-gray-500 mt-1">{students.length} student{students.length!==1?'s':''} • Week of {formatWeekRange(currentWeek.start, currentWeek.end)}</p></div>
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          {[['dashboard','Dashboard'],['list','List View']].map(([v,l]) => <button key={v} onClick={() => setDashboardView(v)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dashboardView===v?'bg-white text-gray-900 shadow-sm':'text-gray-600 hover:text-gray-900'}`}>{l}</button>)}
        </div>
      </div>

      {dashboardView === 'dashboard' ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[['Students',students.length,'text-gray-900'],['Week P&L',formatCurrency(dashboardData.totalPnLThisWeek),dashboardData.totalPnLThisWeek>=0?'text-emerald-600':'text-red-600'],['Avg Win Rate',`${dashboardData.avgWinRate.toFixed(0)}%`,'text-blue-600'],['Need Attention',dashboardData.studentsNeedingAttention.length,'text-orange-600']].map(([l,v,c]) => <div key={l} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"><p className="text-sm text-gray-500">{l}</p><p className={`text-2xl font-bold ${c}`}>{v}</p></div>)}
          </div>

          {dashboardData.studentsNeedingCheckin.length > 0 && (
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-3"><span className="text-xl">📅</span><h2 className="font-semibold">Weekly Check-ins Due</h2><span className="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-sm">{dashboardData.studentsNeedingCheckin.length} pending</span></div>
              <div className="space-y-2">
                {dashboardData.studentsNeedingCheckin.map(s => (
                  <div key={s.id} className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">{s.photoURL?<img src={s.photoURL} alt="" className="w-8 h-8 rounded-full object-cover"/>:<div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">{s.displayName?.charAt(0)?.toUpperCase()||'?'}</div>}<div><p className="font-medium">{s.displayName}</p><p className="text-sm text-blue-100">{s.weekStats?.totalTrades||0} trades • {formatCurrency(s.weekStats?.totalPnL||0)}</p></div></div>
                    <button onClick={() => { loadStudentData(s); setActiveJournalTab('checkins'); }} className="px-3 py-1.5 bg-white text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50">Write Check-in</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboardData.completedAssignmentsToReview.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2"><span className="text-lg">✅</span><h2 className="font-semibold text-gray-900">Assignments to Review</h2><span className="ml-auto bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-sm font-medium">{dashboardData.completedAssignmentsToReview.length}</span></div>
              <div className="divide-y divide-gray-100">
                {dashboardData.completedAssignmentsToReview.map(({ student, assignment }) => (
                  <div key={assignment.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div><p className="font-medium text-gray-900">{assignment.title}</p><p className="text-sm text-gray-500">Completed by {student.displayName}</p></div>
                    <button onClick={() => { loadStudentData(student); setActiveJournalTab('assignments'); }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Review</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboardData.pendingQuestions?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2"><span className="text-lg">❓</span><h2 className="font-semibold text-gray-900">Questions Awaiting Answers</h2><span className="ml-auto bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-sm font-medium">{dashboardData.pendingQuestions.length}</span></div>
              <div className="divide-y divide-gray-100">
                {dashboardData.pendingQuestions.map(({ student, question }) => (
                  <div key={question.id} className="px-6 py-3 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1"><div className="flex items-center gap-2 mb-1"><p className="font-medium text-gray-900">{student.displayName}</p><span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded">{question.questionType}</span></div><p className="text-sm text-gray-600 line-clamp-2">"{question.question}"</p></div>
                      <button onClick={() => { loadStudentData(student); setActiveJournalTab('tradelog'); }} className="ml-4 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">Answer</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboardData.studentsNeedingAttention.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2"><span className="text-lg">⚠️</span><h2 className="font-semibold text-gray-900">Needs Attention</h2></div>
              <div className="divide-y divide-gray-100">
                {dashboardData.studentsNeedingAttention.map((a, i) => (
                  <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3"><span className="text-lg">{a.type==='red_days'?'🔴':a.type==='overdue'?'📋':'💤'}</span><div><p className="font-medium text-gray-900">{a.student.displayName}</p><p className="text-sm text-gray-500">{a.message}</p></div></div>
                    <button onClick={() => loadStudentData(a.student)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">View</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200"><h2 className="font-semibold text-gray-900">📊 Student Performance This Week</h2></div>
            {students.length === 0 ? <div className="p-8 text-center text-gray-500">No students yet</div> : (
              <div className="overflow-x-auto">
                <table className="w-full"><thead className="bg-gray-50"><tr>{['Student','Trades','Win Rate','P&L','Status','Action'].map((h,i) => <th key={h} className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${i===0?'text-left':i===5?'text-right':'text-center'}`}>{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-200">
                    {students.filter(s => s.status==='active').map(student => {
                      const ws = calculateWeekStats((allStudentData[student.id]||{}).trades||[], currentWeek.start, currentWeek.end);
                      const st = getStudentStatus(student.id);
                      return (<tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4"><div className="flex items-center gap-3"><Avatar user={student} size="sm"/><span className="font-medium text-gray-900">{student.displayName}</span></div></td>
                        <td className="px-6 py-4 text-center text-gray-900">{ws.totalTrades}</td>
                        <td className="px-6 py-4 text-center text-gray-900">{ws.winRate.toFixed(0)}%</td>
                        <td className={`px-6 py-4 text-center font-medium ${ws.totalPnL>=0?'text-emerald-600':'text-red-600'}`}>{formatCurrency(ws.totalPnL)}</td>
                        <td className="px-6 py-4 text-center"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${st.color==='green'?'bg-emerald-100 text-emerald-700':st.color==='yellow'?'bg-yellow-100 text-yellow-700':st.color==='red'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-600'}`}><span>{st.color==='green'?'🟢':st.color==='yellow'?'🟡':st.color==='red'?'🔴':'⚪'}</span>{st.label}</span></td>
                        <td className="px-6 py-4 text-right"><button onClick={() => loadStudentData(student)} className="text-blue-600 hover:text-blue-700 font-medium text-sm">View →</button></td>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {dashboardData.recentActivity.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200"><h2 className="font-semibold text-gray-900">📝 Recent Activity</h2></div>
              <div className="divide-y divide-gray-100">
                {dashboardData.recentActivity.map((a, i) => <div key={i} className="px-6 py-3 flex items-center gap-3"><span className="text-lg">{a.type==='assignment_completed'?'✅':'📌'}</span><div className="flex-1"><span className="font-medium text-gray-900">{a.student.displayName}</span><span className="text-gray-600"> {a.message}</span></div><span className="text-sm text-gray-400">{a.timestamp.toLocaleDateString()}</span></div>)}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Invite a Trader</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}
            {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">{success}</div>}
            <form onSubmit={handleInvite} className="flex gap-3">
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Enter trader's email" className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required/>
              <button type="submit" disabled={inviting} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">{inviting?'Sending...':'Send Invite'}</button>
            </form>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200"><h2 className="font-semibold text-gray-900">Your Students ({students.length})</h2></div>
            {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : students.length === 0 ? (
              <div className="p-12 text-center"><div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">👥</div><h3 className="text-lg font-medium text-gray-900 mb-2">No students yet</h3><p className="text-gray-500">Invite traders to start mentoring them</p></div>
            ) : (
              <div className="divide-y divide-gray-200">
                {students.map(student => (
                  <div key={student.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar user={student} size="lg"/>
                        <div><h3 className="font-medium text-gray-900">{student.displayName}</h3><p className="text-sm text-gray-500">{student.email}</p></div>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${student.status==='active'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>{student.status==='active'?'Active':'Pending'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {student.status==='active' && <button onClick={() => loadStudentData(student)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>View Journal</button>}
                        <button onClick={() => removeStudent(student.id)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg">{Icons.trash}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// MENTOR INVITE BANNER (for traders)
// =============================================================================
export function MentorInviteBanner({ userProfile, onUpdate }) {
  const [responding, setResponding] = useState(false);

  const handleResponse = async (accept) => {
    setResponding(true);
    try {
      const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp; const FieldValue = firebase.firestore.FieldValue;
      if (accept) {
        await db.collection('users').doc(userProfile.uid).update({ mentorId: userProfile.pendingMentorId, mentorName: userProfile.pendingMentorName, pendingMentorId: FieldValue.delete(), pendingMentorName: FieldValue.delete(), pendingMentorEmail: FieldValue.delete() });
        await db.collection('mentorships').doc(userProfile.pendingMentorId).collection('students').doc(userProfile.uid).update({ status: 'active', photoURL: userProfile.photoURL || null, acceptedAt: serverTimestamp() });
        await sendEmail(emailTemplates.inviteAccepted(userProfile.pendingMentorEmail, userProfile.displayName));
        await db.collection('users').doc(userProfile.pendingMentorId).collection('notifications').add({ type: 'invite_accepted', title: `${userProfile.displayName} accepted your invitation!`, message: 'You can now view their trades and provide feedback.', link: 'students', read: false, studentId: userProfile.uid, createdAt: serverTimestamp() });
      } else {
        await db.collection('users').doc(userProfile.uid).update({ pendingMentorId: FieldValue.delete(), pendingMentorName: FieldValue.delete(), pendingMentorEmail: FieldValue.delete() });
        await db.collection('mentorships').doc(userProfile.pendingMentorId).collection('students').doc(userProfile.uid).delete();
      }
      onUpdate();
    } catch (err) { alert('Failed to respond. Please try again.'); }
    finally { setResponding(false); }
  };

  if (!userProfile.pendingMentorId) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div><h3 className="font-medium text-blue-900">Mentor Invitation</h3><p className="text-sm text-blue-700"><strong>{userProfile.pendingMentorName}</strong> wants to mentor you</p></div>
        <div className="flex gap-2">
          <button onClick={() => handleResponse(false)} disabled={responding} className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Decline</button>
          <button onClick={() => handleResponse(true)} disabled={responding} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{responding?'Accepting...':'Accept'}</button>
        </div>
      </div>
    </div>
  );
}
