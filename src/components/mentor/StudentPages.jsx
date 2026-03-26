import { useState } from 'react';
import { ASSIGNMENT_CATEGORIES, HOMEWORK_CHALLENGE_TYPES } from '../../utils/constants';
import { todayISO, calcTradeDerived, formatCurrency, formatCurrencyShort, formatWeekRange } from '../../utils/helpers';
import Icons from '../shared/Icons';

// =============================================================================
// CHECKINS PAGE (Student view)
// =============================================================================
export function CheckinsPage({ checkins, userProfile, isMobile }) {
  const [expandedCheckin, setExpandedCheckin] = useState(null);
  const latestCheckin = checkins[0];
  const olderCheckins = checkins.slice(1);

  if (!userProfile?.mentorId) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📅</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Check-ins</h3>
        <p className="text-gray-500">Connect with a mentor to receive weekly check-ins and feedback.</p>
      </div>
    );
  }

  const CheckinStats = ({ ci }) => {
    const s = ci.stats || {};
    if (!s.totalTrades) return null;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[['Week P&L', formatCurrency(s.totalPnL || 0), (s.totalPnL||0)>=0?'text-emerald-600':'text-red-600'], ['# Trades', s.totalTrades, 'text-gray-900'], ['Win Rate', `${(s.winRate||0).toFixed(0)}%`, 'text-gray-900'], ['R:R', `${s.riskRewardRatio||'0.00'}:1`, 'text-gray-900']].map(([l,v,c]) => (
            <div key={l} className="bg-gray-50 rounded-lg p-3">
              <p className="text-[10px] font-medium text-gray-500 mb-1">{l}</p>
              <p className={`text-lg font-bold ${c}`}>{v}</p>
              {l === '# Trades' && <p className="text-[10px] text-gray-500">{s.tradingDays||0} days</p>}
              {l === 'Win Rate' && <p className="text-[10px] text-gray-500"><span className="text-emerald-600">{s.wins||0}W</span>{' / '}<span className="text-red-600">{s.losses||0}L</span></p>}
            </div>
          ))}
        </div>
        {s.dailyBreakdown?.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-700 mb-2">📅 Daily Breakdown</p>
            <div className="space-y-1">
              {s.dailyBreakdown.map(d => (
                <div key={d.date} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{new Date(d.date+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span>
                  <div className="flex items-center gap-3"><span className="text-gray-500">{d.trades} trades</span><span className="text-gray-500">{d.winRate}% WR</span><span className={`font-medium ${d.pnl>=0?'text-emerald-600':'text-red-600'}`}>{formatCurrency(d.pnl)}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
        {s.setupData?.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-700 mb-2">🎯 Setups Used</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="text-left text-xs text-gray-500">{['Setup','Trades','W/L','WR','P&L'].map(h=><th key={h} className="pb-1">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-200">{s.setupData.map(setup=><tr key={setup.id}><td className="py-1 font-medium text-gray-900">{setup.name}</td><td className="py-1 text-center text-gray-600">{setup.total}</td><td className="py-1 text-center"><span className="text-emerald-600">{setup.wins}</span>/<span className="text-red-600">{setup.losses}</span></td><td className="py-1 text-center text-gray-600">{setup.winRate}%</td><td className={`py-1 text-right font-medium ${setup.totalPnL>=0?'text-emerald-600':'text-red-600'}`}>{formatCurrency(setup.totalPnL)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
        {s.mistakeData?.length > 0 && (
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-xs font-medium text-red-700 mb-2">⚠️ Mistakes ({s.totalMistakeOccurrences||0} occurrences, {formatCurrency(s.totalMistakeLoss||0)} cost)</p>
            <table className="w-full text-sm"><thead><tr className="text-left text-xs text-red-600">{['Mistake','Count','Loss/Win','Cost'].map(h=><th key={h} className="pb-1">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-red-100">{s.mistakeData.map(m=><tr key={m.id}><td className="py-1 font-medium text-gray-900">{m.name}</td><td className="py-1 text-center text-gray-600">{m.totalOccurrences}</td><td className="py-1 text-center"><span className="text-red-600">{m.losingTrades}</span>/<span className="text-emerald-600">{m.profitableTrades}</span></td><td className="py-1 text-right font-medium text-red-600">{formatCurrency(m.totalLossAmount)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Weekly Check-ins</h1><p className="text-sm text-gray-500 mt-1">From your mentor: {userProfile.mentorName}</p></div>
      {latestCheckin?.focusForNextWeek && (
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-1"><span className="text-xl">🔥</span><h2 className="font-semibold">This Week's Focus</h2></div>
          <p className="text-orange-100">{latestCheckin.focusForNextWeek}</p>
        </div>
      )}
      {latestCheckin ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50"><h2 className="font-semibold text-gray-900">Latest: Week of {formatWeekRange(latestCheckin.weekStart, latestCheckin.weekEnd)}</h2></div>
          <div className="p-6 space-y-4">
            <CheckinStats ci={latestCheckin} />
            {latestCheckin.summary && <div><h3 className="text-sm font-medium text-gray-700 mb-1">Summary</h3><p className="text-gray-600 whitespace-pre-wrap">{latestCheckin.summary}</p></div>}
            {latestCheckin.whatWentWell && <div className="bg-emerald-50 rounded-lg p-4"><h3 className="text-sm font-medium text-emerald-700 mb-1">💪 What Went Well</h3><p className="text-emerald-800 whitespace-pre-wrap">{latestCheckin.whatWentWell}</p></div>}
            {latestCheckin.areasToImprove && <div className="bg-amber-50 rounded-lg p-4"><h3 className="text-sm font-medium text-amber-700 mb-1">🎯 Areas to Improve</h3><p className="text-amber-800 whitespace-pre-wrap">{latestCheckin.areasToImprove}</p></div>}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📅</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No check-ins yet</h3>
          <p className="text-gray-500">Your mentor will post weekly check-ins to track your progress.</p>
        </div>
      )}
      {olderCheckins.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200"><h2 className="font-semibold text-gray-900">Previous Check-ins ({olderCheckins.length})</h2></div>
          <div className="divide-y divide-gray-100">
            {olderCheckins.map(ci => {
              const isExp = expandedCheckin === ci.id, s = ci.stats || {};
              return (
                <div key={ci.id} className="p-4">
                  <button onClick={() => setExpandedCheckin(isExp ? null : ci.id)} className="w-full flex items-center justify-between text-left">
                    <div>
                      <h3 className="font-medium text-gray-900">Week of {formatWeekRange(ci.weekStart, ci.weekEnd)}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span>{s.totalTrades||0} trades</span><span>|</span><span>{(s.winRate||0).toFixed(0)}% WR</span><span>|</span>
                        <span className={(s.totalPnL||0)>=0?'text-emerald-600':'text-red-600'}>{formatCurrency(s.totalPnL||0)}</span>
                      </div>
                    </div>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExp?'rotate-180':''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                  </button>
                  {isExp && (
                    <div className="mt-4 space-y-3 pl-4 border-l-2 border-gray-200">
                      {ci.summary && <div><h4 className="text-xs font-medium text-gray-500 mb-1">Summary</h4><p className="text-sm text-gray-600">{ci.summary}</p></div>}
                      {ci.whatWentWell && <div><h4 className="text-xs font-medium text-emerald-600 mb-1">💪 What Went Well</h4><p className="text-sm text-gray-600">{ci.whatWentWell}</p></div>}
                      {ci.areasToImprove && <div><h4 className="text-xs font-medium text-amber-600 mb-1">🎯 Areas to Improve</h4><p className="text-sm text-gray-600">{ci.areasToImprove}</p></div>}
                      {ci.focusForNextWeek && <div><h4 className="text-xs font-medium text-orange-600 mb-1">🔥 Focus</h4><p className="text-sm text-gray-600">{ci.focusForNextWeek}</p></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SESSIONS PAGE (Student view)
// =============================================================================
export function SessionsPage({ sessions, userProfile, isMobile }) {
  if (!userProfile?.mentorId) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📅</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Sessions</h3>
        <p className="text-gray-500">Connect with a mentor to schedule review sessions.</p>
      </div>
    );
  }

  const fmtDT = (ts) => { if (!ts?.toDate) return 'Unknown'; return ts.toDate().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'}); };
  const badge = (status) => { const m={requested:['bg-yellow-100 text-yellow-700','Requested'],confirmed:['bg-blue-100 text-blue-700','Confirmed'],completed:['bg-green-100 text-green-700','Completed'],cancelled:['bg-gray-100 text-gray-500','Cancelled']}; const [cls,lbl]=m[status]||[]; return cls ? <span className={`px-2 py-1 text-xs font-medium ${cls} rounded`}>{lbl}</span> : null; };

  const now = new Date();
  const upcoming = sessions.filter(s => s.dateTime?.toDate && s.dateTime.toDate() >= now && s.status !== 'cancelled' && s.status !== 'completed').sort((a,b) => a.dateTime.toDate()-b.dateTime.toDate());
  const past = sessions.filter(s => s.dateTime?.toDate && (s.dateTime.toDate() < now || ['completed','cancelled'].includes(s.status))).sort((a,b) => b.dateTime.toDate()-a.dateTime.toDate());

  const SessionCard = ({ s, isPast }) => (
    <div className="px-6 py-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1"><span className={`font-medium ${s.status==='cancelled'?'text-gray-400 line-through':'text-gray-900'}`}>{fmtDT(s.dateTime)}</span>{badge(s.status)}</div>
          <p className={s.status==='cancelled'?'text-gray-400':'text-gray-600'}>{s.topic}</p>
          {!isPast && <p className="text-sm text-gray-500 mt-1">Duration: {s.duration} minutes</p>}
          {s.videoLink && !isPast && <a href={s.videoLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">🔗 Join Video Call</a>}
          {s.notes && <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-100"><p className="text-sm font-medium text-green-800 mb-1">📝 Session Notes:</p><p className="text-sm text-green-700">{s.notes}</p></div>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Sessions</h1><p className="text-sm text-gray-500 mt-1">Review sessions with your mentor: {userProfile.mentorName}</p></div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white"><h2 className="font-semibold text-gray-900 flex items-center gap-2"><span>📆</span><span>Upcoming Sessions</span>{upcoming.length>0&&<span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">{upcoming.length}</span>}</h2></div>
        {upcoming.length === 0 ? <div className="px-6 py-8 text-center text-gray-500"><p>No upcoming sessions scheduled</p><p className="text-sm mt-1">Your mentor will schedule sessions when needed</p></div> : <div className="divide-y divide-gray-100">{upcoming.map(s=><SessionCard key={s.id} s={s} isPast={false}/>)}</div>}
      </div>
      {past.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200"><h2 className="font-semibold text-gray-900 flex items-center gap-2"><span>📋</span><span>Past Sessions</span></h2></div>
          <div className="divide-y divide-gray-100">{past.map(s=><SessionCard key={s.id} s={s} isPast={true}/>)}</div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ASSIGNMENTS PAGE (Student view)
// =============================================================================
export function AssignmentsPage({ assignments, journalState, userProfile, isMobile, onUpdateAssignment }) {
  const [viewingAssignment, setViewingAssignment] = useState(null);
  const [notesText, setNotesText] = useState('');
  const [filter, setFilter] = useState('active');

  const calcProgress = (challenge, trades) => {
    if (!challenge || !trades) return { current: 0, progress: 0, status: 'active' };
    const ct = trades.filter(t => t.entryDate >= challenge.startDate && t.entryDate <= (challenge.endDate || todayISO())).map(t => ({ ...t, derived: calcTradeDerived(t) }));
    const closed = ct.filter(t => !t.derived.isOpen);
    switch (challenge.type) {
      case 'profit': { const pnl = closed.reduce((s,t) => s+(t.derived.pnlFinal||0), 0); return { current: pnl, progress: Math.min(100,(pnl/challenge.target)*100), status: pnl>=challenge.target?'completed':'active' }; }
      case 'winrate': { const wins = closed.filter(t => t.derived.winLoss==='W'); const wr = closed.length>0?(wins.length/closed.length)*100:0; const tr = challenge.tradesRequired||20; return { current: wr, tradesCompleted: closed.length, tradesRequired: tr, progress: Math.min(100,(closed.length/tr)*100), status: closed.length>=tr?(wr>=challenge.target?'completed':'failed'):'active' }; }
      case 'trades': return { current: ct.length, progress: Math.min(100,(ct.length/challenge.target)*100), status: ct.length>=challenge.target?'completed':'active' };
      case 'streak': { const dp={}; closed.forEach(t=>{const d=t.exitDate||t.entryDate;dp[d]=(dp[d]||0)+(t.derived.pnlFinal||0);}); let max=0,cur=0; Object.keys(dp).sort().forEach(d=>{if(dp[d]>0){cur++;max=Math.max(max,cur);}else cur=0;}); return { current: max, progress: Math.min(100,(max/challenge.target)*100), status: max>=challenge.target?'completed':'active' }; }
      case 'max_loss': { const losses=closed.filter(t=>(t.derived.pnlFinal||0)<0); const ml=losses.length>0?Math.min(...losses.map(t=>t.derived.pnlFinal)):0; const ok=Math.abs(ml)<=challenge.target; return { current: ml, progress: ok?100:0, status: ok?'active':'failed' }; }
      default: return { current: 0, progress: 0, status: 'active' };
    }
  };

  const active = assignments.filter(a => ['assigned','in_progress'].includes(a.status));
  const completed = assignments.filter(a => ['completed','reviewed'].includes(a.status));
  const filtered = filter === 'active' ? active : completed;

  const getDaysUntilDue = (due) => { if (!due) return null; return Math.ceil((new Date(due)-new Date(todayISO()))/(1000*60*60*24)); };

  if (!userProfile?.mentorId) {
    return (<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center"><div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📋</div><h3 className="text-lg font-medium text-gray-900 mb-2">No Assignments</h3><p className="text-gray-500">Connect with a mentor to receive assignments and guidance.</p></div>);
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">My Assignments</h1><p className="text-sm text-gray-500 mt-1">From your mentor: {userProfile.mentorName}</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[['Active',active.length,'text-blue-600'],['Completed',completed.length,'text-green-600'],['With Challenges',assignments.filter(a=>a.hasChallenge).length,'text-purple-600'],['Due Soon',active.filter(a=>{const d=getDaysUntilDue(a.dueDate);return d!==null&&d<=3&&d>=0;}).length,'text-orange-600']].map(([l,v,c]) => (
          <div key={l} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"><p className="text-sm text-gray-500">{l}</p><p className={`text-2xl font-bold ${c}`}>{v}</p></div>
        ))}
      </div>
      <div className="flex gap-2">
        {[['active',`Active (${active.length})`,'bg-blue-100 text-blue-700'],['completed',`Completed (${completed.length})`,'bg-green-100 text-green-700']].map(([f,lbl,cls]) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter===f?cls:'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{lbl}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">{filter==='active'?'📋':'✅'}</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{filter==='active'?'No active assignments':'No completed assignments yet'}</h3>
          <p className="text-gray-500">{filter==='active'?'Your mentor will assign tasks to help your trading development.':'Complete assignments to see them here.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(a => {
            const cat = ASSIGNMENT_CATEGORIES[a.category] || ASSIGNMENT_CATEGORIES.other;
            const daysUntil = getDaysUntilDue(a.dueDate);
            const cp = a.hasChallenge && a.challenge ? calcProgress(a.challenge, journalState?.trades||[]) : null;
            return (
              <div key={a.id} className={`bg-white rounded-xl border shadow-sm p-4 cursor-pointer transition-colors ${a.status==='reviewed'?'border-purple-200 bg-purple-50/30':'border-gray-200 hover:border-gray-300'}`}
                onClick={() => { setViewingAssignment(a); setNotesText(a.studentNotes||''); if(a.status==='assigned') onUpdateAssignment?.(a.id,{status:'in_progress'}); }}>
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${cat.bgColor}`}>{cat.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{a.title}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${a.status==='assigned'?'bg-gray-100 text-gray-600':a.status==='in_progress'?'bg-blue-100 text-blue-700':a.status==='completed'?'bg-green-100 text-green-700':'bg-purple-100 text-purple-700'}`}>
                        {a.status==='in_progress'?'In Progress':a.status==='reviewed'?'✓ Reviewed':a.status.charAt(0).toUpperCase()+a.status.slice(1)}
                      </span>
                    </div>
                    {a.dueDate && filter==='active' && <p className={`text-sm ${daysUntil!==null&&daysUntil<0?'text-red-600 font-medium':daysUntil!==null&&daysUntil<=3?'text-orange-600':'text-gray-500'}`}>{daysUntil!==null&&daysUntil<0?`⚠️ ${Math.abs(daysUntil)} days overdue`:daysUntil===0?'⏰ Due today!':`Due: ${a.dueDate} (${daysUntil} day${daysUntil!==1?'s':''} left)`}</p>}
                    {cp && <div className="mt-3"><div className="flex items-center justify-between text-sm mb-1"><span className="text-gray-600">{HOMEWORK_CHALLENGE_TYPES[a.challenge.type]?.label}</span><span className={`font-medium ${cp.status==='completed'?'text-green-600':cp.status==='failed'?'text-red-600':'text-blue-600'}`}>{Math.round(cp.progress)}%</span></div><div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full transition-all ${cp.status==='completed'?'bg-green-500':cp.status==='failed'?'bg-red-500':'bg-blue-500'}`} style={{width:`${Math.min(100,cp.progress)}%`}}/></div></div>}
                    {a.mentorReview && <div className="mt-2 flex items-center gap-1 text-sm text-purple-600"><span>💬</span><span>Mentor reviewed this</span></div>}
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewingAssignment && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setViewingAssignment(null)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Assignment Details</h2>
                <button onClick={() => setViewingAssignment(null)} className="p-2 hover:bg-gray-100 rounded-lg">{Icons.x}</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${ASSIGNMENT_CATEGORIES[viewingAssignment.category]?.bgColor||'bg-gray-100'}`}>{ASSIGNMENT_CATEGORIES[viewingAssignment.category]?.icon||'📝'}</div>
                  <div><h3 className="text-xl font-semibold text-gray-900">{viewingAssignment.title}</h3><p className="text-sm text-gray-500">From {viewingAssignment.mentorName}</p></div>
                </div>
                {viewingAssignment.description && <div className="bg-gray-50 rounded-lg p-4"><p className="text-gray-700 whitespace-pre-wrap">{viewingAssignment.description}</p></div>}
                {viewingAssignment.hasChallenge && viewingAssignment.challenge && (() => {
                  const cp = calcProgress(viewingAssignment.challenge, journalState?.trades||[]);
                  return (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-blue-700 mb-2">📊 Challenge Progress</h4>
                      <p className="text-sm text-blue-600 mb-2">{HOMEWORK_CHALLENGE_TYPES[viewingAssignment.challenge.type]?.label}: {viewingAssignment.challenge.type==='winrate'?` ${viewingAssignment.challenge.target}% over ${viewingAssignment.challenge.tradesRequired} trades`:` ${viewingAssignment.challenge.target} ${HOMEWORK_CHALLENGE_TYPES[viewingAssignment.challenge.type]?.unit||''}`}</p>
                      <div className="h-3 bg-blue-200 rounded-full overflow-hidden mb-2"><div className={`h-full ${cp.status==='completed'?'bg-green-500':cp.status==='failed'?'bg-red-500':'bg-blue-500'}`} style={{width:`${Math.min(100,cp.progress)}%`}}/></div>
                      <p className="text-sm font-medium text-blue-900">Current: {viewingAssignment.challenge.type==='profit'||viewingAssignment.challenge.type==='max_loss'?formatCurrency(cp.current):viewingAssignment.challenge.type==='winrate'?`${cp.current?.toFixed(1)}% (${cp.tradesCompleted}/${cp.tradesRequired} trades)`:cp.current} <span className={cp.status==='completed'?'text-green-600':cp.status==='failed'?'text-red-600':'text-blue-600'}>({cp.status==='completed'?'✓ Complete!':cp.status==='failed'?'✗ Not met':`${Math.round(cp.progress)}%`})</span></p>
                    </div>
                  );
                })()}
                {viewingAssignment.status !== 'reviewed' && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">My Notes & Progress</h4>
                    <textarea value={notesText} onChange={e => setNotesText(e.target.value)} placeholder="Add your notes, reflections, or questions..." rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    <button onClick={() => onUpdateAssignment?.(viewingAssignment.id,{studentNotes:notesText})} className="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">Save Notes</button>
                  </div>
                )}
                {viewingAssignment.status==='reviewed' && viewingAssignment.studentNotes && <div className="bg-gray-50 rounded-lg p-4"><h4 className="text-sm font-medium text-gray-700 mb-1">My Notes</h4><p className="text-gray-600 whitespace-pre-wrap">{viewingAssignment.studentNotes}</p></div>}
                {viewingAssignment.mentorReview && <div className="bg-purple-50 rounded-lg p-4"><h4 className="text-sm font-medium text-purple-700 mb-1">💬 Mentor's Review</h4><p className="text-purple-900 whitespace-pre-wrap">{viewingAssignment.mentorReview}</p></div>}
                {['assigned','in_progress'].includes(viewingAssignment.status) && (
                  <div className="border-t border-gray-200 pt-4">
                    <button onClick={() => { onUpdateAssignment?.(viewingAssignment.id,{status:'completed'}); setViewingAssignment(null); }} className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"><span>✓</span><span>Mark as Complete</span></button>
                    <p className="text-xs text-gray-500 text-center mt-2">Your mentor will review and provide feedback</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
