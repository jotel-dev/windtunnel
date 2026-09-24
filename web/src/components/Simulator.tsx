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
  partnerFeesQuote: number;
  protocolFeesQuote: number;
  graduated: boolean;
  ticksToGraduation: number | null;
  estimatedWallClockSeconds: number | null;
  migrationGap: {
    priceGapBps: number;
    lastDbcPriceUI: string;
    dammStartingPriceUI: string;
    dbcPriceImpactBps: number;
    dammPriceImpactBps: number;
    impactRatio: number;
  } | null;
}

interface TradeLogItem {
  tick: number;
  slot: number;
  agentName: string;
  agentType: string;
  side: string;
  amountSol: number;
  priceSol: number;
  poolType: string;
  graduated: boolean;
}

export function Simulator() {
  // Form State
  const [initialMarketCap, setInitialMarketCap] = useState(20);
  const [migrationMarketCap, setMigrationMarketCap] = useState(40);
  const [startingFeeBps, setStartingFeeBps] = useState(1600);
  const [endingFeeBps, setEndingFeeBps] = useState(150);
  const [totalDuration, setTotalDuration] = useState(1000);
  const [creatorTradingFeePercentage, setCreatorTradingFeePercentage] = useState(20);
  const [agentMix, setAgentMix] = useState('coordinated snipers');

  // Execution State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scorecard, setScorecard] = useState<SimulationScorecard | null>(null);
  const [curvePoints, setCurvePoints] = useState<any[]>([]);
  const [feeDecayPoints, setFeeDecayPoints] = useState<any[]>([]);
  const [sampleTrades, setSampleTrades] = useState<TradeLogItem[]>([]);
  const [hasRun, setHasRun] = useState(false);

  // Preset Handlers
  const applyPreset = (presetName: string) => {
    if (presetName === 'flat') {
      setInitialMarketCap(20);
      setMigrationMarketCap(40);
      setStartingFeeBps(500);
      setEndingFeeBps(100);
      setTotalDuration(1000);
      setCreatorTradingFeePercentage(20);
    } else if (presetName === 'tuned') {
      setInitialMarketCap(15);
      setMigrationMarketCap(39);
      setStartingFeeBps(1600);
      setEndingFeeBps(150);
      setTotalDuration(1000);
      setCreatorTradingFeePercentage(20);
    } else if (presetName === 'steep') {
      setInitialMarketCap(15);
      setMigrationMarketCap(60);
      setStartingFeeBps(2400);
      setEndingFeeBps(200);
      setTotalDuration(1800);
      setCreatorTradingFeePercentage(30);
    }
  };

  // Run Simulation Function
  const runSimulation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/simulate', {
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Simulation failed');
      }

      setScorecard(data.scorecard);
      setCurvePoints(data.curvePoints);
      setFeeDecayPoints(data.feeDecayPoints);
      setSampleTrades(data.sampleTrades);
      setHasRun(true);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Run initial simulation on load so the user sees live data immediately
  useEffect(() => {
    runSimulation();
  }, []);

  return (
    <section id="simulator" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F7F3EC] border-b-2 border-black">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="mb-12">
          <div className="badge-neo bg-[#FCE8AA] mb-3">Interactive Flight Simulator</div>
          <h2 className="text-3xl sm:text-5xl font-bold font-serif text-black mb-3">
            Simulate Your Curve Economics
          </h2>
          <p className="text-gray-700 text-base sm:text-lg max-w-2xl font-sans">
            Adjust bonding curve caps, dynamic fee barriers, and test trader arrival sequences in a sandbox powered by the exact Meteora DBC virtual pool math.
          </p>
        </div>

        {/* Top Control Bar: Presets */}
        <div className="card-neo p-4 mb-8 bg-white flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Load Preset:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset('tuned')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-black bg-[#F4805D] text-black shadow-[2px_2px_0_#000] hover:translate-x-[-1px] hover:translate-y-[-1px]"
              >
                WindTunnel Tuned (16% Barrier)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('flat')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-black bg-white hover:bg-gray-50 text-black shadow-[2px_2px_0_#000]"
              >
                Unprotected Flat (5% Fee)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('steep')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-black bg-white hover:bg-gray-50 text-black shadow-[2px_2px_0_#000]"
              >
                High-Barrier Steep (24% Fee)
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-500 font-medium">
            Expansion Ratio: <strong className="text-black">{(migrationMarketCap / initialMarketCap).toFixed(2)}x</strong>
          </div>
        </div>

        {/* Main Grid: Left Controls, Right Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
          {/* Left Form (7 Cols) */}
          <div className="lg:col-span-7 card-neo p-6 sm:p-8 bg-white">
            <h3 className="font-serif text-2xl font-bold mb-6 text-black flex items-center justify-between">
              <span>Bonding Curve Parameters</span>
              <span className="badge-neo bg-[#CDE4FE] text-xs font-sans">Meteora DBC v1.5</span>
            </h3>

            <div className="space-y-6">
              {/* Market Cap Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between text-sm font-semibold mb-1">
                    <label>Initial Market Cap</label>
                    <span className="font-mono text-black font-bold">{initialMarketCap} SOL</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={40}
                    step={1}
                    value={initialMarketCap}
                    onChange={(e) => setInitialMarketCap(Number(e.target.value))}
                    className="w-full accent-black cursor-pointer"
                  />
                  <span className="text-xs text-gray-500">Starting liquidity floor (~$3,000)</span>
                </div>

                <div>
                  <div className="flex justify-between text-sm font-semibold mb-1">
                    <label>Migration Market Cap</label>
                    <span className="font-mono text-black font-bold">{migrationMarketCap} SOL</span>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={100}
                    step={1}
                    value={migrationMarketCap}
                    onChange={(e) => setMigrationMarketCap(Number(e.target.value))}
                    className="w-full accent-black cursor-pointer"
                  />
                  <span className="text-xs text-gray-500">Threshold for DAMM v2 migration</span>
                </div>
              </div>

              {/* Fee Scheduler Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                <div>
                  <div className="flex justify-between text-sm font-semibold mb-1">
                    <label>Starting Fee (Anti-Sniper)</label>
                    <span className="font-mono text-black font-bold">{(startingFeeBps / 100).toFixed(1)}% ({startingFeeBps} bps)</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={2500}
                    step={50}
                    value={startingFeeBps}
                    onChange={(e) => setStartingFeeBps(Number(e.target.value))}
                    className="w-full accent-black cursor-pointer"
                  />
                  <span className="text-xs text-gray-500">Fee charged on slot 0 opening trades</span>
                </div>

                <div>
                  <div className="flex justify-between text-sm font-semibold mb-1">
                    <label>Ending Fee Floor</label>
                    <span className="font-mono text-black font-bold">{(endingFeeBps / 100).toFixed(2)}% ({endingFeeBps} bps)</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={500}
                    step={25}
                    value={endingFeeBps}
                    onChange={(e) => setEndingFeeBps(Number(e.target.value))}
                    className="w-full accent-black cursor-pointer"
                  />
                  <span className="text-xs text-gray-500">Baseline trading fee once decayed</span>
                </div>
              </div>

              {/* Decay & Creator Split Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                <div>
                  <div className="flex justify-between text-sm font-semibold mb-1">
                    <label>Fee Decay Duration</label>
                    <span className="font-mono text-black font-bold">{totalDuration} slots (~{(totalDuration * 0.4).toFixed(0)}s)</span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={2500}
                    step={100}
                    value={totalDuration}
                    onChange={(e) => setTotalDuration(Number(e.target.value))}
                    className="w-full accent-black cursor-pointer"
                  />
                  <span className="text-xs text-gray-500">Time window before fee reaches floor</span>
                </div>

                <div>
                  <div className="flex justify-between text-sm font-semibold mb-1">
                    <label>Creator Fee Split</label>
                    <span className="font-mono text-black font-bold">{creatorTradingFeePercentage}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={5}
                    value={creatorTradingFeePercentage}
                    onChange={(e) => setCreatorTradingFeePercentage(Number(e.target.value))}
                    className="w-full accent-black cursor-pointer"
                  />
                  <span className="text-xs text-gray-500">Share of trading fees kept by creator</span>
                </div>
              </div>

              {/* Agent Mix Selector */}
              <div className="pt-4 border-t border-gray-100">
                <label className="block text-sm font-bold mb-3 text-black">
                  Stress-Test Trader Pressure (Agent Mix)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'coordinated snipers', label: 'Coordinated Snipers', desc: 'Jito slot 0 bundles + burst bots + retail' },
                    { id: 'light retail', label: 'Light Retail', desc: 'Natural scalpers, fast momentum & low volume' },
                    { id: 'whale-heavy', label: 'Whale-Heavy', desc: 'Aggressive 20% threshold buys + MEV snipers' },
                    { id: 'organic growth', label: 'Organic Growth', desc: 'Sustained momentum trend followers' },
                  ].map((mix) => (
                    <button
                      key={mix.id}
                      type="button"
                      onClick={() => setAgentMix(mix.id)}
                      className={`p-3 text-left rounded-xl border-2 transition-all ${
                        agentMix === mix.id
                          ? 'border-black bg-[#FCE8AA] shadow-[2px_2px_0_#000]'
                          : 'border-black/30 hover:border-black bg-white'
                      }`}
                    >
                      <div className="font-bold text-sm text-black flex items-center justify-between">
                        <span>{mix.label}</span>
                        {agentMix === mix.id && <span className="text-xs">✓</span>}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">{mix.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 rounded-xl bg-red-100 border-2 border-red-500 text-red-900 text-sm font-semibold">
                  ⚠️ {error}
                </div>
              )}

              {/* Submit CTA */}
              <div className="pt-4">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={runSimulation}
                  className="btn-primary w-full py-4 text-lg font-bold shadow-[4px_4px_0_#000] active:translate-x-[2px] active:translate-y-[2px]"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-black" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Simulating 300 Ticks On Virtual Pool...
                    </span>
                  ) : (
                    <span>Run Stress-Test Simulation →</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Visualizer (5 Cols) */}
          <div className="lg:col-span-5">
            {curvePoints.length > 0 ? (
              <CurveChart
                curvePoints={curvePoints}
                feePoints={feeDecayPoints}
                initialMarketCap={initialMarketCap}
                migrationMarketCap={migrationMarketCap}
                startingFeeBps={startingFeeBps}
                endingFeeBps={endingFeeBps}
              />
            ) : (
              <div className="card-neo p-8 bg-white text-center">
                <div className="font-serif text-lg font-bold mb-2">Ready to Simulate</div>
                <p className="text-xs text-gray-500">Configure parameters on the left to render the bonding curve.</p>
              </div>
            )}
          </div>
        </div>

        {/* Scorecard Results Dashboard */}
        {scorecard && hasRun && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex items-center justify-between border-b-2 border-black pb-4">
              <div>
                <span className="badge-neo bg-[#B8E0D2] mb-1">Flight Telemetry</span>
                <h3 className="font-serif text-3xl font-bold text-black">
                  Simulation Outcome & Scorecard
                </h3>
              </div>
              <div className="text-xs font-semibold text-gray-600">
                Preset Mix: <strong>{agentMix}</strong>
              </div>
            </div>

            {/* 4 KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1: Sniper Extraction */}
              <div className="card-neo p-6 bg-white hover:-translate-y-1 transition-transform">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Sniper Extraction
                  </span>
                  <span className={`badge-neo text-xs ${
                    scorecard.sniperExtractionPct > 50
                      ? 'bg-red-200 text-red-900'
                      : scorecard.sniperExtractionPct > 35
                      ? 'bg-[#FCE8AA] text-black'
                      : 'bg-[#B8E0D2] text-black'
                  }`}>
                    {scorecard.sniperExtractionPct > 50 ? 'Severe MEV' : 'Controlled'}
                  </span>
                </div>
                <div className="font-serif text-4xl sm:text-5xl font-extrabold text-black mb-1">
                  {scorecard.sniperExtractionPct}%
                </div>
                <div className="text-xs text-gray-600 font-medium">
                  Net sniper profit: <strong>{scorecard.sniperNetProfitSol.toFixed(3)} SOL</strong>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  Portion of total bonding curve supply captured by MEV bundlers & snipers.
                </p>
              </div>

              {/* Card 2: Organic Buyer Outcome */}
              <div className="card-neo p-6 bg-white hover:-translate-y-1 transition-transform">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Organic Buyer Return
                  </span>
                  <span className="badge-neo bg-[#CDE4FE] text-xs">
                    {scorecard.organicTotalTrades} Trades
                  </span>
                </div>
                <div className="font-serif text-4xl sm:text-5xl font-extrabold text-black mb-1">
                  {scorecard.organicAvgReturnPct !== null
                    ? `+${scorecard.organicAvgReturnPct}%`
                    : 'N/A'}
                </div>
                <div className="text-xs text-gray-600 font-medium">
                  Median return: <strong>{scorecard.organicMedianReturnPct !== null ? `+${scorecard.organicMedianReturnPct}%` : 'N/A'}</strong>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  Average post-graduation holding return for retail & momentum buyers on DAMM v2.
                </p>
              </div>

              {/* Card 3: Creator Revenue */}
              <div className="card-neo p-6 bg-white hover:-translate-y-1 transition-transform">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Creator Revenue
                  </span>
                  <span className="badge-neo bg-[#F3D9E8] text-xs">
                    {creatorTradingFeePercentage}% Split
                  </span>
                </div>
                <div className="font-serif text-4xl sm:text-5xl font-extrabold text-black mb-1">
                  {scorecard.creatorFeesQuote.toFixed(3)} SOL
                </div>
                <div className="text-xs text-gray-600 font-medium">
                  Total fees generated: <strong>{(scorecard.creatorFeesQuote + scorecard.protocolFeesQuote + scorecard.partnerFeesQuote).toFixed(3)} SOL</strong>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  Trading fees captured from early snipers and ongoing volume directly to creator wallet.
                </p>
              </div>

              {/* Card 4: Graduation Status */}
              <div className="card-neo p-6 bg-white hover:-translate-y-1 transition-transform">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Graduation Status
                  </span>
                  <span className={`badge-neo text-xs ${
                    scorecard.graduated ? 'bg-[#B8E0D2] text-black' : 'bg-red-200 text-red-900'
                  }`}>
                    {scorecard.graduated ? 'Migrated' : 'Stalled'}
                  </span>
                </div>
                <div className="font-serif text-4xl sm:text-5xl font-extrabold text-black mb-1">
                  {scorecard.ticksToGraduation !== null ? `${scorecard.ticksToGraduation} Ticks` : 'N/A'}
                </div>
                <div className="text-xs text-gray-600 font-medium">
                  Estimated time: <strong>{scorecard.estimatedWallClockSeconds !== null ? `~${scorecard.estimatedWallClockSeconds}s` : 'Did not graduate'}</strong>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  Speed to threshold fill and automated liquidity seed into Meteora DAMM v2.
                </p>
              </div>
            </div>

            {/* Migration Gap Analysis Banner */}
            {scorecard.migrationGap && (
              <div className="card-neo p-6 bg-[#FCE8AA] border-2 border-black">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="badge-neo bg-white mb-2">Phase 3 Migration Continuity</div>
                    <h4 className="font-serif text-xl font-bold text-black">
                      DBC → DAMM v2 Liquidity Transition Gap
                    </h4>
                    <p className="text-xs text-gray-800 max-w-2xl mt-1">
                      Due to full-range concentrated liquidity distribution on DAMM v2, post-graduation depth thins substantially compared to the discrete DBC segments.
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-xs text-gray-700 font-bold uppercase">Price Gap</div>
                      <div className="font-serif text-2xl font-black text-black">
                        {scorecard.migrationGap.priceGapBps} bps
                      </div>
                      <div className="text-[11px] text-gray-600">({(scorecard.migrationGap.priceGapBps / 100).toFixed(2)}%)</div>
                    </div>
                    <div className="h-10 w-[2px] bg-black/20" />
                    <div className="text-center">
                      <div className="text-xs text-gray-700 font-bold uppercase">Impact Jump</div>
                      <div className="font-serif text-2xl font-black text-black">
                        {scorecard.migrationGap.impactRatio}x
                      </div>
                      <div className="text-[11px] text-gray-600">On $1,000 Buy</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Simulated Trade Execution Stream */}
            {sampleTrades.length > 0 && (
              <div className="card-neo p-6 bg-white overflow-hidden">
                <h4 className="font-serif text-xl font-bold text-black mb-4">
                  Simulated Trade Execution Log (First 15 Swaps)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-[#F7F3EC] border-b-2 border-black font-bold uppercase text-gray-600">
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
                    <tbody className="divide-y divide-gray-100">
                      {sampleTrades.slice(0, 15).map((t, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 font-mono">
                          <td className="p-3 font-semibold text-black">#{t.tick} (Slot {t.slot})</td>
                          <td className="p-3 font-sans font-medium text-black">{t.agentName}</td>
                          <td className="p-3 font-sans">
                            <span className="badge-neo bg-gray-100 py-0.5 px-2 text-[10px]">
                              {t.agentType}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-black">
                            <span className={t.side === 'buy' ? 'text-emerald-700' : 'text-rose-700'}>
                              {t.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-black font-semibold">{t.amountSol.toFixed(4)} SOL</td>
                          <td className="p-3 text-gray-700">{t.priceSol.toExponential(4)}</td>
                          <td className="p-3 font-sans">
                            <span className={`badge-neo py-0.5 px-2 text-[10px] ${
                              t.poolType === 'dbc' ? 'bg-[#CDE4FE]' : 'bg-[#F3D9E8]'
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
