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
    <section id="compare" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F3D9E8] border-b-2 border-black">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="badge-neo bg-white mb-3">Head-to-Head Benchmark</div>
            <h2 className="text-3xl sm:text-5xl font-bold font-serif text-black mb-3">
              Compare Launch Strategies
            </h2>
            <p className="text-gray-800 text-base sm:text-lg max-w-xl font-sans">
              Evaluate how flat vs. fee-decay curves perform under identical sniper arrival conditions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-gray-700">Trader Flow:</span>
            <select
              value={agentMix}
              onChange={(e) => setAgentMix(e.target.value)}
              className="card-neo-sm px-3 py-2 text-xs font-bold bg-white text-black cursor-pointer"
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
                className={`card-neo p-6 sm:p-8 flex flex-col justify-between transition-all ${
                  isWinner ? 'bg-white shadow-[6px_6px_0_#000] ring-2 ring-black relative' : 'bg-white/90'
                }`}
              >
                <div>
                  {isWinner && (
                    <div className="absolute -top-3.5 right-6 badge-neo bg-[#F4805D] text-black">
                      Recommended ★
                    </div>
                  )}

                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-black mb-2">
                    {r.label}
                  </h3>
                  <div className="text-xs text-gray-600 mb-6">
                    {isWinner ? 'Optimized anti-sniper fee schedule' : 'Standard baseline curve setup'}
                  </div>

                  <div className="space-y-4 border-t-2 border-black/10 pt-4">
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Sniper Extraction
                      </div>
                      <div className="font-serif text-3xl font-extrabold text-black">
                        {r.sniperExtractionPct}%
                      </div>
                      <div className="text-xs text-gray-600">
                        Profit: {r.sniperNetProfitSol.toFixed(3)} SOL
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Organic Avg Return
                      </div>
                      <div className="font-serif text-3xl font-extrabold text-black">
                        {r.organicAvgReturnPct !== null ? `+${r.organicAvgReturnPct}%` : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-600">Post-graduation holding return</div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Creator Fees Earned
                      </div>
                      <div className="font-serif text-3xl font-extrabold text-black">
                        {r.creatorFeesQuote.toFixed(3)} SOL
                      </div>
                      <div className="text-xs text-gray-600">Direct creator fee revenue</div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Graduation Speed
                      </div>
                      <div className="font-sans font-bold text-base text-black mt-1">
                        {r.graduated ? `Graduated in ${r.ticksToGraduation} Ticks` : 'Did Not Graduate'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-gray-100">
                  <div className={`text-xs p-3 rounded-lg border font-medium ${
                    isWinner
                      ? 'bg-[#B8E0D2] border-black text-black'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
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
