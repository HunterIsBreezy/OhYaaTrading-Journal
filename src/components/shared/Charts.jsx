import { useState } from 'react';
import { formatCurrency, formatCurrencyShort } from '../../utils/helpers';

// =============================================================================
// LINE CHART
// =============================================================================
export function SimpleLineChart({ data, width = 700, height = 350, onPointClick }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const chartRef = useState(null)[0]; // will use useRef below
  const [ref, setRef] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center text-gray-400 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
        <div className="text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-3 text-gray-300">
            <path d="M3 3v18h18" />
            <path d="M7 14l4-4 4 4 5-5" />
          </svg>
          <p className="font-medium text-gray-500">No P&L Data Yet</p>
          <p className="text-sm text-gray-400 mt-1">Complete some trades to see your performance chart</p>
        </div>
      </div>
    );
  }

  const padding = { top: 20, right: 50, bottom: 45, left: 65 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.map((d) => d.cumulative);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(0, ...values);
  const range = maxVal - minVal || 1;
  const paddedMin = minVal - range * 0.1;
  const paddedMax = maxVal + range * 0.1;
  const paddedRange = paddedMax - paddedMin;

  const getX = (index) => {
    if (data.length === 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (data.length - 1)) * chartWidth;
  };
  const getY = (value) =>
    padding.top + chartHeight - ((value - paddedMin) / paddedRange) * chartHeight;

  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.cumulative)}`)
    .join(' ');

  const zeroY = getY(0);
  const finalValue = data[data.length - 1]?.cumulative || 0;
  const startValue = data[0]?.cumulative || 0;
  const isPositive = finalValue >= 0;
  const changePercent =
    startValue !== 0
      ? (((finalValue - startValue) / Math.abs(startValue)) * 100).toFixed(1)
      : 0;

  const areaPath = `${pathD} L ${getX(data.length - 1)} ${zeroY} L ${padding.left} ${zeroY} Z`;

  const yLabels = [];
  const numYLabels = 5;
  for (let i = 0; i <= numYLabels; i++) {
    const value = paddedMin + (paddedRange * (numYLabels - i)) / numYLabels;
    yLabels.push({ value: Math.round(value), y: padding.top + (chartHeight * i) / numYLabels });
  }

  const xLabels = [];
  const maxXLabels = Math.min(data.length, 7);
  const step = Math.max(1, Math.floor((data.length - 1) / (maxXLabels - 1)));
  for (let i = 0; i < data.length; i += step) {
    xLabels.push({ date: data[i].date, x: getX(i) });
  }
  if (
    xLabels.length > 0 &&
    data.length > 1 &&
    xLabels[xLabels.length - 1].date !== data[data.length - 1].date
  ) {
    xLabels.push({ date: data[data.length - 1].date, x: getX(data.length - 1) });
  }

  const highestPoint = Math.max(...values);
  const lowestPoint = Math.min(...values);
  const avgValue = values.reduce((a, b) => a + b, 0) / values.length;

  const handleMouseMove = (e) => {
    if (!ref) return;
    const rect = ref.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const svgX = (mouseX / rect.width) * width;
    const svgY = (mouseY / rect.height) * height;
    setMousePos({ x: mouseX, y: mouseY });

    let closestIdx = 0;
    let closestDist = Infinity;
    data.forEach((d, i) => {
      const dist = Math.abs(svgX - getX(i));
      if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    });

    if (
      svgX >= padding.left - 30 && svgX <= width - padding.right + 30 &&
      svgY >= padding.top - 20 && svgY <= height - padding.bottom + 20
    ) {
      setHoveredPoint(closestIdx);
    } else {
      setHoveredPoint(null);
    }
  };

  const hoveredData = hoveredPoint !== null ? data[hoveredPoint] : null;
  const prevData = hoveredPoint !== null && hoveredPoint > 0 ? data[hoveredPoint - 1] : null;
  const dayChange =
    hoveredData && prevData
      ? hoveredData.cumulative - prevData.cumulative
      : hoveredData && hoveredPoint === 0
      ? hoveredData.cumulative
      : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-3 md:px-6 py-3 md:py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <div>
            <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5 md:mb-1">Cumulative P&L</p>
            <div className="flex items-baseline gap-2 md:gap-3">
              <span className={`text-xl md:text-3xl font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(finalValue)}
              </span>
              <span className={`inline-flex items-center px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {isPositive ? '↑' : '↓'} {Math.abs(changePercent)}%
              </span>
            </div>
          </div>
          <div className="flex gap-3 md:gap-6 text-right">
            <div>
              <p className="text-[10px] md:text-xs text-gray-500">Peak</p>
              <p className="text-xs md:text-sm font-semibold text-emerald-600">{formatCurrencyShort(highestPoint)}</p>
            </div>
            <div>
              <p className="text-[10px] md:text-xs text-gray-500">Trough</p>
              <p className="text-xs md:text-sm font-semibold text-red-600">{formatCurrencyShort(lowestPoint)}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] md:text-xs text-gray-500">Average</p>
              <p className={`text-xs md:text-sm font-semibold ${avgValue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrencyShort(avgValue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-1 md:px-2 py-2 relative" ref={setRef}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full cursor-crosshair"
          style={{ height: '280px' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="areaGradientPos" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="areaGradientNeg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill="#fafbfc" rx="4" />

          {yLabels.map((label, i) => (
            <g key={i}>
              <line
                x1={padding.left} y1={label.y}
                x2={width - padding.right} y2={label.y}
                stroke={Math.abs(label.value) < 1 ? '#64748b' : '#e5e7eb'}
                strokeWidth={Math.abs(label.value) < 1 ? 1.5 : 1}
                strokeDasharray={Math.abs(label.value) < 1 ? '0' : '4,4'}
              />
              <text x={padding.left - 8} y={label.y + 4} textAnchor="end" fontSize="10" fill="#6b7280" fontWeight="500">
                {formatCurrencyShort(label.value)}
              </text>
            </g>
          ))}

          <path d={areaPath} fill={isPositive ? 'url(#areaGradientPos)' : 'url(#areaGradientNeg)'} />
          <path d={pathD} fill="none" stroke={isPositive ? '#10b981' : '#ef4444'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />

          {hoveredPoint !== null && (
            <line x1={getX(hoveredPoint)} y1={padding.top} x2={getX(hoveredPoint)} y2={height - padding.bottom}
              stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.8" />
          )}

          {data.map((d, i) => {
            const x = getX(i);
            const y = getY(d.cumulative);
            const ptPositive = d.cumulative >= 0;
            const isLast = i === data.length - 1;
            const isHovered = i === hoveredPoint;
            return (
              <g key={i} onClick={() => onPointClick && data[i] && onPointClick(data[i])} style={{ cursor: onPointClick ? 'pointer' : 'crosshair' }}>
                {(isLast || isHovered) && (
                  <circle cx={x} cy={y} r={isHovered ? 14 : 10} fill={isHovered ? '#6366f1' : ptPositive ? '#10b981' : '#ef4444'} opacity="0.25">
                    {isLast && !isHovered && (
                      <>
                        <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
                      </>
                    )}
                  </circle>
                )}
                <circle cx={x} cy={y} r={isHovered ? 9 : isLast ? 7 : 5} fill="white" stroke={isHovered ? '#6366f1' : ptPositive ? '#10b981' : '#ef4444'} strokeWidth="2.5" />
                <circle cx={x} cy={y} r={isHovered ? 5 : isLast ? 4 : 3} fill={isHovered ? '#6366f1' : ptPositive ? '#10b981' : '#ef4444'} />
              </g>
            );
          })}

          {xLabels.map((label, i) => (
            <text key={i} x={label.x} y={height - padding.bottom + 18} textAnchor="middle" fontSize="10" fill="#6b7280" fontWeight="500">
              {label.date.slice(5)}
            </text>
          ))}
        </svg>

        {hoveredData && (
          <div
            className="absolute pointer-events-none bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl text-sm z-10 border border-gray-700"
            style={{
              left: Math.min(Math.max(mousePos.x - 75, 10), (ref?.offsetWidth || 400) - 170),
              top: Math.max(mousePos.y - 90, 10),
            }}
          >
            <p className="font-semibold text-gray-300 text-xs mb-1">{hoveredData.date}</p>
            <p className={`text-xl font-bold ${hoveredData.cumulative >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(hoveredData.cumulative)}
            </p>
            {dayChange !== null && (
              <p className={`text-xs mt-1 ${dayChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {dayChange >= 0 ? '+' : ''}{formatCurrency(dayChange)} this day
              </p>
            )}
            {onPointClick && <p className="text-xs text-indigo-400 mt-2 font-medium">Click to view details →</p>}
          </div>
        )}
      </div>

      <div className="px-3 md:px-6 py-2 md:py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1 md:gap-2">
            <div className="w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] md:text-xs text-gray-600">Profit</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <div className="w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-red-500" />
            <span className="text-[10px] md:text-xs text-gray-600">Loss</span>
          </div>
        </div>
        <div className="text-[10px] md:text-xs text-gray-500">
          {data.length} trade{data.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PIE CHART
// =============================================================================
export function SimplePieChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>;
  }
  const total = data.reduce((sum, d) => sum + Math.abs(d.value), 0);
  if (total === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>;
  }

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
  let currentAngle = 0;
  const slices = data.map((d, i) => {
    const percentage = Math.abs(d.value) / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);
    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    return {
      ...d,
      path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: colors[i % colors.length],
      percentage: (percentage * 100).toFixed(1),
    };
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-32 h-32">
        {slices.map((slice, i) => (
          <path key={i} d={slice.path} fill={slice.color} stroke="white" strokeWidth="1" />
        ))}
      </svg>
      <div className="flex-1 space-y-1">
        {slices.map((slice, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: slice.color }} />
            <span className="text-gray-600">{slice.label}</span>
            <span className="text-gray-400 ml-auto">{slice.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// BAR CHART
// =============================================================================
export function SimpleBarChart({ data, showValues = true }) {
  if (!data || data.length === 0) {
    return <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No data</div>;
  }
  const maxVal = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-20 truncate" title={d.label}>{d.label}</span>
          <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
            <div
              className={`h-full rounded ${d.value >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
              style={{ width: `${(Math.abs(d.value) / maxVal) * 100}%` }}
            />
          </div>
          {showValues && (
            <span className={`text-xs font-medium w-16 text-right ${d.value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(d.value)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// SETUP SUCCESS BAR CHART
// =============================================================================
export function SetupBarChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No setups used</div>;
  }
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-700 font-medium">{d.name}</span>
            <span className="text-gray-500">{d.wins}W / {d.losses}L ({d.winRate}%)</span>
          </div>
          <div className="h-4 bg-gray-100 rounded overflow-hidden flex">
            {d.wins > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(d.wins / d.total) * 100}%` }} />}
            {d.losses > 0 && <div className="h-full bg-red-500" style={{ width: `${(d.losses / d.total) * 100}%` }} />}
          </div>
        </div>
      ))}
    </div>
  );
}
