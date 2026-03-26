import { firebase } from '../../firebase';
import { useState, useMemo } from 'react';
import { ASSIGNMENT_CATEGORIES, HOMEWORK_CHALLENGE_TYPES } from '../../utils/constants';
import { todayISO, formatCurrency, formatCurrencyShort, formatWeekRange, getWeekBounds, getRecentWeeks, calculateWeekStats } from '../../utils/helpers';
import { SimplePieChart, SimpleBarChart, SetupBarChart } from '../shared/Charts';
import Icons from '../shared/Icons';

// =============================================================================
// MENTOR ASSIGNMENTS TAB
// =============================================================================
export function MentorAssignmentsTab({ assignments, studentData, selectedStudent, onCreateAssignment, onUpdateAssignment, onDeleteAssignment, calculateChallengeProgress, isMobile }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [viewingAssignment, setViewingAssignment] = useState(null);
  const [reviewText, setReviewText] = useState('');
  const [formData, setFormData] = useState({ title: '', description: '', category: 'practice', dueDate: '', hasChallenge: false, challengeType: 'profit', challengeTarget: '', challengeTradesRequired: '20', challengeEndDate: '' });

  const resetForm = () => setFormData({ title: '', description: '', category: 'practice', dueDate: '', hasChallenge: false, challengeType: 'profit', challengeTarget: '', challengeTradesRequired: '20', challengeEndDate: '' });

  const handleCreate = async () => {
    if (!formData.title.trim()) return;
    const data = { title: formData.title.trim(), description: formData.description.trim(), category: formData.category, dueDate: formData.dueDate || null, hasChallenge: formData.hasChallenge, challenge: formData.hasChallenge ? { type: formData.challengeType, target: parseFloat(formData.challengeTarget)||0, tradesRequired: formData.challengeType==='winrate'?parseInt(formData.challengeTradesRequired)||20:null, startDate: todayISO(), endDate: formData.challengeEndDate||null, status: 'active' } : null };
    const ok = await onCreateAssignment(data);
    if (ok) { setModalOpen(false); resetForm(); }
  };

  const handleAddReview = async (id) => {
    if (!reviewText.trim()) return;
    await onUpdateAssignment(id, { mentorReview: reviewText.trim(), status: 'reviewed' });
    setReviewText(''); setViewingAssignment(null);
  };

  const filtered = assignments.filter(a => { if (filter==='active') return ['assigned','in_progress'].includes(a.status); if (filter==='completed') return ['completed','reviewed'].includes(a.status); return true; });
  const getDays = (due) => { if (!due) return null; return Math.ceil((new Date(due)-new Date(todayISO()))/(1000*60*60*24)); };

  const statusCls = (s) => ({ assigned: 'bg-gray-100 text-gray-600', in_progress: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', reviewed: 'bg-purple-100 text-purple-700' }[s] || '');
  const statusLabel = (s) => s==='in_progress'?'In Progress':s.charAt(0).toUpperCase()+s.slice(1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Assignments</h1><p className="text-sm text-gray-500 mt-1">{assignments.length} assignment{assignments.length!==1?'s':''} for {selectedStudent?.displayName}</p></div>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">{Icons.plus}<span>New Assignment</span></button>
      </div>
      <div className="flex gap-2">
        {['all','active','completed'].map(f => <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${filter===f?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>)}
      </div>
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments yet</h3>
          <p className="text-gray-500 mb-4">Create an assignment to help guide your student's learning</p>
          <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{Icons.plus}<span>Create First Assignment</span></button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(a => {
            const cat = ASSIGNMENT_CATEGORIES[a.category] || ASSIGNMENT_CATEGORIES.other;
            const days = getDays(a.dueDate);
            const cp = a.hasChallenge && a.challenge ? calculateChallengeProgress(a.challenge, studentData?.trades||[]) : null;
            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:border-gray-300 transition-colors cursor-pointer" onClick={() => setViewingAssignment(a)}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${cat.bgColor}`}>{cat.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1"><h3 className="font-medium text-gray-900 truncate">{a.title}</h3><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusCls(a.status)}`}>{statusLabel(a.status)}</span></div>
                    {a.dueDate && <p className={`text-sm ${days!==null&&days<0?'text-red-600':days!==null&&days<=3?'text-orange-600':'text-gray-500'}`}>Due: {a.dueDate}{days!==null&&<span className="ml-1">({days<0?`${Math.abs(days)} days overdue`:days===0?'Today':`${days} day${days!==1?'s':''} left`})</span>}</p>}
                    {cp && <div className="mt-2"><div className="flex items-center gap-2 text-sm"><span className="text-gray-600">{HOMEWORK_CHALLENGE_TYPES[a.challenge.type]?.label}: </span><span className="font-medium">{a.challenge.type==='profit'||a.challenge.type==='max_loss'?formatCurrency(cp.current):a.challenge.type==='winrate'?`${cp.current?.toFixed(1)}% (${cp.tradesCompleted}/${cp.tradesRequired} trades)`:`${cp.current}/${a.challenge.target}`}</span><span className={`text-xs px-1.5 py-0.5 rounded ${cp.status==='completed'?'bg-green-100 text-green-700':cp.status==='failed'?'bg-red-100 text-red-700':'bg-blue-100 text-blue-700'}`}>{cp.status==='completed'?'✓ Complete':cp.status==='failed'?'✗ Failed':`${Math.round(cp.progress)}%`}</span></div><div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full transition-all ${cp.status==='completed'?'bg-green-500':cp.status==='failed'?'bg-red-500':'bg-blue-500'}`} style={{width:`${Math.min(100,cp.progress)}%`}}/></div></div>}
                    {a.studentNotes && <p className="text-sm text-gray-500 mt-2 truncate">💬 Student: "{a.studentNotes}"</p>}
                  </div>
                  <button onClick={e=>{e.stopPropagation();if(confirm('Delete this assignment?'))onDeleteAssignment(a.id);}} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">{Icons.trash}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto"><div className="fixed inset-0 bg-black/50" onClick={()=>{setModalOpen(false);resetForm();}}/>
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl"><h2 className="text-lg font-semibold text-gray-900">Create Assignment</h2></div>
              <div className="p-6 space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label><input type="text" value={formData.title} onChange={e=>setFormData({...formData,title:e.target.value})} placeholder="e.g., Focus on A+ setups this week" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Category</label><div className="flex flex-wrap gap-2">{Object.entries(ASSIGNMENT_CATEGORIES).map(([key,val])=><button key={key} type="button" onClick={()=>setFormData({...formData,category:key})} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${formData.category===key?`${val.bgColor} ${val.textColor} border-current`:'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><span>{val.icon}</span><span>{val.label}</span></button>)}</div></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={formData.description} onChange={e=>setFormData({...formData,description:e.target.value})} placeholder="Provide details about what they should focus on..." rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Due Date (optional)</label><input type="date" value={formData.dueDate} onChange={e=>setFormData({...formData,dueDate:e.target.value})} min={todayISO()} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
                <div className="border-t border-gray-200 pt-4"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.hasChallenge} onChange={e=>setFormData({...formData,hasChallenge:e.target.checked})} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"/><span className="text-sm font-medium text-gray-700">Attach a Measurable Challenge</span></label></div>
                {formData.hasChallenge && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Challenge Type</label><select value={formData.challengeType} onChange={e=>setFormData({...formData,challengeType:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">{Object.entries(HOMEWORK_CHALLENGE_TYPES).map(([k,v])=><option key={k} value={k}>{v.label} - {v.metric}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Target {HOMEWORK_CHALLENGE_TYPES[formData.challengeType]?.unit&&`(${HOMEWORK_CHALLENGE_TYPES[formData.challengeType].unit})`}</label><input type="number" value={formData.challengeTarget} onChange={e=>setFormData({...formData,challengeTarget:e.target.value})} placeholder={formData.challengeType==='profit'?'500':formData.challengeType==='winrate'?'60':'10'} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
                    {formData.challengeType==='winrate' && <div><label className="block text-sm font-medium text-gray-700 mb-1">Over how many trades?</label><input type="number" value={formData.challengeTradesRequired} onChange={e=>setFormData({...formData,challengeTradesRequired:e.target.value})} placeholder="20" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>}
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">End Date (optional)</label><input type="date" value={formData.challengeEndDate} onChange={e=>setFormData({...formData,challengeEndDate:e.target.value})} min={todayISO()} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
                  </div>
                )}
              </div>
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-xl flex justify-end gap-3">
                <button onClick={()=>{setModalOpen(false);resetForm();}} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={handleCreate} disabled={!formData.title.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create Assignment</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingAssignment && (
        <div className="fixed inset-0 z-50 overflow-y-auto"><div className="fixed inset-0 bg-black/50" onClick={()=>setViewingAssignment(null)}/>
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">Assignment Details</h2><button onClick={()=>setViewingAssignment(null)} className="p-2 hover:bg-gray-100 rounded-lg">{Icons.x}</button></div>
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3"><div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${ASSIGNMENT_CATEGORIES[viewingAssignment.category]?.bgColor||'bg-gray-100'}`}>{ASSIGNMENT_CATEGORIES[viewingAssignment.category]?.icon||'📝'}</div><div><h3 className="text-xl font-semibold text-gray-900">{viewingAssignment.title}</h3><p className="text-sm text-gray-500">Created {viewingAssignment.createdAt?.toDate?.().toLocaleDateString()||'recently'}</p></div></div>
                {viewingAssignment.description && <div><h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4><p className="text-gray-600 whitespace-pre-wrap">{viewingAssignment.description}</p></div>}
                <div className="grid grid-cols-2 gap-4">
                  <div><h4 className="text-sm font-medium text-gray-700 mb-1">Status</h4><span className={`inline-flex px-2 py-1 text-sm rounded-full font-medium ${statusCls(viewingAssignment.status)}`}>{statusLabel(viewingAssignment.status)}</span></div>
                  {viewingAssignment.dueDate && <div><h4 className="text-sm font-medium text-gray-700 mb-1">Due Date</h4><p className="text-gray-600">{viewingAssignment.dueDate}</p></div>}
                </div>
                {viewingAssignment.hasChallenge && viewingAssignment.challenge && (() => {
                  const cp = calculateChallengeProgress(viewingAssignment.challenge, studentData?.trades||[]);
                  return (<div className="bg-gray-50 rounded-lg p-4"><h4 className="text-sm font-medium text-gray-700 mb-2">Challenge Progress</h4><p className="text-sm text-gray-600 mb-2">{HOMEWORK_CHALLENGE_TYPES[viewingAssignment.challenge.type]?.label}: {viewingAssignment.challenge.type==='winrate'?` ${viewingAssignment.challenge.target}% over ${viewingAssignment.challenge.tradesRequired} trades`:` ${viewingAssignment.challenge.target} ${HOMEWORK_CHALLENGE_TYPES[viewingAssignment.challenge.type]?.unit||''}`}</p><div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-2"><div className={`h-full ${cp.status==='completed'?'bg-green-500':cp.status==='failed'?'bg-red-500':'bg-blue-500'}`} style={{width:`${Math.min(100,cp.progress)}%`}}/></div><p className="text-sm font-medium">Current: {viewingAssignment.challenge.type==='profit'||viewingAssignment.challenge.type==='max_loss'?formatCurrency(cp.current):viewingAssignment.challenge.type==='winrate'?`${cp.current?.toFixed(1)}% (${cp.tradesCompleted}/${cp.tradesRequired} trades)`:cp.current} <span className={cp.status==='completed'?'text-green-600':cp.status==='failed'?'text-red-600':'text-blue-600'}>({cp.status==='completed'?'✓ Complete':cp.status==='failed'?'✗ Failed':`${Math.round(cp.progress)}%`})</span></p></div>);
                })()}
                {viewingAssignment.studentNotes && <div className="bg-blue-50 rounded-lg p-4"><h4 className="text-sm font-medium text-blue-700 mb-1">Student's Notes</h4><p className="text-blue-900 whitespace-pre-wrap">{viewingAssignment.studentNotes}</p></div>}
                {viewingAssignment.status==='completed' && !viewingAssignment.mentorReview && (
                  <div className="border-t border-gray-200 pt-4"><h4 className="text-sm font-medium text-gray-700 mb-2">Add Your Review</h4><textarea value={reviewText} onChange={e=>setReviewText(e.target.value)} placeholder="Provide feedback on their work..." rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/><button onClick={()=>handleAddReview(viewingAssignment.id)} disabled={!reviewText.trim()} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Submit Review</button></div>
                )}
                {viewingAssignment.mentorReview && <div className="bg-purple-50 rounded-lg p-4"><h4 className="text-sm font-medium text-purple-700 mb-1">Your Review</h4><p className="text-purple-900 whitespace-pre-wrap">{viewingAssignment.mentorReview}</p></div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MENTOR CHECK-INS TAB
// =============================================================================
export function MentorCheckinsTab({ checkins, studentData, selectedStudent, onCreateCheckin, onDeleteCheckin, onCreateAssignment, isMobile }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCheckin, setEditingCheckin] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(getWeekBounds());
  const [formData, setFormData] = useState({ summary: '', whatWentWell: '', areasToImprove: '', focusForNextWeek: '' });
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [assignmentData, setAssignmentData] = useState({ title: '', description: '', dueDate: '', hasChallenge: false, challengeType: 'profit', challengeTarget: '', challengeTradesRequired: 10, challengeStartDate: todayISO(), challengeEndDate: '' });

  const recentWeeks = getRecentWeeks(12);

  const weekStats = useMemo(() => {
    if (!studentData?.trades) return null;
    return calculateWeekStats(studentData.trades, selectedWeek.start, selectedWeek.end, studentData.setups||[], studentData.mistakes||[]);
  }, [studentData, selectedWeek]);

  const resetForm = () => {
    setFormData({ summary: '', whatWentWell: '', areasToImprove: '', focusForNextWeek: '' });
    setEditingCheckin(null); setShowAssignmentForm(false);
    setAssignmentData({ title: '', description: '', dueDate: '', hasChallenge: false, challengeType: 'profit', challengeTarget: '', challengeTradesRequired: 10, challengeStartDate: todayISO(), challengeEndDate: '' });
  };

  const handleSave = async () => {
    const data = { weekStart: selectedWeek.start, weekEnd: selectedWeek.end, stats: weekStats, summary: formData.summary.trim(), whatWentWell: formData.whatWentWell.trim(), areasToImprove: formData.areasToImprove.trim(), focusForNextWeek: formData.focusForNextWeek.trim() };
    const ok = await onCreateCheckin(data);
    if (showAssignmentForm && assignmentData.title.trim() && onCreateAssignment) {
      await onCreateAssignment({ title: assignmentData.title.trim(), description: assignmentData.description.trim(), type: 'homework', dueDate: assignmentData.dueDate||null, hasChallenge: assignmentData.hasChallenge, challenge: assignmentData.hasChallenge ? { type: assignmentData.challengeType, target: parseFloat(assignmentData.challengeTarget)||0, tradesRequired: assignmentData.challengeTradesRequired, startDate: assignmentData.challengeStartDate, endDate: assignmentData.challengeEndDate } : null });
    }
    if (ok) { setModalOpen(false); resetForm(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Weekly Check-ins</h1><p className="text-sm text-gray-500 mt-1">{checkins.length} check-in{checkins.length!==1?'s':''} for {selectedStudent?.displayName}</p></div>
        <button onClick={()=>{resetForm();setSelectedWeek(getWeekBounds());setModalOpen(true);}} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">{Icons.plus}<span>New Check-in</span></button>
      </div>

      {checkins.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📅</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No check-ins yet</h3>
          <p className="text-gray-500 mb-4">Create your first weekly check-in to track progress</p>
          <button onClick={()=>{resetForm();setModalOpen(true);}} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{Icons.plus}<span>Create First Check-in</span></button>
        </div>
      ) : (
        <div className="space-y-4">
          {checkins.map(ci => {
            const s = ci.stats || {};
            return (
              <div key={ci.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:border-gray-300 transition-colors cursor-pointer"
                onClick={()=>{setEditingCheckin(ci);setSelectedWeek({start:ci.weekStart,end:ci.weekEnd});setFormData({summary:ci.summary||'',whatWentWell:ci.whatWentWell||'',areasToImprove:ci.areasToImprove||'',focusForNextWeek:ci.focusForNextWeek||''});setModalOpen(true);}}>
                <div className="flex items-start justify-between mb-3">
                  <div><h3 className="font-semibold text-gray-900">Week of {formatWeekRange(ci.weekStart, ci.weekEnd)}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-600"><span>📊 {s.totalTrades||0} trades</span><span>|</span><span>{(s.winRate||0).toFixed(0)}% WR</span><span>|</span><span className={(s.totalPnL||0)>=0?'text-emerald-600':'text-red-600'}>{formatCurrency(s.totalPnL||0)}</span></div>
                  </div>
                  <button onClick={e=>{e.stopPropagation();if(confirm('Delete this check-in?'))onDeleteCheckin(ci.id);}} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">{Icons.trash}</button>
                </div>
                {ci.summary && <p className="text-gray-600 text-sm mb-2 line-clamp-2">"{ci.summary}"</p>}
                {ci.focusForNextWeek && <div className="flex items-center gap-2 text-sm"><span className="text-orange-500">🔥</span><span className="text-gray-600">Focus: {ci.focusForNextWeek}</span></div>}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto"><div className="fixed inset-0 bg-black/50" onClick={()=>{setModalOpen(false);resetForm();}}/>
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl"><h2 className="text-lg font-semibold text-gray-900">{editingCheckin?'Edit Check-in':'New Weekly Check-in'}</h2></div>
              <div className="p-6 space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Week</label>
                  <select value={`${selectedWeek.start}|${selectedWeek.end}`} onChange={e=>{const[s,end]=e.target.value.split('|');setSelectedWeek({start:s,end});}} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    {recentWeeks.map(w=><option key={w.start} value={`${w.start}|${w.end}`}>{formatWeekRange(w.start,w.end)}</option>)}
                  </select>
                </div>

                {weekStats && weekStats.totalTrades > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2">
                      {[['Week P&L', <span className={weekStats.totalPnL>=0?'text-emerald-600':'text-red-600'}>{formatCurrencyShort(weekStats.totalPnL)}</span>, null],['# Trades', weekStats.totalTrades, `${weekStats.tradingDays} days traded`],['Win Rate',`${weekStats.winRate.toFixed(1)}%`,<><span className="text-emerald-600">{weekStats.wins}W</span>{' / '}<span className="text-red-600">{weekStats.losses}L</span></>],['R:R',`${weekStats.riskRewardRatio}:1`,`${formatCurrencyShort(weekStats.avgWin)}/${formatCurrencyShort(weekStats.avgLoss)}`],['Avg Win',<span className="text-emerald-600">+{formatCurrencyShort(weekStats.avgWin)}</span>,`${weekStats.wins} win${weekStats.wins!==1?'s':''}`],['Avg Loss',<span className="text-red-600">-{formatCurrencyShort(weekStats.avgLoss)}</span>,`${weekStats.losses} loss${weekStats.losses!==1?'es':''}`],['Avg Rating',weekStats.ratedTradesCount>0?<div className="flex items-center gap-1"><span>{weekStats.avgRating.toFixed(1)}</span><span className="text-amber-400">★</span></div>:<span className="text-xs text-gray-400 italic">No ratings</span>,weekStats.ratedTradesCount>0?`${weekStats.ratedTradesCount} rated`:null]].map(([lbl,val,sub],i)=>(
                        <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3"><p className="text-[10px] font-medium text-gray-500 mb-1 truncate">{lbl}</p><p className="text-lg font-bold truncate">{val}</p>{sub&&<p className="text-[10px] text-gray-500 mt-1 truncate">{sub}</p>}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"><h3 className="text-sm font-semibold text-gray-900 mb-3">P&L by Asset</h3><SimplePieChart data={weekStats.assetPieData}/></div>
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"><h3 className="text-sm font-semibold text-gray-900 mb-3">P&L by Ticker</h3><SimpleBarChart data={weekStats.tickerPnLData}/></div>
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"><h3 className="text-sm font-semibold text-gray-900 mb-3">Trade P&L</h3><SimpleBarChart data={weekStats.tradePnLData}/></div>
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"><h3 className="text-sm font-semibold text-gray-900 mb-3">Setups Used</h3><SetupBarChart data={weekStats.setupData}/></div>
                    </div>
                    {weekStats.trades?.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200"><h3 className="text-sm font-semibold text-gray-900">Trades ({weekStats.trades.length})</h3></div>
                        <div className="overflow-x-auto">
                          <table className="w-full"><thead className="bg-gray-50 border-b border-gray-200"><tr>{['#','Date','Ticker','Type','Size','P&L','Rating','Setup','Mistakes'].map(h=><th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                            <tbody className="divide-y divide-gray-200">
                              {[...weekStats.trades].sort((a,b)=>{const da=a.exitDate||a.entryDate,db=b.exitDate||b.entryDate;return da.localeCompare(db)||((a.createdAt||'').localeCompare(b.createdAt||''));}).map((t,i)=>{
                                const setup=t.setupId?(studentData?.setups?.find(s=>s.id===t.setupId)?.name||'-'):'-';
                                const mistakes=t.mistakeIds?.length>0?t.mistakeIds.map(id=>studentData?.mistakes?.find(m=>m.id===id)?.name||'').filter(Boolean).join(', '):'-';
                                return (<tr key={t.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-sm font-medium text-gray-400">{i+1}</td>
                                  <td className="px-3 py-2 text-sm text-gray-600">{t.exitDate||t.entryDate}</td>
                                  <td className="px-3 py-2 text-sm font-medium text-gray-900">{t.ticker}</td>
                                  <td className="px-3 py-2 text-sm"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${t.positionType==='long'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{t.positionType?.toUpperCase()||'-'}</span></td>
                                  <td className="px-3 py-2 text-sm text-gray-600">{t.positionSize||'-'}</td>
                                  <td className="px-3 py-2 text-sm">{t.derived?.isOpen?<span className="text-gray-400">Open</span>:<span className={`font-medium ${(t.derived?.pnlFinal||0)>=0?'text-emerald-600':'text-red-600'}`}>{formatCurrency(t.derived?.pnlFinal||0)}</span>}</td>
                                  <td className="px-3 py-2"><div className="flex items-center gap-0.5">{[1,2,3,4,5].map(s=><span key={s} className={`text-xs ${s<=(t.rating||0)?'text-amber-400':'text-gray-300'}`}>★</span>)}</div></td>
                                  <td className="px-3 py-2 text-sm text-gray-600 max-w-[100px] truncate">{setup}</td>
                                  <td className="px-3 py-2 text-sm text-gray-600 max-w-[120px] truncate">{mistakes}</td>
                                </tr>);
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : weekStats && weekStats.totalTrades === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-6 text-center"><p className="text-gray-500">No trades this week</p></div>
                ) : null}

                {[['Overall Summary','summary','How did this week go overall?'],['💪 What Went Well','whatWentWell','Positives from this week...'],['🎯 Areas to Improve','areasToImprove','What needs work...'],['🔥 Focus for Next Week','focusForNextWeek','Key priorities for the coming week...']].map(([lbl,key,ph])=>(
                  <div key={key}><label className="block text-sm font-medium text-gray-700 mb-1">{lbl}</label><textarea value={formData[key]} onChange={e=>setFormData({...formData,[key]:e.target.value})} placeholder={ph} rows={key==='summary'?3:2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
                ))}

                <div className="border-t border-gray-200 pt-4">
                  <button type="button" onClick={()=>setShowAssignmentForm(!showAssignmentForm)} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium">{showAssignmentForm?Icons.minus:Icons.plus}<span>{showAssignmentForm?'Cancel Assignment':'Add Homework Assignment'}</span></button>
                  {showAssignmentForm && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg space-y-4">
                      <h4 className="font-medium text-gray-900">📝 New Homework Assignment</h4>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label><input type="text" value={assignmentData.title} onChange={e=>setAssignmentData({...assignmentData,title:e.target.value})} placeholder="e.g., Read Trading in the Zone Ch. 5" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label><textarea value={assignmentData.description} onChange={e=>setAssignmentData({...assignmentData,description:e.target.value})} placeholder="Details or instructions..." rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Due Date (optional)</label><input type="date" value={assignmentData.dueDate} onChange={e=>setAssignmentData({...assignmentData,dueDate:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
                      <div className="border-t border-blue-200 pt-4"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={assignmentData.hasChallenge} onChange={e=>setAssignmentData({...assignmentData,hasChallenge:e.target.checked})} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"/><span className="font-medium text-gray-900">🎯 Add a Challenge</span></label><p className="text-xs text-gray-500 mt-1 ml-8">Track a measurable goal like profit target, win rate, etc.</p></div>
                      {assignmentData.hasChallenge && (
                        <div className="ml-4 pl-4 border-l-2 border-blue-300 space-y-4">
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Challenge Type</label><select value={assignmentData.challengeType} onChange={e=>setAssignmentData({...assignmentData,challengeType:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">{Object.entries(HOMEWORK_CHALLENGE_TYPES).map(([id,type])=><option key={id} value={id}>{type.label}</option>)}</select></div>
                          <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Target {HOMEWORK_CHALLENGE_TYPES[assignmentData.challengeType]?.unit||''}</label><input type="number" value={assignmentData.challengeTarget} onChange={e=>setAssignmentData({...assignmentData,challengeTarget:e.target.value})} placeholder={assignmentData.challengeType==='profit'?'500':assignmentData.challengeType==='winrate'?'60':'10'} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
                            {assignmentData.challengeType==='winrate' && <div><label className="block text-sm font-medium text-gray-700 mb-1">Min Trades</label><input type="number" value={assignmentData.challengeTradesRequired} onChange={e=>setAssignmentData({...assignmentData,challengeTradesRequired:parseInt(e.target.value)||10})} placeholder="10" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label><input type="date" value={assignmentData.challengeStartDate} onChange={e=>setAssignmentData({...assignmentData,challengeStartDate:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">End Date</label><input type="date" value={assignmentData.challengeEndDate} onChange={e=>setAssignmentData({...assignmentData,challengeEndDate:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-xl flex justify-end gap-3">
                <button onClick={()=>{setModalOpen(false);resetForm();}} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingCheckin?'Update Check-in':showAssignmentForm&&assignmentData.title?'Save Check-in & Assignment':'Save Check-in'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MENTOR SESSIONS TAB
// =============================================================================
export function MentorSessionsTab({ sessions, selectedStudent, userProfile, onCreateSession, onUpdateStatus, onDeleteSession, isMobile }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ date: '', time: '', duration: 30, topic: '', videoLink: '' });
  const [saving, setSaving] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [notesSession, setNotesSession] = useState(null);
  const [sessionNotes, setSessionNotes] = useState('');

  const resetForm = () => { setFormData({ date: '', time: '', duration: 30, topic: '', videoLink: '' }); setShowForm(false); };

  const handleSubmit = async () => {
    if (!formData.date || !formData.time || !formData.topic.trim()) return;
    setSaving(true);
    try {
      const Timestamp = firebase.firestore.Timestamp;
      const ok = await onCreateSession({ dateTime: Timestamp.fromDate(new Date(`${formData.date}T${formData.time}`)), duration: formData.duration, topic: formData.topic.trim(), videoLink: formData.videoLink.trim()||null });
      if (ok) resetForm();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const saveNotesAndComplete = async () => {
    if (!notesSession) return;
    await onUpdateStatus(notesSession.id, 'completed', sessionNotes);
    setNotesModalOpen(false); setNotesSession(null); setSessionNotes('');
  };

  const now = new Date();
  const upcoming = sessions.filter(s => s.dateTime?.toDate && s.dateTime.toDate() >= now && !['cancelled','completed'].includes(s.status)).sort((a,b) => a.dateTime.toDate()-b.dateTime.toDate());
  const past = sessions.filter(s => s.dateTime?.toDate && (s.dateTime.toDate() < now || ['completed','cancelled'].includes(s.status))).sort((a,b) => b.dateTime.toDate()-a.dateTime.toDate());

  const fmtDT = (ts) => { if (!ts?.toDate) return 'Unknown'; return ts.toDate().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); };
  const badge = (s) => { const m={requested:'bg-yellow-100 text-yellow-700',confirmed:'bg-blue-100 text-blue-700',completed:'bg-green-100 text-green-700',cancelled:'bg-gray-100 text-gray-500'}; const [cls]=Object.entries(m).find(([k])=>k===s)||['']; return cls?<span className={`px-2 py-1 text-xs font-medium ${cls} rounded`}>{s.charAt(0).toUpperCase()+s.slice(1)}</span>:null; };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">📅 Sessions with {selectedStudent?.displayName}</h2>
        <button onClick={()=>setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">{showForm?Icons.minus:Icons.plus}<span>{showForm?'Cancel':'Schedule Session'}</span></button>
      </div>

      {showForm && (
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
          <h3 className="font-semibold text-gray-900 mb-4">📅 Schedule New Session</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date *</label><input type="date" value={formData.date} onChange={e=>setFormData({...formData,date:e.target.value})} min={todayISO()} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Time *</label><input type="time" value={formData.time} onChange={e=>setFormData({...formData,time:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Duration</label><select value={formData.duration} onChange={e=>setFormData({...formData,duration:parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">{[15,30,45,60,90].map(d=><option key={d} value={d}>{d<60?`${d} minutes`:d===60?'1 hour':'1.5 hours'}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Video Link (optional)</label><input type="url" value={formData.videoLink} onChange={e=>setFormData({...formData,videoLink:e.target.value})} placeholder="https://zoom.us/j/..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
          </div>
          <div className="mt-4"><label className="block text-sm font-medium text-gray-700 mb-1">Topic / Agenda *</label><textarea value={formData.topic} onChange={e=>setFormData({...formData,topic:e.target.value})} placeholder="What will you discuss in this session?" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={resetForm} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={handleSubmit} disabled={saving||!formData.date||!formData.time||!formData.topic.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving?'Scheduling...':'Schedule Session'}</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white"><h3 className="font-semibold text-gray-900 flex items-center gap-2"><span>📆</span><span>Upcoming Sessions</span>{upcoming.length>0&&<span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">{upcoming.length}</span>}</h3></div>
        {upcoming.length===0 ? <div className="px-6 py-8 text-center text-gray-500"><p>No upcoming sessions scheduled</p></div> : (
          <div className="divide-y divide-gray-100">
            {upcoming.map(s=>(
              <div key={s.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="font-medium text-gray-900">{fmtDT(s.dateTime)}</span><span className="text-gray-400">•</span><span className="text-sm text-gray-500">{s.duration} min</span>{badge(s.status)}</div><p className="text-gray-600">{s.topic}</p>{s.videoLink&&<a href={s.videoLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:text-blue-700">🔗 Join Video Call</a>}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>{setNotesSession(s);setSessionNotes(s.notes||'');setNotesModalOpen(true);}} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Complete</button>
                    <button onClick={()=>{if(confirm('Cancel this session?'))onUpdateStatus(s.id,'cancelled');}} className="px-3 py-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 text-sm rounded-lg">Cancel</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200"><h3 className="font-semibold text-gray-900 flex items-center gap-2"><span>📋</span><span>Past Sessions</span></h3></div>
          <div className="divide-y divide-gray-100">
            {past.map(s=>(
              <div key={s.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className={`font-medium ${s.status==='cancelled'?'text-gray-400 line-through':'text-gray-900'}`}>{fmtDT(s.dateTime)}</span><span className="text-gray-400">•</span><span className="text-sm text-gray-500">{s.duration} min</span>{badge(s.status)}</div><p className={s.status==='cancelled'?'text-gray-400':'text-gray-600'}>{s.topic}</p>{s.notes&&<div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600"><span className="font-medium">Notes:</span> {s.notes}</div>}</div>
                  <button onClick={()=>{if(confirm('Delete this session?'))onDeleteSession(s.id);}} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">{Icons.trash}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {notesModalOpen && notesSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-gray-200"><h3 className="font-semibold text-gray-900">Complete Session</h3><p className="text-sm text-gray-500 mt-1">{fmtDT(notesSession.dateTime)} - {notesSession.topic}</p></div>
            <div className="p-6"><label className="block text-sm font-medium text-gray-700 mb-2">Session Notes (optional)</label><textarea value={sessionNotes} onChange={e=>setSessionNotes(e.target.value)} placeholder="Key takeaways, action items, areas to focus on..." rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/></div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button onClick={()=>{setNotesModalOpen(false);setNotesSession(null);setSessionNotes('');}} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={saveNotesAndComplete} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Mark as Completed</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
