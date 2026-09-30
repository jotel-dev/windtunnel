'use client';

import React from 'react';

export function Footer() {
  return (
    <footer className="py-10 sm:py-12 px-4 sm:px-6 lg:px-8 bg-[#0A0E14] text-[#E6EDF3] border-t-2 border-[#30363D]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand & Subtitle */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F4805D] border-2 border-[#E6EDF3] flex items-center justify-center font-serif font-black text-base text-[#0D1117] shadow-[2px_2px_0_rgba(230,237,243,0.25)] shrink-0">
              W
            </div>
            <span className="font-serif text-xl font-bold tracking-tight text-white">WindTunnel</span>
          </div>
          <span className="text-xs text-[#8B949E] font-medium">
            Meteora DBC Flight Simulator &amp; Stress Engine
          </span>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-wrap justify-center items-center gap-1 sm:gap-4 text-xs sm:text-sm font-semibold text-[#8B949E]">
          <a href="#simulator" className="min-h-[44px] px-2.5 flex items-center hover:text-[#14F195] transition-colors">
            Simulator
          </a>
          <a href="#compare" className="min-h-[44px] px-2.5 flex items-center hover:text-[#14F195] transition-colors">
            Compare
          </a>
          <a href="#devnet" className="min-h-[44px] px-2.5 flex items-center hover:text-[#14F195] transition-colors">
            Devnet Proof
          </a>
          <a href="#findings" className="min-h-[44px] px-2.5 flex items-center hover:text-[#14F195] transition-colors">
            Findings
          </a>
          <a
            href="https://github.com/jotel-dev/windtunnel"
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] px-2.5 flex items-center hover:text-[#14F195] transition-colors gap-1"
          >
            <span>GitHub</span>
            <span>↗</span>
          </a>
        </div>

        {/* Built With Note */}
        <div className="text-xs text-[#8B949E] text-center md:text-right">
          Built with Meteora Dynamic Bonding Curve SDK &amp; CP-AMM SDK.
        </div>
      </div>
    </footer>
  );
}

