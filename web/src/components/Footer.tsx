'use client';

import React from 'react';

export function Footer() {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-[#0A0E14] text-[#E6EDF3] border-t-2 border-[#30363D]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F4805D] border-2 border-[#E6EDF3] flex items-center justify-center font-serif font-black text-base text-[#0D1117] shadow-[2px_2px_0_rgba(230,237,243,0.25)]">
            W
          </div>
          <span className="font-serif text-xl font-bold tracking-tight text-white">WindTunnel</span>
          <span className="text-xs text-[#8B949E] font-medium ml-2">
            Simulation & Stress-Test Engine for Meteora DBC
          </span>
        </div>

        <div className="flex items-center gap-6 text-xs font-semibold text-[#8B949E]">
          <a href="#simulator" className="hover:text-[#14F195] transition-colors">Simulator</a>
          <a href="#compare" className="hover:text-[#14F195] transition-colors">Compare</a>
          <a href="#devnet" className="hover:text-[#14F195] transition-colors">Devnet Proof</a>
          <a href="#findings" className="hover:text-[#14F195] transition-colors">Findings</a>
          <a
            href="https://github.com/jotel-dev/windtunnel"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#14F195] transition-colors flex items-center gap-1"
          >
            <span>GitHub</span>
            <span>↗</span>
          </a>
        </div>

        <div className="text-xs text-[#8B949E]">
          Built with Meteora Dynamic Bonding Curve SDK & CP-AMM SDK.
        </div>
      </div>
    </footer>
  );
}
