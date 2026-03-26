import { useMemo } from 'react';
import { db, firebase } from '../../firebase';
import { calcTradeDerived, formatCurrency, formatCurrencyShort } from '../../utils/helpers';
import Icons from '../shared/Icons';

export default function ProfilePage({ state, setState, isMobile, userProfile, onSignOut, onUpdate, readOnly }) {
  const allTimeStats = useMemo(() => {
    const closed = state.trades.map(t => ({ ...t, derived: calcTradeDerived(t) })).filter(t => !t.derived.isOpen);
    const wins = closed.filter(t => t.derived.winLoss === 'W');
    const losses = closed.filter(t => t.derived.winLoss === 'L');
    const totalPnL = closed.reduce((s, t) => s + (t.derived.pnlFinal || 0), 0);
    const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(1) : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.derived.pnlFinal, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.derived.pnlFinal, 0) / losses.length) : 0;
    const grossProfit = wins.reduce((s, t) => s + t.derived.pnlFinal, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.derived.pnlFinal, 0));
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : wins.length > 0 ? '∞' : '0';
    const biggestWin = wins.length > 0 ? Math.max(...wins.map(t => t.derived.pnlFinal)) : 0;
    const biggestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.derived.pnlFinal)) : 0;
    const tradingDays = new Set(closed.map(t => t.exitDate || t.entryDate)).size;
    const dailyPnL = {};
    closed.forEach(t => { const d = t.exitDate || t.entryDate; dailyPnL[d] = (dailyPnL[d] || 0) + (t.derived.pnlFinal || 0); });
    const days = Object.entries(dailyPnL);
    const bestDay = days.length > 0 ? days.reduce((b, c) => c[1] > b[1] ? c : b, days[0]) : null;
    const worstDay = days.length > 0 ? days.reduce((w, c) => c[1] < w[1] ? c : w, days[0]) : null;
    return {
      totalTrades: closed.length, wins: wins.length, losses: losses.length, totalPnL, winRate, avgWin, avgLoss, profitFactor,
      biggestWin, biggestLoss, tradingDays, bestDay, worstDay,
      avgDailyPnL: tradingDays > 0 ? totalPnL / tradingDays : 0,
      greenDays: days.filter(([, p]) => p > 0).length,
      redDays: days.filter(([, p]) => p < 0).length,
    };
  }, [state.trades]);

  const challengeStats = useMemo(() => {
    const challenges = state.challenges || [];
    const completed = [], failed = [];
    challenges.forEach(c => {
      const trades = state.trades.map(t => ({ ...t, derived: calcTradeDerived(t) })).filter(t => !t.derived.isOpen);
      const ct = trades.filter(t => (t.exitDate || t.entryDate) >= c.startDate);
      let isComplete = false, isFailed = false;
      const now = new Date();
      switch (c.condition) {
        case 'by_date': { const pnl = ct.filter(t => (t.exitDate || t.entryDate) <= c.endDate).reduce((s, t) => s + (t.derived.pnlFinal || 0), 0); isComplete = pnl >= c.targetValue; isFailed = !isComplete && now > new Date(c.endDate + 'T23:59:59'); break; }
        case 'single_day': { const dp = {}; ct.forEach(t => { const d = t.exitDate || t.entryDate; dp[d] = (dp[d] || 0) + (t.derived.pnlFinal || 0); }); isComplete = Object.values(dp).length > 0 && Math.max(...Object.values(dp)) >= c.targetValue; break; }
        case 'single_trade': { isComplete = ct.length > 0 && Math.max(...ct.map(t => t.derived.pnlFinal || 0)) >= c.targetValue; break; }
        case 'in_trades': { const lt = ct.slice(0, c.tradeLimit); const pnl = lt.reduce((s, t) => s + (t.derived.pnlFinal || 0), 0); isComplete = pnl >= c.targetValue && lt.length <= c.tradeLimit; isFailed = ct.length >= c.tradeLimit && pnl < c.targetValue; break; }
        case 'profitable_days': case 'streak_days': { const dp = {}; ct.forEach(t => { const d = t.exitDate || t.entryDate; dp[d] = (dp[d] || 0) + (t.derived.pnlFinal || 0); }); let max = 0, cur = 0; Object.values(dp).sort().forEach(p => { if (p > (c.condition === 'profitable_days' ? 0 : c.targetValue)) { cur++; max = Math.max(max, cur); } else cur = 0; }); isComplete = max >= c.streakDays; break; }
        case 'no_mistakes': { isComplete = ct.filter(t => !t.mistakeIds?.length).length >= c.tradeLimit; break; }
      }
      if (isComplete) completed.push(c); else if (isFailed) failed.push(c);
    });
    const successRate = (completed.length + failed.length) > 0 ? ((completed.length / (completed.length + failed.length)) * 100).toFixed(0) : 0;
    return { total: challenges.length, completed: completed.length, failed: failed.length, active: challenges.length - completed.length - failed.length, successRate, completedList: completed, failedList: failed };
  }, [state.challenges, state.trades]);

  const deleteChallenge = (id) => setState({ ...state, challenges: state.challenges.filter(c => c.id !== id) });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-500 mt-1">{readOnly ? 'Viewing trader statistics' : 'Your trading stats and challenge history'}</p>
      </div>

      {userProfile && !readOnly && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group">
                {userProfile.photoURL ? (
                  <img src={userProfile.photoURL} alt={userProfile.displayName} className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">
                    {userProfile.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const compress = (f) => new Promise(res => { const r = new FileReader(); r.onload = ev => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); const ratio = Math.min(200 / img.width, 200 / img.height); c.width = img.width * ratio; c.height = img.height * ratio; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.8)); }; img.src = ev.target.result; }; r.readAsDataURL(f); });
                    try { const url = await compress(file); db.collection('users').doc(userProfile.uid).update({ photoURL: url }); if (onUpdate) onUpdate(); } catch (err) { alert('Failed to upload photo. Please try again.'); }
                  }} />
                </label>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{userProfile.displayName}</h2>
                <p className="text-gray-500">{userProfile.email}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-medium ${userProfile.role === 'mentor' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {userProfile.role === 'mentor' ? '👨‍🏫 Mentor' : '📈 Trader'}
                </span>
                {userProfile.mentorName && (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-gray-500">Mentored by: <span className="font-medium">{userProfile.mentorName}</span></p>
                    <button onClick={async () => {
                      if (!confirm('Are you sure you want to disconnect from your mentor?')) return;
                      try {
                        
                        await db.collection('users').doc(userProfile.uid).update({ mentorId: firebase.firestore.FieldValue.delete(), mentorName: firebase.firestore.FieldValue.delete() });
                        if (userProfile.mentorId) await db.collection('mentorships').doc(userProfile.mentorId).collection('students').doc(userProfile.uid).delete();
                        if (onUpdate) onUpdate();
                      } catch (err) { alert('Failed to remove mentor. Please try again.'); }
                    }} className="text-xs text-red-500 hover:text-red-700 hover:underline">Remove</button>
                  </div>
                )}
              </div>
            </div>
            {onSignOut && (
              <button onClick={onSignOut} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                Sign Out
              </button>
            )}
          </div>
        </div>
      )}

      {/* All-Time Stats */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><h2 className="font-semibold text-gray-900">All-Time Statistics</h2></div>
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            {[
              ['Total P&L', formatCurrency(allTimeStats.totalPnL), allTimeStats.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'],
              ['Trades', allTimeStats.totalTrades, 'text-gray-900'],
              ['Win Rate', `${allTimeStats.winRate}%`, 'text-gray-900'],
              ['Profit Factor', allTimeStats.profitFactor, 'text-gray-900'],
            ].map(([lbl, val, cls]) => (
              <div key={lbl} className="bg-gray-50 rounded-lg p-3 md:p-4 text-center">
                <p className="text-[10px] md:text-xs text-gray-500 uppercase mb-1">{lbl}</p>
                <p className={`text-lg sm:text-xl md:text-2xl font-bold truncate ${cls}`}>{val}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
            {[
              ['W / L', <><span className="text-emerald-600">{allTimeStats.wins}</span>{' / '}<span className="text-red-600">{allTimeStats.losses}</span></>],
              ['Avg Win', <span className="text-emerald-600">{formatCurrencyShort(allTimeStats.avgWin)}</span>],
              ['Avg Loss', <span className="text-red-600">-{formatCurrencyShort(allTimeStats.avgLoss)}</span>],
              ['Best Win', <span className="text-emerald-600">{formatCurrencyShort(allTimeStats.biggestWin)}</span>],
              ['Worst Loss', <span className="text-red-600">{formatCurrencyShort(allTimeStats.biggestLoss)}</span>],
              ['Days', <span className="text-gray-900">{allTimeStats.tradingDays}</span>],
              ['G / R Days', <><span className="text-emerald-600">{allTimeStats.greenDays}</span>{' / '}<span className="text-red-600">{allTimeStats.redDays}</span></>],
              ['Avg Daily', <span className={allTimeStats.avgDailyPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrencyShort(allTimeStats.avgDailyPnL)}</span>],
              ...(allTimeStats.bestDay ? [['Best Day', <><span className="text-emerald-600">{formatCurrencyShort(allTimeStats.bestDay[1])}</span><p className="text-[9px] md:text-[10px] text-gray-400 truncate">{allTimeStats.bestDay[0]}</p></>]] : []),
              ...(allTimeStats.worstDay ? [['Worst Day', <><span className="text-red-600">{formatCurrencyShort(allTimeStats.worstDay[1])}</span><p className="text-[9px] md:text-[10px] text-gray-400 truncate">{allTimeStats.worstDay[0]}</p></>]] : []),
            ].map(([lbl, val]) => (
              <div key={lbl} className="border border-gray-200 rounded-lg p-2 md:p-3">
                <p className="text-[9px] md:text-[10px] text-gray-500 uppercase">{lbl}</p>
                <p className="text-base md:text-lg font-semibold">{val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Challenge History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><h2 className="font-semibold text-gray-900">Challenge History</h2></div>
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            {[
              ['Total', challengeStats.total, 'bg-blue-50', 'text-blue-600', 'text-blue-900'],
              ['Completed', challengeStats.completed, 'bg-emerald-50', 'text-emerald-600', 'text-emerald-700'],
              ['Failed', challengeStats.failed, 'bg-red-50', 'text-red-600', 'text-red-700'],
              ['Success', `${challengeStats.successRate}%`, 'bg-gray-50', 'text-gray-600', 'text-gray-900'],
            ].map(([lbl, val, bg, labelCls, valCls]) => (
              <div key={lbl} className={`${bg} rounded-lg p-3 md:p-4 text-center`}>
                <p className={`text-[10px] md:text-xs ${labelCls} uppercase mb-1`}>{lbl}</p>
                <p className={`text-lg sm:text-xl md:text-2xl font-bold ${valCls}`}>{val}</p>
              </div>
            ))}
          </div>
          {challengeStats.completedList.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-emerald-700 mb-2">✅ Completed Challenges</h3>
              <div className="space-y-2">
                {challengeStats.completedList.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-emerald-50 rounded-lg p-3">
                    <div><p className="text-sm font-medium text-emerald-800">{c.name}</p><p className="text-xs text-emerald-600">Started: {c.startDate}</p></div>
                    <button onClick={() => deleteChallenge(c.id)} className="p-1 text-emerald-400 hover:text-red-600">{Icons.trash}</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {challengeStats.failedList.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-red-700 mb-2">❌ Failed Challenges</h3>
              <div className="space-y-2">
                {challengeStats.failedList.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-red-50 rounded-lg p-3">
                    <div><p className="text-sm font-medium text-red-800">{c.name}</p><p className="text-xs text-red-600">Started: {c.startDate}</p></div>
                    <button onClick={() => deleteChallenge(c.id)} className="p-1 text-red-400 hover:text-red-600">{Icons.trash}</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {challengeStats.total === 0 && (
            <div className="text-center py-8 text-gray-500"><p>No challenges yet. Create one from the Goals page!</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
