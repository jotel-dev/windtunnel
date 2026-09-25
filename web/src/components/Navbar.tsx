'use client';

import React from 'react';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-[#0D1117]/95 border-b-2 border-[#30363D] backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F4805D] border-2 border-[#E6EDF3] flex items-center justify-center font-serif font-black text-xl text-[#0D1117] shadow-[2px_2px_0_rgba(230,237,243,0.25)]">
            W
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-2xl font-bold tracking-tight text-white">WindTunnel</span>
              <span className="badge-neo-solana text-[11px] py-0.5 px-2">v0.1</span>
            </div>
            <span className="text-xs text-[#8B949E] font-medium hidden sm:inline-block">
              Meteora DBC Flight Simulator
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#E6EDF3]">
          <a href="#simulator" className="hover:text-[#14F195] hover:underline underline-offset-4 decoration-2 transition-colors">
            Simulator
          </a>
          <a href="#compare" className="hover:text-[#14F195] hover:underline underline-offset-4 decoration-2 transition-colors">
            Compare
          </a>
          <a href="#devnet" className="hover:text-[#14F195] hover:underline underline-offset-4 decoration-2 transition-colors">
            On-Chain Proof
          </a>
          <a href="#findings" className="hover:text-[#14F195] hover:underline underline-offset-4 decoration-2 transition-colors">
            Research Findings
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/jotel-dev/windtunnel"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs sm:text-sm py-2 px-3 sm:px-4"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>GitHub</span>
          </a>
          <a
            href="#simulator"
            className="btn-primary text-xs sm:text-sm py-2 px-3 sm:px-4"
          >
            Launch Test
          </a>
        </div>
      </div>
    </header>
  );
}
