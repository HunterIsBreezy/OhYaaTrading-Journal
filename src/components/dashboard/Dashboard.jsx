import { useState, useEffect, useMemo, useRef } from 'react';
import { FILTER_OPTIONS } from '../../utils/constants';
import { todayISO, nowISO, calcTradeDerived, formatCurrency, formatCurrencyShort } from '../../utils/helpers';
import { SimpleLineChart, SimplePieChart, SimpleBarChart } from '../shared/Charts';
import Icons from '../shared/Icons';

export default function DashboardPage({ state, setState, setActivePage, setSelectedDate, isMobile, isReadOnly = false }) {
  const [filter, setFilter] = useState('week');
  const [dailyNote, setDailyNote] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(null);
  const datePickerRef = useRef(null);
  const today = todayISO();

  useEffect(() => {
    if (state.dailyNotes[today]) setDailyNote(state.dailyNotes[today].note || '');
  }, [state.dailyNotes, today]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target)) setShowDatePicker(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { setCustomStartDate(null); }, [filter]);

  const getDateRange = (filterType) => {
    const now = new Date();
    const todayStr = todayISO();
    switch (filterType) {
      case 'day': return { start: todayStr, end: todayStr };
      case 'week': {
        const dow = now.getDay();
        const ws = new Date(now); ws.setDate(now.getDate() - dow);
        const we = new Date(ws); we.setDate(ws.getDate() + 6);
        return { start: ws.toISOString().split('T')[0], end: we.toISOString().split('T')[0] };
      }
      case 'month': return {
        start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
      };
      case 'year': return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
      default: return { start: '1900-01-01', end: '2100-12-31' };
    }
  };

  const currentRange = useMemo(() => {
    if (customStartDate && filter !== 'all') {
      const start = new Date(customStartDate);
      let end = new Date(customStartDate);
      if (filter === 'week') end.setDate(start.getDate() + 6);
      else if (filter === 'month') end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      else if (filter === 'year') end = new Date(start.getFullYear(), 11, 31);
      return { start: customStartDate, end: end.toISOString().split('T')[0] };
    }
    return getDateRange(filter);
  }, [filter, customStartDate]);

  const metrics = useMemo(() => {
    const range = currentRange;
    const closedTrades = state.trades
      .map(t => ({ ...t, derived: calcTradeDerived(t) }))
      .filter(t => {
        if (t.derived.isOpen) return false;
        const d = (t.exitDate && t.exitDate !== '') ? t.exitDate : t.entryDate;
        return d && d >= range.start && d <= range.end;
      });

    const wins = closedTrades.filter(t => t.derived.winLoss === 'W');
    const losses = closedTrades.filter(t => t.derived.winLoss === 'L');
    const totalPnL = closedTrades.reduce((s, t) => s + (t.derived.pnlFinal || 0), 0);
    const winRate = closedTrades.length > 0 ? ((wins.length / closedTrades.length) * 100).toFixed(1) : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.derived.pnlFinal, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.derived.pnlFinal, 0) / losses.length) : 0;
    const avgWinLossRatio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : avgWin > 0 ? '∞' : '0.00';
    const riskRewardRatio = avgWinLossRatio;

    const dailyPnL = {}, dailyTradeCounts = {}, dailyWins = {}, dailyLosses = {};
    closedTrades.forEach(t => {
      const date = t.exitDate || t.entryDate;
      if (!dailyPnL[date]) { dailyPnL[date] = 0; dailyTradeCounts[date] = 0; dailyWins[date] = 0; dailyLosses[date] = 0; }
      dailyPnL[date] += t.derived.pnlFinal || 0;
      dailyTradeCounts[date]++;
      if (t.derived.winLoss === 'W') dailyWins[date]++;
      if (t.derived.winLoss === 'L') dailyLosses[date]++;
    });
    const days = Object.entries(dailyPnL);
    const bestDay = days.length > 0 ? days.reduce((b, c) => c[1] > b[1] ? c : b, days[0]) : null;
    const worstDay = days.length > 0 ? days.reduce((w, c) => c[1] < w[1] ? c : w, days[0]) : null;
    const biggestWin = wins.length > 0 ? wins.reduce((b, c) => c.derived.pnlFinal > b.derived.pnlFinal ? c : b, wins[0]) : null;
    const biggestLoss = losses.length > 0 ? losses.reduce((w, c) => c.derived.pnlFinal < w.derived.pnlFinal ? c : w, losses[0]) : null;

    const sortedTrades = [...closedTrades].sort((a, b) => (a.exitDate || a.entryDate).localeCompare(b.exitDate || b.entryDate));
    let cumulative = 0;
    const chartByDate = {};
    sortedTrades.forEach(t => {
      const date = t.exitDate || t.entryDate;
      cumulative += t.derived.pnlFinal || 0;
      chartByDate[date] = Math.round(cumulative * 100) / 100;
    });
    const chartData = Object.entries(chartByDate).map(([date, cumulative]) => ({ date, cumulative }));

    const setupStats = {};
    state.setups.forEach(s => { setupStats[s.id] = { id: s.id, name: s.name, totalTrades: 0, wins: 0, losses: 0, totalPnL: 0, winRate: 0 }; });
    closedTrades.forEach(t => {
      if (!t.setupId || !setupStats[t.setupId]) return;
      setupStats[t.setupId].totalTrades++;
      setupStats[t.setupId].totalPnL += t.derived.pnlFinal || 0;
      if (t.derived.winLoss === 'W') setupStats[t.setupId].wins++;
      if (t.derived.winLoss === 'L') setupStats[t.setupId].losses++;
    });
    Object.values(setupStats).forEach(s => {
      s.winRate = (s.wins + s.losses) > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0;
    });

    const mistakeStats = {};
    state.mistakes.forEach(m => { mistakeStats[m.id] = { id: m.id, name: m.name, totalOccurrences: 0, losingTrades: 0, profitableTrades: 0, totalLossAmount: 0 }; });
    closedTrades.forEach(t => {
      if (!t.mistakeIds?.length) return;
      const pnl = t.derived.pnlFinal || 0;
      t.mistakeIds.forEach(mId => {
        if (!mistakeStats[mId]) return;
        mistakeStats[mId].totalOccurrences++;
        if (pnl < 0) { mistakeStats[mId].losingTrades++; mistakeStats[mId].totalLossAmount += pnl; }
        else mistakeStats[mId].profitableTrades++;
      });
    });

    const tradeCounts = Object.values(dailyTradeCounts);
    const avgDailyTrades = tradeCounts.length > 0 ? tradeCounts.reduce((a, b) => a + b, 0) / tradeCounts.length : 0;

    return {
      totalTrades: closedTrades.length, totalPnL, wins: wins.length, losses: losses.length, winRate,
      avgWin, avgLoss, avgWinLossRatio, riskRewardRatio, avgDailyTrades,
      dailyPnL, dailyTradeCounts, dailyWins, dailyLosses, bestDay, worstDay, biggestWin, biggestLoss, chartData,
      setupAnalytics: Object.values(setupStats),
      mistakeAnalytics: Object.values(mistakeStats),
    };
  }, [state.trades, state.setups, state.mistakes, currentRange]);

  const calendarData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = firstDay.getDay();
    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push({ day: null, pnl: null, trades: 0, wins: 0, losses: 0 });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, date: dateStr, pnl: metrics.dailyPnL[dateStr] || null, trades: metrics.dailyTradeCounts[dateStr] || 0, wins: metrics.dailyWins[dateStr] || 0, losses: metrics.dailyLosses[dateStr] || 0 });
    }
    return { year, month, monthName: firstDay.toLocaleString('default', { month: 'long' }), days };
  }, [metrics.dailyPnL, metrics.dailyTradeCounts, metrics.dailyWins, metrics.dailyLosses]);

  const goalProgress = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const TRADING_DAYS = 252;
    const yearlyGoal = state.yearlyGoal;
    if (!yearlyGoal || yearlyGoal.year !== currentYear) return null;
    const yearStart = `${currentYear}-01-01`, yearEnd = `${currentYear}-12-31`;
    const yearTrades = state.trades
      .map(t => ({ ...t, derived: calcTradeDerived(t) }))
      .filter(t => { if (t.derived.isOpen) return false; const d = t.exitDate || t.entryDate; return d >= yearStart && d <= yearEnd; })
      .sort((a, b) => (a.exitDate || a.entryDate).localeCompare(b.exitDate || b.entryDate));
    const cumulativeByDate = {};
    let runningTotal = 0;
    yearTrades.forEach(t => { const d = t.exitDate || t.entryDate; runningTotal += t.derived.pnlFinal || 0; cumulativeByDate[d] = runningTotal; });
    const yearPnL = runningTotal;
    const progress = yearlyGoal.target > 0 ? (yearPnL / yearlyGoal.target) * 100 : 0;
    const remaining = yearlyGoal.target - yearPnL;
    const endOfYear = new Date(currentYear, 11, 31);
    const calDaysRem = Math.ceil((endOfYear - now) / (1000 * 60 * 60 * 24));
    const tradingDaysRem = Math.round(calDaysRem * (TRADING_DAYS / 365));
    const tradingDaysPassed = TRADING_DAYS - tradingDaysRem;
    const expectedPnL = (yearlyGoal.target / TRADING_DAYS) * tradingDaysPassed;
    const dailyTarget = yearlyGoal.target / TRADING_DAYS;
    return {
      goal: yearlyGoal, yearPnL, progress: Math.min(progress, 100), progressRaw: progress,
      isComplete: yearPnL >= yearlyGoal.target, remaining,
      paceStatus: yearPnL >= expectedPnL ? 'ahead' : 'behind',
      paceDifference: yearPnL - expectedPnL,
      dailyTarget, weeklyTarget: yearlyGoal.target / 52, monthlyTarget: yearlyGoal.target / 12, quarterlyTarget: yearlyGoal.target / 4,
      remainingDailyTarget: tradingDaysRem > 0 ? remaining / tradingDaysRem : 0,
      remainingWeeklyTarget: Math.ceil(calDaysRem / 7) > 0 ? remaining / Math.ceil(calDaysRem / 7) : 0,
      daysRemaining: calDaysRem, tradingDaysRemaining: tradingDaysRem,
      weeksRemaining: Math.ceil(calDaysRem / 7),
      yearLabel: `${currentYear}`, yearStartStr: yearStart, yearEndStr: yearEnd,
      cumulativeByDate,
    };
  }, [state.yearlyGoal, state.trades]);

  const handleSaveDailyNote = () => {
    setState({ ...state, dailyNotes: { ...state.dailyNotes, [today]: { date: today, note: dailyNote, emotionalState: state.dailyNotes[today]?.emotionalState || null, updatedAt: nowISO() } } });
  };

  const handleDayClick = (dateStr) => { if (dateStr) { setSelectedDate(dateStr); setActivePage('calendar'); } };

  const formatDateRange = () => {
    const start = new Date(currentRange.start + 'T12:00:00');
    const end = new Date(currentRange.end + 'T12:00:00');
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const fmtS = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (filter === 'day') return fmt(start);
    if (filter === 'all') return 'All Time';
    if (start.getFullYear() === end.getFullYear()) return `${fmtS(start)} - ${fmtS(end)}, ${start.getFullYear()}`;
    return `${fmt(start)} - ${fmt(end)}`;
  };

  const handleDateSelect = (dateStr) => {
    const sel = new Date(dateStr + 'T12:00:00');
    if (filter === 'day') setCustomStartDate(dateStr);
    else if (filter === 'week') { const sun = new Date(sel); sun.setDate(sel.getDate() - sel.getDay()); setCustomStartDate(sun.toISOString().split('T')[0]); }
    else if (filter === 'month') setCustomStartDate(new Date(sel.getFullYear(), sel.getMonth(), 1).toISOString().split('T')[0]);
    else if (filter === 'year') setCustomStartDate(`${sel.getFullYear()}-01-01`);
    else setCustomStartDate(null);
    setShowDatePicker(false);
  };

  const MiniCalendar = () => {
    const [viewMonth, setViewMonth] = useState(() => {
      const d = customStartDate ? new Date(customStartDate + 'T12:00:00') : new Date();
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
    const firstDayOfWeek = new Date(viewMonth.year, viewMonth.month, 1).getDay();
    const monthName = new Date(viewMonth.year, viewMonth.month, 1).toLocaleString('default', { month: 'long' });
    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);

    const dateStr = (day) => day ? `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
    const inRange = (day) => { const ds = dateStr(day); return ds && ds >= currentRange.start && ds <= currentRange.end; };
    const isStart = (day) => dateStr(day) === currentRange.start;
    const isEnd = (day) => dateStr(day) === currentRange.end;

    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setViewMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 })} className="p-1 hover:bg-gray-100 rounded">{Icons.chevronLeft}</button>
          <span className="font-semibold text-gray-900">{monthName} {viewMonth.year}</span>
          <button onClick={() => setViewMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 })} className="p-1 hover:bg-gray-100 rounded">{Icons.chevronRight}</button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="text-xs text-gray-500 py-1">{d}</div>)}
          {days.map((day, i) => {
            const ds = dateStr(day);
            return (
              <button key={i} onClick={() => day && handleDateSelect(ds)} disabled={!day}
                className={`text-xs py-1.5 transition-colors ${!day ? 'invisible' : 'hover:bg-blue-100 cursor-pointer'} ${inRange(day) ? 'bg-blue-100 text-blue-900' : 'text-gray-700'} ${isStart(day) ? 'rounded-l-md bg-blue-500 text-white hover:bg-blue-600' : ''} ${isEnd(day) ? 'rounded-r-md bg-blue-500 text-white hover:bg-blue-600' : ''} ${isStart(day) && isEnd(day) ? 'rounded-md' : ''}`}>
                {day}
              </button>
            );
          })}
        </div>
        {filter !== 'all' && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button onClick={() => { setCustomStartDate(null); setShowDatePicker(false); }} className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium">
              Reset to Current {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h1>
          <div className="relative" ref={datePickerRef}>
            <button onClick={() => filter !== 'all' && setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-1 text-xs md:text-sm ${filter === 'all' ? 'text-gray-500 cursor-default' : 'text-blue-600 hover:text-blue-700 cursor-pointer'}`}>
              {Icons.calendar}
              <span className="font-medium hidden sm:inline">{formatDateRange()}</span>
              <span className="font-medium sm:hidden">{filter === 'all' ? 'All' : formatDateRange().split(',')[0]}</span>
              {filter !== 'all' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 md:w-4 md:h-4"><path d="M6 9l6 6 6-6" /></svg>}
            </button>
            {showDatePicker && filter !== 'all' && (
              <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 min-w-[280px]"><MiniCalendar /></div>
            )}
          </div>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto no-scrollbar">
          {FILTER_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => setFilter(opt.id)}
              className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-md transition-colors whitespace-nowrap flex-shrink-0 ${filter === opt.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-white p-3 md:p-6 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">Total P&L</p>
          <p className={`text-xl sm:text-2xl md:text-3xl font-bold ${metrics.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(metrics.totalPnL)}</p>
        </div>
        <div className="bg-white p-3 md:p-6 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">Win/Loss</p>
          <p className="text-base sm:text-lg md:text-xl font-bold text-gray-900"><span className="text-emerald-600">{metrics.wins}W</span>{' / '}<span className="text-red-600">{metrics.losses}L</span></p>
          <p className="text-xs md:text-sm text-gray-500 mt-1">{metrics.winRate}%</p>
        </div>
        <div className="bg-white p-3 md:p-6 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">Avg W/L</p>
          <p className="text-base sm:text-lg md:text-xl font-bold text-gray-900">{metrics.avgWinLossRatio}:1</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">{formatCurrencyShort(metrics.avgWin)} / {formatCurrencyShort(metrics.avgLoss)}</p>
        </div>
        <div className="bg-white p-3 md:p-6 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">Trades</p>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{metrics.totalTrades}</p>
          {metrics.avgDailyTrades > 0 && <p className="text-[10px] md:text-xs text-gray-500 mt-1">{metrics.avgDailyTrades.toFixed(1)}/day</p>}
        </div>
      </div>

      {/* Goal Progress */}
      {goalProgress && (
        <div className={`rounded-xl border-2 p-4 md:p-6 ${goalProgress.isComplete ? 'bg-emerald-50 border-emerald-300' : goalProgress.paceStatus === 'ahead' ? 'bg-blue-50 border-blue-300' : 'bg-amber-50 border-amber-300'}`}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 md:w-24 md:h-24 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="50%" cy="50%" r="45%" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle cx="50%" cy="50%" r="45%" fill="none"
                    stroke={goalProgress.isComplete ? '#10b981' : goalProgress.paceStatus === 'ahead' ? '#3b82f6' : '#f59e0b'}
                    strokeWidth="8" strokeLinecap="round" strokeDasharray={`${goalProgress.progress * 2.83} 283`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-lg md:text-xl font-bold ${goalProgress.isComplete ? 'text-emerald-600' : goalProgress.paceStatus === 'ahead' ? 'text-blue-600' : 'text-amber-600'}`}>
                    {goalProgress.progress.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${goalProgress.isComplete ? 'bg-emerald-200 text-emerald-800' : goalProgress.paceStatus === 'ahead' ? 'bg-blue-200 text-blue-800' : 'bg-amber-200 text-amber-800'}`}>
                    {goalProgress.yearLabel} Goal
                  </span>
                  {goalProgress.isComplete && <span className="text-lg">🎯</span>}
                </div>
                <p className="text-sm text-gray-600 mt-1">{goalProgress.isComplete ? 'Goal achieved!' : goalProgress.paceStatus === 'ahead' ? 'On track' : 'Behind pace'}</p>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div><p className="text-[10px] md:text-xs text-gray-500 uppercase">Target</p><p className="text-base md:text-lg font-bold text-gray-900">{formatCurrencyShort(goalProgress.goal.target)}</p></div>
              <div><p className="text-[10px] md:text-xs text-gray-500 uppercase">Current</p><p className={`text-base md:text-lg font-bold ${goalProgress.yearPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrencyShort(goalProgress.yearPnL)}</p></div>
              <div>
                <p className="text-[10px] md:text-xs text-gray-500 uppercase">{goalProgress.isComplete ? 'Exceeded' : 'Remaining'}</p>
                <p className={`text-base md:text-lg font-bold ${goalProgress.isComplete ? 'text-emerald-600' : 'text-gray-900'}`}>{formatCurrencyShort(Math.abs(goalProgress.remaining))}</p>
              </div>
              <div>
                <p className="text-[10px] md:text-xs text-gray-500 uppercase">{goalProgress.paceStatus === 'ahead' ? 'Ahead by' : 'Behind by'}</p>
                <p className={`text-base md:text-lg font-bold ${goalProgress.paceStatus === 'ahead' ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrencyShort(Math.abs(goalProgress.paceDifference))}</p>
              </div>
            </div>
            <div className={`p-3 rounded-lg ${goalProgress.isComplete ? 'bg-emerald-100' : goalProgress.paceStatus === 'ahead' ? 'bg-blue-100' : 'bg-amber-100'} flex-shrink-0`}>
              <p className="text-[10px] md:text-xs text-gray-600 uppercase mb-1">
                {filter === 'day' ? 'Daily' : filter === 'week' ? 'Weekly' : filter === 'month' ? 'Monthly' : filter === 'year' ? 'Quarterly' : 'Weekly'} Target
              </p>
              <p className="text-lg md:text-xl font-bold text-gray-900">
                {formatCurrencyShort(filter === 'day' ? goalProgress.dailyTarget : filter === 'month' ? goalProgress.monthlyTarget : filter === 'year' ? goalProgress.quarterlyTarget : goalProgress.weeklyTarget)}
              </p>
              {!goalProgress.isComplete && goalProgress.tradingDaysRemaining > 0 && (
                <p className="text-[10px] text-gray-500 mt-1">Need {formatCurrencyShort(goalProgress.remainingDailyTarget)}/day</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Calendar + Daily Note */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{calendarData.monthName} {calendarData.year}</h2>
          <div className="grid grid-cols-7 gap-1">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>)}
            {calendarData.days.map((d, i) => {
              let metDailyGoal = null;
              if (goalProgress && d.day && d.trades > 0 && d.date >= goalProgress.yearStartStr && d.date <= goalProgress.yearEndStr) {
                metDailyGoal = d.pnl >= goalProgress.dailyTarget;
              }
              return (
                <div key={i} onClick={() => d.day && handleDayClick(d.date)}
                  className={`min-h-[60px] md:min-h-[72px] p-1 rounded-lg flex flex-col items-center justify-start ${d.day ? 'cursor-pointer hover:ring-2 hover:ring-blue-400' : ''} ${!d.day ? 'bg-transparent' : ''} ${d.day && d.trades === 0 ? 'bg-gray-50' : ''} ${d.day && d.trades > 0 && d.pnl > 0 ? 'bg-emerald-100 border border-emerald-300' : ''} ${d.day && d.trades > 0 && d.pnl < 0 ? 'bg-red-100 border border-red-300' : ''} ${d.day && d.trades > 0 && d.pnl === 0 ? 'bg-gray-200' : ''}`}>
                  {d.day && (
                    <>
                      <span className="text-xs md:text-sm font-semibold text-gray-700">{d.day}</span>
                      {d.trades > 0 && (
                        <div className="flex flex-col items-center leading-tight">
                          <span className={`text-[10px] md:text-xs font-bold ${d.pnl >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrencyShort(d.pnl)}</span>
                          <span className="text-[8px] md:text-[10px] text-gray-500">{d.wins}W/{d.losses}L</span>
                        </div>
                      )}
                      {metDailyGoal !== null && <span className="text-[8px]" title={metDailyGoal ? 'Hit daily goal' : 'Missed daily goal'}>{metDailyGoal ? '✅' : '❌'}</span>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Today's Notes</h2>
          <p className="text-sm text-gray-500 mb-3">{today}</p>
          <textarea value={dailyNote} onChange={(e) => !isReadOnly && setDailyNote(e.target.value)}
            placeholder={isReadOnly ? "No notes for today" : "Jot down your thoughts for today..."}
            className={`w-full flex-1 min-h-[280px] p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${isReadOnly ? 'bg-gray-50 cursor-not-allowed' : ''}`}
            readOnly={isReadOnly} />
          {!isReadOnly && (
            <button onClick={handleSaveDailyNote} className="mt-3 w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Save Note</button>
          )}
        </div>
      </div>

      {/* Best/Worst Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        {[
          { label: 'Biggest Win', icon: Icons.trendUp, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', trade: metrics.biggestWin, positive: true },
          { label: 'Biggest Loss', icon: Icons.trendDown, iconBg: 'bg-red-100', iconColor: 'text-red-600', trade: metrics.biggestLoss, positive: false },
          { label: 'Best Day', icon: Icons.trendUp, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', day: metrics.bestDay, positive: true },
          { label: 'Worst Day', icon: Icons.trendDown, iconBg: 'bg-red-100', iconColor: 'text-red-600', day: metrics.worstDay, positive: false },
        ].map((card, i) => (
          <div key={i} className="bg-white p-3 md:p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 md:p-2 ${card.iconBg} rounded-lg ${card.iconColor}`}>{card.icon}</div>
              <p className="text-xs md:text-sm font-medium text-gray-500">{card.label}</p>
            </div>
            {card.trade ? (
              <>
                <p className={`text-base sm:text-lg md:text-xl font-bold truncate ${card.positive ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(card.trade.derived.pnlFinal)}</p>
                <p className="text-xs md:text-sm text-gray-500 truncate">{card.trade.ticker} • {card.trade.exitDate || card.trade.entryDate}</p>
              </>
            ) : card.day ? (
              <>
                <p className={`text-base sm:text-lg md:text-xl font-bold truncate ${card.positive ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(card.day[1])}</p>
                <p className="text-xs md:text-sm text-gray-500">{card.day[0]}</p>
              </>
            ) : <p className="text-xs md:text-sm text-gray-400 italic">No trades yet</p>}
          </div>
        ))}
      </div>

      {/* Cumulative Chart */}
      <SimpleLineChart data={metrics.chartData} onPointClick={(point) => { setSelectedDate(point.date); setActivePage('calendar'); }} />

      {/* Setups Performance */}
      {metrics.setupAnalytics.some(s => s.totalTrades > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div><h2 className="text-lg font-semibold text-gray-900">Setups Performance</h2><p className="text-xs text-gray-500 mt-0.5">Filtered by selected time range</p></div>
            <button onClick={() => setActivePage('setups')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All →</button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div><h4 className="text-sm font-medium text-gray-700 mb-3">By Trade Count</h4><SimplePieChart data={metrics.setupAnalytics.filter(s => s.totalTrades > 0).map(s => ({ label: s.name, value: s.totalTrades }))} /></div>
              <div><h4 className="text-sm font-medium text-gray-700 mb-3">By Total P&L</h4><SimpleBarChart data={metrics.setupAnalytics.filter(s => s.totalTrades > 0).sort((a, b) => b.totalPnL - a.totalPnL).map(s => ({ label: s.name, value: s.totalPnL }))} /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
              {[
                { label: 'Top Profit', data: metrics.setupAnalytics.filter(s => s.totalPnL > 0).sort((a,b) => b.totalPnL - a.totalPnL), val: s => formatCurrencyShort(s.totalPnL), color: 'text-emerald-600' },
                { label: 'Worst Loss', data: metrics.setupAnalytics.filter(s => s.totalPnL < 0).sort((a,b) => a.totalPnL - b.totalPnL), val: s => formatCurrencyShort(s.totalPnL), color: 'text-red-600' },
                { label: 'Most Used', data: metrics.setupAnalytics.filter(s => s.totalTrades > 0).sort((a,b) => b.totalTrades - a.totalTrades), val: s => s.totalTrades, color: 'text-blue-600' },
                { label: 'Best Win Rate', data: metrics.setupAnalytics.filter(s => s.totalTrades >= 3).sort((a,b) => b.winRate - a.winRate), val: s => `${s.winRate}%`, color: 'text-amber-600', empty: 'Min 3 trades' },
              ].map((col, ci) => (
                <div key={ci}>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{col.label}</p>
                  {col.data.slice(0, 3).length > 0
                    ? col.data.slice(0, 3).map((s, i) => (
                        <div key={s.id} className="flex items-center justify-between py-1">
                          <span className="text-xs text-gray-600 truncate max-w-[80px]" title={s.name}>{i + 1}. {s.name}</span>
                          <span className={`text-xs font-semibold ${col.color}`}>{col.val(s)}</span>
                        </div>
                      ))
                    : <p className="text-xs text-gray-400 italic">{col.empty || 'None'}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mistakes Analysis */}
      {metrics.mistakeAnalytics.some(m => m.totalOccurrences > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div><h2 className="text-lg font-semibold text-gray-900">Mistakes Analysis</h2><p className="text-xs text-gray-500 mt-0.5">Filtered by selected time range • Loss amounts only include losing trades</p></div>
            <button onClick={() => setActivePage('mistakes')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All →</button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">By Frequency</h4>
                <SimplePieChart data={metrics.mistakeAnalytics.filter(m => m.totalOccurrences > 0).sort((a,b) => b.totalOccurrences - a.totalOccurrences).map(m => ({ label: m.name, value: m.totalOccurrences }))} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">By Loss Amount (Losses Only)</h4>
                {(() => {
                  const lossData = metrics.mistakeAnalytics.filter(m => m.totalLossAmount < 0).sort((a,b) => a.totalLossAmount - b.totalLossAmount).map(m => ({ label: m.name, value: Math.abs(m.totalLossAmount) }));
                  if (!lossData.length) return <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No loss data</div>;
                  const maxVal = Math.max(...lossData.map(d => d.value), 1);
                  return (
                    <div className="space-y-2">
                      {lossData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-20 truncate" title={d.label}>{d.label}</span>
                          <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden"><div className="h-full rounded bg-red-500" style={{ width: `${(d.value / maxVal) * 100}%` }} /></div>
                          <span className="text-xs font-medium w-16 text-right text-red-600">-{formatCurrencyShort(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100">
              {[
                { label: 'Most Frequent', data: metrics.mistakeAnalytics.filter(m => m.totalOccurrences > 0).sort((a,b) => b.totalOccurrences - a.totalOccurrences), val: m => `${m.totalOccurrences}x`, color: 'text-amber-600' },
                { label: 'Most Costly', data: metrics.mistakeAnalytics.filter(m => m.totalLossAmount < 0).sort((a,b) => a.totalLossAmount - b.totalLossAmount), val: m => formatCurrencyShort(m.totalLossAmount), color: 'text-red-600' },
              ].map((col, ci) => (
                <div key={ci}>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{col.label}</p>
                  {col.data.slice(0, 3).length > 0
                    ? col.data.slice(0, 3).map((m, i) => (
                        <div key={m.id} className="flex items-center justify-between py-1">
                          <span className="text-xs text-gray-600 truncate max-w-[120px]" title={m.name}>{i + 1}. {m.name}</span>
                          <span className={`text-xs font-semibold ${col.color}`}>{col.val(m)}</span>
                        </div>
                      ))
                    : <p className="text-xs text-gray-400 italic">None</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
