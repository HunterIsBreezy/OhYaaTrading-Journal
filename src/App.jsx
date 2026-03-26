import { useState, useEffect } from 'react';
import { auth, db, firebase } from './firebase';
import { NAV_ITEMS, EMPTY_STATE } from './utils/constants';
import { todayISO, calcTradeDerived } from './utils/helpers';
import { emailTemplates, sendEmail } from './utils/emailService';
import { AuthContext } from './contexts/AuthContext';
import AuthScreen, { VerificationScreen } from './components/auth/AuthScreens';
import Sidebar from './components/shared/Sidebar';
import TopBar from './components/shared/TopBar';
import DashboardPage from './components/dashboard/Dashboard';
import TradeLogPage from './components/tradelog/TradeLog';
import CalendarPage from './components/calendar/CalendarPage';
import GoalsPage from './components/goals/GoalsPage';
import SetupsPage from './components/setups/SetupsPage';
import MistakesPage from './components/mistakes/MistakesPage';
import ProfilePage from './components/profile/ProfilePage';
import StudentsPage, { MentorInviteBanner } from './components/mentor/StudentsPage';
import { CheckinsPage, SessionsPage, AssignmentsPage } from './components/mentor/StudentPages';

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState(null);
  const [journalState, setJournalState] = useState(EMPTY_STATE);
  const [storageInfo, setStorageInfo] = useState({ bytes: 0, megabytes: 0, percentUsed: 0, nearLimit: false });
  const [isMobile, setIsMobile] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [myTradeFeedback, setMyTradeFeedback] = useState([]);
  const [myTradeFlags, setMyTradeFlags] = useState([]);
  const [myTradeQuestions, setMyTradeQuestions] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [myCheckins, setMyCheckins] = useState([]);
  const [mySessions, setMySessions] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Auth state
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      setUser(u);
      if (!u) { setUserProfile(null); setAuthLoading(false); }
    });
    return () => unsub();
  }, []);

  // Profile listener
  useEffect(() => {
    if (!user) { setUserProfile(null); return; }
    const unsub = db.collection('users').doc(user.uid).onSnapshot(
      doc => { setUserProfile(doc.exists ? { uid: user.uid, ...doc.data() } : null); setAuthLoading(false); },
      err => { setUserProfile(null); setAuthLoading(false); }
    );
    return () => unsub();
  }, [user]);

  // Student mentor data subscriptions
  useEffect(() => {
    if (!user || !userProfile?.mentorId) {
      setMyTradeFeedback([]); setMyTradeFlags([]); setMyTradeQuestions([]); setMyAssignments([]); setMyCheckins([]); setMySessions([]);
      return;
    }
    const uid = user.uid;
    const unsubs = [
      db.collection('users').doc(uid).collection('tradeFeedback').orderBy('createdAt', 'desc').onSnapshot(s => setMyTradeFeedback(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      db.collection('users').doc(uid).collection('tradeFlags').onSnapshot(s => setMyTradeFlags(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      db.collection('users').doc(uid).collection('assignments').orderBy('createdAt', 'desc').onSnapshot(s => setMyAssignments(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      db.collection('users').doc(uid).collection('weeklyCheckins').orderBy('weekStart', 'desc').onSnapshot(s => setMyCheckins(s.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    const u5 = db.collection('users').doc(uid).collection('tradeQuestions').orderBy('createdAt', 'desc').onSnapshot(s => setMyTradeQuestions(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setMyTradeQuestions([]));
    const u6 = db.collection('users').doc(uid).collection('sessions').orderBy('dateTime', 'desc').onSnapshot(s => setMySessions(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setMySessions([]));
    return () => { unsubs.forEach(u => u()); u5(); u6(); };
  }, [user, userProfile?.mentorId]);

  // Notifications
  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    const unsub = db.collection('users').doc(user.uid).collection('notifications').orderBy('createdAt', 'desc').limit(50).onSnapshot(
      s => setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => setNotifications([])
    );
    return () => unsub();
  }, [user]);

  // Helper: get trade chunk key (e.g. "trades-2026-03-22") from a trade's entryDate — one doc per day
  const getTradeChunkKey = (trade) => {
    const d = trade.entryDate || '';
    const match = d.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? `trades-${match[1]}` : 'trades-unknown';
  };

  // Group trades by month chunk
  const groupTradesByChunk = (trades) => {
    const chunks = {};
    trades.forEach(t => {
      const key = getTradeChunkKey(t);
      if (!chunks[key]) chunks[key] = [];
      chunks[key].push(t);
    });
    return chunks;
  };

  // Migrate old formats: state doc trades → chunks, monthly chunks → weekly chunks
  const migrateIfNeeded = async (uid) => {
    const journalRef = db.collection('users').doc(uid).collection('journalData');
    const screenshotRef = db.collection('users').doc(uid).collection('screenshots');
    const snapshot = await journalRef.get();
    const batch = db.batch();
    let migrated = false;

    snapshot.forEach(doc => {
      const data = doc.data();

      // Migrate trades from state doc (old single-doc format)
      if (doc.id === 'state' && data.trades && data.trades.length > 0) {
        const chunks = groupTradesByChunk(data.trades);
        Object.entries(chunks).forEach(([key, trades]) => {
          batch.set(journalRef.doc(key), { trades: sanitizeForFirestore(trades) });
        });
        const { trades, ...rest } = data;
        batch.set(journalRef.doc('state'), sanitizeForFirestore(rest));
        migrated = true;
      }

      // Migrate old monthly/weekly chunks → daily chunks + extract screenshots
      if (doc.id.match(/^trades-\d{4}-\d{2}(-w\d)?$/) && data.trades && data.trades.length > 0) {
        const migratedTrades = data.trades.map(t => {
          if (t.screenshot && t.screenshot !== '__stored__') {
            batch.set(screenshotRef.doc(t.id), { data: t.screenshot });
            return { ...t, screenshot: '__stored__' };
          }
          return t;
        });
        const chunks = groupTradesByChunk(migratedTrades);
        Object.entries(chunks).forEach(([key, trades]) => {
          batch.set(journalRef.doc(key), { trades: sanitizeForFirestore(trades) });
        });
        batch.delete(journalRef.doc(doc.id));
        migrated = true;
      }

      // Extract screenshots from daily chunks that still have inline data
      if (doc.id.match(/^trades-\d{4}-\d{2}-\d{2}$/) && data.trades && data.trades.length > 0) {
        const hasInline = data.trades.some(t => t.screenshot && t.screenshot !== '__stored__');
        if (hasInline) {
          const migratedTrades = data.trades.map(t => {
            if (t.screenshot && t.screenshot !== '__stored__') {
              batch.set(screenshotRef.doc(t.id), { data: t.screenshot });
              return { ...t, screenshot: '__stored__' };
            }
            return t;
          });
          batch.set(journalRef.doc(doc.id), { trades: sanitizeForFirestore(migratedTrades) });
          migrated = true;
        }
      }
    });

    if (migrated) {
      await batch.commit();
      console.log('Migrated trades to daily chunks with separate screenshots');
    }
    return migrated;
  };

  // Load all journal data from chunked documents + screenshots
  const loadJournalData = async (uid) => {
    const snapshot = await db.collection('users').doc(uid).collection('journalData').get();
    let allTrades = [];
    let meta = { setups: [], mistakes: [], dailyNotes: {}, yearlyGoal: null, challenges: [] };

    snapshot.forEach(doc => {
      const data = doc.data();
      if (doc.id === 'state') {
        meta = {
          setups: data.setups || [],
          mistakes: data.mistakes || [],
          dailyNotes: data.dailyNotes || {},
          yearlyGoal: data.yearlyGoal || null,
          challenges: data.challenges || [],
        };
      } else if (doc.id.startsWith('trades-')) {
        allTrades = allTrades.concat(data.trades || []);
      }
    });

    // Load screenshots and reattach to trades
    const tradeIdsWithScreenshots = allTrades.filter(t => t.screenshot === '__stored__').map(t => t.id);
    if (tradeIdsWithScreenshots.length > 0) {
      const screenshotSnap = await db.collection('users').doc(uid).collection('screenshots').get();
      const screenshotMap = {};
      screenshotSnap.forEach(doc => { screenshotMap[doc.id] = doc.data().data; });
      allTrades = allTrades.map(t => t.screenshot === '__stored__' && screenshotMap[t.id] ? { ...t, screenshot: screenshotMap[t.id] } : t);
    }

    return { trades: allTrades, ...meta };
  };

  // Journal data — load with migration support
  useEffect(() => {
    if (!user) { setDataLoading(false); return; }
    setDataLoading(true);

    let cancelled = false;
    const init = async () => {
      try {
        await migrateIfNeeded(user.uid);
        if (cancelled) return;
        const data = await loadJournalData(user.uid);
        if (!cancelled) setJournalState(data);
      } catch (err) {
        console.error('Firestore load error:', err);
      }
      if (!cancelled) setDataLoading(false);
    };
    init();

    // Listen for realtime changes on the whole collection
    const unsub = db.collection('users').doc(user.uid).collection('journalData').onSnapshot(
      async snapshot => {
        let allTrades = [];
        let meta = { setups: [], mistakes: [], dailyNotes: {}, yearlyGoal: null, challenges: [] };
        snapshot.forEach(doc => {
          const data = doc.data();
          if (doc.id === 'state') {
            meta = { setups: data.setups || [], mistakes: data.mistakes || [], dailyNotes: data.dailyNotes || {}, yearlyGoal: data.yearlyGoal || null, challenges: data.challenges || [] };
            if (data.trades && data.trades.length > 0) allTrades = allTrades.concat(data.trades);
          } else if (doc.id.startsWith('trades-')) {
            allTrades = allTrades.concat(data.trades || []);
          }
        });
        // Reattach screenshots from separate collection
        const needScreenshots = allTrades.filter(t => t.screenshot === '__stored__');
        if (needScreenshots.length > 0) {
          try {
            const screenshotSnap = await db.collection('users').doc(user.uid).collection('screenshots').get();
            const screenshotMap = {};
            screenshotSnap.forEach(doc => { screenshotMap[doc.id] = doc.data().data; });
            allTrades = allTrades.map(t => t.screenshot === '__stored__' && screenshotMap[t.id] ? { ...t, screenshot: screenshotMap[t.id] } : t);
          } catch (e) { console.error('Failed to load screenshots:', e); }
        }
        setJournalState({ trades: allTrades, ...meta });
        setDataLoading(false);
      },
      err => { console.error('Firestore error:', err); setDataLoading(false); }
    );

    return () => { cancelled = true; unsub(); };
  }, [user]);

  // Mobile detection
  useEffect(() => {
    const handleResize = () => { const m = window.innerWidth < 768; setIsMobile(m); setSidebarExpanded(window.innerWidth >= 1024); };
    handleResize(); window.addEventListener('resize', handleResize); return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sanitizeForFirestore = (obj) => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'function') return null;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore).filter(v => v !== undefined);
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => typeof v !== 'function' && v !== undefined).map(([k, v]) => [k, sanitizeForFirestore(v)]));
  };

  const createSelfNotification = async (type, title, message, link = 'dashboard') => {
    if (!user) return;
    try { const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp; await db.collection('users').doc(user.uid).collection('notifications').add({ type, title, message, link, read: false, createdAt: serverTimestamp() }); } catch {}
  };

  const notifyMentorOfProgress = async (type, title, message) => {
    if (!userProfile?.mentorId) return;
    try { const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp; await db.collection('users').doc(userProfile.mentorId).collection('notifications').add({ type, title, message, link: 'students', studentId: user.uid, read: false, createdAt: serverTimestamp() }); } catch {}
  };

  const checkProgressAndNotify = async (newState, oldState) => {
    if (!userProfile?.uid || !newState) return;
    const today = todayISO();
    const now = new Date();
    const calcDailyPnL = (trades, date) => trades.filter(t => t.entryDate === date).reduce((s, t) => s + (calcTradeDerived(t).pnlFinal || 0), 0);
    const todayPnL = calcDailyPnL(newState.trades || [], today);
    const oldTodayPnL = calcDailyPnL(oldState?.trades || [], today);
    if (newState.yearlyGoal?.target) {
      const dt = newState.yearlyGoal.target / 252;
      if (!(oldTodayPnL >= dt) && todayPnL >= dt) {
        try { await sendEmail(emailTemplates.dailyTargetHit(userProfile.email, userProfile.displayName, todayPnL, dt)); } catch {}
        await createSelfNotification('daily_target_hit', '🎯 Daily Target Hit!', `You made $${todayPnL.toFixed(0)} today`);
        if (userProfile.mentorId) await notifyMentorOfProgress('student_daily_target', `🎯 ${userProfile.displayName} hit daily target`, `Made $${todayPnL.toFixed(0)} today`);
      }
      if (!(oldTodayPnL >= dt * 1.5) && todayPnL >= dt * 1.5) await createSelfNotification('daily_target_exceeded', '🔥 Crushed It!', `You exceeded your daily target!`);
    }
    // Win streak
    const sorted = [...(newState.trades||[])].sort((a,b) => (b.entryDate||'').localeCompare(a.entryDate||''));
    let streak = 0; for (const t of sorted) { if ((calcTradeDerived(t).pnlFinal||0) > 0) streak++; else break; }
    const oldSorted = [...(oldState?.trades||[])].sort((a,b) => (b.entryDate||'').localeCompare(a.entryDate||''));
    let oldStreak = 0; for (const t of oldSorted) { if ((calcTradeDerived(t).pnlFinal||0) > 0) oldStreak++; else break; }
    for (const m of [3, 5, 10, 15, 20]) { if (streak >= m && oldStreak < m) { await createSelfNotification('win_streak', `🔥 ${m} Win Streak!`, `${m} consecutive winning trades.`, 'tradelog'); break; } }
    // Trade milestones
    const total = (newState.trades||[]).length, oldTotal = (oldState?.trades||[]).length;
    for (const m of [10, 25, 50, 100, 250, 500, 1000]) { if (total >= m && oldTotal < m) { await createSelfNotification('trading_milestone', `🎉 ${m} Trades Logged!`, `You've logged ${m} trades.`, 'tradelog'); if (userProfile.mentorId) await notifyMentorOfProgress('student_milestone', `🎉 ${userProfile.displayName} reached ${m} trades`, `Milestone: ${m} trades logged`); break; } }
    // Yearly goal milestones
    if (newState.yearlyGoal?.target) {
      const ys = `${now.getFullYear()}-01-01`;
      const yp = (newState.trades||[]).filter(t => t.entryDate >= ys).reduce((s, t) => s + (calcTradeDerived(t).pnlFinal||0), 0);
      const oyp = (oldState?.trades||[]).filter(t => t.entryDate >= ys).reduce((s, t) => s + (calcTradeDerived(t).pnlFinal||0), 0);
      const prog = (yp / newState.yearlyGoal.target) * 100, oldProg = (oyp / (oldState?.yearlyGoal?.target || 1)) * 100;
      for (const m of [25, 50, 75, 100]) { if (prog >= m && oldProg < m) { await createSelfNotification('yearly_goal_progress', m===100?'⭐ Yearly Goal Achieved!':`📈 ${m}% of Yearly Goal`, `$${yp.toFixed(0)} of $${newState.yearlyGoal.target.toLocaleString()} target`, 'goals'); break; } }
    }
    // Personal best day
    const allDP = {}; (newState.trades||[]).forEach(t => { const d = t.entryDate; allDP[d] = (allDP[d]||0) + (calcTradeDerived(t).pnlFinal||0); });
    const best = Math.max(...Object.values(allDP), 0);
    const oldDP = {}; (oldState?.trades||[]).forEach(t => { const d = t.entryDate; oldDP[d] = (oldDP[d]||0) + (calcTradeDerived(t).pnlFinal||0); });
    const oldBest = Math.max(...Object.values(oldDP), 0);
    if (allDP[today] === best && best > oldBest && best > 100) await createSelfNotification('new_personal_best', '🏆 New Personal Best Day!', `$${best.toFixed(0)} - Your best trading day ever!`, 'dashboard');
  };

  const saveJournalState = async (newStateOrUpdater) => {
    if (!user) return;
    const newState = typeof newStateOrUpdater === 'function' ? newStateOrUpdater(journalState) : newStateOrUpdater;
    const oldState = journalState;
    setJournalState(newState);
    try {
      const batch = db.batch();
      const journalRef = db.collection('users').doc(user.uid).collection('journalData');
      const screenshotRef = db.collection('users').doc(user.uid).collection('screenshots');

      // Save non-trade data to state doc (no trades — keeps it small)
      const { trades, ...meta } = newState;
      batch.set(journalRef.doc('state'), sanitizeForFirestore(meta), { merge: true });

      // Save/update screenshots separately, strip from trade data
      const tradesForStorage = (trades || []).map(t => {
        if (t.screenshot) {
          batch.set(screenshotRef.doc(t.id), { data: t.screenshot });
          return { ...t, screenshot: '__stored__' };
        }
        if (t.screenshot === null) {
          // Screenshot was removed — delete from storage
          const oldTrade = (oldState?.trades || []).find(ot => ot.id === t.id);
          if (oldTrade?.screenshot) batch.delete(screenshotRef.doc(t.id));
        }
        return t;
      });

      // Save trades in daily chunks (without screenshot data)
      const newChunks = groupTradesByChunk(tradesForStorage);
      const oldTradesForStorage = (oldState?.trades || []).map(t => t.screenshot ? { ...t, screenshot: '__stored__' } : t);
      const oldChunks = groupTradesByChunk(oldTradesForStorage);

      // Write all chunks that changed
      const allChunkKeys = new Set([...Object.keys(newChunks), ...Object.keys(oldChunks)]);
      for (const key of allChunkKeys) {
        const newTrades = newChunks[key] || [];
        const oldTrades = oldChunks[key] || [];
        if (newTrades.length !== oldTrades.length || JSON.stringify(newTrades) !== JSON.stringify(oldTrades)) {
          if (newTrades.length === 0) {
            batch.delete(journalRef.doc(key));
          } else {
            batch.set(journalRef.doc(key), { trades: sanitizeForFirestore(newTrades) });
          }
        }
      }

      await batch.commit();

      if (trades?.length !== oldState?.trades?.length || JSON.stringify(trades) !== JSON.stringify(oldState?.trades)) {
        checkProgressAndNotify(newState, oldState);
      }
    } catch (error) {
      console.error('Failed to save:', error);
      if (error.code === 'permission-denied') alert('Permission denied. Please sign out and sign back in.');
      else if (error.code === 'unavailable') alert('Network error. Changes will sync when connection is restored.');
    }
  };

  const updateMyAssignment = async (id, updates) => {
    if (!user) return false;
    try {
      const { serverTimestamp } = ({ serverTimestamp: firebase.firestore.FieldValue.serverTimestamp });
      const doc = await db.collection('users').doc(user.uid).collection('assignments').doc(id).get();
      const a = doc.data();
      await db.collection('users').doc(user.uid).collection('assignments').doc(id).update({ ...updates, updatedAt: serverTimestamp() });
      if (updates.status === 'completed' && a?.mentorId) {
        await db.collection('users').doc(a.mentorId).collection('notifications').add({ type: 'assignment_completed', title: `${userProfile?.displayName} completed an assignment`, message: a.title || 'Assignment completed', link: 'students', read: false, studentId: user.uid, createdAt: serverTimestamp() });
      }
      return true;
    } catch { return false; }
  };

  const markFeedbackAsRead = async (ids) => {
    if (!user || !ids.length) return;
    try { const batch = db.batch(); ids.forEach(id => batch.update(db.collection('users').doc(user.uid).collection('tradeFeedback').doc(id), { read: true })); await batch.commit(); } catch {}
  };

  const askQuestion = async (tradeId, questionType, question) => {
    if (!user || !userProfile?.mentorId || !question.trim()) return false;
    try {
      const { serverTimestamp } = ({ serverTimestamp: firebase.firestore.FieldValue.serverTimestamp });
      await db.collection('users').doc(user.uid).collection('tradeQuestions').add({ tradeId, studentId: user.uid, studentName: userProfile.displayName, mentorId: userProfile.mentorId, questionType, question: question.trim(), status: 'asked', answer: null, answeredAt: null, createdAt: serverTimestamp() });
      await db.collection('users').doc(userProfile.mentorId).collection('notifications').add({ type: 'question_asked', title: `${userProfile.displayName} asked a question`, message: `${questionType}: ${question.trim().substring(0, 80)}`, link: 'students', read: false, studentId: user.uid, createdAt: serverTimestamp() });
      return true;
    } catch { return false; }
  };

  const resolveMyQuestion = async (id) => {
    if (!user) return false;
    try { const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp; await db.collection('users').doc(user.uid).collection('tradeQuestions').doc(id).update({ status: 'resolved', resolvedAt: serverTimestamp() }); return true; } catch { return false; }
  };

  const markNotificationAsRead = async (id) => {
    if (!user) return;
    try { await db.collection('users').doc(user.uid).collection('notifications').doc(id).update({ read: true }); } catch {}
  };

  const markAllNotificationsAsRead = async () => {
    if (!user || !notifications.length) return;
    try { const batch = db.batch(); notifications.filter(n => !n.read).forEach(n => batch.update(db.collection('users').doc(user.uid).collection('notifications').doc(n.id), { read: true })); await batch.commit(); } catch {}
  };

  const handleNotificationClick = (n) => {
    if (!n.read) markNotificationAsRead(n.id);
    const map = { feedback: 'tradelog', flag: 'tradelog', question_answered: 'tradelog', win_streak: 'tradelog', trading_milestone: 'tradelog', checkin: 'checkins', weekly_recap: 'checkins', assignment: 'assignments', assignment_reviewed: 'assignments', session: 'sessions', session_reminder: 'sessions', yearly_goal_progress: 'goals', challenge_progress: 'goals', challenge_completed: 'goals', challenge_failed: 'goals', daily_target_hit: 'dashboard', daily_target_exceeded: 'dashboard', weekly_goal_progress: 'dashboard', monthly_goal_progress: 'dashboard', profitable_week: 'dashboard', profitable_month: 'dashboard', new_personal_best: 'dashboard', monthly_report: 'dashboard', question_asked: 'students', assignment_completed: 'students', student_daily_target: 'students', student_challenge_complete: 'students', student_milestone: 'students', invite_accepted: 'students' };
    if (map[n.type]) setActivePage(map[n.type]);
  };

  const reloadProfile = async () => {
    if (!user) return;
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists) setUserProfile({ uid: user.uid, ...doc.data() });
  };

  const handleSignOut = async () => { try { await auth.signOut(); window.location.href = '/landing.html'; } catch {} };

  if (authLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"/><p className="text-gray-600">Loading...</p></div></div>;
  if (!user) return <AuthScreen />;
  if (!userProfile) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"/><p className="text-gray-600">Loading profile...</p></div></div>;
  if (userProfile.emailVerified === false) return <VerificationScreen user={user} userProfile={userProfile} onVerified={reloadProfile} />;
  if (dataLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"/><p className="text-gray-600">Loading your journal...</p></div></div>;

  // Build nav items based on role
  const navItems = (() => {
    let items = [...NAV_ITEMS];
    if (userProfile?.mentorId) {
      const gi = items.findIndex(i => i.id === 'goals');
      items.splice(gi + 1, 0, { id: 'assignments', label: 'Assignments', icon: 'assignments' }, { id: 'checkins', label: 'Check-ins', icon: 'checkins' }, { id: 'sessions', label: 'Sessions', icon: 'sessions' });
    }
    if (userProfile?.role === 'mentor') items.push({ id: 'students', label: 'Mentor Dashboard', icon: 'students' });
    return items;
  })();

  const inviteBanner = userProfile?.role === 'trader' && userProfile?.pendingMentorId ? <MentorInviteBanner userProfile={userProfile} onUpdate={reloadProfile} /> : null;

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <>{inviteBanner}<DashboardPage state={journalState} setState={saveJournalState} setActivePage={setActivePage} setSelectedDate={setSelectedDate} isMobile={isMobile}/></>;
      case 'tradelog': return <>{inviteBanner}<TradeLogPage state={journalState} setState={saveJournalState} isMobile={isMobile} myTradeFeedback={myTradeFeedback} myTradeFlags={myTradeFlags} markFeedbackAsRead={markFeedbackAsRead} tradeQuestions={myTradeQuestions} onAskQuestion={askQuestion} onResolveQuestion={resolveMyQuestion} userProfile={userProfile}/></>;
      case 'calendar': return <>{inviteBanner}<CalendarPage state={journalState} setState={saveJournalState} selectedDate={selectedDate} setSelectedDate={setSelectedDate} isMobile={isMobile}/></>;
      case 'goals': return <>{inviteBanner}<GoalsPage state={journalState} setState={saveJournalState} isMobile={isMobile}/></>;
      case 'assignments': return <>{inviteBanner}<AssignmentsPage assignments={myAssignments} journalState={journalState} userProfile={userProfile} isMobile={isMobile} onUpdateAssignment={updateMyAssignment}/></>;
      case 'checkins': return <>{inviteBanner}<CheckinsPage checkins={myCheckins} userProfile={userProfile} isMobile={isMobile}/></>;
      case 'sessions': return <>{inviteBanner}<SessionsPage sessions={mySessions} userProfile={userProfile} isMobile={isMobile}/></>;
      case 'setups': return <>{inviteBanner}<SetupsPage state={journalState} setState={saveJournalState} isMobile={isMobile}/></>;
      case 'mistakes': return <>{inviteBanner}<MistakesPage state={journalState} setState={saveJournalState} isMobile={isMobile}/></>;
      case 'profile': return <>{inviteBanner}<ProfilePage state={journalState} setState={saveJournalState} isMobile={isMobile} userProfile={userProfile} onSignOut={handleSignOut} onUpdate={reloadProfile}/></>;
      case 'students': return <StudentsPage userProfile={userProfile} isMobile={isMobile}/>;
      default: return <>{inviteBanner}<DashboardPage state={journalState} setState={saveJournalState} isMobile={isMobile}/></>;
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, reloadProfile }}>
      <div className="min-h-screen bg-gray-50">
        {!isMobile && <Sidebar isExpanded={sidebarExpanded} setIsExpanded={setSidebarExpanded} activePage={activePage} setActivePage={setActivePage} isMobile={false} navItems={navItems}/>}
        <TopBar storageInfo={storageInfo} sidebarExpanded={sidebarExpanded} isMobile={isMobile} userProfile={userProfile} onSignOut={handleSignOut} notifications={notifications} onMarkAsRead={markNotificationAsRead} onMarkAllAsRead={markAllNotificationsAsRead} onNotificationClick={handleNotificationClick}/>
        <main className={`pt-14 min-h-screen transition-all duration-300 ease-in-out ${isMobile ? 'mobile-content-padding' : (sidebarExpanded ? 'pl-56' : 'pl-16')}`}>
          <div className={isMobile ? 'p-3' : 'p-6'}>{renderPage()}</div>
        </main>
        {isMobile && <Sidebar isExpanded={false} setIsExpanded={() => {}} activePage={activePage} setActivePage={setActivePage} isMobile={true} navItems={navItems}/>}
      </div>
    </AuthContext.Provider>
  );
}
