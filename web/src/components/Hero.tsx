'use client';

import React from 'react';

export function Hero() {
  return (
    <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 border-b-2 border-black bg-[#F7F3EC]">
      <div className="max-w-5xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 badge-neo bg-[#F3D9E8] mb-6">
          <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
          <span>Solana Token Launch Security</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold font-serif text-[#171717] leading-[1.08] tracking-tight mb-6">
          Stress-test your token launch before it goes live.
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-700 font-sans leading-relaxed mb-10">
          Simulate coordinated Jito bundles, calculate sniper extraction, and stress-test the DAMM v2 migration gap on Meteora DBC curves before committing real SOL.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <a href="#simulator" className="btn-primary text-base py-3.5 px-8 w-full sm:w-auto">
            Launch Interactive Simulator
            <span className="font-sans font-bold">→</span>
          </a>
          <a href="#devnet" className="btn-secondary text-base py-3.5 px-8 w-full sm:w-auto">
            View On-Chain Devnet Proof
          </a>
        </div>

        {/* 3 Hard-Bordered Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="card-neo p-6 bg-white hover:-translate-y-1 transition-transform">
            <div className="badge-neo bg-[#F4805D] text-black mb-3">Vulnerability</div>
            <div className="font-serif text-4xl sm:text-5xl font-extrabold text-black mb-1">
              38.2%
            </div>
            <div className="text-sm font-semibold text-gray-900 mb-1">
              Sniper Token Extraction
            </div>
            <p className="text-xs text-gray-600 leading-normal">
              On unprotected flat curves, coordinated MEV bundlers capture over a third of token supply in slots 0–2.
            </p>
          </div>

          <div className="card-neo p-6 bg-white hover:-translate-y-1 transition-transform">
            <div className="badge-neo bg-[#FCE8AA] text-black mb-3">Liquidity Thinning</div>
            <div className="font-serif text-4xl sm:text-5xl font-extrabold text-black mb-1">
              67x – 79x
            </div>
            <div className="text-sm font-semibold text-gray-900 mb-1">
              Post-Graduation Price Impact
            </div>
            <p className="text-xs text-gray-600 leading-normal">
              Migrating to full-range DAMM v2 dilutes quote liquidity, creating an immediate 67x price impact jump.
            </p>
          </div>

          <div className="card-neo p-6 bg-white hover:-translate-y-1 transition-transform">
            <div className="badge-neo bg-[#B8E0D2] text-black mb-3">Mathematical Parity</div>
            <div className="font-serif text-4xl sm:text-5xl font-extrabold text-black mb-1">
              0 Delta
            </div>
            <div className="text-sm font-semibold text-gray-900 mb-1">
              Exact On-Chain Parity
            </div>
            <p className="text-xs text-gray-600 leading-normal">
              Simulated sqrtPrice, reserves, and decaying fee splits verified down to the exact lamport against live Solana devnet.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
