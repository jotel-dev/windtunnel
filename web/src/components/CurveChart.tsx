'use client';

import React from 'react';

interface CurvePoint {
  fillPct: number;
  quoteReserveSol: number;
  priceSol: number;
}

interface FeePoint {
  slot: number;
  feePct: number;
}

interface CurveChartProps {
  curvePoints: CurvePoint[];
  feePoints: FeePoint[];
  initialMarketCap: number;
  migrationMarketCap: number;
  startingFeeBps: number;
  endingFeeBps: number;
}

export function CurveChart({
  curvePoints,
  feePoints,
  initialMarketCap,
  migrationMarketCap,
  startingFeeBps,
  endingFeeBps,
}: CurveChartProps) {
  // SVG Dimensions
  const width = 500;
  const height = 240;
  const padding = { top: 25, right: 30, bottom: 40, left: 65 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // 1. Calculate price curve path
  const maxPrice = Math.max(...curvePoints.map(p => p.priceSol), 0.00000001);
  const minPrice = Math.min(...curvePoints.map(p => p.priceSol), 0);

  const getX = (pct: number) => padding.left + (pct / 100) * chartW;
  const getY = (val: number) => padding.top + chartH - ((val - minPrice) / (maxPrice - minPrice || 1)) * chartH;

  const pathD = curvePoints.reduce((acc, pt, i) => {
    const x = getX(pt.fillPct);
    const y = getY(pt.priceSol);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  const areaD = `${pathD} L ${padding.left + chartW} ${padding.top + chartH} L ${padding.left} ${padding.top + chartH} Z`;

  // 2. Calculate fee decay path
  const maxSlot = Math.max(...feePoints.map(p => p.slot), 100);
  const maxFee = Math.max(...feePoints.map(p => p.feePct), 1);
  const getFeeX = (s: number) => padding.left + (s / maxSlot) * chartW;
  const getFeeY = (f: number) => padding.top + chartH - (f / maxFee) * chartH;

  const feePathD = feePoints.reduce((acc, pt, i) => {
    const x = getFeeX(pt.slot);
    const y = getFeeY(pt.feePct);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  const feeAreaD = `${feePathD} L ${padding.left + chartW} ${padding.top + chartH - 40} L ${padding.left} ${padding.top + chartH - 40} Z`;

  return (
    <div className="space-y-6">
      {/* Price Curve Chart */}
      <div className="card-neo p-5 bg-[#161B22] border-2 border-[#E6EDF3]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#8B949E]">
              Live Bonding Curve Model
            </span>
            <h4 className="font-serif text-lg font-bold text-white">
              Price vs. Curve Fill
            </h4>
          </div>
          <div className="badge-neo-solana text-xs">
            {(migrationMarketCap / initialMarketCap).toFixed(1)}x Expansion
          </div>
        </div>

        <div className="relative w-full overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
            {/* Grid lines */}
            <line x1={padding.left} y1={padding.top} x2={padding.left + chartW} y2={padding.top} stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="4 4" />
            <line x1={padding.left} y1={padding.top + chartH / 2} x2={padding.left + chartW} y2={padding.top + chartH / 2} stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="4 4" />
            <line x1={padding.left} y1={padding.top + chartH} x2={padding.left + chartW} y2={padding.top + chartH} stroke="#30363D" strokeWidth="2" />
            <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartH} stroke="#30363D" strokeWidth="2" />

            {/* Filled area */}
            <path d={areaD} fill="#14F195" fillOpacity="0.12" />

            {/* Price Line */}
            <path d={pathD} fill="none" stroke="#14F195" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

            {/* Graduation target marker */}
            <circle cx={padding.left + chartW} cy={getY(maxPrice)} r="5" fill="#F4805D" stroke="#FFFFFF" strokeWidth="2" />

            {/* Y Axis labels */}
            <text x={padding.left - 8} y={padding.top + 5} textAnchor="end" fontSize="10" fontWeight="600" fill="#8B949E">
              {maxPrice.toExponential(2)}
            </text>
            <text x={padding.left - 8} y={padding.top + chartH} textAnchor="end" fontSize="10" fontWeight="600" fill="#8B949E">
              {minPrice.toExponential(2)}
            </text>

            {/* X Axis labels */}
            <text x={padding.left} y={padding.top + chartH + 20} textAnchor="middle" fontSize="11" fontWeight="600" fill="#8B949E">
              0%
            </text>
            <text x={padding.left + chartW * 0.5} y={padding.top + chartH + 20} textAnchor="middle" fontSize="11" fontWeight="600" fill="#8B949E">
              50% Fill
            </text>
            <text x={padding.left + chartW} y={padding.top + chartH + 20} textAnchor="middle" fontSize="11" fontWeight="700" fill="#14F195">
              100% (Graduation)
            </text>
          </svg>
        </div>

        <div className="flex items-center justify-between text-xs text-[#8B949E] mt-2 pt-2 border-t border-[#30363D]">
          <span>Initial: <strong className="text-white">{initialMarketCap} SOL</strong></span>
          <span>Target: <strong className="text-white">{migrationMarketCap} SOL</strong></span>
        </div>
      </div>

      {/* Fee Scheduler Decay Chart */}
      <div className="card-neo p-5 bg-[#161B22] border-2 border-[#E6EDF3]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#8B949E]">
              Anti-Sniper Fee Barrier
            </span>
            <h4 className="font-serif text-lg font-bold text-white">
              Dynamic Fee Decay Schedule
            </h4>
          </div>
          <div className="badge-neo-coral text-xs">
            {(startingFeeBps / 100).toFixed(1)}% → {(endingFeeBps / 100).toFixed(1)}%
          </div>
        </div>

        <div className="relative w-full overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height - 40}`} className="w-full h-auto select-none">
            {/* Grid lines */}
            <line x1={padding.left} y1={padding.top} x2={padding.left + chartW} y2={padding.top} stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="4 4" />
            <line x1={padding.left} y1={padding.top + (chartH - 40) / 2} x2={padding.left + chartW} y2={padding.top + (chartH - 40) / 2} stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="4 4" />
            <line x1={padding.left} y1={padding.top + chartH - 40} x2={padding.left + chartW} y2={padding.top + chartH - 40} stroke="#30363D" strokeWidth="2" />
            <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartH - 40} stroke="#30363D" strokeWidth="2" />

            {/* Fee Decay Area */}
            <path d={feeAreaD} fill="#F4805D" fillOpacity="0.1" />

            {/* Fee Decay Line */}
            <path d={feePathD} fill="none" stroke="#F4805D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

            {/* Y Axis labels */}
            <text x={padding.left - 8} y={padding.top + 5} textAnchor="end" fontSize="10" fontWeight="600" fill="#8B949E">
              {(startingFeeBps / 100).toFixed(1)}%
            </text>
            <text x={padding.left - 8} y={padding.top + chartH - 40} textAnchor="end" fontSize="10" fontWeight="600" fill="#8B949E">
              {(endingFeeBps / 100).toFixed(1)}%
            </text>

            {/* X Axis labels */}
            <text x={padding.left} y={padding.top + chartH - 20} textAnchor="middle" fontSize="11" fontWeight="600" fill="#8B949E">
              Slot 0
            </text>
            <text x={padding.left + chartW} y={padding.top + chartH - 20} textAnchor="middle" fontSize="11" fontWeight="600" fill="#8B949E">
              Slot {maxSlot}
            </text>
          </svg>
        </div>

        <p className="text-xs text-[#8B949E] mt-1">
          High fee during the first slots penalizes early snipers and directs 20% to creator revenue, decaying linearly to the floor fee.
        </p>
      </div>
    </div>
  );
}
