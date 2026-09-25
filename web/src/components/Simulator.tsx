'use client';

import React, { useState, useEffect } from 'react';
import { CurveChart } from './CurveChart';

interface SimulationScorecard {
  sniperExtractionPct: number;
  sniperNetProfitSol: number;
  sniperBaseTokens: string;
  organicAvgReturnPct: number | null;
  organicMedianReturnPct: number | null;
  organicTotalTrades: number;
  creatorFeesQuote: number;
  protocolFeesQuote: number;
  partnerFeesQuote: number;
  graduated: boolean;
  ticksToGraduation: number | null;
  estimatedWallClockSeconds: number | null;
  migrationGap?: {
    priceGapBps: number;
    impactRatio: number;
  };
}

interface SimulatedTrade {
  tick: number;
  slot: number;
  agentName: string;
  agentType: string;
  side: 'buy' | 'sell';
  amountSol: number;
  tokens: string;
  priceSol: number;
  feeQuote: number;
  poolType: 'dbc' | 'damm';
}

const PRESETS = [
  {
    id: 'anti-sniper',
    name: 'Anti-Sniper Fee Decay',
    desc: '16% fee decaying over 1,000 slots. Best overall balance for organic buyers and creator fees.',
    params: {
      initialMarketCap: 20,
      migrationMarketCap: 400,
      startingFeeBps: 1600,
      endingFeeBps: 100,
      totalDuration: 1000,
      creatorTradingFeePercentage: 20,
    }
  },
  {
    id: 'flat-unprotected',
    name: 'Standard Flat Curve (Vulnerable)',
    desc: 'Flat 1% fee with zero decay. Vulnerable to coordinated slot-0 Jito sniper extraction.',
    params: {
      initialMarketCap: 20,
      migrationMarketCap: 400,
      startingFeeBps: 100,
      endingFeeBps: 100,
      totalDuration: 0,
      creatorTradingFeePercentage: 20,
    }
  },
  {
    id: 'steep-grad',
    name: 'Fast Graduation Sprint',
    desc: 'High slope curve with rapid migration threshold for quick liquidity migration into DAMM v2.',
    params: {
      initialMarketCap: 15,
      migrationMarketCap: 200,
      startingFeeBps: 1000,
      endingFeeBps: 50,
      totalDuration: 500,
      creatorTradingFeePercentage: 25,
    }
  }
];

const AGENT_MIXES = [
  { id: 'coordinated snipers', name: 'Coordinated Snipers (Jito MEV)', desc: '3 fast snipers landing multi-buys in slots 0–2, followed by retail flow.' },
  { id: 'light retail', name: 'Light Retail Flow', desc: 'Evenly distributed organic buy and sell orders across 3,000 slots.' },
  { id: 'whale-heavy', name: 'Whale Heavy Inflow', desc: 'Large discretionary buyers triggering fast threshold expansions.' },
  { id: 'organic growth', name: 'Organic Momentum', desc: 'Steady adoption curve with increasing momentum trades as market cap rises.' }
];

