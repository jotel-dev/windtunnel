'use client';

import React from 'react';

export function Footer() {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-[#F7F3EC] text-black">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F4805D] border-2 border-black flex items-center justify-center font-serif font-black text-base shadow-[2px_2px_0_#000]">
            W
          </div>
          <span className="font-serif text-xl font-bold tracking-tight">WindTunnel</span>
          <span className="text-xs text-gray-500 font-medium ml-2">
            Simulation & Stress-Test Engine for Meteora DBC
          </span>
        </div>

        <div className="flex items-center gap-6 text-xs font-semibold text-gray-700">
          <a href="#simulator" className="hover:underline">Simulator</a>
          <a href="#compare" className="hover:underline">Compare</a>
          <a href="#devnet" className="hover:underline">Devnet Proof</a>
          <a href="#findings" className="hover:underline">Findings</a>
          <a
            href="https://github.com/jotel-dev/windtunnel"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline flex items-center gap-1"
          >
            <span>GitHub</span>
            <span>↗</span>
          </a>
        </div>

        <div className="text-xs text-gray-500">
          Built with Meteora Dynamic Bonding Curve SDK & CP-AMM SDK.
        </div>
      </div>
    </footer>
  );
}
