import { useState, useMemo, useEffect } from 'react';
import { ASSET_TYPES, POSITION_TYPES, FEEDBACK_TYPES, FLAG_TYPES } from '../../utils/constants';
import { calcTradeDerived, formatCurrency, formatCurrencyShort } from '../../utils/helpers';
import { StarRating } from '../shared/StarRatingAvatar';
import Icons from '../shared/Icons';
import TradeModal from './TradeModal';
import { ImageModal, NotesModal } from './Modals';

export default function TradeLogPage({
  state, setState, isMobile, isReadOnly = false, isMentorView = false,
  tradeFeedback = [], tradeFlags = [], onAddFeedback, onAddFlag, onRemoveFlag, onToggleFlagStatus,
  myTradeFeedback = [], myTradeFlags = [], markFeedbackAsRead,
  tradeQuestions = [], onAskQuestion, onAnswerQuestion, onResolveQuestion, userProfile,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [sortField, setSortField] = useState('entryDate');
  const [sortDir, setSortDir] = useState('desc');
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalData, setImageModalData] = useState({ src: null, title: '' });
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [notesModalData, setNotesModalData] = useState({ notes: '', title: '' });
  const [viewingTrade, setViewingTrade] = useState(null);
  const [feedbackType, setFeedbackType] = useState('general');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [showFlagMenu, setShowFlagMenu] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionType, setQuestionType] = useState('general');
  const [questionContent, setQuestionContent] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [answerContents, setAnswerContents] = useState({});
  const [submittingAnswerId, setSubmittingAnswerId] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [filters, setFilters] = useState({ dateStart: '', dateEnd: '', tickers: [], assetTypes: [], positionTypes: [], setupIds: [], mistakeIds: [], ratings: [], results: [] });

  const activeFeedback = isMentorView ? tradeFeedback : myTradeFeedback;
  const activeFlags = isMentorView ? tradeFlags : myTradeFlags;
  const getTradeQuestions = (id) => tradeQuestions.filter(q => q.tradeId === id);
  const getTradeFeedback = (id) => activeFeedback.filter(f => f.tradeId === id);
  const getTradeFlag = (id) => activeFlags.find(f => f.tradeId === id);

  useEffect(() => {
    if (!viewingTrade || isMentorView || !markFeedbackAsRead) return;
    const unread = getTradeFeedback(viewingTrade.id).filter(f => !f.read);
    if (unread.length > 0) markFeedbackAsRead(unread.map(f => f.id));
  }, [viewingTrade?.id, isMentorView]);

  const uniqueTickers = useMemo(() => [...new Set(state.trades.map(t => t.ticker))].sort(), [state.trades]);

  const filteredTrades = useMemo(() => {
    return state.trades
      .map(t => ({ ...t, derived: calcTradeDerived(t) }))
      .filter(t => {
        if (filters.dateStart && t.entryDate < filters.dateStart) return false;
        if (filters.dateEnd && t.entryDate > filters.dateEnd) return false;
        if (filters.tickers.length > 0 && !filters.tickers.includes(t.ticker)) return false;
        if (filters.assetTypes.length > 0 && !filters.assetTypes.includes(t.assetType)) return false;
        if (filters.positionTypes.length > 0 && !filters.positionTypes.includes(t.positionType)) return false;
        if (filters.setupIds.length > 0 && !filters.setupIds.includes(t.setupId)) return false;
        if (filters.mistakeIds.length > 0 && !t.mistakeIds.some(id => filters.mistakeIds.includes(id))) return false;
        if (filters.ratings.length > 0 && !filters.ratings.includes(t.rating || 0)) return false;
        if (filters.results.length > 0) {
          const res = t.derived.isOpen ? 'open' : t.derived.winLoss;
          if (!filters.results.includes(res)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let av, bv;
        switch (sortField) {
          case 'entryDate': av = a.entryDate || ''; bv = b.entryDate || ''; break;
          case 'exitDate': av = a.exitDate || ''; bv = b.exitDate || ''; break;
          case 'ticker': av = a.ticker || ''; bv = b.ticker || ''; break;
          case 'assetType': av = a.assetType || ''; bv = b.assetType || ''; break;
          case 'positionType': av = a.positionType || ''; bv = b.positionType || ''; break;
          case 'positionSize': av = a.positionSize || 0; bv = b.positionSize || 0; break;
          case 'entryPrice': av = a.entryPrice || 0; bv = b.entryPrice || 0; break;
          case 'exitPrice': av = a.exitPrice || 0; bv = b.exitPrice || 0; break;
          case 'length': av = a.derived.lengthDays || 0; bv = b.derived.lengthDays || 0; break;
          case 'pnl': av = a.derived.pnlFinal || 0; bv = b.derived.pnlFinal || 0; break;
          case 'rating': av = a.rating || 0; bv = b.rating || 0; break;
          case 'setup': av = state.setups.find(s => s.id === a.setupId)?.name || ''; bv = state.setups.find(s => s.id === b.setupId)?.name || ''; break;
          case 'mistakes': av = a.mistakeIds.length; bv = b.mistakeIds.length; break;
          default: av = a.entryDate || ''; bv = b.entryDate || '';
        }
        return sortDir === 'asc' ? (av > bv ? 1 : av < bv ? -1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0);
      });
  }, [state.trades, state.setups, filters, sortField, sortDir]);

  const summaryStats = useMemo(() => {
    const closed = filteredTrades.filter(t => !t.derived.isOpen);
    const wins = closed.filter(t => t.derived.winLoss === 'W');
    const losses = closed.filter(t => t.derived.winLoss === 'L');
    const totalPnL = closed.reduce((s, t) => s + (t.derived.pnlFinal || 0), 0);
    const grossProfit = wins.reduce((s, t) => s + (t.derived.pnlFinal || 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.derived.pnlFinal || 0), 0));
    const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(1) : 0;
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '∞' : '0.00';
    const avgTrade = closed.length > 0 ? totalPnL / closed.length : 0;
    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
    const riskRewardRatio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : avgWin > 0 ? '∞' : '0.00';
    const bestTrade = closed.length > 0 ? closed.reduce((b, t) => (t.derived.pnlFinal || 0) > (b.derived.pnlFinal || 0) ? t : b, closed[0]) : null;
    const worstTrade = closed.length > 0 ? closed.reduce((w, t) => (t.derived.pnlFinal || 0) < (w.derived.pnlFinal || 0) ? t : w, closed[0]) : null;
    const pnlByTicker = {};
    closed.forEach(t => { if (!pnlByTicker[t.ticker]) pnlByTicker[t.ticker] = { pnl: 0, count: 0 }; pnlByTicker[t.ticker].pnl += t.derived.pnlFinal || 0; pnlByTicker[t.ticker].count++; });
    const topTicker = Object.entries(pnlByTicker).sort((a, b) => b[1].pnl - a[1].pnl)[0];
    const pnlBySetup = {};
    closed.forEach(t => { if (!t.setupId) return; const s = state.setups.find(s => s.id === t.setupId); if (!s) return; if (!pnlBySetup[s.id]) pnlBySetup[s.id] = { name: s.name, pnl: 0, count: 0 }; pnlBySetup[s.id].pnl += t.derived.pnlFinal || 0; pnlBySetup[s.id].count++; });
    const topSetup = Object.values(pnlBySetup).sort((a, b) => b.pnl - a.pnl)[0];
    const ratedTrades = closed.filter(t => t.rating && t.rating > 0);
    const avgRating = ratedTrades.length > 0 ? ratedTrades.reduce((s, t) => s + t.rating, 0) / ratedTrades.length : 0;
    return {
      total: filteredTrades.length, closedCount: closed.length, openCount: filteredTrades.length - closed.length,
      totalPnL, wins: wins.length, losses: losses.length, winRate, profitFactor, avgTrade, avgWin, avgLoss, riskRewardRatio,
      bestTrade, worstTrade, topTicker: topTicker ? { ticker: topTicker[0], pnl: topTicker[1].pnl, count: topTicker[1].count } : null,
      topSetup, avgRating, ratedCount: ratedTrades.length,
    };
  }, [filteredTrades, state.setups]);

  const handleSort = (field) => { if (sortField === field) setSortDir(p => p === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('desc'); } };
  const toggleFilterItem = (field, value) => setFilters(prev => { const arr = prev[field]; return arr.includes(value) ? { ...prev, [field]: arr.filter(v => v !== value) } : { ...prev, [field]: [...arr, value] }; });
  const resetFilters = () => { setFilters({ dateStart: '', dateEnd: '', tickers: [], assetTypes: [], positionTypes: [], setupIds: [], mistakeIds: [], ratings: [], results: [] }); setOpenDropdown(null); };
  const hasActiveFilters = filters.dateStart !== '' || filters.dateEnd !== '' || filters.tickers.length > 0 || filters.assetTypes.length > 0 || filters.positionTypes.length > 0 || filters.setupIds.length > 0 || filters.mistakeIds.length > 0 || filters.ratings.length > 0 || filters.results.length > 0;

  const getSetupName = (setupId) => { if (!setupId) return '-'; return state.setups.find(s => s.id === setupId)?.name || '-'; };
  const getMistakeNames = (ids) => { if (!ids?.length) return '-'; return ids.map(id => state.mistakes.find(m => m.id === id)?.name).filter(Boolean).join(', ') || '-'; };
  const SortIndicator = ({ field }) => sortField !== field ? <span className="text-gray-300 ml-1">↕</span> : <span className="text-blue-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;

  const MultiSelectDropdown = ({ label, field, options }) => {
    const isOpen = openDropdown === field;
    const selected = filters[field];
    return (
      <div className="relative" data-dropdown="true">
        <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
        <button type="button" onClick={(e) => { e.stopPropagation(); setOpenDropdown(isOpen ? null : field); }}
          className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[100px] bg-white text-left flex items-center justify-between gap-2">
          <span className={selected.length === 0 ? 'text-gray-500' : 'text-gray-900'}>{selected.length === 0 ? 'All' : `${selected.length} selected`}</span>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {isOpen && (
          <div className="absolute z-20 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-2 border-b border-gray-100">
              <button type="button" onClick={(e) => { e.stopPropagation(); setFilters(prev => ({ ...prev, [field]: [] })); }} className="text-xs text-blue-600 hover:text-blue-800">Clear all</button>
            </div>
            {options.map((option, idx) => (
              <label key={idx} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={selected.includes(option.value)} onChange={(e) => { e.stopPropagation(); toggleFilterItem(field, option.value); }} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Trade Log</h1>
        {!isReadOnly && (
          <button onClick={() => { setEditingTrade(null); setModalOpen(true); }}
            className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
            {Icons.plus}<span className="hidden sm:inline">Add Trade</span><span className="sm:hidden">Add</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 md:p-4 overflow-x-auto" onClick={(e) => { if (!e.target.closest('[data-dropdown]')) setOpenDropdown(null); }}>
        <div className="flex flex-wrap items-end gap-2 md:gap-3 min-w-0">
          <div className="flex gap-2 items-end flex-shrink-0">
            <div>
              <label className="block text-[10px] md:text-xs font-medium text-gray-500 mb-1">From</label>
              <input type="date" value={filters.dateStart} onChange={(e) => setFilters(p => ({ ...p, dateStart: e.target.value }))} className="w-[115px] md:w-auto px-1.5 md:px-2 py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-medium text-gray-500 mb-1">To</label>
              <input type="date" value={filters.dateEnd} onChange={(e) => setFilters(p => ({ ...p, dateEnd: e.target.value }))} className="w-[115px] md:w-auto px-1.5 md:px-2 py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <MultiSelectDropdown label="Ticker" field="tickers" options={uniqueTickers.map(t => ({ value: t, label: t }))} />
          <MultiSelectDropdown label="Asset" field="assetTypes" options={ASSET_TYPES.map(t => ({ value: t.id, label: t.label }))} />
          <MultiSelectDropdown label="Position" field="positionTypes" options={POSITION_TYPES.map(t => ({ value: t.id, label: t.label }))} />
          <MultiSelectDropdown label="Setup" field="setupIds" options={state.setups.map(s => ({ value: s.id, label: s.name }))} />
          <MultiSelectDropdown label="Mistake" field="mistakeIds" options={state.mistakes.map(m => ({ value: m.id, label: m.name }))} />
          <MultiSelectDropdown label="Rating" field="ratings" options={[{value:0,label:'☆ No Rating'},{value:1,label:'★ 1 Star'},{value:2,label:'★★ 2 Stars'},{value:3,label:'★★★ 3 Stars'},{value:4,label:'★★★★ 4 Stars'},{value:5,label:'★★★★★ 5 Stars'}]} />
          <MultiSelectDropdown label="Result" field="results" options={[{value:'W',label:'Win'},{value:'L',label:'Loss'},{value:'BE',label:'Break-even'},{value:'open',label:'Open'}]} />
          {hasActiveFilters && <button onClick={resetFilters} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">Reset Filters</button>}
        </div>

        {/* Summary Stats */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Showing <span className="font-semibold text-gray-900">{summaryStats.total}</span> trades{summaryStats.openCount > 0 && <span className="text-gray-400"> ({summaryStats.openCount} open)</span>}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-2">
            {[
              { label: 'Total P&L', val: formatCurrencyShort(summaryStats.totalPnL), color: summaryStats.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600' },
              { label: 'Win Rate', val: `${summaryStats.winRate}%`, sub: <><span className="text-emerald-600">{summaryStats.wins}W</span> / <span className="text-red-600">{summaryStats.losses}L</span></> },
              { label: 'Profit Factor', val: summaryStats.profitFactor, color: parseFloat(summaryStats.profitFactor) >= 1 ? 'text-emerald-600' : 'text-red-600' },
              { label: 'Avg Trade', val: formatCurrencyShort(summaryStats.avgTrade), color: summaryStats.avgTrade >= 0 ? 'text-emerald-600' : 'text-red-600' },
              { label: 'R:R Ratio', val: `${summaryStats.riskRewardRatio}:1`, sub: <span className="text-[10px] text-gray-500">{formatCurrencyShort(summaryStats.avgWin)}/{formatCurrencyShort(summaryStats.avgLoss)}</span> },
            ].map((s, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] font-medium text-gray-500 mb-1">{s.label}</p>
                <p className={`text-lg font-bold ${s.color || 'text-gray-900'}`}>{s.val}</p>
                {s.sub && <p className="text-[10px] text-gray-500">{s.sub}</p>}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            <div className="bg-emerald-50 rounded-lg p-3"><p className="text-[10px] font-medium text-emerald-700 mb-1">Best Trade</p>{summaryStats.bestTrade ? <><p className="text-lg font-bold text-emerald-600">{formatCurrencyShort(summaryStats.bestTrade.derived.pnlFinal)}</p><p className="text-[10px] text-emerald-700 truncate">{summaryStats.bestTrade.ticker}</p></> : <p className="text-sm text-emerald-400">-</p>}</div>
            <div className="bg-red-50 rounded-lg p-3"><p className="text-[10px] font-medium text-red-700 mb-1">Worst Trade</p>{summaryStats.worstTrade ? <><p className="text-lg font-bold text-red-600">{formatCurrencyShort(summaryStats.worstTrade.derived.pnlFinal)}</p><p className="text-[10px] text-red-700 truncate">{summaryStats.worstTrade.ticker}</p></> : <p className="text-sm text-red-400">-</p>}</div>
            <div className="bg-blue-50 rounded-lg p-3"><p className="text-[10px] font-medium text-blue-700 mb-1">Top Ticker</p>{summaryStats.topTicker ? <><p className="text-lg font-bold text-blue-600">{summaryStats.topTicker.ticker}</p><p className="text-[10px] text-blue-700">{formatCurrencyShort(summaryStats.topTicker.pnl)} ({summaryStats.topTicker.count})</p></> : <p className="text-sm text-blue-400">-</p>}</div>
            <div className="bg-purple-50 rounded-lg p-3"><p className="text-[10px] font-medium text-purple-700 mb-1">Top Setup</p>{summaryStats.topSetup ? <><p className="text-sm font-bold text-purple-600 truncate">{summaryStats.topSetup.name}</p><p className="text-[10px] text-purple-700">{formatCurrencyShort(summaryStats.topSetup.pnl)} ({summaryStats.topSetup.count})</p></> : <p className="text-sm text-purple-400">-</p>}</div>
            <div className="bg-amber-50 rounded-lg p-3"><p className="text-[10px] font-medium text-amber-700 mb-1">Avg Rating</p>{summaryStats.ratedCount > 0 ? <><div className="flex items-center gap-1"><p className="text-lg font-bold text-amber-600">{summaryStats.avgRating.toFixed(1)}</p><span className="text-amber-500">★</span></div><p className="text-[10px] text-amber-700">{summaryStats.ratedCount} rated</p></> : <p className="text-sm text-amber-400">No ratings</p>}</div>
          </div>
        </div>
      </div>

      {/* Trades Table */}
      {filteredTrades.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">{Icons.tradelog}</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{state.trades.length === 0 ? 'No trades yet' : 'No trades match filters'}</h3>
          <p className="text-gray-500 mb-4">{state.trades.length === 0 ? 'Start tracking your trades to see your performance.' : 'Try adjusting your filters to see more trades.'}</p>
          {state.trades.length === 0 ? (
            <button onClick={() => { setEditingTrade(null); setModalOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">{Icons.plus}<span>Add Your First Trade</span></button>
          ) : (
            <button onClick={resetFilters} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">Reset Filters</button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[['entryDate','Entry Date'],['ticker','Ticker'],['assetType','Asset'],['positionType','Type'],['positionSize','Size'],['entryPrice','Entry'],['exitDate','Exit Date'],['exitPrice','Exit'],['length','Length'],['pnl','P&L'],['rating','Rating'],['setup','Setup'],['mistakes','Mistakes']].map(([f,l]) => (
                    <th key={f} onClick={() => handleSort(f)} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap">
                      {l} <SortIndicator field={f} />
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Notes</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Screenshot</th>
                  {(isReadOnly || activeFeedback.length > 0 || activeFlags.length > 0) && <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Feedback</th>}
                  {!isReadOnly && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTrades.map(trade => (
                  <tr key={trade.id} className={`hover:bg-gray-50 ${(isReadOnly || activeFeedback.length > 0) ? 'cursor-pointer' : ''}`}
                    onClick={(isReadOnly || activeFeedback.length > 0) ? () => setViewingTrade(trade) : undefined}>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{trade.entryDate}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{trade.ticker}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{ASSET_TYPES.find(a => a.id === trade.assetType)?.label || trade.assetType}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${trade.positionType === 'long' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{trade.positionType.toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{trade.positionSize}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{trade.entryPrice != null ? `$${trade.entryPrice.toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{trade.exitDate || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{trade.exitPrice != null ? `$${trade.exitPrice.toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{trade.derived.lengthDays != null ? `${trade.derived.lengthDays} days` : '-'}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {trade.derived.isOpen ? <span className="text-gray-400">Open</span> : (
                        <span className={`font-medium ${trade.derived.pnlFinal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(trade.derived.pnlFinal)}{trade.derived.pnlMismatch && <span className="ml-1 text-amber-500" title="Manual P&L differs from calculated">⚠</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap"><StarRating value={trade.rating || 0} readonly size="sm" /></td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap max-w-[150px] truncate" title={getSetupName(trade.setupId)}>{getSetupName(trade.setupId)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap max-w-[150px] truncate" title={getMistakeNames(trade.mistakeIds)}>{getMistakeNames(trade.mistakeIds)}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {trade.notes ? (
                        <button onClick={() => { openNotesModal(trade.notes, `${trade.ticker} - ${trade.entryDate}`); }} className="text-left max-w-[150px] hover:bg-gray-100 rounded px-2 py-1 -mx-2 -my-1 transition-colors group" title="Click to expand">
                          <p className="text-gray-600 truncate text-xs" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal' }}>{trade.notes}</p>
                          {trade.notes.length > 50 && <span className="text-blue-500 text-xs group-hover:underline">more...</span>}
                        </button>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {trade.screenshot ? (
                        <button onClick={() => { setImageModalData({ src: trade.screenshot, title: `${trade.ticker} - ${trade.entryDate}`, trade }); setImageModalOpen(true); }} className="inline-block hover:opacity-80 transition-opacity">
                          <img src={trade.screenshot} alt="Screenshot" className="w-12 h-12 object-cover rounded border border-gray-200 hover:border-blue-400 transition-colors" />
                        </button>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    {(isReadOnly || activeFeedback.length > 0 || activeFlags.length > 0 || tradeQuestions.length > 0) && (
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {(() => {
                          const feedback = getTradeFeedback(trade.id);
                          const flag = getTradeFlag(trade.id);
                          const questions = getTradeQuestions(trade.id);
                          if (!feedback.length && !flag && !questions.length) return <span className="text-gray-300">-</span>;
                          const hasUnread = feedback.some(f => !f.read);
                          const hasUnanswered = questions.some(q => q.status === 'asked');
                          const hasAnswered = questions.some(q => q.status === 'answered' && !isMentorView);
                          return (
                            <div className="flex items-center justify-center gap-1">
                              {flag && <span className={`text-sm ${flag.status === 'resolved' ? 'opacity-50' : ''}`} title={`${FLAG_TYPES[flag.flagType]?.label || 'Flagged'}${flag.status === 'resolved' ? ' (Resolved)' : ''}`}>{FLAG_TYPES[flag.flagType]?.icon || '🚩'}</span>}
                              {questions.length > 0 && <span className={`text-sm relative ${hasUnanswered ? 'animate-pulse' : ''}`} title={`${questions.length} question(s)`}>❓{hasUnanswered && <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" />}{hasAnswered && <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />}</span>}
                              {feedback.length > 0 && (
                                <div className={`flex items-center gap-0.5 ${hasUnread ? 'relative' : ''}`}>
                                  {[...new Set(feedback.map(f => f.type))].slice(0, 2).map((type, idx) => <span key={idx} className="text-sm" title={FEEDBACK_TYPES[type]?.label}>{FEEDBACK_TYPES[type]?.icon || '💬'}</span>)}
                                  {feedback.length > 1 && <span className="text-xs bg-gray-200 text-gray-600 px-1 rounded">{feedback.length}</span>}
                                  {hasUnread && <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    )}
                    {!isReadOnly && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => { setEditingTrade(trade); setModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit trade">{Icons.edit}</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <TradeModal isOpen={modalOpen} onClose={() => setModalOpen(false)} trade={editingTrade} state={state} setState={setState} />
      <ImageModal isOpen={imageModalOpen} onClose={() => setImageModalOpen(false)} src={imageModalData.src} title={imageModalData.title} trade={imageModalData.trade} state={state} setState={setState} getSetupName={getSetupName} getMistakeNames={getMistakeNames} />
      <NotesModal isOpen={notesModalOpen} onClose={() => setNotesModalOpen(false)} notes={notesModalData.notes} title={notesModalData.title} />

      {/* Trade View Modal */}
      {viewingTrade && (isReadOnly || activeFeedback.length > 0) && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setViewingTrade(null)} />
          <div className="relative min-h-screen flex items-start md:items-center justify-center p-2 md:p-4 pt-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between rounded-t-xl z-10">
                <div><h2 className="text-lg md:text-xl font-semibold text-gray-900">{viewingTrade.ticker} - {viewingTrade.entryDate}</h2><p className="text-sm text-gray-500">{isMentorView ? 'Trade Details (Read-Only)' : 'Trade Details & Feedback'}</p></div>
                <button onClick={() => setViewingTrade(null)} className="p-2 hover:bg-gray-100 rounded-lg">{Icons.x}</button>
              </div>
              <div className="p-4 md:p-6 space-y-6">
                <div className={`p-4 rounded-xl ${viewingTrade.derived?.pnlFinal >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <p className="text-sm text-gray-600 mb-1">P&L</p>
                  <p className={`text-3xl font-bold ${viewingTrade.derived?.pnlFinal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{viewingTrade.derived?.isOpen ? 'Open' : formatCurrency(viewingTrade.derived?.pnlFinal || 0)}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[['Asset Type', ASSET_TYPES.find(a => a.id === viewingTrade.assetType)?.label || viewingTrade.assetType],['Position', viewingTrade.positionType],['Size', viewingTrade.positionSize],['Entry Price', viewingTrade.entryPrice != null ? `$${viewingTrade.entryPrice.toFixed(2)}` : '-'],['Exit Date', viewingTrade.exitDate || '-'],['Exit Price', viewingTrade.exitPrice != null ? `$${viewingTrade.exitPrice.toFixed(2)}` : '-']].map(([l,v]) => (
                    <div key={l}><p className="text-xs text-gray-500 mb-1">{l}</p><p className="font-medium capitalize">{v}</p></div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-gray-500 mb-1">Setup</p><p className="font-medium">{getSetupName(viewingTrade.setupId)}</p></div>
                  <div><p className="text-xs text-gray-500 mb-1">Mistakes</p><p className="font-medium">{getMistakeNames(viewingTrade.mistakeIds) || 'None'}</p></div>
                </div>
                <div><p className="text-xs text-gray-500 mb-1">Rating</p><StarRating value={viewingTrade.rating || 0} readonly size="md" /></div>
                {viewingTrade.notes && <div><p className="text-xs text-gray-500 mb-1">Notes</p><p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">{viewingTrade.notes}</p></div>}
                {viewingTrade.screenshot && (
                  <div><p className="text-xs text-gray-500 mb-2">Screenshot</p>
                    <img src={viewingTrade.screenshot} alt="Screenshot" className="w-full rounded-lg border border-gray-200 cursor-pointer hover:opacity-90"
                      onClick={() => { setImageModalData({ src: viewingTrade.screenshot, title: `${viewingTrade.ticker} - ${viewingTrade.entryDate}`, trade: viewingTrade }); setImageModalOpen(true); }} />
                  </div>
                )}

                {/* Flag Section */}
                {(() => {
                  const flag = getTradeFlag(viewingTrade.id);
                  return (
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-gray-700">Trade Flag</p>
                        {isMentorView && flag && onToggleFlagStatus && (
                          <button onClick={() => onToggleFlagStatus(viewingTrade.id)} className={`text-xs px-2 py-1 rounded ${flag.status === 'open' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            {flag.status === 'open' ? 'Mark Resolved' : 'Reopen'}
                          </button>
                        )}
                      </div>
                      {flag ? (
                        <div className={`p-3 rounded-lg border ${FLAG_TYPES[flag.flagType]?.bgColor || 'bg-gray-50'} ${flag.status === 'resolved' ? 'opacity-60' : ''}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{FLAG_TYPES[flag.flagType]?.icon || '🚩'}</span>
                            <span className={`font-medium ${FLAG_TYPES[flag.flagType]?.textColor || 'text-gray-700'}`}>{FLAG_TYPES[flag.flagType]?.label || 'Flagged'}</span>
                            {flag.status === 'resolved' && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Resolved</span>}
                          </div>
                          {flag.note && <p className="text-sm text-gray-600 mt-1">{flag.note}</p>}
                          <p className="text-xs text-gray-400 mt-2">Flagged by {flag.mentorName}</p>
                          {isMentorView && onRemoveFlag && <button onClick={() => onRemoveFlag(viewingTrade.id)} className="text-xs text-red-500 hover:text-red-700 mt-2">Remove Flag</button>}
                        </div>
                      ) : isMentorView && onAddFlag ? (
                        <div className="relative">
                          <button onClick={() => setShowFlagMenu(!showFlagMenu)} className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700">
                            <span>🚩</span><span>Flag this Trade</span>
                            <svg className={`w-4 h-4 transition-transform ${showFlagMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                          {showFlagMenu && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[200px]">
                              {Object.entries(FLAG_TYPES).map(([key, val]) => (
                                <button key={key} onClick={() => { onAddFlag(viewingTrade.id, key); setShowFlagMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm">
                                  <span>{val.icon}</span><span>{val.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : <p className="text-sm text-gray-400">No flag on this trade</p>}
                    </div>
                  );
                })()}

                {/* Feedback Section */}
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">Mentor Feedback</p>
                  {(() => {
                    const feedback = getTradeFeedback(viewingTrade.id);
                    return feedback.length > 0 ? (
                      <div className="space-y-3 mb-4">
                        {feedback.map(fb => {
                          const ti = FEEDBACK_TYPES[fb.type] || FEEDBACK_TYPES.general;
                          return (
                            <div key={fb.id} className={`p-3 rounded-lg border ${ti.bgColor} ${ti.borderColor}`}>
                              <div className="flex items-start gap-2"><span className="text-lg flex-shrink-0">{ti.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1"><span className={`text-xs font-medium ${ti.textColor}`}>{ti.label}</span>{!fb.read && !isMentorView && <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">New</span>}</div>
                                  <p className="text-sm text-gray-700">{fb.content}</p>
                                  <p className="text-xs text-gray-400 mt-2">{fb.mentorName} • {fb.createdAt?.toDate ? fb.createdAt.toDate().toLocaleDateString() : 'Just now'}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="text-sm text-gray-400 mb-4">No feedback yet</p>;
                  })()}
                  {isMentorView && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-700 mb-3">Add Feedback</p>
                      <div className="mb-3"><label className="block text-xs text-gray-500 mb-1">Feedback Type</label>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(FEEDBACK_TYPES).map(([key, val]) => (
                            <button key={key} onClick={() => setFeedbackType(key)} className={`flex items-center gap-1 px-2 py-1 rounded text-sm border transition-colors ${feedbackType === key ? `${val.bgColor} ${val.textColor} ${val.borderColor}` : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                              <span>{val.icon}</span><span className="hidden sm:inline">{val.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mb-3"><textarea value={feedbackContent} onChange={(e) => setFeedbackContent(e.target.value)} placeholder="Write your feedback..." rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                      <button onClick={async () => { if (!feedbackContent.trim() || !onAddFeedback) return; setSubmittingFeedback(true); try { const ok = await onAddFeedback(viewingTrade.id, feedbackType, feedbackContent); if (ok) { setFeedbackContent(''); setFeedbackType('general'); } } catch(e){} setSubmittingFeedback(false); }}
                        disabled={!feedbackContent.trim() || submittingFeedback || !onAddFeedback}
                        className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {submittingFeedback ? 'Adding...' : 'Add Feedback'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Questions Section */}
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">💬 Questions & Discussion</p>
                  {(() => {
                    const questions = getTradeQuestions(viewingTrade.id);
                    return questions.length > 0 ? (
                      <div className="space-y-4 mb-4">
                        {questions.map(q => (
                          <div key={q.id} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-start gap-2 mb-2"><span className="text-lg">❓</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-0.5 rounded">{q.questionType === 'entry' ? 'Entry Question' : q.questionType === 'exit' ? 'Exit Question' : q.questionType === 'improvement' ? 'How to Improve' : 'Question'}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded ${q.status === 'asked' ? 'bg-orange-100 text-orange-600' : q.status === 'answered' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>{q.status === 'asked' ? '⏳ Awaiting Answer' : q.status === 'answered' ? '💬 Answered' : '✅ Resolved'}</span>
                                </div>
                                <p className="text-sm text-gray-700">{q.question}</p>
                                <p className="text-xs text-gray-400 mt-1">{q.studentName || 'You'} • {q.createdAt?.toDate ? q.createdAt.toDate().toLocaleDateString() : 'Just now'}</p>
                              </div>
                            </div>
                            {q.answer && (
                              <div className="ml-6 mt-2 pl-3 border-l-2 border-blue-300">
                                <div className="flex items-start gap-2"><span className="text-lg">💡</span>
                                  <div><p className="text-sm text-gray-700">{q.answer}</p><p className="text-xs text-gray-400 mt-1">{q.mentorName || 'Mentor'} • {q.answeredAt?.toDate ? q.answeredAt.toDate().toLocaleDateString() : 'Just now'}</p></div>
                                </div>
                              </div>
                            )}
                            {isMentorView && q.status === 'asked' && onAnswerQuestion && (
                              <div className="ml-6 mt-3 pl-3 border-l-2 border-gray-200">
                                <textarea value={answerContents[q.id] || ''} onChange={(e) => setAnswerContents(p => ({ ...p, [q.id]: e.target.value }))} placeholder="Write your answer..." rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <button onClick={async () => { const ans = answerContents[q.id]?.trim(); if (!ans) return; setSubmittingAnswerId(q.id); try { await onAnswerQuestion(q.id, ans); setAnswerContents(p => ({ ...p, [q.id]: '' })); } catch(e){} setSubmittingAnswerId(null); }}
                                  disabled={!answerContents[q.id]?.trim() || submittingAnswerId === q.id}
                                  className="mt-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                  {submittingAnswerId === q.id ? 'Sending...' : 'Send Answer'}
                                </button>
                              </div>
                            )}
                            {q.status === 'answered' && onResolveQuestion && (
                              <div className="ml-6 mt-2"><button onClick={() => onResolveQuestion(q.id)} className="text-xs text-green-600 hover:text-green-700 font-medium">✓ Mark as Resolved</button></div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-gray-400 mb-4">No questions yet</p>;
                  })()}
                  {!isMentorView && userProfile?.mentorId && onAskQuestion && (
                    !showQuestionForm ? (
                      <button onClick={() => setShowQuestionForm(true)} className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium text-sm"><span>❓</span><span>Ask Mentor a Question</span></button>
                    ) : (
                      <div className="bg-purple-50 rounded-lg p-4">
                        <p className="text-sm font-medium text-purple-700 mb-3">Ask Your Mentor</p>
                        <div className="mb-3"><label className="block text-xs text-gray-500 mb-1">Question Type</label>
                          <div className="flex flex-wrap gap-2">
                            {[{key:'entry',label:'Entry',icon:'📈'},{key:'exit',label:'Exit',icon:'📉'},{key:'improvement',label:'How to Improve',icon:'🎯'},{key:'general',label:'General',icon:'💬'}].map(({key,label,icon}) => (
                              <button key={key} onClick={() => setQuestionType(key)} className={`flex items-center gap-1 px-2 py-1 rounded text-sm border transition-colors ${questionType === key ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><span>{icon}</span><span>{label}</span></button>
                            ))}
                          </div>
                        </div>
                        <textarea value={questionContent} onChange={(e) => setQuestionContent(e.target.value)} placeholder="Ask your mentor anything about this trade..." rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3" />
                        <div className="flex gap-2">
                          <button onClick={() => { setShowQuestionForm(false); setQuestionContent(''); setQuestionType('general'); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancel</button>
                          <button onClick={async () => { if (!questionContent.trim()) return; setSubmittingQuestion(true); try { const ok = await onAskQuestion(viewingTrade.id, questionType, questionContent.trim()); if (ok) { setQuestionContent(''); setQuestionType('general'); setShowQuestionForm(false); } } catch(e){} setSubmittingQuestion(false); }}
                            disabled={!questionContent.trim() || submittingQuestion} className="flex-1 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50">
                            {submittingQuestion ? 'Sending...' : 'Send Question'}
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function openNotesModal(notes, title) { setNotesModalData({ notes, title }); setNotesModalOpen(true); }
}
