import { useState, useMemo } from 'react';
import { nowISO, generateId, todayISO, calcTradeDerived, formatCurrency } from '../../utils/helpers';
import Icons from '../shared/Icons';

const TRADING_DAYS_PER_YEAR = 252;

const CHALLENGE_TEMPLATES = {
  profit: [
    { id: 'profit_by_date', name: 'Make ${amount} by {date}', defaults: { amount: 5000, date: '' }, type: 'profit', condition: 'by_date' },
    { id: 'profit_in_trades', name: 'Make ${amount} in only {trades} trades', defaults: { amount: 5000, trades: 10 }, type: 'profit', condition: 'in_trades' },
    { id: 'profit_streak', name: 'Make ${amount} for {days} days in a row', defaults: { amount: 1000, days: 5 }, type: 'profit', condition: 'streak_days' },
    { id: 'profit_single_day', name: 'Make ${amount} in a single day', defaults: { amount: 2000 }, type: 'profit', condition: 'single_day' },
    { id: 'profit_single_trade', name: 'Make ${amount} in a single trade', defaults: { amount: 1000 }, type: 'profit', condition: 'single_trade' },
  ],
  consistency: [
    { id: 'profitable_streak', name: 'Be profitable {days} days in a row', defaults: { days: 5 }, type: 'consistency', condition: 'profitable_days' },
    { id: 'trade_streak', name: 'Trade {days} days in a row', defaults: { days: 10 }, type: 'consistency', condition: 'trading_days' },
    { id: 'win_rate', name: 'Stay above {percent}% win rate for {trades} trades', defaults: { percent: 60, trades: 20 }, type: 'consistency', condition: 'win_rate' },
  ],
  risk: [
    { id: 'max_loss_per_trade', name: 'No losses greater than ${amount} for {days} days', defaults: { amount: 500, days: 5 }, type: 'risk', condition: 'max_loss_days' },
    { id: 'max_daily_loss', name: 'Keep max daily loss under ${amount} for {days} days', defaults: { amount: 1000, days: 10 }, type: 'risk', condition: 'daily_loss_limit' },
    { id: 'no_mistakes', name: 'Complete {trades} trades with no mistakes tagged', defaults: { trades: 10 }, type: 'risk', condition: 'no_mistakes' },
  ],
  volume: [
    { id: 'trades_by_date', name: 'Complete {trades} trades by {date}', defaults: { trades: 20, date: '' }, type: 'volume', condition: 'trades_by_date' },
    { id: 'trade_every_day', name: 'Trade every market day for {weeks} weeks', defaults: { weeks: 2 }, type: 'volume', condition: 'consecutive_weeks' },
  ],
};

const isWeekend = (dateStr) => { const d = new Date(dateStr).getDay(); return d === 0 || d === 6; };

