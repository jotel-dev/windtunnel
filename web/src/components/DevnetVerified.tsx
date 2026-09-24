'use client';

import React from 'react';

export function DevnetVerified() {
  const devnetData = [
    { trade: '#1 Buy (0.04 SOL)', slot: '502,898,411', onChainSqrt: '9,330,152,131,849,556', simSqrt: '9,330,152,131,849,556', delta: '0 (EXACT)' },
    { trade: '#2 Buy (0.05 SOL)', slot: '502,898,422', onChainSqrt: '10,680,793,442,633,488', simSqrt: '10,680,793,442,633,488', delta: '0 (EXACT)' },
    { trade: '#3 Sell (175M tokens)', slot: '502,898,438', onChainSqrt: '9,947,887,160,515,008', simSqrt: '9,947,887,160,515,008', delta: '0 (EXACT)' },
    { trade: '#4 Buy (0.03 SOL)', slot: '502,898,451', onChainSqrt: '10,758,271,946,985,367', simSqrt: '10,758,271,946,985,367', delta: '0 (EXACT)' },
  ];

  return (
    <section id="devnet" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#B8E0D2] border-b-2 border-black">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="mb-12">
          <div className="badge-neo bg-white mb-3">On-Chain Verification</div>
          <h2 className="text-3xl sm:text-5xl font-bold font-serif text-black mb-3">
            Validated On-Chain (Devnet Verified)
          </h2>
          <p className="text-gray-800 text-base sm:text-lg max-w-2xl font-sans">
            WindTunnel is not an approximation. Every mathematical step has been executed on live Solana Devnet and proven against the official Meteora DBC and CP-AMM programs.
          </p>
        </div>

        {/* Verification Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="card-neo p-6 bg-white">
            <span className="badge-neo bg-[#FCE8AA] text-xs mb-2">Phase 5 Part B</span>
            <div className="font-serif text-2xl font-bold text-black mb-1">
              Zero Model Divergence
            </div>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Real-time swap execution on devnet matched the simulator across sqrtPrice, quoteReserve, and decaying trading fees with 0 delta.
            </p>
            <div className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-300">
              ✓ SqrtPrice Delta: 0 Units<br />
              ✓ Quote Reserve Delta: 0 Lamports
            </div>
          </div>

          <div className="card-neo p-6 bg-white">
            <span className="badge-neo bg-[#F4805D] text-xs mb-2">Phase 5 Part C</span>
            <div className="font-serif text-2xl font-bold text-black mb-1">
              Live DAMM v2 Migration
            </div>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Graduation buy filled the threshold cleanly. Successfully migrated into Meteora DAMM v2 full-range concentrated liquidity pool.
            </p>
            <a
              href="https://explorer.solana.com/address/DyEz6XSvhDnmgjUcU4EHEDM27z4p9yGRHJaPFJH3wWHp?cluster=devnet"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-black underline underline-offset-4 flex items-center gap-1"
            >
              <span>View Migrated Pool Explorer</span>
              <span>↗</span>
            </a>
          </div>

          <div className="card-neo p-6 bg-white">
            <span className="badge-neo bg-[#CDE4FE] text-xs mb-2">Permanent Liquidity</span>
            <div className="font-serif text-2xl font-bold text-black mb-1">
              100% Permanently Locked
            </div>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              The full-range LP position was permanently locked on-chain in an NFT position, matching Phase 3 mathematical model predictions.
            </p>
            <a
              href="https://explorer.solana.com/tx/tMXi4mVSqj6fJyFLsEphYbUG6JMQuXJ3EiZZ8eR2asgGk4tGsM7xkqYFHvLCiT6Q1dcGiK6xYdVJgvML4ZXvMuC?cluster=devnet"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-black underline underline-offset-4 flex items-center gap-1"
            >
              <span>View Migration Transaction</span>
              <span>↗</span>
            </a>
          </div>
        </div>

        {/* Exact Match Parity Table */}
        <div className="card-neo p-6 bg-white overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h4 className="font-serif text-xl font-bold text-black">
              Devnet Swap Execution vs. WindTunnel Simulator (Exact Match Proof)
            </h4>
            <span className="badge-neo bg-[#B8E0D2] text-[11px]">4/4 Exact Matches</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#F7F3EC] border-b-2 border-black font-bold uppercase text-gray-600">
                <tr>
                  <th className="p-3">Swap Action</th>
                  <th className="p-3">Confirmed Slot</th>
                  <th className="p-3">On-Chain sqrtPrice</th>
                  <th className="p-3">Simulated sqrtPrice</th>
                  <th className="p-3">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {devnetData.map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="p-3 font-sans font-bold text-black">{d.trade}</td>
                    <td className="p-3 text-gray-700">{d.slot}</td>
                    <td className="p-3 font-semibold text-black">{d.onChainSqrt}</td>
                    <td className="p-3 font-semibold text-black">{d.simSqrt}</td>
                    <td className="p-3">
                      <span className="badge-neo bg-emerald-100 text-emerald-900 border-emerald-400 py-0.5 px-2">
                        {d.delta}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
