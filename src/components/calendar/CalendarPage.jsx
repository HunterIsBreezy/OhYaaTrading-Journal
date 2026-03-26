import { useState, useMemo, useEffect } from 'react';
import { ASSET_TYPES } from '../../utils/constants';
import { todayISO, nowISO, calcTradeDerived, formatCurrency, formatCurrencyShort } from '../../utils/helpers';
import { SimplePieChart, SimpleBarChart, SetupBarChart } from '../shared/Charts';
import { StarRating } from '../shared/StarRatingAvatar';
import Icons from '../shared/Icons';
import TradeModal from '../tradelog/TradeModal';
import { ImageModal } from '../tradelog/Modals';

export default function CalendarPage({ state, setState, selectedDate, setSelectedDate, isMobile, isReadOnly = false }) {
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const [year, month] = selectedDate.split('-');
      return { year: parseInt(year), month: parseInt(month) - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [dailyNote, setDailyNote] = useState('');
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalData, setImageModalData] = useState({ src: null, title: '' });

  const allTradesWithDerived = useMemo(() => state.trades.map(t => ({ ...t, derived: calcTradeDerived(t) })), [state.trades]);

  const overallStats = useMemo(() => {
    const closed = allTradesWithDerived.filter(t => !t.derived.isOpen);
    const dailyPnL = {}, dailyTradeCount = {};
    closed.forEach(t => {
      const date = (t.exitDate && t.exitDate !== '') ? t.exitDate : t.entryDate;
      if (!dailyPnL[date]) { dailyPnL[date] = 0; dailyTradeCount[date] = 0; }
      dailyPnL[date] += t.derived.pnlFinal || 0;
      dailyTradeCount[date]++;
    });
    const days = Object.values(dailyPnL), counts = Object.values(dailyTradeCount);
    return {
      avgDailyPnL: days.length > 0 ? days.reduce((a, b) => a + b, 0) / days.length : 0,
      avgDailyTrades: counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0,
      tradingDays: days.length,
    };
  }, [allTradesWithDerived]);

  const goalProgress = useMemo(() => {
    const now = new Date(), year = now.getFullYear(), DAYS = 252;
    const goal = state.yearlyGoal;
    if (!goal || goal.year !== year) return null;
    const yearStart = `${year}-01-01`, yearEnd = `${year}-12-31`;
    const yearTrades = allTradesWithDerived
      .filter(t => { if (t.derived.isOpen) return false; const d = t.exitDate || t.entryDate; return d >= yearStart && d <= yearEnd; })
      .sort((a, b) => (a.exitDate || a.entryDate).localeCompare(b.exitDate || b.entryDate));
    const cumulativeByDate = {};
    let runningTotal = 0;
    yearTrades.forEach(t => { const d = t.exitDate || t.entryDate; runningTotal += t.derived.pnlFinal || 0; cumulativeByDate[d] = runningTotal; });
    const dailyTarget = goal.target / DAYS;
    const paceByDate = {};
    let dc = 0;
    const end = new Date(year, 11, 31);
    for (let d = new Date(year, 0, 1); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) { dc++; paceByDate[d.toISOString().split('T')[0]] = dailyTarget * dc; }
    }
    return { goal, yearPnL: runningTotal, progress: Math.min(goal.target > 0 ? (runningTotal / goal.target) * 100 : 0, 100), dailyTarget, cumulativeByDate, paceByDate, yearStartStr: yearStart, yearEndStr: yearEnd, yearLabel: `${year}` };
  }, [state.yearlyGoal, allTradesWithDerived]);

  const calendarData = useMemo(() => {
    const { year, month } = viewDate;
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = firstDay.getDay();
    const dailyStats = {};
    allTradesWithDerived.forEach(t => {
      const date = (t.exitDate && t.exitDate !== '') ? t.exitDate : t.entryDate;
      if (!date) return;
      if (!dailyStats[date]) dailyStats[date] = { pnl: 0, trades: 0, wins: 0, losses: 0 };
      dailyStats[date].trades++;
      if (!t.derived.isOpen) {
        dailyStats[date].pnl += t.derived.pnlFinal || 0;
        if (t.derived.winLoss === 'W') dailyStats[date].wins++;
        if (t.derived.winLoss === 'L') dailyStats[date].losses++;
      }
    });
    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, date: dateStr, ...(dailyStats[dateStr] || { pnl: 0, trades: 0, wins: 0, losses: 0 }), hasNote: !!state.dailyNotes[dateStr] });
    }
    return { year, month, monthName: firstDay.toLocaleString('default', { month: 'long' }), days };
  }, [viewDate, allTradesWithDerived, state.dailyNotes]);

  const selectedDateTrades = useMemo(() => {
    if (!selectedDate) return [];
    return allTradesWithDerived.filter(t => { const d = (t.exitDate && t.exitDate !== '') ? t.exitDate : t.entryDate; return d === selectedDate; });
  }, [selectedDate, allTradesWithDerived]);

  const selectedDateStats = useMemo(() => {
    if (!selectedDate || !selectedDateTrades.length) return null;
    const closed = selectedDateTrades.filter(t => !t.derived.isOpen);
    const wins = closed.filter(t => t.derived.winLoss === 'W');
    const losses = closed.filter(t => t.derived.winLoss === 'L');
    const totalPnL = closed.reduce((s, t) => s + (t.derived.pnlFinal || 0), 0);
    const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(1) : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.derived.pnlFinal || 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.derived.pnlFinal || 0), 0) / losses.length) : 0;
    const pnlByAsset = {}, pnlByTicker = {};
    closed.forEach(t => {
      const asset = ASSET_TYPES.find(a => a.id === t.assetType)?.label || t.assetType;
      pnlByAsset[asset] = (pnlByAsset[asset] || 0) + (t.derived.pnlFinal || 0);
      pnlByTicker[t.ticker] = (pnlByTicker[t.ticker] || 0) + (t.derived.pnlFinal || 0);
    });
    const setupStats = {};
    closed.forEach(t => {
      if (!t.setupId) return;
      const s = state.setups.find(s => s.id === t.setupId); if (!s) return;
      if (!setupStats[s.id]) setupStats[s.id] = { id: s.id, name: s.name, wins: 0, losses: 0, total: 0, totalPnL: 0 };
      setupStats[s.id].total++; setupStats[s.id].totalPnL += t.derived.pnlFinal || 0;
      if (t.derived.winLoss === 'W') setupStats[s.id].wins++; if (t.derived.winLoss === 'L') setupStats[s.id].losses++;
    });
    const mistakeStats = {};
    closed.forEach(t => {
      if (!t.mistakeIds?.length) return;
      const pnl = t.derived.pnlFinal || 0;
      t.mistakeIds.forEach(mid => {
        const m = state.mistakes.find(m => m.id === mid); if (!m) return;
        if (!mistakeStats[mid]) mistakeStats[mid] = { id: mid, name: m.name, totalOccurrences: 0, losingTrades: 0, profitableTrades: 0, totalLossAmount: 0 };
        mistakeStats[mid].totalOccurrences++;
        if (pnl < 0) { mistakeStats[mid].losingTrades++; mistakeStats[mid].totalLossAmount += pnl; } else mistakeStats[mid].profitableTrades++;
      });
    });
    const ratedTrades = closed.filter(t => t.rating && t.rating > 0);
    return {
      totalPnL, totalTrades: selectedDateTrades.length, closedTrades: closed.length,
      wins: wins.length, losses: losses.length, winRate, avgWin, avgLoss,
      riskRewardRatio: avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : avgWin > 0 ? '∞' : '0.00',
      bestTrade: closed.length > 0 ? closed.reduce((b, t) => (t.derived.pnlFinal||0) > (b.derived.pnlFinal||0) ? t : b, closed[0]) : null,
      assetPieData: Object.entries(pnlByAsset).map(([label, value]) => ({ label, value })),
      tickerPnLData: Object.entries(pnlByTicker).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      tradePnLData: closed.map(t => ({ label: t.ticker, value: t.derived.pnlFinal || 0 })),
      setupData: Object.values(setupStats).map(s => ({ ...s, winRate: s.total > 0 ? ((s.wins / s.total) * 100).toFixed(0) : 0 })),
      mistakeData: Object.values(mistakeStats),
      vsAverage: overallStats.avgDailyPnL !== 0 ? ((totalPnL - overallStats.avgDailyPnL) / Math.abs(overallStats.avgDailyPnL) * 100).toFixed(1) : totalPnL > 0 ? 100 : totalPnL < 0 ? -100 : 0,
      avgDailyPnL: overallStats.avgDailyPnL, tradesVsAvg: overallStats.avgDailyTrades > 0 ? closed.length - overallStats.avgDailyTrades : 0,
      avgDailyTrades: overallStats.avgDailyTrades,
      avgRating: ratedTrades.length > 0 ? ratedTrades.reduce((s, t) => s + t.rating, 0) / ratedTrades.length : 0,
      ratedTradesCount: ratedTrades.length,
    };
  }, [selectedDate, selectedDateTrades, state.setups, state.mistakes, overallStats]);

  useEffect(() => {
    if (selectedDate && state.dailyNotes[selectedDate]) setDailyNote(state.dailyNotes[selectedDate].note || '');
    else setDailyNote('');
  }, [selectedDate, state.dailyNotes]);

  const prevMonth = () => setViewDate(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setViewDate(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });
  const goToToday = () => { const now = new Date(); setViewDate({ year: now.getFullYear(), month: now.getMonth() }); setSelectedDate(todayISO()); };

  const handleSaveNote = () => {
    if (!selectedDate) return;
    setState({ ...state, dailyNotes: { ...state.dailyNotes, [selectedDate]: { date: selectedDate, note: dailyNote, emotionalState: state.dailyNotes[selectedDate]?.emotionalState || null, updatedAt: nowISO() } } });
  };

  const getSetupName = id => id ? (state.setups.find(s => s.id === id)?.name || '-') : '-';
  const getMistakeNames = ids => !ids?.length ? '-' : ids.map(id => state.mistakes.find(m => m.id === id)?.name).filter(Boolean).join(', ') || '-';

  const formatPnLCompact = (pnl) => {
    const abs = Math.abs(pnl), p = pnl >= 0 ? '+' : '-';
    if (abs >= 1000000) return p + (abs / 1000000).toFixed(1) + 'M';
    if (abs >= 10000) return p + (abs / 1000).toFixed(0) + 'K';
    if (abs >= 1000) return p + (abs / 1000).toFixed(1) + 'K';
    return p + abs.toFixed(0);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Calendar</h1>
        <button onClick={goToToday} className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Today</button>
      </div>

      {goalProgress && (
        <div className={`rounded-xl p-4 ${goalProgress.progress >= 100 ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><span className="text-sm font-semibold text-gray-900">{goalProgress.yearLabel} Goal</span>{goalProgress.progress >= 100 && <span>🎯</span>}</div>
            <span className={`text-sm font-bold ${goalProgress.progress >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{goalProgress.progress.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${goalProgress.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(goalProgress.progress, 100)}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>{formatCurrencyShort(goalProgress.yearPnL)} earned</span>
            <span>{formatCurrencyShort(goalProgress.goal.target)} target</span>
          </div>
        </div>
      )}

      <div className={`grid gap-4 md:gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">{Icons.chevronLeft}</button>
              <h2 className="text-lg font-semibold text-gray-900">{calendarData.monthName} {calendarData.year}</h2>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">{Icons.chevronRight}</button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 md:gap-1">
              {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="text-center text-[10px] md:text-xs font-medium text-gray-500 py-1 md:py-2">{d}</div>)}
              {calendarData.days.map((d, i) => {
                let metDailyGoal = null;
                if (goalProgress && d.day && d.trades > 0 && d.date >= goalProgress.yearStartStr && d.date <= goalProgress.yearEndStr) metDailyGoal = d.pnl >= goalProgress.dailyTarget;
                return (
                  <button key={i} onClick={() => d.day && setSelectedDate(d.date)} disabled={!d.day}
                    className={`min-h-[52px] md:min-h-[72px] p-0.5 md:p-1 rounded-lg flex flex-col items-center justify-start transition-all relative overflow-hidden ${!d.day ? 'invisible' : ''} ${d.date === selectedDate ? 'ring-2 ring-blue-500 bg-blue-50' : ''} ${d.date === todayISO() && d.date !== selectedDate ? 'ring-1 ring-gray-300' : ''} ${d.day && d.trades === 0 ? 'bg-gray-50 hover:bg-gray-100' : ''} ${d.day && d.trades > 0 && d.pnl > 0 ? 'bg-emerald-100 hover:bg-emerald-200 border border-emerald-300' : ''} ${d.day && d.trades > 0 && d.pnl < 0 ? 'bg-red-100 hover:bg-red-200 border border-red-300' : ''} ${d.day && d.trades > 0 && d.pnl === 0 ? 'bg-gray-200 hover:bg-gray-300' : ''}`}>
                    {d.day && (
                      <>
                        <span className={`text-[10px] md:text-sm font-semibold ${d.date === todayISO() ? 'text-blue-600' : 'text-gray-700'}`}>{d.day}</span>
                        {d.trades > 0 && (
                          <div className="flex flex-col items-center leading-none w-full">
                            <span className={`text-[9px] md:text-xs font-bold truncate w-full text-center ${d.pnl >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              <span className="md:hidden">{formatPnLCompact(d.pnl)}</span>
                              <span className="hidden md:inline">{formatCurrencyShort(d.pnl)}</span>
                            </span>
                            <span className="text-[7px] md:text-[10px] text-gray-500">{d.wins}W/{d.losses}L</span>
                          </div>
                        )}
                        {d.hasNote && d.trades === 0 && <span className="text-[8px] md:text-[10px]">📝</span>}
                        {metDailyGoal !== null && <span className="text-[6px] md:text-[8px]" title={metDailyGoal ? 'Hit daily goal' : 'Missed daily goal'}>{metDailyGoal ? '✅' : '❌'}</span>}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3 text-xs">
              {[['bg-emerald-100','Profit'],['bg-red-100','Loss'],['bg-gray-50 border border-gray-200','No trades']].map(([cls,lbl]) => (
                <div key={lbl} className="flex items-center gap-1"><div className={`w-3 h-3 rounded ${cls}`} /><span className="text-gray-600">{lbl}</span></div>
              ))}
              {goalProgress && <><div className="flex items-center gap-1"><span className="text-[10px]">✅</span><span className="text-gray-600">Hit daily goal</span></div><div className="flex items-center gap-1"><span className="text-[10px]">❌</span><span className="text-gray-600">Missed daily goal</span></div></>}
            </div>
          </div>

          {selectedDate && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Daily Notes <span className="text-xs font-normal text-gray-500 ml-2">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></h3>
              <textarea value={dailyNote}
                onChange={(e) => { if (isReadOnly) return; setDailyNote(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.max(150, e.target.scrollHeight) + 'px'; }}
                onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.max(150, e.target.scrollHeight) + 'px'; }}
                placeholder={isReadOnly ? "No notes for this date" : "Market conditions, trading plan, lessons learned, emotions..."}
                className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-hidden ${isReadOnly ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                style={{ minHeight: '150px', resize: 'none' }} readOnly={isReadOnly} />
              {!isReadOnly && <button onClick={handleSaveNote} className="mt-2 w-full px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Save Note</button>}
            </div>
          )}
        </div>

        {/* Right Column - Day Details */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedDate ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">{Icons.calendar}</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a date</h3>
              <p className="text-gray-500">Click on a day in the calendar to view details</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h2>

              {/* Daily Goal Progress */}
              {goalProgress && selectedDate >= goalProgress.yearStartStr && selectedDate <= goalProgress.yearEndStr && selectedDateStats?.closedTrades > 0 && (() => {
                const dp = selectedDateStats.totalPnL, dt = goalProgress.dailyTarget;
                const prog = dt > 0 ? Math.min((dp / dt) * 100, 100) : 0;
                const met = dp >= dt;
                return (
                  <div className={`rounded-lg p-3 ${met ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2"><span className="text-sm font-medium text-gray-700">Daily Goal</span><span className="text-sm">{met ? '✅' : '❌'}</span></div>
                      <span className={`text-sm font-bold ${met ? 'text-emerald-600' : dp >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{prog > 0 ? prog.toFixed(0) : 0}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${met ? 'bg-emerald-500' : dp >= 0 ? 'bg-blue-500' : 'bg-red-400'}`} style={{ width: `${Math.max(0, Math.min(prog, 100))}%` }} />
                    </div>
                    <div className="flex justify-between mt-1.5 text-xs text-gray-500">
                      <span><span className={dp >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrencyShort(dp)}</span>{' / '}{formatCurrencyShort(dt)} target</span>
                      <span>{met ? `+${formatCurrencyShort(dp - dt)} over` : `${formatCurrencyShort(dt - dp)} short`}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Stats Cards */}
              {selectedDateStats ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2">
                  {[
                    { label: 'Daily P&L', val: <span className={selectedDateStats.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrencyShort(selectedDateStats.totalPnL)}</span>, sub: <span className={parseFloat(selectedDateStats.vsAverage) >= 0 ? 'text-emerald-600' : 'text-red-600'}>{parseFloat(selectedDateStats.vsAverage) >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(selectedDateStats.vsAverage))}% vs avg</span> },
                    { label: '# Trades', val: <span className="text-gray-900">{selectedDateStats.closedTrades}</span>, sub: <span className="text-gray-500">avg {selectedDateStats.avgDailyTrades.toFixed(1)}/day</span> },
                    { label: 'Win Rate', val: <span className="text-gray-900">{selectedDateStats.winRate}%</span>, sub: <><span className="text-emerald-600">{selectedDateStats.wins}W</span>{' / '}<span className="text-red-600">{selectedDateStats.losses}L</span></> },
                    { label: 'R:R', val: <span className="text-gray-900">{selectedDateStats.riskRewardRatio}:1</span>, sub: <span className="text-gray-500">{formatCurrencyShort(selectedDateStats.avgWin)}/{formatCurrencyShort(selectedDateStats.avgLoss)}</span> },
                    { label: 'Avg Win', val: <span className="text-emerald-600">{formatCurrencyShort(selectedDateStats.avgWin)}</span>, sub: <span className="text-gray-500">{selectedDateStats.wins} win{selectedDateStats.wins !== 1 ? 's' : ''}</span> },
                    { label: 'Avg Loss', val: <span className="text-red-600">-{formatCurrencyShort(selectedDateStats.avgLoss)}</span>, sub: <span className="text-gray-500">{selectedDateStats.losses} loss{selectedDateStats.losses !== 1 ? 'es' : ''}</span> },
                    { label: 'Avg Rating', val: selectedDateStats.ratedTradesCount > 0 ? <div className="flex items-center gap-1"><span className="text-gray-900">{selectedDateStats.avgRating.toFixed(1)}</span><span className="text-amber-400">★</span></div> : <span className="text-gray-400 text-xs italic">No ratings</span>, sub: selectedDateStats.ratedTradesCount > 0 ? <span className="text-gray-500">{selectedDateStats.ratedTradesCount} rated</span> : null },
                  ].map((s, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                      <p className="text-[10px] font-medium text-gray-500 mb-1 truncate">{s.label}</p>
                      <p className="text-lg font-bold truncate">{s.val}</p>
                      {s.sub && <p className="text-[10px] mt-1 truncate">{s.sub}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center text-gray-500">No trades on this date</div>
              )}

              {/* Charts */}
              {selectedDateStats?.closedTrades > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"><h3 className="text-sm font-semibold text-gray-900 mb-3">P&L by Asset</h3><SimplePieChart data={selectedDateStats.assetPieData} /></div>
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"><h3 className="text-sm font-semibold text-gray-900 mb-3">P&L by Ticker</h3><SimpleBarChart data={selectedDateStats.tickerPnLData} /></div>
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"><h3 className="text-sm font-semibold text-gray-900 mb-3">Trade P&L</h3><SimpleBarChart data={selectedDateStats.tradePnLData} /></div>
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"><h3 className="text-sm font-semibold text-gray-900 mb-3">Setups Used</h3><SetupBarChart data={selectedDateStats.setupData} /></div>
                </div>
              )}

              {/* Trades Table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">{selectedDateTrades.length > 0 ? `Trades (${selectedDateTrades.length})` : 'No trades yet'}</h3>
                  {!isReadOnly && (
                    <button onClick={() => { setEditingTrade({ entryDate: selectedDate }); setModalOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium">
                      {Icons.plus}<span>Add Trade</span>
                    </button>
                  )}
                </div>
                {selectedDateTrades.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['#','Ticker','Type','Size','P&L','Rating','Setup','Mistakes','Screenshot'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}
                          {!isReadOnly && <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {[...selectedDateTrades].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')).map((trade, idx) => (
                          <tr key={trade.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm font-medium text-gray-400">{idx + 1}</td>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">{trade.ticker}</td>
                            <td className="px-3 py-2 text-sm"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${trade.positionType === 'long' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{trade.positionType.toUpperCase()}</span></td>
                            <td className="px-3 py-2 text-sm text-gray-600">{trade.positionSize}</td>
                            <td className="px-3 py-2 text-sm">{trade.derived.isOpen ? <span className="text-gray-400">Open</span> : <span className={`font-medium ${(trade.derived.pnlFinal||0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(trade.derived.pnlFinal)}</span>}</td>
                            <td className="px-3 py-2"><StarRating value={trade.rating || 0} readonly size="sm" /></td>
                            <td className="px-3 py-2 text-sm text-gray-600 max-w-[100px] truncate">{getSetupName(trade.setupId)}</td>
                            <td className="px-3 py-2 text-sm text-gray-600 max-w-[100px] truncate">{getMistakeNames(trade.mistakeIds)}</td>
                            <td className="px-3 py-2 text-center">
                              {trade.screenshot ? (
                                <button onClick={() => { setImageModalData({ src: trade.screenshot, title: `${trade.ticker} - ${trade.entryDate}`, trade }); setImageModalOpen(true); }} className="inline-flex items-center justify-center w-10 h-10 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 hover:ring-2 hover:ring-blue-100 transition-all">
                                  <img src={trade.screenshot} alt="Screenshot" className="w-full h-full object-cover" />
                                </button>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            {!isReadOnly && <td className="px-3 py-2 text-right"><button onClick={() => { setEditingTrade(trade); setModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">{Icons.edit}</button></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500"><p className="text-sm">No trades logged for this date yet.</p><p className="text-xs mt-1">Click "Add Trade" above to log your first trade.</p></div>
                )}
              </div>

              {/* Setups Performance */}
              {selectedDateStats?.setupData?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50"><h3 className="text-sm font-semibold text-gray-900">Setups Used on {selectedDate}</h3></div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">By Trade Count</h4><SimplePieChart data={selectedDateStats.setupData.map(s => ({ label: s.name, value: s.total }))} /></div>
                      <div><h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">By P&L</h4><SimpleBarChart data={selectedDateStats.setupData.sort((a, b) => b.totalPnL - a.totalPnL).map(s => ({ label: s.name, value: s.totalPnL }))} /></div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs text-gray-500 uppercase">{['Setup','Trades','W/L','Win Rate','P&L'].map(h => <th key={h} className={`pb-2 ${h === 'P&L' ? 'text-right' : h === 'W/L' || h === 'Win Rate' ? 'text-center' : ''}`}>{h}</th>)}</tr></thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedDateStats.setupData.map(s => (
                            <tr key={s.id}>
                              <td className="py-2 font-medium text-gray-900">{s.name}</td>
                              <td className="py-2 text-center text-gray-600">{s.total}</td>
                              <td className="py-2 text-center"><span className="text-emerald-600">{s.wins}W</span>{' / '}<span className="text-red-600">{s.losses}L</span></td>
                              <td className="py-2 text-center text-gray-600">{s.winRate}%</td>
                              <td className={`py-2 text-right font-semibold ${s.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(s.totalPnL)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Mistakes Analysis */}
              {selectedDateStats?.mistakeData?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900">Mistakes on {selectedDate}</h3><span className="text-xs text-gray-500">Loss amounts only include losing trades</span></div></div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">By Frequency</h4><SimplePieChart data={selectedDateStats.mistakeData.map(m => ({ label: m.name, value: m.totalOccurrences }))} /></div>
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">By Loss Amount</h4>
                        {(() => {
                          const ld = selectedDateStats.mistakeData.filter(m => m.totalLossAmount < 0).sort((a, b) => a.totalLossAmount - b.totalLossAmount).map(m => ({ label: m.name, value: Math.abs(m.totalLossAmount) }));
                          if (!ld.length) return <div className="h-24 flex items-center justify-center text-gray-400 text-sm">No losses from mistakes</div>;
                          const mx = Math.max(...ld.map(d => d.value), 1);
                          return <div className="space-y-2">{ld.map((d, i) => <div key={i} className="flex items-center gap-2"><span className="text-xs text-gray-600 w-20 truncate">{d.label}</span><div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden"><div className="h-full rounded bg-red-500" style={{ width: `${(d.value/mx)*100}%` }} /></div><span className="text-xs font-medium w-16 text-right text-red-600">-{formatCurrencyShort(d.value)}</span></div>)}</div>;
                        })()}
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs text-gray-500 uppercase">{['Mistake','Occurrences','Losing / Profitable','Total Loss'].map(h => <th key={h} className={`pb-2 ${h === 'Total Loss' ? 'text-right' : h !== 'Mistake' ? 'text-center' : ''}`}>{h}</th>)}</tr></thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedDateStats.mistakeData.map(m => (
                            <tr key={m.id}>
                              <td className="py-2 font-medium text-gray-900">{m.name}</td>
                              <td className="py-2 text-center text-gray-600">{m.totalOccurrences}x</td>
                              <td className="py-2 text-center"><span className="text-red-600">{m.losingTrades}</span>{' / '}<span className="text-emerald-600">{m.profitableTrades}</span></td>
                              <td className={`py-2 text-right font-semibold ${m.totalLossAmount < 0 ? 'text-red-600' : 'text-gray-400'}`}>{m.totalLossAmount < 0 ? formatCurrency(m.totalLossAmount) : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <TradeModal isOpen={modalOpen} onClose={() => setModalOpen(false)} trade={editingTrade} state={state} setState={setState} />
      <ImageModal isOpen={imageModalOpen} onClose={() => setImageModalOpen(false)} src={imageModalData.src} title={imageModalData.title} trade={imageModalData.trade} state={state} setState={setState} getSetupName={getSetupName} getMistakeNames={getMistakeNames} />
    </div>
  );
}
