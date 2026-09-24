'use client';

import React from 'react';

export function Findings() {
  return (
    <section id="findings" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F7F3EC] border-b-2 border-black">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 text-center max-w-3xl mx-auto">
          <div className="badge-neo bg-[#F4805D] mb-3">Key Research Findings</div>
          <h2 className="text-3xl sm:text-5xl font-bold font-serif text-black mb-4">
            The Hidden Risks of Token Graduation
          </h2>
          <p className="text-gray-700 text-base sm:text-lg font-sans">
            Our benchmarks revealed structural phenomena that every token founder on Meteora must know before designing their curve.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Card 1 */}
          <div className="card-neo p-8 bg-white hover:-translate-y-1 transition-transform">
            <div className="badge-neo bg-[#FCE8AA] mb-4">Finding 1</div>
            <div className="font-serif text-3xl sm:text-4xl font-extrabold text-black mb-2">
              67x – 79x
            </div>
            <h4 className="font-bold text-base text-black mb-2">
              Price Impact Jump Across Graduation
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              A standard $1,000 buy causes 67x to 79x higher price slippage immediately post-graduation on DAMM v2 than it did immediately before graduation on DBC.
            </p>
          </div>

          {/* Card 2 */}
          <div className="card-neo p-8 bg-white hover:-translate-y-1 transition-transform">
            <div className="badge-neo bg-[#F3D9E8] mb-4">Finding 2</div>
            <div className="font-serif text-3xl sm:text-4xl font-extrabold text-black mb-2">
              Full-Range
            </div>
            <h4 className="font-bold text-base text-black mb-2">
              Concentrated Liquidity Dilution
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              Meteora DAMM v2 deploys migrated liquidity across the entire price spectrum (from MIN_SQRT_PRICE to MAX_SQRT_PRICE), substantially thinning active liquidity around spot.
            </p>
          </div>

          {/* Card 3 */}
          <div className="card-neo p-8 bg-white hover:-translate-y-1 transition-transform">
            <div className="badge-neo bg-[#B8E0D2] mb-4">Finding 3</div>
            <div className="font-serif text-3xl sm:text-4xl font-extrabold text-black mb-2">
              +225%
            </div>
            <h4 className="font-bold text-base text-black mb-2">
              Creator Fee Capture via Fee Decay
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              A 16% starting fee decaying over 1,000 slots penalizes Jito bundles without stopping organic buyers, tripling creator revenue from 0.126 SOL to 0.410 SOL.
            </p>
          </div>
        </div>

        {/* Read More Link */}
        <div className="card-neo p-6 bg-white text-center flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <h4 className="font-serif text-lg font-bold text-black">
              Explore the Full Technical Research Papers
            </h4>
            <p className="text-xs text-gray-600">
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
