import {
  ASSET_TYPES,
  BE_THRESHOLD,
  PNL_MISMATCH_THRESHOLD,
  STORAGE_KEY,
  STORAGE_LIMIT_BYTES,
  STORAGE_WARNING_PERCENT,
  EMPTY_STATE,
} from './constants';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function nowISO() {
  return new Date().toISOString();
}

export function generateId() {
  return crypto.randomUUID();
}

/** Get week bounds (Monday to Sunday) for a given date */
export function getWeekBounds(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

/** Get list of recent weeks for dropdown */
export function getRecentWeeks(count = 8) {
  const weeks = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 7);
    weeks.push(getWeekBounds(d));
  }
  return weeks;
}

/** Format week range for display */
export function formatWeekRange(start, end) {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const options = { month: 'short', day: 'numeric' };
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}, ${endDate.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Trade calculations
// ---------------------------------------------------------------------------
export function calcTradeDerived(trade) {
  const hasManualPnl =
    trade.pnlManual !== null &&
    trade.pnlManual !== undefined &&
    String(trade.pnlManual).trim() !== '';

  const hasExit =
    trade.exitDate !== null &&
    trade.exitDate !== '' &&
    trade.exitPrice !== null &&
    trade.exitPrice !== undefined;

  const isOpen = !hasExit && !hasManualPnl;

  let lengthDays = null;
  if (trade.entryDate && trade.exitDate) {
    const entry = new Date(trade.entryDate);
    const exit = new Date(trade.exitDate);
    lengthDays = Math.round((exit - entry) / (1000 * 60 * 60 * 24));
  }

  let pnlCalculated = null;
  if (
    hasExit &&
    trade.entryPrice != null &&
    trade.exitPrice != null &&
    trade.positionSize != null
  ) {
    if (trade.positionType === 'long') {
      pnlCalculated = (trade.exitPrice - trade.entryPrice) * trade.positionSize;
    } else {
      pnlCalculated = (trade.entryPrice - trade.exitPrice) * trade.positionSize;
    }
    pnlCalculated = Math.round(pnlCalculated * 100) / 100;
  }

  const pnlFinal = hasManualPnl ? parseFloat(trade.pnlManual) : pnlCalculated;

  let pnlMismatch = false;
  if (hasManualPnl && pnlCalculated !== null) {
    pnlMismatch =
      Math.abs(parseFloat(trade.pnlManual) - pnlCalculated) > PNL_MISMATCH_THRESHOLD;
  }

  let winLoss = null;
  if (pnlFinal !== null && !isNaN(pnlFinal)) {
    if (pnlFinal > BE_THRESHOLD) {
      winLoss = 'W';
    } else if (pnlFinal < -BE_THRESHOLD) {
      winLoss = 'L';
    } else {
      winLoss = 'BE';
    }
  }

  return { lengthDays, pnlCalculated, pnlFinal, winLoss, pnlMismatch, isOpen };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '$0.00';
  const prefix = amount >= 0 ? '+' : '';
  return (
    prefix +
    '$' +
    Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatCurrencyShort(amount) {
  if (amount === null || amount === undefined) return '$0';
  const absAmount = Math.abs(amount);
  const prefix = amount >= 0 ? '+' : '-';
  if (absAmount >= 1_000_000) {
    return prefix + '$' + (absAmount / 1_000_000).toFixed(1) + 'M';
  } else if (absAmount >= 1_000) {
    return prefix + '$' + (absAmount / 1_000).toFixed(1) + 'K';
  }
  return prefix + '$' + absAmount.toFixed(0);
}

// ---------------------------------------------------------------------------
// Weekly stats
// ---------------------------------------------------------------------------
export function calculateWeekStats(trades, weekStart, weekEnd, setups = [], mistakes = []) {
  const weekTrades = trades
    .filter((t) => {
      const date = t.exitDate || t.entryDate;
      return date >= weekStart && date <= weekEnd;
    })
    .map((t) => ({ ...t, derived: calcTradeDerived(t) }));

  const closedTrades = weekTrades.filter((t) => !t.derived.isOpen);
  const wins = closedTrades.filter((t) => t.derived.winLoss === 'W');
  const losses = closedTrades.filter((t) => t.derived.winLoss === 'L');
  const pnls = closedTrades.map((t) => t.derived.pnlFinal || 0);

  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.derived.pnlFinal || 0), 0);
  const winRate =
    closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;

  const bestTrade =
    closedTrades.length > 0
      ? closedTrades.reduce(
          (best, t) =>
            (t.derived.pnlFinal || 0) > (best.derived.pnlFinal || 0) ? t : best,
          closedTrades[0]
        )
      : null;
  const worstTrade =
    closedTrades.length > 0
      ? closedTrades.reduce(
          (worst, t) =>
            (t.derived.pnlFinal || 0) < (worst.derived.pnlFinal || 0) ? t : worst,
          closedTrades[0]
        )
      : null;

  const avgWin =
    wins.length > 0
      ? wins.reduce((sum, t) => sum + (t.derived.pnlFinal || 0), 0) / wins.length
      : 0;
  const avgLoss =
    losses.length > 0
      ? Math.abs(
          losses.reduce((sum, t) => sum + (t.derived.pnlFinal || 0), 0) / losses.length
        )
      : 0;
  const riskRewardRatio =
    avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : avgWin > 0 ? '∞' : '0.00';

  const ratedTrades = closedTrades.filter((t) => t.rating && t.rating > 0);
  const avgRating =
    ratedTrades.length > 0
      ? ratedTrades.reduce((sum, t) => sum + t.rating, 0) / ratedTrades.length
      : 0;

  const pnlByAsset = {};
  closedTrades.forEach((t) => {
    const asset =
      ASSET_TYPES.find((a) => a.id === t.assetType)?.label || t.assetType || 'Unknown';
    if (!pnlByAsset[asset]) pnlByAsset[asset] = 0;
    pnlByAsset[asset] += t.derived.pnlFinal || 0;
  });
  const assetPieData = Object.entries(pnlByAsset).map(([label, value]) => ({
    label,
    value,
  }));

  const pnlByTicker = {};
  closedTrades.forEach((t) => {
    if (!pnlByTicker[t.ticker]) pnlByTicker[t.ticker] = 0;
    pnlByTicker[t.ticker] += t.derived.pnlFinal || 0;
  });
  const tickerPnLData = Object.entries(pnlByTicker)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const tradePnLData = closedTrades.map((t) => ({
    label: t.ticker,
    value: t.derived.pnlFinal || 0,
  }));

  const setupStats = {};
  closedTrades.forEach((t) => {
    if (!t.setupId) return;
    const setup = setups.find((s) => s.id === t.setupId);
    if (!setup) return;
    if (!setupStats[setup.id]) {
      setupStats[setup.id] = {
        id: setup.id,
        name: setup.name,
        wins: 0,
        losses: 0,
        total: 0,
        totalPnL: 0,
      };
    }
    setupStats[setup.id].total++;
    setupStats[setup.id].totalPnL += t.derived.pnlFinal || 0;
    if (t.derived.winLoss === 'W') setupStats[setup.id].wins++;
    if (t.derived.winLoss === 'L') setupStats[setup.id].losses++;
  });
  const setupData = Object.values(setupStats)
    .map((s) => ({
      ...s,
      winRate: s.total > 0 ? ((s.wins / s.total) * 100).toFixed(0) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const mistakeStats = {};
  closedTrades.forEach((t) => {
    if (!t.mistakeIds || t.mistakeIds.length === 0) return;
    const pnl = t.derived.pnlFinal || 0;
    t.mistakeIds.forEach((mistakeId) => {
      const mistake = mistakes.find((m) => m.id === mistakeId);
      if (!mistake) return;
      if (!mistakeStats[mistakeId]) {
        mistakeStats[mistakeId] = {
          id: mistakeId,
          name: mistake.name,
          totalOccurrences: 0,
          losingTrades: 0,
          profitableTrades: 0,
          totalLossAmount: 0,
        };
      }
      mistakeStats[mistakeId].totalOccurrences++;
      if (pnl < 0) {
        mistakeStats[mistakeId].losingTrades++;
        mistakeStats[mistakeId].totalLossAmount += pnl;
      } else {
        mistakeStats[mistakeId].profitableTrades++;
      }
    });
  });
  const mistakeData = Object.values(mistakeStats).sort(
    (a, b) => b.totalOccurrences - a.totalOccurrences
  );
  const totalMistakeOccurrences = mistakeData.reduce(
    (sum, m) => sum + m.totalOccurrences,
    0
  );
  const totalMistakeLoss = mistakeData.reduce((sum, m) => sum + m.totalLossAmount, 0);

  const dailyPnL = {};
  closedTrades.forEach((t) => {
    const date = t.exitDate || t.entryDate;
    if (!dailyPnL[date]) dailyPnL[date] = { pnl: 0, trades: 0, wins: 0 };
    dailyPnL[date].pnl += t.derived.pnlFinal || 0;
    dailyPnL[date].trades++;
    if (t.derived.winLoss === 'W') dailyPnL[date].wins++;
  });
  const dailyBreakdown = Object.entries(dailyPnL)
    .map(([date, data]) => ({
      date,
      ...data,
      winRate:
        data.trades > 0 ? ((data.wins / data.trades) * 100).toFixed(0) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const greenDays = dailyBreakdown.filter((d) => d.pnl > 0).length;
  const redDays = dailyBreakdown.filter((d) => d.pnl < 0).length;
  const tradingDays = dailyBreakdown.length;

  return {
    totalTrades: closedTrades.length,
    totalPnL,
    winRate,
    wins: wins.length,
    losses: losses.length,
    biggestWin: pnls.length > 0 ? Math.max(0, ...pnls) : 0,
    biggestLoss: pnls.length > 0 ? Math.min(0, ...pnls) : 0,
    bestTrade,
    worstTrade,
    avgWin,
    avgLoss,
    riskRewardRatio,
    avgRating,
    ratedTradesCount: ratedTrades.length,
    assetPieData,
    tickerPnLData,
    tradePnLData,
    setupData,
    mistakeData,
    totalMistakeOccurrences,
    totalMistakeLoss,
    dailyBreakdown,
    tradingDays,
    greenDays,
    redDays,
    trades: weekTrades,
    closedTradesList: closedTrades,
  };
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
export function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...EMPTY_STATE };
    const parsed = JSON.parse(stored);
    if (
      !parsed.trades ||
      !parsed.setups ||
      !parsed.mistakes ||
      !parsed.dailyNotes
    ) {
      return { ...EMPTY_STATE };
    }
    return parsed;
  } catch (error) {
    console.error('Error loading state:', error);
    return { ...EMPTY_STATE };
  }
}

export function saveState(state) {
  const jsonString = JSON.stringify(state);
  const storageInfo = getStorageInfo(jsonString);
  if (storageInfo.percentUsed >= 100) {
    throw new Error('Storage quota exceeded. Please export and clear old data.');
  }
  localStorage.setItem(STORAGE_KEY, jsonString);
  return storageInfo;
}

export function getStorageInfo(jsonString) {
  const str = jsonString || localStorage.getItem(STORAGE_KEY) || '';
  const bytes = new Blob([str]).size;
  const megabytes = Math.round((bytes / (1024 * 1024)) * 100) / 100;
  const percentUsed = Math.round((bytes / STORAGE_LIMIT_BYTES) * 100);
  return {
    bytes,
    megabytes,
    percentUsed,
    nearLimit: percentUsed >= STORAGE_WARNING_PERCENT,
  };
}
