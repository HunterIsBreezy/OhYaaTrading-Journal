import { useState, useEffect, useMemo, useRef } from 'react';
import { ASSET_TYPES, POSITION_TYPES, PNL_MISMATCH_THRESHOLD } from '../../utils/constants';
import { todayISO, nowISO, generateId, calcTradeDerived, formatCurrency } from '../../utils/helpers';
import { StarRating } from '../shared/StarRatingAvatar';
import Icons from '../shared/Icons';

export default function TradeModal({ isOpen, onClose, trade, state, setState }) {
  const isEdit = trade !== null && trade?.id !== undefined;
  const fileInputRef = useRef(null);

  const [pnlInputTab, setPnlInputTab] = useState(
    () => localStorage.getItem('pnlInputTab') || 'entry_exit'
  );

  const handleTabChange = (tab) => {
    setPnlInputTab(tab);
    localStorage.setItem('pnlInputTab', tab);
  };

  const emptyForm = {
    entryDate: todayISO(),
    ticker: '',
    assetType: 'stock',
    positionType: 'long',
    positionSize: '',
    entryPrice: '',
    exitDate: '',
    exitPrice: '',
    pnlManual: '',
    dailyTotalPnl: '',
    setupId: '',
    mistakeIds: [],
    notes: '',
    screenshot: null,
    rating: 0,
  };

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [showTickerDropdown, setShowTickerDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (trade && trade.id) {
        setForm({
          entryDate: trade.entryDate || todayISO(),
          ticker: trade.ticker || '',
          assetType: trade.assetType || 'stock',
          positionType: trade.positionType || 'long',
          positionSize: trade.positionSize?.toString() || '',
          entryPrice: trade.entryPrice?.toString() || '',
          exitDate: trade.exitDate || '',
          exitPrice: trade.exitPrice?.toString() || '',
          pnlManual: trade.pnlManual?.toString() || '',
          dailyTotalPnl: '',
          setupId: trade.setupId || '',
          mistakeIds: trade.mistakeIds || [],
          notes: trade.notes || '',
          screenshot: trade.screenshot || null,
          rating: trade.rating || 0,
        });
      } else if (trade && trade.entryDate) {
        setForm({ ...emptyForm, entryDate: trade.entryDate });
      } else {
        setForm(emptyForm);
      }
      setErrors({});
      setShowDeleteConfirm(false);
    }
  }, [isOpen, trade]);

  const previousTickers = useMemo(() => {
    const tickersByDate = state.trades
      .sort((a, b) => (b.entryDate || '').localeCompare(a.entryDate || ''))
      .map((t) => t.ticker);
    const uniqueTickers = [...new Set(tickersByDate)];
    if (form.ticker) {
      return uniqueTickers
        .filter((t) => t.toLowerCase().includes(form.ticker.toLowerCase()))
        .slice(0, 10);
    }
    return uniqueTickers.slice(0, 10);
  }, [state.trades, form.ticker]);

  const sizeLabel = ASSET_TYPES.find((a) => a.id === form.assetType)?.sizeLabel || 'Shares';

  const otherTradesPnlOnDate = useMemo(() => {
    const selectedDate = form.entryDate;
    if (!selectedDate) return 0;
    const otherTrades = state.trades.filter((t) => {
      if (t.entryDate !== selectedDate) return false;
      if (trade?.id && t.id === trade.id) return false;
      return true;
    });
    return otherTrades.reduce((sum, t) => {
      const derived = calcTradeDerived(t);
      return sum + (derived.pnlFinal || 0);
    }, 0);
  }, [form.entryDate, state.trades, trade?.id]);

  const dailyTotalCalcPnl = useMemo(() => {
    if (!form.dailyTotalPnl || form.dailyTotalPnl === '') return null;
    const dailyTotal = parseFloat(form.dailyTotalPnl);
    if (isNaN(dailyTotal)) return null;
    return Math.round((dailyTotal - otherTradesPnlOnDate) * 100) / 100;
  }, [form.dailyTotalPnl, otherTradesPnlOnDate]);

  const liveCalc = useMemo(() => {
    const hasExit = form.exitDate && form.exitPrice;
    let lengthDays = null;
    let pnlCalculated = null;
    if (hasExit && form.entryDate) {
      lengthDays = Math.round(
        (new Date(form.exitDate) - new Date(form.entryDate)) / (1000 * 60 * 60 * 24)
      );
    }
    if (hasExit && form.entryPrice && form.positionSize) {
      const entryP = parseFloat(form.entryPrice);
      const exitP = parseFloat(form.exitPrice);
      const size = parseFloat(form.positionSize);
      if (!isNaN(entryP) && !isNaN(exitP) && !isNaN(size)) {
        pnlCalculated = form.positionType === 'long'
          ? (exitP - entryP) * size
          : (entryP - exitP) * size;
        pnlCalculated = Math.round(pnlCalculated * 100) / 100;
      }
    }
    let pnlMismatch = false;
    if (form.pnlManual !== '' && pnlCalculated !== null) {
      const manual = parseFloat(form.pnlManual);
      if (!isNaN(manual)) {
        pnlMismatch = Math.abs(manual - pnlCalculated) > PNL_MISMATCH_THRESHOLD;
      }
    }
    return { lengthDays, pnlCalculated, pnlMismatch };
  }, [form]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const selectTicker = (ticker) => {
    const previousTrade = state.trades
      .filter((t) => t.ticker.toUpperCase() === ticker.toUpperCase())
      .sort((a, b) => (b.entryDate || '').localeCompare(a.entryDate || ''))[0];
    if (previousTrade) {
      setForm((prev) => ({
        ...prev,
        ticker,
        assetType: previousTrade.assetType || prev.assetType,
        positionSize: previousTrade.positionSize?.toString() || prev.positionSize,
      }));
    } else {
      handleChange('ticker', ticker);
    }
    setShowTickerDropdown(false);
  };

  const handleAssetTypeChange = (assetType) => {
    const previousTrade = state.trades
      .filter(
        (t) =>
          t.ticker.toUpperCase() === form.ticker.toUpperCase() &&
          t.assetType === assetType
      )
      .sort((a, b) => (b.entryDate || '').localeCompare(a.entryDate || ''))[0];
    if (previousTrade?.positionSize) {
      setForm((prev) => ({
        ...prev,
        assetType,
        positionSize: previousTrade.positionSize.toString(),
      }));
    } else {
      const anyPrevious = state.trades
        .filter((t) => t.assetType === assetType)
        .sort((a, b) => (b.entryDate || '').localeCompare(a.entryDate || ''))[0];
      setForm((prev) => ({
        ...prev,
        assetType,
        positionSize: anyPrevious?.positionSize?.toString() || prev.positionSize,
      }));
    }
  };

  const toggleMistake = (mistakeId) => {
    setForm((prev) => ({
      ...prev,
      mistakeIds: prev.mistakeIds.includes(mistakeId)
        ? prev.mistakeIds.filter((id) => id !== mistakeId)
        : [...prev.mistakeIds, mistakeId],
    }));
  };

  const handleScreenshotUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please upload an image file.'); return; }
    try {
      const compressedBase64 = await compressImage(file, 200 * 1024);
      handleChange('screenshot', compressedBase64);
    } catch (error) {
      alert(error.message);
    }
    e.target.value = '';
  };

  const compressImage = (file, maxSizeBytes) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = () => reject(new Error('Failed to read file'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let { width, height } = img;
        const maxDim = 1920;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        const tryCompress = (w, h, q) => {
          canvas.width = w; canvas.height = h;
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const base64 = canvas.toDataURL('image/jpeg', q);
          const sizeBytes = Math.round((base64.length - 'data:image/jpeg;base64,'.length) * 0.75);
          return { base64, sizeBytes };
        };
        let cw = width, ch = height, q = 0.9;
        let result = tryCompress(cw, ch, q);
        while (result.sizeBytes > maxSizeBytes && q > 0.1) { q -= 0.1; result = tryCompress(cw, ch, q); }
        while (result.sizeBytes > maxSizeBytes && cw > 200) {
          cw = Math.round(cw * 0.8); ch = Math.round(ch * 0.8); q = 0.8;
          result = tryCompress(cw, ch, q);
          while (result.sizeBytes > maxSizeBytes && q > 0.1) { q -= 0.1; result = tryCompress(cw, ch, q); }
        }
        if (result.sizeBytes > maxSizeBytes) reject(new Error('Unable to compress image below 200KB. Please use a smaller image.'));
        else resolve(result.base64);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      reader.readAsDataURL(file);
    });

  const validate = () => {
    const newErrors = {};
    if (!form.entryDate) newErrors.entryDate = 'Required';
    if (!form.ticker.trim()) newErrors.ticker = 'Required';
    if (!form.assetType) newErrors.assetType = 'Required';
    if (!form.positionType) newErrors.positionType = 'Required';
    if (pnlInputTab === 'entry_exit') {
      if (!form.positionSize) newErrors.positionSize = 'Required';
      else if (parseFloat(form.positionSize) <= 0) newErrors.positionSize = 'Must be > 0';
      if (form.entryPrice && parseFloat(form.entryPrice) < 0) newErrors.entryPrice = 'Must be >= 0';
      if (form.exitPrice && parseFloat(form.exitPrice) < 0) newErrors.exitPrice = 'Must be >= 0';
      if (form.exitDate && form.entryDate && form.exitDate < form.entryDate) newErrors.exitDate = 'Must be >= entry date';
    }
    if (pnlInputTab === 'direct' && (!form.pnlManual || form.pnlManual === '')) newErrors.pnlManual = 'Required';
    if (pnlInputTab === 'daily_total' && (!form.dailyTotalPnl || form.dailyTotalPnl === '')) newErrors.dailyTotalPnl = 'Required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const now = nowISO();
    let finalPnlManual = null;
    if (pnlInputTab === 'direct' && form.pnlManual) finalPnlManual = parseFloat(form.pnlManual);
    else if (pnlInputTab === 'daily_total' && dailyTotalCalcPnl !== null) finalPnlManual = dailyTotalCalcPnl;

    const tradeData = {
      id: trade?.id || generateId(),
      entryDate: form.entryDate,
      ticker: form.ticker.toUpperCase().trim(),
      assetType: form.assetType,
      positionType: form.positionType,
      positionSize: pnlInputTab === 'entry_exit' ? parseFloat(form.positionSize) : null,
      entryPrice: pnlInputTab === 'entry_exit' && form.entryPrice ? parseFloat(form.entryPrice) : null,
      exitDate: pnlInputTab === 'entry_exit' && form.exitDate ? form.exitDate : null,
      exitPrice: pnlInputTab === 'entry_exit' && form.exitPrice ? parseFloat(form.exitPrice) : null,
      pnlManual: finalPnlManual,
      setupId: form.setupId || null,
      mistakeIds: form.mistakeIds,
      notes: form.notes,
      screenshot: form.screenshot,
      rating: form.rating || 0,
      createdAt: trade?.createdAt || now,
      updatedAt: now,
    };

    if (isEdit) {
      setState((prev) => ({ ...prev, trades: prev.trades.map((t) => (t.id === trade.id ? tradeData : t)) }));
    } else {
      setState((prev) => ({ ...prev, trades: [...prev.trades, tradeData] }));
    }
    onClose();
  };

  const handleDelete = () => {
    setState((prev) => ({ ...prev, trades: prev.trades.filter((t) => t.id !== trade.id) }));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative min-h-screen flex items-start md:items-center justify-center p-2 md:p-4 pt-4 md:pt-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between rounded-t-xl z-10">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">
              {isEdit ? 'Edit Trade' : 'Add Trade'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">{Icons.x}</button>
          </div>

          {/* Form */}
          <div className="p-4 md:p-6 space-y-3 md:space-y-6">
            {/* Row 1: Entry Date, Ticker */}
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Entry Date <span className="text-red-500">*</span></label>
                <input type="date" value={form.entryDate} onChange={(e) => handleChange('entryDate', e.target.value)} max={todayISO()}
                  className={`w-full px-2 md:px-3 py-1.5 md:py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.entryDate ? 'border-red-500' : 'border-gray-300'}`} />
                {errors.entryDate && <p className="text-red-500 text-xs mt-1">{errors.entryDate}</p>}
              </div>
              <div className="relative">
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Ticker <span className="text-red-500">*</span></label>
                <input type="text" value={form.ticker}
                  onChange={(e) => { handleChange('ticker', e.target.value.toUpperCase()); setShowTickerDropdown(true); }}
                  onFocus={() => setShowTickerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowTickerDropdown(false), 200)}
                  placeholder="AAPL"
                  className={`w-full px-2 md:px-3 py-1.5 md:py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.ticker ? 'border-red-500' : 'border-gray-300'}`} />
                {showTickerDropdown && previousTickers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    <div className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-100">Recent tickers</div>
                    {previousTickers.map((ticker) => (
                      <button key={ticker} type="button" onClick={() => selectTicker(ticker)} className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm">{ticker}</button>
                    ))}
                  </div>
                )}
                {errors.ticker && <p className="text-red-500 text-xs mt-1">{errors.ticker}</p>}
              </div>
            </div>

            {/* Row 2: Asset Type, Position Type */}
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Asset <span className="text-red-500">*</span></label>
                <select value={form.assetType} onChange={(e) => handleAssetTypeChange(e.target.value)}
                  className="w-full px-2 md:px-3 py-1.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ASSET_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Position <span className="text-red-500">*</span></label>
                <div className="flex gap-1 md:gap-2">
                  {POSITION_TYPES.map((type) => (
                    <button key={type.id} type="button" onClick={() => handleChange('positionType', type.id)}
                      className={`flex-1 py-1.5 md:py-2 px-2 md:px-4 rounded-lg border text-xs md:text-sm font-medium transition-colors ${
                        form.positionType === type.id
                          ? type.id === 'long' ? 'bg-emerald-100 border-emerald-500 text-emerald-700' : 'bg-red-100 border-red-500 text-red-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* P&L Input Tabs */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex bg-gray-50 border-b border-gray-200">
                {[
                  { id: 'entry_exit', label: 'Entry/Exit' },
                  { id: 'direct', label: 'Trade P&L' },
                  { id: 'daily_total', label: 'Daily Total' },
                ].map((tab) => (
                  <button key={tab.id} type="button" onClick={() => handleTabChange(tab.id)}
                    className={`flex-1 py-2.5 px-3 text-xs md:text-sm font-medium transition-colors ${
                      pnlInputTab === tab.id
                        ? 'bg-white text-blue-600 border-b-2 border-blue-600 -mb-px'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-3 md:p-4 bg-white">
                {/* Entry/Exit Tab */}
                {pnlInputTab === 'entry_exit' && (
                  <div className="space-y-3 md:space-y-4">
                    <div className="grid grid-cols-2 gap-2 md:gap-4">
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">{sizeLabel} <span className="text-red-500">*</span></label>
                        <input type="number" value={form.positionSize} onChange={(e) => handleChange('positionSize', e.target.value)} placeholder="100" step="any" min="0"
                          className={`w-full px-2 md:px-3 py-1.5 md:py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.positionSize ? 'border-red-500' : 'border-gray-300'}`} />
                        {errors.positionSize && <p className="text-red-500 text-xs mt-1">{errors.positionSize}</p>}
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Entry Price</label>
                        <div className="relative">
                          <span className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                          <input type="number" value={form.entryPrice} onChange={(e) => handleChange('entryPrice', e.target.value)} placeholder="0.00" step="any" min="0"
                            className={`w-full pl-5 md:pl-7 pr-2 md:pr-3 py-1.5 md:py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.entryPrice ? 'border-red-500' : 'border-gray-300'}`} />
                        </div>
                        {errors.entryPrice && <p className="text-red-500 text-xs mt-1">{errors.entryPrice}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:gap-4">
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Exit Date</label>
                        <input type="date" value={form.exitDate} onChange={(e) => handleChange('exitDate', e.target.value)} min={form.entryDate} max={todayISO()}
                          className={`w-full px-2 md:px-3 py-1.5 md:py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.exitDate ? 'border-red-500' : 'border-gray-300'}`} />
                        {errors.exitDate && <p className="text-red-500 text-xs mt-1">{errors.exitDate}</p>}
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Exit Price</label>
                        <div className="relative">
                          <span className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                          <input type="number" value={form.exitPrice} onChange={(e) => handleChange('exitPrice', e.target.value)} placeholder="0.00" step="any" min="0"
                            className={`w-full pl-5 md:pl-7 pr-2 md:pr-3 py-1.5 md:py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.exitPrice ? 'border-red-500' : 'border-gray-300'}`} />
                        </div>
                        {errors.exitPrice && <p className="text-red-500 text-xs mt-1">{errors.exitPrice}</p>}
                      </div>
                    </div>
                    {(liveCalc.lengthDays !== null || liveCalc.pnlCalculated !== null) && (
                      <div className="bg-gray-50 rounded-lg p-3 md:p-4 flex gap-4 md:gap-6">
                        {liveCalc.lengthDays !== null && (
                          <div><p className="text-[10px] md:text-xs text-gray-500">Length</p><p className="text-sm md:text-lg font-semibold text-gray-900">{liveCalc.lengthDays}d</p></div>
                        )}
                        {liveCalc.pnlCalculated !== null && (
                          <div>
                            <p className="text-[10px] md:text-xs text-gray-500">Trade P&L</p>
                            <p className={`text-sm md:text-lg font-semibold ${liveCalc.pnlCalculated >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {liveCalc.pnlCalculated >= 0 ? '+' : ''}{formatCurrency(liveCalc.pnlCalculated)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Direct P&L Tab */}
                {pnlInputTab === 'direct' && (
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Trade P&L <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <input type="number" value={form.pnlManual} onChange={(e) => handleChange('pnlManual', e.target.value)}
                        placeholder="Enter profit or loss (e.g., 150 or -75)" step="any"
                        className={`w-full pl-5 md:pl-7 pr-2 md:pr-3 py-2.5 md:py-3 text-sm md:text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.pnlManual ? 'border-red-500' : 'border-gray-300'}`} />
                    </div>
                    {errors.pnlManual && <p className="text-red-500 text-xs mt-1">{errors.pnlManual}</p>}
                    <p className="text-xs text-gray-500 mt-2">Enter positive for profit, negative for loss</p>
                    {form.pnlManual && !isNaN(parseFloat(form.pnlManual)) && (
                      <div className="mt-3 bg-gray-50 rounded-lg p-3 md:p-4">
                        <p className="text-[10px] md:text-xs text-gray-500 mb-1">Trade P&L</p>
                        <p className={`text-xl md:text-2xl font-bold ${parseFloat(form.pnlManual) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {parseFloat(form.pnlManual) >= 0 ? '+' : ''}{formatCurrency(parseFloat(form.pnlManual))}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Daily Total Tab */}
                {pnlInputTab === 'daily_total' && (
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Daily Total P&L <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <input type="number" value={form.dailyTotalPnl} onChange={(e) => handleChange('dailyTotalPnl', e.target.value)}
                        placeholder="Enter your total P&L for the day" step="any"
                        className={`w-full pl-5 md:pl-7 pr-2 md:pr-3 py-2.5 md:py-3 text-sm md:text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.dailyTotalPnl ? 'border-red-500' : 'border-gray-300'}`} />
                    </div>
                    {errors.dailyTotalPnl && <p className="text-red-500 text-xs mt-1">{errors.dailyTotalPnl}</p>}
                    <div className="mt-3 bg-gray-50 rounded-lg p-3 md:p-4 space-y-2">
                      <div className="flex justify-between text-xs md:text-sm">
                        <span className="text-gray-500">Other trades on {form.entryDate}:</span>
                        <span className={`font-medium ${otherTradesPnlOnDate >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {otherTradesPnlOnDate >= 0 ? '+' : ''}{formatCurrency(otherTradesPnlOnDate)}
                        </span>
                      </div>
                      {dailyTotalCalcPnl !== null && (
                        <div className="border-t border-gray-200 pt-2">
                          <p className="text-[10px] md:text-xs text-gray-500 mb-1">This Trade's P&L</p>
                          <p className={`text-xl md:text-2xl font-bold ${dailyTotalCalcPnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {dailyTotalCalcPnl >= 0 ? '+' : ''}{formatCurrency(dailyTotalCalcPnl)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Setup */}
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Setup</label>
              <select value={form.setupId} onChange={(e) => handleChange('setupId', e.target.value)}
                className="w-full px-2 md:px-3 py-1.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">No setup selected</option>
                {state.setups.map((setup) => <option key={setup.id} value={setup.id}>{setup.name}</option>)}
              </select>
            </div>

            {/* Mistakes */}
            {state.mistakes.length > 0 && (
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Mistakes</label>
                <div className="flex flex-wrap gap-1.5 md:gap-2">
                  {state.mistakes.map((mistake) => (
                    <button key={mistake.id} type="button" onClick={() => toggleMistake(mistake.id)}
                      className={`px-2 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-medium transition-colors ${
                        form.mistakeIds.includes(mistake.id)
                          ? 'bg-red-100 text-red-700 border-2 border-red-300'
                          : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                      }`}>
                      {mistake.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Screenshot */}
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Screenshot</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleScreenshotUpload} className="hidden" />
              {form.screenshot ? (
                <div className="relative">
                  <img src={form.screenshot} alt="Trade screenshot" className="w-full max-h-32 md:max-h-48 object-contain rounded-lg border border-gray-200 bg-gray-50" />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <span className="px-2 py-1 bg-black/60 text-white text-[10px] md:text-xs rounded">
                      {Math.round((form.screenshot.length - 'data:image/jpeg;base64,'.length) * 0.75 / 1024)}KB
                    </span>
                    <button type="button" onClick={() => handleChange('screenshot', null)} className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600">{Icons.x}</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 md:py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors flex flex-col items-center gap-1 md:gap-2 text-gray-500">
                  {Icons.upload}
                  <span className="text-xs md:text-sm">Tap to upload</span>
                </button>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} placeholder="Trade notes..." rows={2}
                className="w-full px-2 md:px-3 py-1.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            {/* Rating */}
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Rating</label>
              <div className="flex items-center gap-2 md:gap-3">
                <StarRating value={form.rating} onChange={(rating) => handleChange('rating', rating)} size="lg" />
                {form.rating > 0 && (
                  <span className="text-xs md:text-sm text-gray-500">
                    {['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent'][form.rating]}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between rounded-b-xl">
            <div>
              {isEdit && (
                showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600">Delete this trade?</span>
                    <button type="button" onClick={handleDelete} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Yes, Delete</button>
                    <button type="button" onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300">Cancel</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    {Icons.trash} <span>Delete</span>
                  </button>
                )
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              <button type="button" onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                {isEdit ? 'Save Changes' : 'Add Trade'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
