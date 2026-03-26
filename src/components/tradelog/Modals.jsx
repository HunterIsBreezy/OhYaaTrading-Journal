import { useState, useEffect } from 'react';
import { nowISO, calcTradeDerived, formatCurrency } from '../../utils/helpers';
import { StarRating } from '../shared/StarRatingAvatar';

// =============================================================================
// IMAGE MODAL
// =============================================================================
export function ImageModal({ isOpen, onClose, src, title, trade, state, setState, getSetupName, getMistakeNames }) {
  const [notes, setNotes] = useState(trade?.notes || '');

  useEffect(() => { setNotes(trade?.notes || ''); }, [trade]);

  if (!isOpen || !src) return null;

  const handleSaveNotes = () => {
    if (trade && setState) {
      setState(prev => ({
        ...prev,
        trades: prev.trades.map(t => t.id === trade.id ? { ...t, notes, updatedAt: nowISO() } : t),
      }));
    }
    onClose();
  };

  const derivedTrade = trade ? { ...trade, derived: trade.derived || calcTradeDerived(trade) } : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/80" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
            <div className="flex-1 p-4 overflow-auto">
              <img src={src} alt={title} className="w-full rounded-lg" />
            </div>
            {trade && setState && (
              <div className="lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 p-4 bg-gray-50 flex flex-col overflow-auto">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex-shrink-0">Trade Notes</h4>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes for this trade..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-shrink-0"
                  style={{ minHeight: '200px', resize: 'none' }} />
                <button onClick={handleSaveNotes} className="mt-2 w-full px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0">
                  Save Notes
                </button>
                {derivedTrade && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 flex-shrink-0">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">P&L</span>
                      <span className={`font-medium ${(derivedTrade.derived?.pnlFinal || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(derivedTrade.derived?.pnlFinal)}
                      </span>
                    </div>
                    {getSetupName && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Setup</span>
                        <span className="text-gray-900">{getSetupName(derivedTrade.setupId)}</span>
                      </div>
                    )}
                    {getMistakeNames && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Mistakes</span>
                        <span className="text-gray-900 text-right max-w-[150px]">{getMistakeNames(derivedTrade.mistakeIds)}</span>
                      </div>
                    )}
                    {derivedTrade.rating > 0 && (
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-gray-500">Rating</span>
                        <StarRating value={derivedTrade.rating} readonly size="sm" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// NOTES MODAL
// =============================================================================
export function NotesModal({ isOpen, onClose, notes, title }) {
  if (!isOpen || !notes) return null;

  const getModalWidth = () => {
    if (notes.length < 200) return 'max-w-sm';
    if (notes.length < 500) return 'max-w-md';
    if (notes.length < 1000) return 'max-w-lg';
    return 'max-w-xl';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div className={`relative ${getModalWidth()} w-full bg-white rounded-xl shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{title || 'Trade Notes'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gray-500">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{notes}</p>
        </div>
      </div>
    </div>
  );
}
