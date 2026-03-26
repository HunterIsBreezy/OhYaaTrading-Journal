import { useState, useMemo } from 'react';
import { nowISO, generateId, calcTradeDerived, formatCurrency } from '../../utils/helpers';
import { SimplePieChart, SimpleBarChart } from '../shared/Charts';
import Icons from '../shared/Icons';

export default function SetupsPage({ state, setState, isMobile, isReadOnly = false }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSetup, setEditingSetup] = useState(null);
  const [setupName, setSetupName] = useState('');
  const [setupDescription, setSetupDescription] = useState('');
  const [setupScreenshot, setSetupScreenshot] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewingScreenshot, setViewingScreenshot] = useState(null);
  const [error, setError] = useState('');

  const setupAnalytics = useMemo(() => {
    const analytics = {};
    state.setups.forEach(s => { analytics[s.id] = { id: s.id, name: s.name, description: s.description || '', totalTrades: 0, wins: 0, losses: 0, totalPnL: 0, winRate: 0, avgPnL: 0 }; });
    state.trades.forEach(t => {
      if (!t.setupId || !analytics[t.setupId]) return;
      const d = calcTradeDerived(t); if (d.isOpen) return;
      analytics[t.setupId].totalTrades++;
      analytics[t.setupId].totalPnL += d.pnlFinal || 0;
      if (d.winLoss === 'W') analytics[t.setupId].wins++;
      if (d.winLoss === 'L') analytics[t.setupId].losses++;
    });
    Object.values(analytics).forEach(s => {
      const tc = s.wins + s.losses;
      s.winRate = tc > 0 ? Math.round((s.wins / tc) * 100) : 0;
      s.avgPnL = s.totalTrades > 0 ? s.totalPnL / s.totalTrades : 0;
    });
    return Object.values(analytics);
  }, [state.setups, state.trades]);

  const pieData = useMemo(() => setupAnalytics.filter(s => s.totalTrades > 0).map(s => ({ label: s.name, value: s.totalTrades })), [setupAnalytics]);
  const barData = useMemo(() => setupAnalytics.filter(s => s.totalTrades > 0).sort((a, b) => b.totalPnL - a.totalPnL).map(s => ({ label: s.name, value: s.totalPnL })), [setupAnalytics]);
  const topByProfit = useMemo(() => [...setupAnalytics].filter(s => s.totalPnL > 0).sort((a, b) => b.totalPnL - a.totalPnL).slice(0, 3), [setupAnalytics]);
  const topByLoss = useMemo(() => [...setupAnalytics].filter(s => s.totalPnL < 0).sort((a, b) => a.totalPnL - b.totalPnL).slice(0, 3), [setupAnalytics]);
  const topByQuantity = useMemo(() => [...setupAnalytics].filter(s => s.totalTrades > 0).sort((a, b) => b.totalTrades - a.totalTrades).slice(0, 3), [setupAnalytics]);
  const topByWinRate = useMemo(() => [...setupAnalytics].filter(s => s.totalTrades >= 3).sort((a, b) => b.winRate - a.winRate).slice(0, 3), [setupAnalytics]);

  const openAddModal = () => { setEditingSetup(null); setSetupName(''); setSetupDescription(''); setSetupScreenshot(null); setError(''); setModalOpen(true); };
  const openEditModal = (s) => { setEditingSetup(s); setSetupName(s.name); setSetupDescription(s.description || ''); setSetupScreenshot(s.screenshot || null); setError(''); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingSetup(null); setSetupName(''); setSetupDescription(''); setSetupScreenshot(null); setError(''); };

  const handleSave = () => {
    const name = setupName.trim();
    if (!name) { setError('Setup name is required'); return; }
    const dup = state.setups.find(s => s.name.toLowerCase() === name.toLowerCase() && s.id !== editingSetup?.id);
    if (dup) { setError('A setup with this name already exists'); return; }
    if (editingSetup) {
      setState({ ...state, setups: state.setups.map(s => s.id === editingSetup.id ? { ...s, name, description: setupDescription.trim(), screenshot: setupScreenshot, updatedAt: nowISO() } : s) });
    } else {
      setState({ ...state, setups: [...state.setups, { id: generateId(), name, description: setupDescription.trim(), screenshot: setupScreenshot, rules: [], createdAt: nowISO(), updatedAt: nowISO() }] });
    }
    closeModal();
  };

  const handleDelete = (setupId, nullify = false) => {
    if (nullify) {
      setState({ ...state, setups: state.setups.filter(s => s.id !== setupId), trades: state.trades.map(t => t.setupId === setupId ? { ...t, setupId: null } : t) });
    } else {
      setState({ ...state, setups: state.setups.filter(s => s.id !== setupId) });
    }
    setDeleteConfirm(null);
  };

  const initiateDelete = (setup) => {
    const using = state.trades.filter(t => t.setupId === setup.id);
    if (using.length > 0) setDeleteConfirm({ setup, tradesCount: using.length });
    else handleDelete(setup.id);
  };

  const compressImage = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(800 / img.width, 1);
        canvas.width = img.width * ratio; canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Setups</h1><p className="text-sm text-gray-500 mt-1">{state.setups.length} setups defined</p></div>
        {!isReadOnly && <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">{Icons.plus}<span>Add Setup</span></button>}
      </div>

      {setupAnalytics.some(s => s.totalTrades > 0) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"><h3 className="text-lg font-semibold text-gray-900 mb-4">Setups by Trade Count</h3><SimplePieChart data={pieData} /></div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"><h3 className="text-lg font-semibold text-gray-900 mb-4">Setups by Total P&L</h3><SimpleBarChart data={barData} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Top Profit', icon: Icons.trendUp, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', data: topByProfit, val: s => <span className="text-sm font-semibold text-emerald-600">{formatCurrency(s.totalPnL)}</span>, empty: 'No profitable setups yet' },
              { title: 'Worst Loss', icon: Icons.trendDown, iconBg: 'bg-red-100', iconColor: 'text-red-600', data: topByLoss, val: s => <span className="text-sm font-semibold text-red-600">{formatCurrency(s.totalPnL)}</span>, empty: 'No losing setups yet' },
              { title: 'Most Used', icon: Icons.tradelog, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', data: topByQuantity, val: s => <span className="text-sm font-semibold text-blue-600">{s.totalTrades} trades</span>, empty: 'No trades with setups yet' },
              { title: 'Best Win Rate', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', data: topByWinRate, val: s => <span className="text-sm font-semibold text-amber-600">{s.winRate}%</span>, empty: 'Need 3+ trades per setup' },
            ].map((card, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3"><div className={`p-1.5 ${card.iconBg} rounded-lg ${card.iconColor}`}>{card.icon}</div><h4 className="font-semibold text-gray-900">{card.title}</h4></div>
                {card.data.length > 0 ? (
                  <div className="space-y-2">
                    {card.data.map((s, j) => (
                      <div key={s.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-400">#{j + 1}</span><span className="text-sm text-gray-700 truncate max-w-[100px]">{s.name}</span></div>
                        {card.val(s)}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-400 italic">{card.empty}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><h3 className="font-semibold text-gray-900">All Setups</h3></div>
        {state.setups.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">{Icons.setups}</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No setups defined</h3>
            <p className="text-gray-500 mb-4">Create setups to categorize and analyze your trading strategies</p>
            {!isReadOnly && <button onClick={openAddModal} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">{Icons.plus}<span>Add Your First Setup</span></button>}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {setupAnalytics.map(setup => {
              const maxPnL = Math.max(...setupAnalytics.map(s => Math.abs(s.totalPnL)), 1);
              const pnlBarWidth = (Math.abs(setup.totalPnL) / maxPnL) * 100;
              const winPct = setup.wins + setup.losses > 0 ? (setup.wins / (setup.wins + setup.losses)) * 100 : 0;
              const full = state.setups.find(s => s.id === setup.id);
              return (
                <div key={setup.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-shrink-0 w-56">
                      {full?.screenshot ? (
                        <img src={full.screenshot} alt={setup.name} onClick={() => setViewingScreenshot(full.screenshot)} className="w-12 h-12 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                      )}
                      <div className="min-w-0"><h4 className="font-medium text-gray-900">{setup.name}</h4>{setup.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{setup.description}</p>}</div>
                    </div>
                    {setup.totalTrades > 0 ? (
                      <div className="flex-1 flex items-center gap-6">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-600 font-medium whitespace-nowrap">{setup.totalTrades} trades</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`font-semibold whitespace-nowrap ${setup.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(setup.totalPnL)}</span>
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${setup.totalPnL >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${pnlBarWidth}%` }} /></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-emerald-600 font-medium w-6 text-right">{setup.wins}W</span>
                          <div className="w-24 h-2 bg-red-200 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${winPct}%` }} /></div>
                          <span className="text-xs text-red-600 font-medium w-6">{setup.losses}L</span>
                          <span className="text-xs text-gray-500 font-medium w-10">{setup.winRate}%</span>
                        </div>
                      </div>
                    ) : <div className="flex-1"><span className="text-xs text-gray-400">No trades yet</span></div>}
                    {!isReadOnly && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEditModal(full)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">{Icons.edit}</button>
                        <button onClick={() => initiateDelete(full)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">{Icons.trash}</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-semibold text-gray-900">{editingSetup ? 'Edit Setup' : 'Add Setup'}</h2></div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input type="text" value={setupName} onChange={(e) => { setSetupName(e.target.value); setError(''); }} placeholder="e.g., Breakout, Mean Reversion, Gap Fill"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-gray-300'}`} autoFocus />
                  {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={setupDescription} onChange={(e) => setSetupDescription(e.target.value)} placeholder="Describe the setup criteria, entry/exit rules..." rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Example Screenshot</label>
                  {setupScreenshot ? (
                    <div className="relative">
                      <img src={setupScreenshot} alt="Setup example" className="w-full h-40 object-cover rounded-lg border border-gray-200" />
                      <button onClick={() => setSetupScreenshot(null)} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                      <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span className="text-sm text-gray-500">Click to upload example chart</span>
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setSetupScreenshot(await compressImage(f)); } catch(err) {} }} />
                    </label>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-xl">
                <button onClick={closeModal} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">{editingSetup ? 'Save Changes' : 'Add Setup'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-semibold text-gray-900">Delete Setup</h2></div>
              <div className="p-6"><div className="flex items-start gap-4"><div className="p-3 bg-red-100 rounded-full text-red-600 flex-shrink-0">{Icons.warning}</div>
                <div><p className="text-gray-900 font-medium">Delete "{deleteConfirm.setup.name}"?</p>
                  <p className="text-gray-500 text-sm mt-2">This setup is linked to <span className="font-semibold text-gray-700">{deleteConfirm.tradesCount} trade{deleteConfirm.tradesCount !== 1 ? 's' : ''}</span>.</p>
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg"><p className="text-amber-800 text-sm font-medium">⚠️ This action cannot be undone</p><p className="text-amber-700 text-xs mt-1">The setup will be removed from all linked trades. Your trade data will remain intact.</p></div>
                </div>
              </div></div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col gap-2 rounded-b-xl">
                <button onClick={() => handleDelete(deleteConfirm.setup.id, true)} className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">Delete Setup</button>
                <button onClick={() => setDeleteConfirm(null)} className="w-full px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Viewer */}
      {viewingScreenshot && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/80" onClick={() => setViewingScreenshot(null)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative max-w-4xl w-full">
              <button onClick={() => setViewingScreenshot(null)} className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <img src={viewingScreenshot} alt="Setup example" className="w-full rounded-lg shadow-2xl" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
