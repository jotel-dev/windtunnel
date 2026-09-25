'use client';

import React, { useState, useEffect } from 'react';

interface CompareCandidate {
  label: string;
  sniperExtractionPct: number;
  sniperNetProfitSol: number;
  organicAvgReturnPct: number | null;
  creatorFeesQuote: number;
  graduated: boolean;
  ticksToGraduation: number | null;
}

export function CompareView() {
  const [agentMix, setAgentMix] = useState('coordinated snipers');
  const [results, setResults] = useState<CompareCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchComparison = async (mix: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentMix: mix }),
      });
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
      }
    } catch (err) {
      console.error('Failed to fetch comparison', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComparison(agentMix);
  }, [agentMix]);

  return (
    <section id="compare" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#131A26] border-b-2 border-[#30363D]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="badge-neo bg-[#21262D] border-[#E6EDF3] text-white mb-3">Head-to-Head Benchmark</div>
            <h2 className="text-3xl sm:text-5xl font-bold font-serif text-white mb-3">
              Compare Launch Strategies
            </h2>
            <p className="text-[#8B949E] text-base sm:text-lg max-w-xl font-sans">
              Evaluate how flat vs. fee-decay curves perform under identical sniper arrival conditions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-[#8B949E]">Trader Flow:</span>
            <select
              value={agentMix}
              onChange={(e) => setAgentMix(e.target.value)}
              className="card-neo-sm px-3 py-2 text-xs font-bold bg-[#161B22] text-white border-2 border-[#E6EDF3] cursor-pointer"
            >
              <option value="coordinated snipers">Coordinated Snipers</option>
              <option value="light retail">Light Retail</option>
              <option value="whale-heavy">Whale-Heavy</option>
              <option value="organic growth">Organic Growth</option>
            </select>
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {results.map((r, i) => {
            const isWinner = r.label.includes('Tuned');
            return (
              <div
                key={i}
                className={`p-6 sm:p-8 flex flex-col justify-between transition-all rounded-[14px] ${
                  isWinner
                    ? 'bg-[#14231B] border-2 border-[#14F195] shadow-[6px_6px_0_rgba(20,241,149,0.3)] relative'
                    : 'card-neo bg-[#161B22] border-2 border-[#E6EDF3]'
                }`}
              >
                <div>
                  {isWinner && (
                    <div className="absolute -top-3.5 right-6 badge-neo-solana bg-[#14F195] text-[#0D1117] font-extrabold border-2 border-[#E6EDF3]">
                      Recommended ★
                    </div>
                  )}

                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-white mb-2">
                    {r.label}
                  </h3>
                  <div className="text-xs text-[#8B949E] mb-6">
                    {isWinner ? 'Optimized anti-sniper fee schedule' : 'Standard baseline curve setup'}
                  </div>

                  <div className="space-y-4 border-t-2 border-[#30363D] pt-4">
                    <div>
                      <div className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">
                        Sniper Extraction
                      </div>
                      <div className="font-serif text-3xl font-extrabold text-white">
                        {r.sniperExtractionPct}%
                      </div>
                      <div className="text-xs text-[#8B949E]">
                        Profit: {r.sniperNetProfitSol.toFixed(3)} SOL
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">
                        Organic Avg Return
                      </div>
                      <div className={`font-serif text-3xl font-extrabold ${
                        isWinner ? 'text-[#14F195]' : 'text-white'
                      }`}>
                        {r.organicAvgReturnPct !== null ? `+${r.organicAvgReturnPct}%` : 'N/A'}
                      </div>
                      <div className="text-xs text-[#8B949E]">Post-graduation holding return</div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">
                        Creator Fees Earned
                      </div>
                      <div className="font-serif text-3xl font-extrabold text-white">
                        {r.creatorFeesQuote.toFixed(3)} SOL
                      </div>
                      <div className="text-xs text-[#8B949E]">Direct creator fee revenue</div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">
                        Graduation Speed
                      </div>
                      <div className={`font-sans font-bold text-base mt-1 ${
                        r.graduated ? 'text-[#14F195]' : 'text-[#8B949E]'
                      }`}>
                        {r.graduated ? `Graduated in ${r.ticksToGraduation} Ticks` : 'Did Not Graduate'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-[#30363D]">
                  <div className={`text-xs p-3 rounded-lg border font-medium ${
                    isWinner
                      ? 'bg-[rgba(20,241,149,0.12)] border-[#14F195]/40 text-[#14F195]'
                      : 'bg-[#21262D] border-[#30363D] text-[#8B949E]'
                  }`}>
                    {isWinner
                      ? '✓ Captures highest creator fees while giving organic buyers highest return.'
                      : 'High extraction allows early bots to capture majority of initial supply.'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
