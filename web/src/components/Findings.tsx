'use client';

import React from 'react';

export function Findings() {
  return (
    <section id="findings" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#161B26] border-b-2 border-[#30363D]">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 text-center max-w-3xl mx-auto">
          <div className="badge-neo-coral mb-3">Key Research Findings</div>
          <h2 className="text-3xl sm:text-5xl font-bold font-serif text-white mb-4">
            The Hidden Risks of Token Graduation
          </h2>
          <p className="text-[#8B949E] text-base sm:text-lg font-sans">
            Our benchmarks revealed structural phenomena that every token founder on Meteora must know before designing their curve.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Card 1 */}
          <div className="card-neo p-8 bg-[#161B22] border-2 border-[#E6EDF3] hover:-translate-y-1 transition-transform">
            <div className="badge-neo-coral mb-4">Finding 1</div>
            <div className="font-serif text-3xl sm:text-4xl font-extrabold text-white mb-2">
              67x – 79x
            </div>
            <h4 className="font-bold text-base text-white mb-2">
              Price Impact Jump Across Graduation
            </h4>
            <p className="text-xs text-[#8B949E] leading-relaxed">
              A standard $1,000 buy causes 67x to 79x higher price slippage immediately post-graduation on DAMM v2 than it did immediately before graduation on DBC.
            </p>
          </div>

          {/* Card 2 */}
          <div className="card-neo p-8 bg-[#161B22] border-2 border-[#E6EDF3] hover:-translate-y-1 transition-transform">
            <div className="badge-neo bg-[#21262D] text-[#38BDF8] border-[#38BDF8]/40 mb-4">Finding 2</div>
            <div className="font-serif text-3xl sm:text-4xl font-extrabold text-white mb-2">
              Full-Range
            </div>
            <h4 className="font-bold text-base text-white mb-2">
              Concentrated Liquidity Dilution
            </h4>
            <p className="text-xs text-[#8B949E] leading-relaxed">
              Meteora DAMM v2 deploys migrated liquidity across the entire price spectrum (from MIN_SQRT_PRICE to MAX_SQRT_PRICE), substantially thinning active liquidity around spot.
            </p>
          </div>

          {/* Card 3 */}
          <div className="card-neo p-8 bg-[#161B22] border-2 border-[#E6EDF3] hover:-translate-y-1 transition-transform">
            <div className="badge-neo-solana mb-4">Finding 3</div>
            <div className="font-serif text-3xl sm:text-4xl font-extrabold text-[#14F195] mb-2">
              +225%
            </div>
            <h4 className="font-bold text-base text-white mb-2">
              Creator Fee Capture via Fee Decay
            </h4>
            <p className="text-xs text-[#8B949E] leading-relaxed">
              A 16% starting fee decaying over 1,000 slots penalizes Jito bundles without stopping organic buyers, tripling creator revenue from 0.126 SOL to 0.410 SOL.
            </p>
          </div>
        </div>

        {/* Read More Link */}
        <div className="card-neo p-6 bg-[#161B22] border-2 border-[#E6EDF3] text-center flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <h4 className="font-serif text-lg font-bold text-white">
              Explore the Full Technical Research Papers
            </h4>
            <p className="text-xs text-[#8B949E]">
              Read comprehensive docs on migration gap math, fee decay scheduling, and devnet verification logs.
            </p>
          </div>
          <a
            href="https://github.com/jotel-dev/windtunnel/tree/main/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-sm py-2.5 px-6 shrink-0"
          >
            Read Technical Documentation →
          </a>
        </div>
      </div>
    </section>
  );
}
