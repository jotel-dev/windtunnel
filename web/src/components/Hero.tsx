'use client';

import React from 'react';

export function Hero() {
  return (
    <section className="relative pt-12 sm:pt-16 pb-16 sm:pb-20 px-4 sm:px-6 lg:px-8 border-b-2 border-[#30363D] bg-[#0D1117]">
      <div className="max-w-5xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 mb-6 max-w-full">
          <span className="badge-neo-solana py-1 px-3 sm:px-3.5 text-[11px] sm:text-xs">
            <span className="w-2 h-2 rounded-full bg-[#14F195] animate-pulse shrink-0"></span>
            <span className="truncate">Solana Devnet Parity • Meteora DBC Engine</span>
          </span>
        </div>

        {/* Big Editorial Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold font-serif text-white tracking-tight leading-[1.12] mb-6 break-words">
          Stress-test your token launch before snipers{' '}
          <span className="underline decoration-[#F4805D] decoration-wavy decoration-2">break it</span>.
        </h1>

        {/* Subhead */}
        <p className="text-base sm:text-lg lg:text-xl text-[#8B949E] max-w-3xl mx-auto mb-8 sm:mb-10 leading-relaxed font-sans">
          WindTunnel is an economic flight simulator for Meteora Dynamic Bonding Curves.
          Model Jito bundle snipers, test dynamic fee schedules, and guarantee post-graduation liquidity depth on DAMM v2.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-16 w-full max-w-md sm:max-w-none mx-auto">
          <a href="#simulator" className="btn-primary text-sm sm:text-base py-3 sm:py-3.5 px-6 sm:px-8 w-full sm:w-auto min-h-[44px]">
            Launch Interactive Simulator
            <span className="font-sans font-bold"> →</span>
          </a>
          <a href="#devnet" className="btn-secondary text-sm sm:text-base py-3 sm:py-3.5 px-6 sm:px-8 w-full sm:w-auto min-h-[44px]">
            View On-Chain Devnet Proof
          </a>
        </div>

        {/* 3 Hard-Bordered Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 text-left">
          <div className="card-neo p-5 sm:p-6 bg-[#161B22] hover:-translate-y-1 transition-transform">
            <div className="badge-neo-coral mb-3">Vulnerability</div>
            <div className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-1">
              38.2%
            </div>
            <div className="text-sm font-semibold text-[#E6EDF3] mb-1">
              Sniper Token Extraction
            </div>
            <p className="text-xs text-[#8B949E] leading-normal">
              In the coordinated-snipers tuner baseline (20→40 SOL, seed 4242), MEV bundlers capture 38.2% of token supply in slots 0–2 (reaching up to 42.8% on flat 1% curves).
            </p>
          </div>

          <div className="card-neo p-5 sm:p-6 bg-[#161B22] hover:-translate-y-1 transition-transform">
            <div className="badge-neo bg-[#21262D] text-[#E6EDF3] border-[#E6EDF3] mb-3">Liquidity Thinning</div>
            <div className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-1">
              67x – 79x
            </div>
            <div className="text-sm font-semibold text-[#E6EDF3] mb-1">
              Post-Graduation Price Impact
            </div>
            <p className="text-xs text-[#8B949E] leading-normal">
              Across compare-demo launch curves ($1,000 buy), migrating into full-range DAMM v2 dilutes liquidity, creating an immediate 67x to 79x surge in price impact.
            </p>
          </div>

          <div className="card-neo p-5 sm:p-6 bg-[#161B22] hover:-translate-y-1 transition-transform">
            <div className="badge-neo-solana mb-3">Mathematical Parity</div>
            <div className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#14F195] mb-1">
              0 Delta
            </div>
            <div className="text-sm font-semibold text-[#E6EDF3] mb-1">
              Exact On-Chain Parity
            </div>
            <p className="text-xs text-[#8B949E] leading-normal">
              Simulated sqrtPrice, reserves, and decaying fee splits verified down to the exact lamport against live Solana devnet.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

