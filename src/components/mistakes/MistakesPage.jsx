import { useState, useMemo } from 'react';
import { nowISO, generateId, calcTradeDerived, formatCurrency, formatCurrencyShort } from '../../utils/helpers';
import { SimplePieChart } from '../shared/Charts';
import Icons from '../shared/Icons';

export default function MistakesPage({ state, setState, isMobile, isReadOnly = false }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMistake, setEditingMistake] = useState(null);
  const [mistakeName, setMistakeName] = useState('');
  const [mistakeDescription, setMistakeDescription] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [error, setError] = useState('');

  const mistakeAnalytics = useMemo(() => {
    const analytics = {};
    state.mistakes.forEach(m => { analytics[m.id] = { id: m.id, name: m.name, description: m.description || '', totalOccurrences: 0, losingTrades: 0, profitableTrades: 0, totalLossAmount: 0, avgLossPerOccurrence: 0 }; });
    state.trades.forEach(t => {
      if (!t.mistakeIds?.length) return;
      const d = calcTradeDerived(t); if (d.isOpen) return;
      const pnl = d.pnlFinal || 0;
      t.mistakeIds.forEach(mid => {
        if (!analytics[mid]) return;
        analytics[mid].totalOccurrences++;
        if (pnl < 0) { analytics[mid].losingTrades++; analytics[mid].totalLossAmount += pnl; }
        else analytics[mid].profitableTrades++;
      });
    });
    Object.values(analytics).forEach(m => { if (m.losingTrades > 0) m.avgLossPerOccurrence = m.totalLossAmount / m.losingTrades; });
    return Object.values(analytics);
  }, [state.mistakes, state.trades]);

  const pieData = useMemo(() => mistakeAnalytics.filter(m => m.totalOccurrences > 0).sort((a, b) => b.totalOccurrences - a.totalOccurrences).map(m => ({ label: m.name, value: m.totalOccurrences })), [mistakeAnalytics]);
  const barData = useMemo(() => mistakeAnalytics.filter(m => m.totalLossAmount < 0).sort((a, b) => a.totalLossAmount - b.totalLossAmount).map(m => ({ label: m.name, value: Math.abs(m.totalLossAmount) })), [mistakeAnalytics]);
  const mostFrequent = useMemo(() => [...mistakeAnalytics].filter(m => m.totalOccurrences > 0).sort((a, b) => b.totalOccurrences - a.totalOccurrences).slice(0, 3), [mistakeAnalytics]);
  const mostCostly = useMemo(() => [...mistakeAnalytics].filter(m => m.totalLossAmount < 0).sort((a, b) => a.totalLossAmount - b.totalLossAmount).slice(0, 3), [mistakeAnalytics]);

  const openAddModal = () => { setEditingMistake(null); setMistakeName(''); setMistakeDescription(''); setError(''); setModalOpen(true); };
  const openEditModal = (m) => { setEditingMistake(m); setMistakeName(m.name); setMistakeDescription(m.description || ''); setError(''); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingMistake(null); setMistakeName(''); setMistakeDescription(''); setError(''); };

  const handleSave = () => {
    const name = mistakeName.trim();
    if (!name) { setError('Mistake name is required'); return; }
    const dup = state.mistakes.find(m => m.name.toLowerCase() === name.toLowerCase() && m.id !== editingMistake?.id);
    if (dup) { setError('A mistake with this name already exists'); return; }
    if (editingMistake) {
      setState({ ...state, mistakes: state.mistakes.map(m => m.id === editingMistake.id ? { ...m, name, description: mistakeDescription.trim(), updatedAt: nowISO() } : m) });
    } else {
      setState({ ...state, mistakes: [...state.mistakes, { id: generateId(), name, description: mistakeDescription.trim(), createdAt: nowISO(), updatedAt: nowISO() }] });
    }
    closeModal();
  };

  const handleDelete = (id, remove = false) => {
    if (remove) {
      setState({ ...state, mistakes: state.mistakes.filter(m => m.id !== id), trades: state.trades.map(t => ({ ...t, mistakeIds: t.mistakeIds ? t.mistakeIds.filter(mid => mid !== id) : [] })) });
    } else {
      setState({ ...state, mistakes: state.mistakes.filter(m => m.id !== id) });
    }
    setDeleteConfirm(null);
  };

  const initiateDelete = (mistake) => {
    const using = state.trades.filter(t => t.mistakeIds?.includes(mistake.id));
    if (using.length > 0) setDeleteConfirm({ mistake, tradesCount: using.length });
    else handleDelete(mistake.id);
  };

  const LossBarChart = ({ data }) => {
    if (!data?.length) return <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No loss data</div>;
    const maxVal = Math.max(...data.map(d => d.value), 1);
    return (
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-600 w-24 truncate" title={d.label}>{d.label}</span>
            <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden"><div className="h-full rounded bg-red-500" style={{ width: `${(d.value / maxVal) * 100}%` }} /></div>
            <span className="text-xs font-medium w-20 text-right text-red-600">-${d.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Mistakes</h1><p className="text-sm text-gray-500 mt-1">{state.mistakes.length} mistake types defined</p></div>
        {!isReadOnly && <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">{Icons.plus}<span>Add Mistake</span></button>}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex gap-3"><div className="text-amber-600">{Icons.warning}</div>
          <div><p className="text-sm font-medium text-amber-800">Loss Amount Calculation Rule</p><p className="text-xs text-amber-700 mt-1">Only <strong>losing trades</strong> contribute to a mistake's total loss amount. Profitable trades tagged with a mistake are counted in occurrences but do not reduce the loss total.</p></div>
        </div>
      </div>

      {mistakeAnalytics.some(m => m.totalOccurrences > 0) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"><h3 className="text-lg font-semibold text-gray-900 mb-1">Mistakes by Frequency</h3><p className="text-xs text-gray-500 mb-4">Number of trades tagged with each mistake</p><SimplePieChart data={pieData} /></div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"><h3 className="text-lg font-semibold text-gray-900 mb-1">Mistakes by Loss Amount</h3><p className="text-xs text-gray-500 mb-4">Total losses from trades with each mistake (losses only)</p><LossBarChart data={barData} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: 'Most Frequent Mistakes', sub: 'Mistakes you make most often', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M12 8v4M12 16h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', data: mostFrequent, empty: 'No mistakes logged yet',
                renderItem: (m, i) => <><div className="flex items-center gap-3"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-gray-400 text-white' : 'bg-amber-200 text-amber-800'}`}>{i + 1}</span><span className="font-medium text-gray-700">{m.name}</span></div><div className="text-right"><span className="text-sm font-semibold text-gray-900">{m.totalOccurrences}x</span><p className="text-xs text-gray-500">{m.losingTrades} losses, {m.profitableTrades} wins</p></div></>
              },
              { title: 'Most Costly Mistakes', sub: 'Mistakes costing you the most money', icon: Icons.trendDown, iconBg: 'bg-red-100', iconColor: 'text-red-600', data: mostCostly, empty: 'No losing trades with mistakes yet',
                renderItem: (m, i) => <><div className="flex items-center gap-3"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-red-500 text-white' : i === 1 ? 'bg-red-400 text-white' : 'bg-red-200 text-red-800'}`}>{i + 1}</span><span className="font-medium text-gray-700">{m.name}</span></div><div className="text-right"><span className="text-sm font-bold text-red-600">{formatCurrency(m.totalLossAmount)}</span><p className="text-xs text-gray-500">Avg: {formatCurrency(m.avgLossPerOccurrence)}/loss</p></div></>
              },
            ].map((card, ci) => (
              <div key={ci} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4"><div className={`p-2 ${card.iconBg} rounded-lg ${card.iconColor}`}>{card.icon}</div><div><h4 className="font-semibold text-gray-900">{card.title}</h4><p className="text-xs text-gray-500">{card.sub}</p></div></div>
                {card.data.length > 0 ? (
                  <div className="space-y-3">{card.data.map((m, i) => <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">{card.renderItem(m, i)}</div>)}</div>
                ) : <p className="text-sm text-gray-400 italic text-center py-4">{card.empty}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><h3 className="font-semibold text-gray-900">All Mistake Types</h3></div>
        {state.mistakes.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">{Icons.mistakes}</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No mistake types defined</h3>
            <p className="text-gray-500 mb-4">Create mistake types to track and analyze your trading errors</p>
            {!isReadOnly && <button onClick={openAddModal} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">{Icons.plus}<span>Add Your First Mistake Type</span></button>}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {mistakeAnalytics.map(mistake => {
              const maxLoss = Math.max(...mistakeAnalytics.map(m => Math.abs(m.totalLossAmount)), 1);
              const lossRatio = Math.abs(mistake.totalLossAmount) / maxLoss;
              const importance = mistake.totalLossAmount >= 0 ? 0 : lossRatio >= 0.7 ? 3 : lossRatio >= 0.4 ? 2 : lossRatio > 0 ? 1 : 0;
              return (
                <div key={mistake.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-shrink-0 w-56">
                      <div className="flex items-end gap-0.5" title={`Priority: ${importance === 3 ? 'Critical' : importance === 2 ? 'High' : importance === 1 ? 'Medium' : 'Low'}`}>
                        {[0, 1, 2].map(i => <div key={i} className={`w-1.5 rounded-sm ${i < importance ? (importance === 3 ? 'bg-red-500' : importance === 2 ? 'bg-orange-500' : 'bg-amber-400') : 'bg-gray-200'}`} style={{ height: `${8 + i * 4}px` }} />)}
                      </div>
                      <div className="min-w-0"><h4 className="font-medium text-gray-900 truncate">{mistake.name}</h4>{mistake.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{mistake.description}</p>}</div>
                    </div>
                    {mistake.totalOccurrences > 0 ? (
                      <div className="flex-1 flex items-center gap-8 text-xs">
                        <div className="text-center min-w-[60px]"><p className="text-lg font-bold text-gray-900">{mistake.totalOccurrences}</p><p className="text-[10px] text-gray-500 uppercase tracking-wide">times</p></div>
                        <div className="text-center min-w-[80px]"><p className={`text-lg font-bold ${mistake.totalLossAmount < 0 ? 'text-red-600' : 'text-gray-400'}`}>{mistake.totalLossAmount < 0 ? formatCurrencyShort(mistake.totalLossAmount) : '$0'}</p><p className="text-[10px] text-gray-500 uppercase tracking-wide">total cost</p></div>
                        <div className="text-center min-w-[80px]"><p className={`text-lg font-bold ${mistake.avgLossPerOccurrence < 0 ? 'text-orange-600' : 'text-gray-400'}`}>{mistake.avgLossPerOccurrence < 0 ? formatCurrencyShort(mistake.avgLossPerOccurrence) : '$0'}</p><p className="text-[10px] text-gray-500 uppercase tracking-wide">avg/loss</p></div>
                      </div>
                    ) : <div className="flex-1"><span className="text-xs text-gray-400">No occurrences yet</span></div>}
                    {!isReadOnly && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEditModal(state.mistakes.find(m => m.id === mistake.id))} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">{Icons.edit}</button>
                        <button onClick={() => initiateDelete(state.mistakes.find(m => m.id === mistake.id))} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">{Icons.trash}</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto"><div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-semibold text-gray-900">{editingMistake ? 'Edit Mistake' : 'Add Mistake Type'}</h2></div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input type="text" value={mistakeName} onChange={(e) => { setMistakeName(e.target.value); setError(''); }} placeholder="e.g., FOMO, Overtrading, Moved Stop Loss"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-gray-300'}`} autoFocus />
                  {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={mistakeDescription} onChange={(e) => setMistakeDescription(e.target.value)} placeholder="Describe what this mistake looks like, how to avoid it..." rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-xl">
                <button onClick={closeModal} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">{editingMistake ? 'Save Changes' : 'Add Mistake'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto"><div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-semibold text-gray-900">Delete Mistake Type</h2></div>
              <div className="p-6"><div className="flex items-start gap-4"><div className="p-3 bg-red-100 rounded-full text-red-600 flex-shrink-0">{Icons.warning}</div>
                <div><p className="text-gray-900 font-medium">Delete "{deleteConfirm.mistake.name}"?</p>
                  <p className="text-gray-500 text-sm mt-2">This mistake is tagged on <span className="font-semibold text-gray-700">{deleteConfirm.tradesCount} trade{deleteConfirm.tradesCount !== 1 ? 's' : ''}</span>.</p>
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg"><p className="text-amber-800 text-sm font-medium">⚠️ This action cannot be undone</p><p className="text-amber-700 text-xs mt-1">The mistake tag will be removed from all linked trades. Your trade data will remain intact.</p></div>
                </div>
              </div></div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col gap-2 rounded-b-xl">
                <button onClick={() => handleDelete(deleteConfirm.mistake.id, true)} className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">Delete Mistake</button>
                <button onClick={() => setDeleteConfirm(null)} className="w-full px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