export default function GoalsPage({ state, setState, isMobile, isReadOnly = false }) {
  const [yearlyGoalModalOpen, setYearlyGoalModalOpen] = useState(false);
  const [yearlyGoalInput, setYearlyGoalInput] = useState('');
  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
  const [challengeTab, setChallengeTab] = useState('tried');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customChallenge, setCustomChallenge] = useState({ metricType: 'profit', condition: 'by_date', value: '', timeValue: '', endDate: '' });
  const [templateValues, setTemplateValues] = useState({});
  const [error, setError] = useState('');

  const currentYear = new Date().getFullYear();

  const yearlyGoalProgress = useMemo(() => {
    const goal = state.yearlyGoal;
    if (!goal || goal.year !== currentYear) return null;
    const yearStart = `${currentYear}-01-01`, yearEnd = `${currentYear}-12-31`;
    const yearPnL = state.trades
      .filter(t => { const d = calcTradeDerived(t); if (d.isOpen) return false; const ed = t.exitDate || t.entryDate; return ed >= yearStart && ed <= yearEnd; })
      .reduce((s, t) => s + (calcTradeDerived(t).pnlFinal || 0), 0);
    const progress = goal.target > 0 ? (yearPnL / goal.target) * 100 : 0;
    const now = new Date(), endOfYear = new Date(currentYear, 11, 31);
    const calendarDaysRemaining = Math.ceil((endOfYear - now) / (1000 * 60 * 60 * 24));
    const tradingDaysRemaining = Math.round(calendarDaysRemaining * (TRADING_DAYS_PER_YEAR / 365));
    return {
      goal, yearPnL, progress: Math.min(progress, 100), progressRaw: progress, isComplete: yearPnL >= goal.target,
      remaining: goal.target - yearPnL, calendarDaysRemaining, tradingDaysRemaining,
      dailyTarget: goal.target / TRADING_DAYS_PER_YEAR, weeklyTarget: goal.target / 52, monthlyTarget: goal.target / 12, quarterlyTarget: goal.target / 4,
    };
  }, [state.yearlyGoal, state.trades, currentYear]);

  const challengesWithProgress = useMemo(() => {
    return (state.challenges || []).map(challenge => {
      let currentValue = 0, targetValue = challenge.targetValue, progress = 0, isComplete = false, isFailed = false, statusText = 'In Progress';
      const now = new Date();
      const trades = state.trades.map(t => ({ ...t, derived: calcTradeDerived(t) })).filter(t => !t.derived.isOpen);
      const ct = trades.filter(t => (t.exitDate || t.entryDate) >= challenge.startDate);

      switch (challenge.condition) {
        case 'by_date': {
          currentValue = ct.filter(t => (t.exitDate || t.entryDate) <= challenge.endDate).reduce((s, t) => s + (t.derived.pnlFinal || 0), 0);
          isComplete = currentValue >= targetValue; isFailed = !isComplete && now > new Date(challenge.endDate + 'T23:59:59'); break;
        }
        case 'in_trades': {
          const lt = ct.slice(0, challenge.tradeLimit);
          currentValue = lt.reduce((s, t) => s + (t.derived.pnlFinal || 0), 0);
          isComplete = currentValue >= targetValue && lt.length <= challenge.tradeLimit; isFailed = ct.length >= challenge.tradeLimit && currentValue < targetValue; break;
        }
        case 'streak_days': case 'profitable_days': {
          const dp = {}; ct.forEach(t => { const d = t.exitDate || t.entryDate; dp[d] = (dp[d] || 0) + (t.derived.pnlFinal || 0); });
          const sorted = Object.entries(dp).sort((a, b) => a[0].localeCompare(b[0]));
          let max = 0, cur = 0;
          sorted.forEach(([, pnl]) => { if ((challenge.condition === 'streak_days' ? pnl >= targetValue : pnl > 0)) { cur++; max = Math.max(max, cur); } else cur = 0; });
          currentValue = max; targetValue = challenge.streakDays; isComplete = max >= challenge.streakDays; break;
        }
        case 'single_day': { const dp = {}; ct.forEach(t => { const d = t.exitDate || t.entryDate; dp[d] = (dp[d] || 0) + (t.derived.pnlFinal || 0); }); currentValue = Math.max(0, ...Object.values(dp)); isComplete = currentValue >= targetValue; break; }
        case 'single_trade': { currentValue = Math.max(0, ...ct.map(t => t.derived.pnlFinal || 0)); isComplete = currentValue >= targetValue; break; }
        case 'trading_days': {
          const days = [...new Set(ct.map(t => t.exitDate || t.entryDate))].sort();
          let max = 0, cur = 0, last = null;
          days.forEach(d => { if (last) { const diff = (new Date(d) - new Date(last)) / 86400000; if (diff === 1 || (diff <= 3 && isWeekend(last))) cur++; else cur = 1; } else cur = 1; max = Math.max(max, cur); last = d; });
          currentValue = max; targetValue = challenge.streakDays; isComplete = max >= challenge.streakDays; break;
        }
        case 'win_rate': {
          const lt = ct.slice(0, challenge.tradeLimit);
          currentValue = lt.length > 0 ? (lt.filter(t => t.derived.winLoss === 'W').length / lt.length) * 100 : 0;
          targetValue = challenge.targetPercent; isComplete = lt.length >= challenge.tradeLimit && currentValue >= targetValue; isFailed = lt.length >= challenge.tradeLimit && currentValue < targetValue; break;
        }
        case 'max_loss_days': {
          const dm = {}; ct.forEach(t => { const d = t.exitDate || t.entryDate; const l = t.derived.pnlFinal < 0 ? Math.abs(t.derived.pnlFinal) : 0; dm[d] = Math.max(dm[d] || 0, l); });
          let streak = 0; for (const [, ml] of Object.entries(dm).sort((a, b) => a[0].localeCompare(b[0]))) { streak = ml <= challenge.maxLossAmount ? streak + 1 : 0; }
          currentValue = streak; targetValue = challenge.streakDays; isComplete = streak >= challenge.streakDays; break;
        }
        case 'daily_loss_limit': {
          const dp = {}; ct.forEach(t => { const d = t.exitDate || t.entryDate; dp[d] = (dp[d] || 0) + (t.derived.pnlFinal || 0); });
          let streak = 0; for (const [, pnl] of Object.entries(dp).sort((a, b) => a[0].localeCompare(b[0]))) { streak = pnl >= -challenge.maxLossAmount ? streak + 1 : 0; }
          currentValue = streak; targetValue = challenge.streakDays; isComplete = streak >= challenge.streakDays; break;
        }
        case 'no_mistakes': { currentValue = ct.filter(t => !t.mistakeIds?.length).length; targetValue = challenge.tradeLimit; isComplete = currentValue >= targetValue; break; }
        case 'trades_by_date': { currentValue = ct.filter(t => (t.exitDate || t.entryDate) <= challenge.endDate).length; targetValue = challenge.tradeLimit; isComplete = currentValue >= targetValue; isFailed = !isComplete && now > new Date(challenge.endDate + 'T23:59:59'); break; }
        case 'consecutive_weeks': { const ws = new Set(); ct.forEach(t => { const d = new Date(t.exitDate || t.entryDate); ws.add(Math.floor((d - new Date(currentYear, 0, 1)) / (7 * 86400000))); }); currentValue = ws.size; targetValue = challenge.targetWeeks; isComplete = currentValue >= targetValue; break; }
      }
      progress = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
      if (isComplete) statusText = 'Completed'; else if (isFailed) statusText = 'Failed'; else if (progress >= 75) statusText = 'Almost There!'; else if (progress >= 50) statusText = 'Halfway';
      return { ...challenge, currentValue, targetValue, progress, isComplete, isFailed, statusText };
    });
  }, [state.challenges, state.trades, currentYear]);

  const activeChallenges = challengesWithProgress.filter(c => !c.isComplete && !c.isFailed);
  const completedChallenges = challengesWithProgress.filter(c => c.isComplete);
  const failedChallenges = challengesWithProgress.filter(c => c.isFailed);

  const saveYearlyGoal = () => {
    const target = parseFloat(yearlyGoalInput);
    if (isNaN(target) || target <= 0) { setError('Please enter a valid profit target'); return; }
    setState({ ...state, yearlyGoal: { year: currentYear, target, createdAt: state.yearlyGoal?.createdAt || nowISO(), updatedAt: nowISO() } });
    setYearlyGoalModalOpen(false); setError('');
  };

  const createChallengeFromTemplate = () => {
    if (!selectedTemplate) return;
    const template = Object.values(CHALLENGE_TEMPLATES).flat().find(t => t.id === selectedTemplate);
    if (!template) return;
    const vals = templateValues[selectedTemplate] || template.defaults;
    const challenge = {
      id: generateId(), templateId: template.id, type: template.type, condition: template.condition,
      name: template.name.replace('{amount}', vals.amount || '').replace('{date}', vals.date ? new Date(vals.date).toLocaleDateString() : '').replace('{trades}', vals.trades || '').replace('{days}', vals.days || '').replace('{percent}', vals.percent || '').replace('{weeks}', vals.weeks || ''),
      targetValue: vals.amount || 0, targetPercent: vals.percent || 0, tradeLimit: vals.trades || 0, streakDays: vals.days || 0, targetWeeks: vals.weeks || 0, maxLossAmount: vals.amount || 0, endDate: vals.date || '',
      startDate: todayISO(), createdAt: nowISO(),
    };
    setState({ ...state, challenges: [...(state.challenges || []), challenge] });
    setChallengeModalOpen(false); setSelectedTemplate(null); setTemplateValues({});
  };

  const createCustomChallenge = () => {
    const { condition, value, timeValue, endDate } = customChallenge;
    if (!value || parseFloat(value) <= 0) { setError('Please enter a valid value'); return; }
    let name = '';
    const ch = { id: generateId(), type: 'custom', condition, startDate: todayISO(), createdAt: nowISO() };
    switch (condition) {
      case 'by_date': name = `Make $${value} by ${new Date(endDate).toLocaleDateString()}`; ch.targetValue = parseFloat(value); ch.endDate = endDate; break;
      case 'in_trades': name = `Make $${value} in ${timeValue} trades`; ch.targetValue = parseFloat(value); ch.tradeLimit = parseInt(timeValue); break;
      case 'streak_days': name = `Make $${value} for ${timeValue} days in a row`; ch.targetValue = parseFloat(value); ch.streakDays = parseInt(timeValue); break;
      case 'single_day': name = `Make $${value} in a single day`; ch.targetValue = parseFloat(value); break;
      case 'single_trade': name = `Make $${value} in a single trade`; ch.targetValue = parseFloat(value); break;
      case 'profitable_days': name = `Be profitable ${value} days in a row`; ch.streakDays = parseInt(value); break;
      case 'win_rate': name = `Stay above ${value}% win rate for ${timeValue} trades`; ch.targetPercent = parseFloat(value); ch.tradeLimit = parseInt(timeValue); break;
      case 'max_loss_days': name = `No losses > $${value} for ${timeValue} days`; ch.maxLossAmount = parseFloat(value); ch.streakDays = parseInt(timeValue); break;
      case 'no_mistakes': name = `Complete ${value} trades with no mistakes`; ch.tradeLimit = parseInt(value); break;
    }
    ch.name = name;
    setState({ ...state, challenges: [...(state.challenges || []), ch] });
    setChallengeModalOpen(false); setCustomChallenge({ metricType: 'profit', condition: 'by_date', value: '', timeValue: '', endDate: '' }); setError('');
  };

  const deleteChallenge = (id) => setState({ ...state, challenges: state.challenges.filter(c => c.id !== id) });

  const TemplateCard = ({ template }) => (
    <div onClick={() => setSelectedTemplate(selectedTemplate === template.id ? null : template.id)}
      className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedTemplate === template.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
      <p className="text-sm font-medium text-gray-900">{template.name.replace(/\{[^}]+\}/g, '___')}</p>
      {selectedTemplate === template.id && (
        <div className="mt-3 flex flex-wrap gap-2">
          {template.defaults.amount !== undefined && <input type="number" placeholder="Amount" value={templateValues[template.id]?.amount ?? template.defaults.amount} onChange={(e) => setTemplateValues({ ...templateValues, [template.id]: { ...templateValues[template.id], amount: e.target.value } })} className="px-2 py-1 border rounded text-sm w-24" onClick={(e) => e.stopPropagation()} />}
          {template.defaults.trades !== undefined && <input type="number" placeholder="Trades" value={templateValues[template.id]?.trades ?? template.defaults.trades} onChange={(e) => setTemplateValues({ ...templateValues, [template.id]: { ...templateValues[template.id], trades: e.target.value } })} className="px-2 py-1 border rounded text-sm w-20" onClick={(e) => e.stopPropagation()} />}
          {template.defaults.days !== undefined && <input type="number" placeholder="Days" value={templateValues[template.id]?.days ?? template.defaults.days} onChange={(e) => setTemplateValues({ ...templateValues, [template.id]: { ...templateValues[template.id], days: e.target.value } })} className="px-2 py-1 border rounded text-sm w-20" onClick={(e) => e.stopPropagation()} />}
          {template.defaults.percent !== undefined && <input type="number" placeholder="%" value={templateValues[template.id]?.percent ?? template.defaults.percent} onChange={(e) => setTemplateValues({ ...templateValues, [template.id]: { ...templateValues[template.id], percent: e.target.value } })} className="px-2 py-1 border rounded text-sm w-16" onClick={(e) => e.stopPropagation()} />}
          {template.defaults.weeks !== undefined && <input type="number" placeholder="Weeks" value={templateValues[template.id]?.weeks ?? template.defaults.weeks} onChange={(e) => setTemplateValues({ ...templateValues, [template.id]: { ...templateValues[template.id], weeks: e.target.value } })} className="px-2 py-1 border rounded text-sm w-20" onClick={(e) => e.stopPropagation()} />}
          {template.defaults.date !== undefined && <input type="date" value={templateValues[template.id]?.date ?? ''} onChange={(e) => setTemplateValues({ ...templateValues, [template.id]: { ...templateValues[template.id], date: e.target.value } })} className="px-2 py-1 border rounded text-sm" onClick={(e) => e.stopPropagation()} />}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Goals & Challenges</h1><p className="text-sm text-gray-500 mt-1">Set your yearly target and take on challenges</p></div>
      </div>

      {/* Yearly Goal */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{currentYear} Yearly Goal</h2>
          {!isReadOnly && <button onClick={() => { setYearlyGoalInput(state.yearlyGoal?.target?.toString() || ''); setYearlyGoalModalOpen(true); }} className="text-sm text-blue-600 hover:text-blue-700 font-medium">{state.yearlyGoal?.year === currentYear ? 'Edit' : 'Set Goal'}</button>}
        </div>
        {yearlyGoalProgress ? (
          <div className="p-6">
            <div className="flex items-center gap-6 mb-6">
              <div className="relative w-24 h-24 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="50%" cy="50%" r="45%" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle cx="50%" cy="50%" r="45%" fill="none" stroke={yearlyGoalProgress.isComplete ? '#10b981' : '#3b82f6'} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${yearlyGoalProgress.progress * 2.83} 283`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center"><span className={`text-lg font-bold ${yearlyGoalProgress.isComplete ? 'text-emerald-600' : 'text-blue-600'}`}>{yearlyGoalProgress.progress.toFixed(0)}%</span></div>
              </div>
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[['Target', formatCurrency(yearlyGoalProgress.goal.target), 'text-gray-900'], ['Current', formatCurrency(yearlyGoalProgress.yearPnL), yearlyGoalProgress.yearPnL >= 0 ? 'text-emerald-600' : 'text-red-600'], ['Trade Days', yearlyGoalProgress.tradingDaysRemaining, 'text-gray-900'], ['Days Left', yearlyGoalProgress.calendarDaysRemaining, 'text-gray-900']].map(([lbl, val, cls]) => (
                  <div key={lbl}><p className="text-[10px] md:text-xs text-gray-500 uppercase">{lbl}</p><p className={`text-base sm:text-lg md:text-xl font-bold truncate ${cls}`}>{val}</p></div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
              {[['Daily', yearlyGoalProgress.dailyTarget], ['Weekly', yearlyGoalProgress.weeklyTarget], ['Monthly', yearlyGoalProgress.monthlyTarget], ['Quarterly', yearlyGoalProgress.quarterlyTarget]].map(([lbl, val]) => (
                <div key={lbl} className="bg-blue-50 rounded-lg p-3 md:p-4 text-center"><p className="text-[10px] md:text-xs text-blue-600 uppercase font-medium">{lbl}</p><p className="text-sm sm:text-base md:text-lg font-bold text-blue-900 truncate">{formatCurrency(val)}</p></div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">{Icons.goals}</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No yearly goal set</h3>
            <p className="text-gray-500 mb-4">Set a profit target for {currentYear} to track your progress</p>
            {!isReadOnly && <button onClick={() => setYearlyGoalModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">{Icons.plus}<span>Set Yearly Goal</span></button>}
          </div>
        )}
      </div>

      {/* Challenges */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Challenges</h2>
          {!isReadOnly && <button onClick={() => setChallengeModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium">{Icons.plus}<span>New Challenge</span></button>}
        </div>
        {activeChallenges.length > 0 && (
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Active ({activeChallenges.length})</h3>
            <div className="space-y-3">
              {activeChallenges.map(c => (
                <div key={c.id} className={`rounded-lg p-4 ${c.fromMentor ? 'bg-purple-50 border border-purple-100' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{c.name}</h4>
                      {c.fromMentor && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">From {c.mentorName || 'Mentor'}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.progress >= 75 ? 'bg-emerald-100 text-emerald-700' : c.progress >= 50 ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>{c.statusText}</span>
                      {!isReadOnly && !c.fromMentor && <button onClick={() => deleteChallenge(c.id)} className="p-1 text-gray-400 hover:text-red-600">{Icons.trash}</button>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${c.fromMentor ? 'bg-purple-500' : 'bg-blue-500'}`} style={{ width: `${c.progress}%` }} /></div>
                    <span className="text-sm font-medium text-gray-600 w-20 text-right">{typeof c.currentValue === 'number' && c.currentValue % 1 !== 0 ? c.currentValue.toFixed(1) : c.currentValue} / {c.targetValue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {completedChallenges.length > 0 && (
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-medium text-emerald-700 mb-3">✅ Completed ({completedChallenges.length})</h3>
            <div className="space-y-2">
              {completedChallenges.map(c => (
                <div key={c.id} className={`rounded-lg p-3 flex items-center justify-between ${c.fromMentor ? 'bg-purple-50' : 'bg-emerald-50'}`}>
                  <div className="flex items-center gap-2"><span className={`text-sm ${c.fromMentor ? 'text-purple-800' : 'text-emerald-800'}`}>{c.name}</span>{c.fromMentor && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-600">Mentor</span>}</div>
                  {!isReadOnly && !c.fromMentor && <button onClick={() => deleteChallenge(c.id)} className="p-1 text-emerald-400 hover:text-red-600">{Icons.trash}</button>}
                </div>
              ))}
            </div>
          </div>
        )}
        {failedChallenges.length > 0 && (
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-medium text-red-700 mb-3">❌ Failed ({failedChallenges.length})</h3>
            <div className="space-y-2">
              {failedChallenges.map(c => (
                <div key={c.id} className="bg-red-50 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className="text-sm text-red-800">{c.name}</span>{c.fromMentor && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600">Mentor</span>}</div>
                  {!isReadOnly && !c.fromMentor && <button onClick={() => deleteChallenge(c.id)} className="p-1 text-red-400 hover:text-red-600">{Icons.trash}</button>}
                </div>
              ))}
            </div>
          </div>
        )}
        {challengesWithProgress.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🏆</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No challenges yet</h3>
            <p className="text-gray-500 mb-4">Create challenges to push yourself and track achievements</p>
            {!isReadOnly && <button onClick={() => setChallengeModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">{Icons.plus}<span>Create Your First Challenge</span></button>}
          </div>
        )}
      </div>

      {/* Yearly Goal Modal */}
      {yearlyGoalModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto"><div className="fixed inset-0 bg-black/50" onClick={() => setYearlyGoalModalOpen(false)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-semibold text-gray-900">{currentYear} Yearly Goal</h2></div>
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Profit Target for {currentYear}</label>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input type="number" value={yearlyGoalInput} onChange={(e) => { setYearlyGoalInput(e.target.value); setError(''); }} placeholder="100000" className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-gray-300'}`} autoFocus />
                </div>
                {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                {yearlyGoalInput && parseFloat(yearlyGoalInput) > 0 && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                    <p>This breaks down to approximately:</p>
                    <ul className="mt-2 space-y-1">
                      <li>• <strong>{formatCurrency(parseFloat(yearlyGoalInput) / 252)}</strong> per trading day</li>
                      <li>• <strong>{formatCurrency(parseFloat(yearlyGoalInput) / 52)}</strong> per week</li>
                      <li>• <strong>{formatCurrency(parseFloat(yearlyGoalInput) / 12)}</strong> per month</li>
                    </ul>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3 rounded-b-xl">
                <button onClick={() => setYearlyGoalModalOpen(false)} className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={saveYearlyGoal} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Save Goal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Challenge Modal */}
      {challengeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto"><div className="fixed inset-0 bg-black/50" onClick={() => setChallengeModalOpen(false)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-semibold text-gray-900">New Challenge</h2></div>
              <div className="flex border-b border-gray-200">
                {[['tried','🏆 Tried & True'],['custom','⚙️ Custom']].map(([tab, lbl]) => (
                  <button key={tab} onClick={() => setChallengeTab(tab)} className={`flex-1 px-4 py-3 text-sm font-medium ${challengeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>{lbl}</button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {challengeTab === 'tried' ? (
                  <div className="space-y-6">
                    {[['💰 Profit-Based', CHALLENGE_TEMPLATES.profit], ['📈 Consistency-Based', CHALLENGE_TEMPLATES.consistency], ['🛡️ Risk/Discipline-Based', CHALLENGE_TEMPLATES.risk], ['📊 Volume-Based', CHALLENGE_TEMPLATES.volume]].map(([label, templates]) => (
                      <div key={label}><h3 className="text-sm font-semibold text-gray-700 mb-2">{label}</h3><div className="space-y-2">{templates.map(t => <TemplateCard key={t.id} template={t} />)}</div></div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Challenge Type</label>
                      <select value={customChallenge.condition} onChange={(e) => setCustomChallenge({ ...customChallenge, condition: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                        <optgroup label="Profit">
                          <option value="by_date">Make $X by date</option><option value="in_trades">Make $X in N trades</option><option value="streak_days">Make $X for N days in a row</option><option value="single_day">Make $X in a single day</option><option value="single_trade">Make $X in a single trade</option>
                        </optgroup>
                        <optgroup label="Consistency">
                          <option value="profitable_days">Be profitable N days in a row</option><option value="win_rate">Stay above X% win rate for N trades</option>
                        </optgroup>
                        <optgroup label="Risk/Discipline">
                          <option value="max_loss_days">No losses greater than $X for N days</option><option value="no_mistakes">Complete N trades with no mistakes</option>
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{['by_date','in_trades','streak_days','single_day','single_trade','max_loss_days'].includes(customChallenge.condition) ? 'Amount ($)' : customChallenge.condition === 'win_rate' ? 'Win Rate (%)' : 'Number'}</label>
                      <input type="number" value={customChallenge.value} onChange={(e) => setCustomChallenge({ ...customChallenge, value: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="5000" />
                    </div>
                    {['in_trades','streak_days','win_rate','max_loss_days'].includes(customChallenge.condition) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{customChallenge.condition === 'in_trades' || customChallenge.condition === 'win_rate' ? 'Number of Trades' : 'Number of Days'}</label>
                        <input type="number" value={customChallenge.timeValue} onChange={(e) => setCustomChallenge({ ...customChallenge, timeValue: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="10" />
                      </div>
                    )}
                    {customChallenge.condition === 'by_date' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input type="date" value={customChallenge.endDate} onChange={(e) => setCustomChallenge({ ...customChallenge, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                      </div>
                    )}
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                <button onClick={() => { setChallengeModalOpen(false); setSelectedTemplate(null); setError(''); }} className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={challengeTab === 'tried' ? createChallengeFromTemplate : createCustomChallenge} disabled={challengeTab === 'tried' && !selectedTemplate} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed">Start Challenge</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