export function Simulator() {
  // Config state
  const [initialMarketCap, setInitialMarketCap] = useState(20);
  const [migrationMarketCap, setMigrationMarketCap] = useState(400);
  const [startingFeeBps, setStartingFeeBps] = useState(1600);
  const [endingFeeBps, setEndingFeeBps] = useState(100);
  const [totalDuration, setTotalDuration] = useState(1000);
  const [creatorTradingFeePercentage, setCreatorTradingFeePercentage] = useState(20);
  const [agentMix, setAgentMix] = useState('coordinated snipers');
  const [activePreset, setActivePreset] = useState('anti-sniper');

  // Simulation execution state
  const [isRunning, setIsRunning] = useState(false);
  const [scorecard, setScorecard] = useState<SimulationScorecard | null>(null);
  const [sampleTrades, setSampleTrades] = useState<SimulatedTrade[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Apply preset
  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setActivePreset(preset.id);
    setInitialMarketCap(preset.params.initialMarketCap);
    setMigrationMarketCap(preset.params.migrationMarketCap);
    setStartingFeeBps(preset.params.startingFeeBps);
    setEndingFeeBps(preset.params.endingFeeBps);
    setTotalDuration(preset.params.totalDuration);
    setCreatorTradingFeePercentage(preset.params.creatorTradingFeePercentage);
  };

  // Run simulation
  const handleRunSimulation = async () => {
    setIsRunning(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialMarketCap,
          migrationMarketCap,
          startingFeeBps,
          endingFeeBps,
          totalDuration,
          creatorTradingFeePercentage,
          agentMix,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Simulation failed to run');
      }

      setScorecard(data.scorecard);
      setSampleTrades(data.sampleTrades || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing simulation');
    } finally {
      setIsRunning(false);
    }
  };

  // Auto-run baseline on load
  useEffect(() => {
    handleRunSimulation();
  }, []);

  // Compute curve visualization points
  const curvePoints = [
    { fillPct: 0, quoteReserveSol: initialMarketCap, priceSol: 0.000002 },
    { fillPct: 25, quoteReserveSol: initialMarketCap + (migrationMarketCap - initialMarketCap) * 0.15, priceSol: 0.000005 },
    { fillPct: 50, quoteReserveSol: initialMarketCap + (migrationMarketCap - initialMarketCap) * 0.35, priceSol: 0.000012 },
    { fillPct: 75, quoteReserveSol: initialMarketCap + (migrationMarketCap - initialMarketCap) * 0.65, priceSol: 0.000026 },
    { fillPct: 100, quoteReserveSol: migrationMarketCap, priceSol: 0.000045 }
  ];

  const feePoints = [
    { slot: 0, feePct: startingFeeBps / 100 },
    { slot: Math.floor(totalDuration * 0.25), feePct: (startingFeeBps - (startingFeeBps - endingFeeBps) * 0.25) / 100 },
    { slot: Math.floor(totalDuration * 0.5), feePct: (startingFeeBps - (startingFeeBps - endingFeeBps) * 0.5) / 100 },
    { slot: Math.floor(totalDuration * 0.75), feePct: (startingFeeBps - (startingFeeBps - endingFeeBps) * 0.75) / 100 },
    { slot: totalDuration || 1, feePct: endingFeeBps / 100 },
    { slot: (totalDuration || 1) + 500, feePct: endingFeeBps / 100 },
  ];

  return (
    <section id="simulator" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0D1117] border-b-2 border-[#30363D]">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="mb-10 text-center max-w-3xl mx-auto">
          <div className="badge-neo-solana mb-3">Interactive Flight Simulator</div>
          <h2 className="text-3xl sm:text-5xl font-bold font-serif text-white mb-3">
            Simulate DBC Parameter Combinations
          </h2>
          <p className="text-[#8B949E] text-base sm:text-lg font-sans">
            Adjust curve expansion caps, dynamic fee decay slopes, and agent mixes to observe sniper extraction and post-graduation price stability.
          </p>
        </div>

        {/* Presets Bar */}
        <div className="card-neo p-4 mb-8 bg-[#161B22] border-2 border-[#E6EDF3] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8B949E]">
              Preset Scenarios:
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition-all ${
                    activePreset === p.id
                      ? 'border-[#E6EDF3] bg-[#F4805D] text-[#0D1117] font-bold shadow-[2px_2px_0_rgba(230,237,243,0.25)]'
                      : 'border-[#30363D] bg-[#21262D] hover:bg-[#30363D] text-[#E6EDF3] shadow-[2px_2px_0_rgba(230,237,243,0.15)]'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="text-xs text-[#8B949E] font-medium">
            Expansion Ratio: <strong className="text-[#14F195]">{(migrationMarketCap / initialMarketCap).toFixed(2)}x</strong>
          </div>
        </div>

        {/* Main Grid: Controls + Visuals */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          {/* Controls Column (7 Cols) */}
          <div className="lg:col-span-7 card-neo p-6 sm:p-8 bg-[#161B22] border-2 border-[#E6EDF3]">
            <h3 className="font-serif text-2xl font-bold mb-6 text-white flex items-center justify-between">
              <span>Launch Parameter Controls</span>
              <span className="badge-neo bg-[#21262D] border-[#E6EDF3] text-xs font-sans text-white">Meteora DBC v1.5</span>
            </h3>

            <div className="space-y-6">
              {/* Initial Market Cap */}
              <div>
                <div className="flex justify-between text-sm font-semibold mb-1 text-[#E6EDF3]">
                  <span>Initial Floor Market Cap</span>
                  <span className="font-mono text-white font-bold">{initialMarketCap} SOL</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={initialMarketCap}
                  onChange={(e) => {
                    setInitialMarketCap(Number(e.target.value));
                    setActivePreset('custom');
                  }}
                  className="w-full h-2 rounded-lg cursor-pointer bg-[#21262D]"
                />
                <span className="text-xs text-[#8B949E]">Starting liquidity floor (~$3,000)</span>
              </div>

              {/* Migration Market Cap */}
              <div>
                <div className="flex justify-between text-sm font-semibold mb-1 text-[#E6EDF3]">
                  <span>Migration Market Cap (Target)</span>
                  <span className="font-mono text-white font-bold">{migrationMarketCap} SOL</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1500"
                  step="25"
                  value={migrationMarketCap}
                  onChange={(e) => {
                    setMigrationMarketCap(Number(e.target.value));
                    setActivePreset('custom');
                  }}
                  className="w-full h-2 rounded-lg cursor-pointer bg-[#21262D]"
                />
                <span className="text-xs text-[#8B949E]">Threshold for DAMM v2 migration</span>
              </div>

              {/* Starting Fee BPS */}
              <div>
                <div className="flex justify-between text-sm font-semibold mb-1 text-[#E6EDF3]">
                  <span>Starting Fee (Slot 0)</span>
                  <span className="font-mono text-[#F4805D] font-bold">{(startingFeeBps / 100).toFixed(1)}% ({startingFeeBps} bps)</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="5000"
                  step="100"
                  value={startingFeeBps}
                  onChange={(e) => {
                    setStartingFeeBps(Number(e.target.value));
                    setActivePreset('custom');
                  }}
                  className="w-full h-2 rounded-lg cursor-pointer bg-[#21262D]"
                />
                <span className="text-xs text-[#8B949E]">Fee charged on slot 0 opening trades</span>
              </div>

              {/* Ending Fee BPS */}
              <div>
                <div className="flex justify-between text-sm font-semibold mb-1 text-[#E6EDF3]">
                  <span>Ending Floor Fee</span>
                  <span className="font-mono text-[#14F195] font-bold">{(endingFeeBps / 100).toFixed(2)}% ({endingFeeBps} bps)</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="10"
                  value={endingFeeBps}
                  onChange={(e) => {
                    setEndingFeeBps(Number(e.target.value));
                    setActivePreset('custom');
                  }}
                  className="w-full h-2 rounded-lg cursor-pointer bg-[#21262D]"
                />
                <span className="text-xs text-[#8B949E]">Baseline trading fee once decayed</span>
              </div>

              {/* Decay Duration */}
              <div>
                <div className="flex justify-between text-sm font-semibold mb-1 text-[#E6EDF3]">
                  <span>Decay Duration (Slots)</span>
                  <span className="font-mono text-white font-bold">{totalDuration} slots (~{(totalDuration * 0.4).toFixed(0)}s)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3000"
                  step="100"
                  value={totalDuration}
                  onChange={(e) => {
                    setTotalDuration(Number(e.target.value));
                    setActivePreset('custom');
                  }}
                  className="w-full h-2 rounded-lg cursor-pointer bg-[#21262D]"
                />
                <span className="text-xs text-[#8B949E]">Time window before fee reaches floor</span>
              </div>

              {/* Creator Fee Split */}
              <div>
                <div className="flex justify-between text-sm font-semibold mb-1 text-[#E6EDF3]">
                  <span>Creator Trading Fee Share</span>
                  <span className="font-mono text-white font-bold">{creatorTradingFeePercentage}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="5"
                  value={creatorTradingFeePercentage}
                  onChange={(e) => {
                    setCreatorTradingFeePercentage(Number(e.target.value));
                    setActivePreset('custom');
                  }}
                  className="w-full h-2 rounded-lg cursor-pointer bg-[#21262D]"
                />
                <span className="text-xs text-[#8B949E]">Share of trading fees kept by creator</span>
              </div>

              {/* Agent Flow Environment */}
              <div className="pt-2">
                <label className="block text-sm font-bold mb-3 text-white">
                  Simulated Market Environment & Agent Mix
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AGENT_MIXES.map((mix) => (
                    <button
                      key={mix.id}
                      type="button"
                      onClick={() => setAgentMix(mix.id)}
                      className={`p-3 text-left rounded-xl border-2 transition-all ${
                        agentMix === mix.id
                          ? 'border-[#14F195] bg-[#14231B] shadow-[2px_2px_0_#14F195]'
                          : 'border-[#30363D] hover:border-[#E6EDF3] bg-[#21262D]'
                      }`}
                    >
                      <div className="font-bold text-sm text-white flex items-center justify-between">
                        <span>{mix.name}</span>
                        {agentMix === mix.id && <span className="text-xs text-[#14F195]">✓</span>}
                      </div>
                      <div className="text-xs text-[#8B949E] mt-0.5">{mix.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Box */}
              {errorMessage && (
                <div className="p-4 rounded-xl bg-red-950/80 border-2 border-red-500 text-red-200 text-sm font-semibold">
                  {errorMessage}
                </div>
              )}

              {/* Launch Button */}
              <button
                onClick={handleRunSimulation}
                disabled={isRunning}
                className="btn-primary w-full py-4 text-base tracking-wide"
              >
                {isRunning ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Running Monte Carlo Stress Test...
                  </span>
                ) : (
                  <span>Run WindTunnel Simulation →</span>
                )}
              </button>
            </div>
          </div>

          {/* Visualization Column (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <CurveChart
              curvePoints={curvePoints}
              feePoints={feePoints}
              initialMarketCap={initialMarketCap}
              migrationMarketCap={migrationMarketCap}
              startingFeeBps={startingFeeBps}
              endingFeeBps={endingFeeBps}
            />
          </div>
        </div>

        {/* Results Scorecard Section */}
        {scorecard && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex items-center justify-between border-b-2 border-[#30363D] pb-4">
              <h3 className="font-serif text-3xl font-bold text-white">
                Launch Health Scorecard
              </h3>
              <div className="text-xs text-[#8B949E]">
                Agent Mix: <strong className="text-white capitalize">{agentMix}</strong>
              </div>
            </div>

            {/* 4 Scorecard Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1: Sniper Extraction */}
              <div className="card-neo p-6 bg-[#161B22] border-2 border-[#E6EDF3] hover:-translate-y-1 transition-transform">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8B949E]">
                    Sniper Extraction
                  </span>
                  <span className={`text-xs ${
                    scorecard.sniperExtractionPct > 35 ? 'badge-neo-coral' : 'badge-neo-solana'
                  }`}>
                    {scorecard.sniperExtractionPct > 35 ? 'High Risk' : 'Protected'}
                  </span>
                </div>
                <div className="font-serif text-4xl sm:text-5xl font-extrabold text-white mb-1">
                  {scorecard.sniperExtractionPct}%
                </div>
                <div className="text-xs text-[#8B949E] font-medium">
                  Net sniper profit: <strong className="text-white">{scorecard.sniperNetProfitSol.toFixed(3)} SOL</strong>
                </div>
                <p className="text-[11px] text-[#8B949E] mt-2">
                  Percentage of initial token supply extracted by MEV snipers in slots 0–2.
                </p>
              </div>

              {/* Card 2: Organic Buyer Outcome */}
              <div className="card-neo p-6 bg-[#161B22] border-2 border-[#E6EDF3] hover:-translate-y-1 transition-transform">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8B949E]">
                    Organic Avg Return
                  </span>
                  <span className="badge-neo bg-[#21262D] border-[#E6EDF3] text-xs text-[#E6EDF3]">
                    {scorecard.organicTotalTrades} Trades
                  </span>
                </div>
                <div className="font-serif text-4xl sm:text-5xl font-extrabold text-[#14F195] mb-1">
                  {scorecard.organicAvgReturnPct !== null
                    ? `+${scorecard.organicAvgReturnPct}%`
                    : 'N/A'}
                </div>
                <div className="text-xs text-[#8B949E] font-medium">
                  Median return: <strong className="text-white">{scorecard.organicMedianReturnPct !== null ? `+${scorecard.organicMedianReturnPct}%` : 'N/A'}</strong>
                </div>
                <p className="text-[11px] text-[#8B949E] mt-2">
                  Average post-graduation holding return for retail & momentum buyers on DAMM v2.
                </p>
              </div>

              {/* Card 3: Creator Revenue */}
              <div className="card-neo p-6 bg-[#161B22] border-2 border-[#E6EDF3] hover:-translate-y-1 transition-transform">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8B949E]">
                    Creator Revenue
                  </span>
                  <span className="badge-neo-coral text-xs">
                    {creatorTradingFeePercentage}% Split
                  </span>
                </div>
                <div className="font-serif text-4xl sm:text-5xl font-extrabold text-white mb-1">
                  {scorecard.creatorFeesQuote.toFixed(3)} SOL
                </div>
                <div className="text-xs text-[#8B949E] font-medium">
                  Total fees generated: <strong className="text-white">{(scorecard.creatorFeesQuote + scorecard.protocolFeesQuote + scorecard.partnerFeesQuote).toFixed(3)} SOL</strong>
                </div>
                <p className="text-[11px] text-[#8B949E] mt-2">
                  Trading fees captured from early snipers and ongoing volume directly to creator wallet.
                </p>
              </div>

              {/* Card 4: Graduation Status */}
              <div className="card-neo p-6 bg-[#161B22] border-2 border-[#E6EDF3] hover:-translate-y-1 transition-transform">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8B949E]">
                    Graduation Status
                  </span>
                  <span className={`text-xs ${
                    scorecard.graduated ? 'badge-neo-solana' : 'badge-neo-coral'
                  }`}>
                    {scorecard.graduated ? 'Migrated' : 'Stalled'}
                  </span>
                </div>
                <div className={`font-serif text-4xl sm:text-5xl font-extrabold mb-1 ${
                  scorecard.graduated ? 'text-[#14F195]' : 'text-white'
                }`}>
                  {scorecard.ticksToGraduation !== null ? `${scorecard.ticksToGraduation} Ticks` : 'N/A'}
                </div>
                <div className="text-xs text-[#8B949E] font-medium">
                  Estimated time: <strong className="text-white">{scorecard.estimatedWallClockSeconds !== null ? `~${scorecard.estimatedWallClockSeconds}s` : 'Did not graduate'}</strong>
                </div>
                <p className="text-[11px] text-[#8B949E] mt-2">
                  Speed to threshold fill and automated liquidity seed into Meteora DAMM v2.
                </p>
              </div>
            </div>

            {/* Migration Gap Analysis Banner */}
            {scorecard.migrationGap && (
              <div className="card-neo p-6 bg-[#1A2332] border-2 border-[#E6EDF3]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="badge-neo bg-[#21262D] border-[#E6EDF3] text-white mb-2">Phase 3 Migration Continuity</div>
                    <h4 className="font-serif text-xl font-bold text-white">
                      DBC → DAMM v2 Liquidity Transition Gap
                    </h4>
                    <p className="text-xs text-[#8B949E] max-w-2xl mt-1">
                      Due to full-range concentrated liquidity distribution on DAMM v2, post-graduation depth thins substantially compared to the discrete DBC segments.
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-xs text-[#8B949E] font-bold uppercase">Price Gap</div>
                      <div className="font-serif text-2xl font-black text-white">
                        {scorecard.migrationGap.priceGapBps} bps
                      </div>
                      <div className="text-[11px] text-[#8B949E]">({(scorecard.migrationGap.priceGapBps / 100).toFixed(2)}%)</div>
                    </div>
                    <div className="h-10 w-[2px] bg-[#30363D]" />
                    <div className="text-center">
                      <div className="text-xs text-[#8B949E] font-bold uppercase">Impact Jump</div>
                      <div className="font-serif text-2xl font-black text-white">
                        {scorecard.migrationGap.impactRatio}x
                      </div>
                      <div className="text-[11px] text-[#8B949E]">On $1,000 Buy</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Simulated Trade Execution Stream */}
            {sampleTrades.length > 0 && (
              <div className="card-neo p-6 bg-[#161B22] border-2 border-[#E6EDF3] overflow-hidden">
                <h4 className="font-serif text-xl font-bold text-white mb-4">
                  Simulated Trade Execution Log (First 15 Swaps)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-[#21262D] border-b-2 border-[#30363D] font-bold uppercase text-[#8B949E]">
                      <tr>
                        <th className="p-3">Tick / Slot</th>
                        <th className="p-3">Agent</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Side</th>
                        <th className="p-3">SOL In</th>
                        <th className="p-3">Exec Price</th>
                        <th className="p-3">Pool</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#30363D]">
                      {sampleTrades.slice(0, 15).map((t, idx) => (
                        <tr key={idx} className="hover:bg-[#21262D]/60 font-mono">
                          <td className="p-3 font-semibold text-white">#{t.tick} (Slot {t.slot})</td>
                          <td className="p-3 font-sans font-medium text-white">{t.agentName}</td>
                          <td className="p-3 font-sans">
                            <span className="badge-neo bg-[#21262D] border-[#30363D] py-0.5 px-2 text-[10px] text-[#E6EDF3]">
                              {t.agentType}
                            </span>
                          </td>
                          <td className="p-3 font-bold">
                            <span className={t.side === 'buy' ? 'text-[#14F195]' : 'text-[#F4805D]'}>
                              {t.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-white font-semibold">{t.amountSol.toFixed(4)} SOL</td>
                          <td className="p-3 text-[#8B949E]">{t.priceSol.toExponential(4)}</td>
                          <td className="p-3 font-sans">
                            <span className={`badge-neo py-0.5 px-2 text-[10px] ${
                              t.poolType === 'dbc' ? 'bg-[#21262D] text-[#38BDF8] border-[#38BDF8]/40' : 'bg-[#14231B] text-[#14F195] border-[#14F195]/40'
                            }`}>
                              {t.poolType.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
