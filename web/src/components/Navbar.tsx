'use client';

import React, { useState } from 'react';
import Image from 'next/image';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Simulator', href: '#simulator' },
    { label: 'Compare', href: '#compare' },
    { label: 'On-Chain Proof', href: '#devnet' },
    { label: 'Research Findings', href: '#findings' },
  ];

  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0D1117]/95 border-b-2 border-[#30363D] backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
        {/* Brand Logo & Title */}
        <a href="#" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
          <Image
            src="/windtunnel_mark.png"
            alt="WindTunnel Logo"
            width={106}
            height={36}
            className="h-7 sm:h-9 w-auto object-contain shrink-0"
            priority
          />
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-serif text-lg sm:text-2xl font-bold tracking-tight text-white group-hover:text-[#14F195] transition-colors">
                WindTunnel
              </span>
              <span className="badge-neo-solana text-[10px] sm:text-[11px] py-0.5 px-1.5 sm:px-2">
                v0.1
              </span>
            </div>
            <span className="text-[11px] sm:text-xs text-[#8B949E] font-medium hidden sm:inline-block">
              Meteora DBC Flight Simulator
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#E6EDF3]">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="py-2 hover:text-[#14F195] hover:underline underline-offset-4 decoration-2 transition-colors min-h-[44px] flex items-center"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* GitHub button - visible on desktop, in drawer menu on mobile */}
          <a
            href="https://github.com/jotel-dev/windtunnel"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary !hidden md:!inline-flex text-xs sm:text-sm py-2 px-3 sm:px-4 min-h-[44px] items-center"
            aria-label="GitHub Repository"
          >
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>GitHub</span>
          </a>

          {/* Launch Test Button */}
          <a
            href="#simulator"
            className="btn-primary text-xs sm:text-sm py-2 px-2.5 sm:px-4 min-h-[40px] sm:min-h-[44px] whitespace-nowrap"
          >
            Launch Test
          </a>

          {/* Mobile Hamburger Toggle Button (< md) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#161B22] border-2 border-[#E6EDF3] text-white flex items-center justify-center hover:bg-[#21262D] focus:outline-none shadow-[2px_2px_0_rgba(230,237,243,0.2)] transition-colors shrink-0"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Slide-down Navigation Panel */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#161B22] border-b-2 border-[#30363D] px-4 py-4 space-y-2 shadow-[0_8px_16px_rgba(0,0,0,0.5)] animate-fadeIn">
          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={handleLinkClick}
                className="px-4 py-3 rounded-lg text-sm font-semibold text-[#E6EDF3] hover:text-[#14F195] hover:bg-[#21262D] border border-transparent hover:border-[#30363D] transition-colors min-h-[44px] flex items-center justify-between"
              >
                <span>{link.label}</span>
                <span className="text-xs text-[#8B949E]">→</span>
              </a>
            ))}
          </div>

          <div className="pt-3 border-t border-[#30363D] flex items-center justify-between gap-3">
            <a
              href="https://github.com/jotel-dev/windtunnel"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
              className="btn-secondary text-xs w-full py-2.5 min-h-[44px] flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub Repository</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

