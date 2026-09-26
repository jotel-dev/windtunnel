'use client';

import React, { useState } from 'react';

export function DevnetVerified() {
  const [activeTab, setActiveTab] = useState<'mainnet' | 'devnet'>('mainnet');

  const mainnetTransactions = [
    {
      action: '1. Create DBC Partner Config',
      type: 'Config Initialization',
      details: 'Published tuned "Protect-Organic" anti-sniper preset (16% starting fee, 1,000 slots decay, 20% creator split)',
      txSig: 'QWFUuhi9KjrA3Pd1v5srTsuP48KFg7C9TaFDUTKp7cJqev2hSKDrG1HAVm3aWcTct8XGhQVKkq8XuWA6fRHfgGq',
      cost: '0.00598 SOL',
      status: 'CONFIRMED',
      link: 'https://explorer.solana.com/tx/QWFUuhi9KjrA3Pd1v5srTsuP48KFg7C9TaFDUTKp7cJqev2hSKDrG1HAVm3aWcTct8XGhQVKkq8XuWA6fRHfgGq',
    },
    {
      action: '2. Create Pool & Base Token (WIND)',
      type: 'Pool Deployment',
      details: 'Initialized SPL token mint and DBC Virtual Pool PDA with 1B supply on Meteora DBC program',
      txSig: 'd8gcWY4Looh4xht6Wss4Uqboiw1Ceih5vP3oQXbdG27BEgwXg4PanuRzygYUJBn6S4F5z3cTGB6K3HrU11YXUvW',
      cost: '0.02059 SOL',
      status: 'CONFIRMED',
      link: 'https://explorer.solana.com/tx/d8gcWY4Looh4xht6Wss4Uqboiw1Ceih5vP3oQXbdG27BEgwXg4PanuRzygYUJBn6S4F5z3cTGB6K3HrU11YXUvW',
    },
    {
      action: '3. Real Swap 1 (Buy 0.003 SOL)',
      type: 'Live Buy Swap',
      details: 'Acquired 27,814,906.18 WIND at 1.079 × 10⁻¹⁰ SOL/WIND; verified 16% fee enforcement on-chain',
      txSig: '2TpaPqMqq4hZWQSb7HVXt3EhTeUzA8NEiU9mJML4GSms1CmGNFcTsiCS6XkUMX8sbYYu1MEmVbNRWyDW5FyXAngU',
      cost: '0.00449 SOL',
      status: 'CONFIRMED',
      link: 'https://explorer.solana.com/tx/2TpaPqMqq4hZWQSb7HVXt3EhTeUzA8NEiU9mJML4GSms1CmGNFcTsiCS6XkUMX8sbYYu1MEmVbNRWyDW5FyXAngU',
    },
    {
      action: '4. Real Swap 2 (Buy 0.003 SOL)',
      type: 'Live Buy Swap',
      details: 'Acquired 19,865,223.25 WIND at 1.510 × 10⁻¹⁰ SOL/WIND; +40.0% curve price discovery progression',
      txSig: '2njtYBv3aVngGGk5GUPE5GTtzoYpHWiLJFH9a1stmBNhKUch9AzTFhSgzb2qw5ToXm8DUm7T3SQ2P9nrkCdExrv1',
      cost: '0.00301 SOL',
      status: 'CONFIRMED',
      link: 'https://explorer.solana.com/tx/2njtYBv3aVngGGk5GUPE5GTtzoYpHWiLJFH9a1stmBNhKUch9AzTFhSgzb2qw5ToXm8DUm7T3SQ2P9nrkCdExrv1',
    },
  ];

  const devnetData = [
    { trade: '#1 Buy (0.04 SOL)', slot: '502,898,411', onChainSqrt: '9,330,152,131,849,556', simSqrt: '9,330,152,131,849,556', delta: '0 (EXACT)' },
    { trade: '#2 Buy (0.05 SOL)', slot: '502,898,415', onChainSqrt: '9,510,942,674,103,422', simSqrt: '9,510,942,674,103,422', delta: '0 (EXACT)' },
    { trade: '#3 Sell (1.2M Tokens)', slot: '502,898,421', onChainSqrt: '9,442,109,871,553,019', simSqrt: '9,442,109,871,553,019', delta: '0 (EXACT)' },
    { trade: '#4 Buy (0.08 SOL)', slot: '502,898,430', onChainSqrt: '9,720,419,002,114,831', simSqrt: '9,720,419,002,114,831', delta: '0 (EXACT)' },
  ];

  return (
    <section id="devnet" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#101F18] border-b-2 border-[#14F195]/30">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="badge-neo-solana">On-Chain Ground Truth & Traction</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#14F195]/20 text-[#14F195] border border-[#14F195]/40 font-mono">
                <span className="w-2 h-2 rounded-full bg-[#14F195] animate-pulse"></span>
                LIVE ON MAINNET
              </span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold font-serif text-white mb-3">
              Real Mainnet Launch & Devnet Parity
            </h2>
            <p className="text-[#8B949E] text-base sm:text-lg max-w-2xl font-sans">
              WindTunnel bridges offline evolutionary modeling and real-world execution. We published our tuned bonding curve preset to <strong className="text-white">Solana Mainnet-Beta</strong>, created a real pool, and executed live trades to prove traction.
            </p>
          </div>

          {/* Network Switcher Tabs */}
          <div className="flex items-center gap-2 p-1.5 bg-[#0D1912] border-2 border-[#14F195]/40 rounded-xl">
            <button
              onClick={() => setActiveTab('mainnet')}
              className={`px-4 py-2 rounded-lg font-mono text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'mainnet'
                  ? 'bg-[#14F195] text-[#0D1117] shadow-[2px_2px_0_#0D1117]'
                  : 'text-[#8B949E] hover:text-white'
              }`}
            >
              🟢 Mainnet-Beta (Live Traction)
            </button>
            <button
              onClick={() => setActiveTab('devnet')}
              className={`px-4 py-2 rounded-lg font-mono text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'devnet'
                  ? 'bg-[#14F195] text-[#0D1117] shadow-[2px_2px_0_#0D1117]'
                  : 'text-[#8B949E] hover:text-white'
              }`}
            >
              🧪 Devnet (Math Parity)
            </button>
          </div>
        </div>

        {/* MAINNET TAB CONTENT */}
        {activeTab === 'mainnet' && (
          <div className="space-y-8 animate-fadeIn">
            {/* 4 Live Mainnet Proof Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <a
                href="https://explorer.solana.com/address/HRTdrgErgvNtBabEQjtZusdvkm7FXYipjGh8BEdRPECf"
                target="_blank"
                rel="noopener noreferrer"
                className="card-neo-green p-6 hover:-translate-y-1 transition-transform group block"
              >
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#14F195] mb-1">
                  <span>Mainnet Config</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                </div>
                <div className="font-mono text-sm font-bold text-white truncate mb-2">
                  HRTdrg...PECf
                </div>
                <p className="text-xs text-[#8B949E]">
                  Tuned Partner Config with 16% fee barrier &amp; 1,000 slot decay.
                </p>
              </a>

              <a
                href="https://explorer.solana.com/address/F5rMhAuXyc2qVWencT6Uc1H4DnxuJtCF6V1WJpNQ7PMV"
                target="_blank"
                rel="noopener noreferrer"
                className="card-neo-green p-6 hover:-translate-y-1 transition-transform group block"
              >
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#14F195] mb-1">
                  <span>Mainnet DBC Pool</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                </div>
                <div className="font-mono text-sm font-bold text-white truncate mb-2">
                  F5rMhA...7PMV
                </div>
                <p className="text-xs text-[#8B949E]">
                  Active virtual bonding curve pool holding live base and quote reserves.
                </p>
              </a>

              <a
                href="https://explorer.solana.com/address/2M5bnNecFmnasuFKnq9NcX99fGwAvYKDWmVFjf3Qe7jZ"
                target="_blank"
                rel="noopener noreferrer"
                className="card-neo-green p-6 hover:-translate-y-1 transition-transform group block"
              >
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#14F195] mb-1">
                  <span>Base Token (WIND)</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                </div>
                <div className="font-mono text-sm font-bold text-white truncate mb-2">
                  2M5bnN...7jZ
                </div>
                <p className="text-xs text-[#8B949E]">
                  Live SPL mint with 1,000,000,000 supply and 6 decimal precision.
                </p>
              </a>

              <a
                href="https://explorer.solana.com/address/3kSQuuY5Soh3ivZxJ4HoyrgC3Cewif2UmW7hT3Wwvbsk"
                target="_blank"
                rel="noopener noreferrer"
                className="card-neo-green p-6 hover:-translate-y-1 transition-transform group block"
              >
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#14F195] mb-1">
                  <span>Tokens Traded</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                </div>
                <div className="font-mono text-sm font-bold text-[#14F195] truncate mb-2">
                  47,680,129 WIND
                </div>
                <p className="text-xs text-[#8B949E]">
                  Real swaps executed; wallet balance acquired via live pool trades.
                </p>
              </a>
            </div>

            {/* Mainnet Transactions Table */}
            <div className="card-neo-green p-6 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h4 className="font-serif text-xl font-bold text-white flex items-center gap-2">
                    <span>Solana Mainnet-Beta Transaction Ledger</span>
                    <span className="badge-neo-solana text-[11px]">4 Transactions Verified</span>
                  </h4>
                  <p className="text-xs text-[#8B949E] mt-1 font-sans">
                    Executed using real wallet <code className="text-[#14F195]">5EwgTh...BZQye5</code> on program <code className="text-white">dbcv15...Mete</code>
                  </p>
                </div>
                <a
                  href="https://explorer.solana.com/address/5EwgThE4vi7iaUP3SXSq1n1m9aiSrx3WSeDa35BZQye5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-xs py-2 px-3 self-start sm:self-auto border-[#14F195] text-[#14F195] hover:bg-[#14231B]"
                >
                  <span>View Wallet on Explorer</span>
                  <span>↗</span>
                </a>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-[#0D1912] border-b-2 border-[#14F195]/40 font-bold uppercase text-[#8B949E]">
                    <tr>
                      <th className="p-3">Stage &amp; Action</th>
                      <th className="p-3">Economic Execution Details</th>
                      <th className="p-3">Tx Signature</th>
                      <th className="p-3">Cost / Input</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E3325] font-mono">
                    {mainnetTransactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-[#1A2C21] transition-colors">
                        <td className="p-3 font-sans font-bold text-white whitespace-nowrap">
                          {tx.action}
                        </td>
                        <td className="p-3 font-sans text-xs text-[#8B949E] min-w-[260px]">
                          {tx.details}
                        </td>
                        <td className="p-3">
                          <a
                            href={tx.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#14F195] hover:underline flex items-center gap-1 group font-semibold"
                          >
                            <span>{tx.txSig.slice(0, 8)}...{tx.txSig.slice(-6)}</span>
                            <span className="opacity-60 group-hover:opacity-100">↗</span>
                          </a>
                        </td>
                        <td className="p-3 text-[#E6EDF3] whitespace-nowrap font-semibold">
                          {tx.cost}
                        </td>
                        <td className="p-3">
                          <span className="badge-neo-solana py-0.5 px-2.5">
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Economic Summary Footer */}
              <div className="mt-4 pt-4 border-t border-[#1E3325] flex flex-wrap items-center justify-between text-xs text-[#8B949E] font-mono gap-4">
                <div>
                  <span className="text-white font-bold">Total Budget:</span> 0.04856 SOL (~$5.88)
                </div>
                <div>
                  <span className="text-white font-bold">Total Spent:</span> 0.03407 SOL (~$4.12)
                </div>
                <div>
                  <span className="text-[#14F195] font-bold">Remaining Surplus:</span> 0.01448 SOL (29.8%)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DEVNET TAB CONTENT */}
        {activeTab === 'devnet' && (
          <div className="space-y-8 animate-fadeIn">
            {/* 4 Proof Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="card-neo-green p-6 hover:-translate-y-1 transition-transform">
                <div className="text-xs font-bold uppercase tracking-wider text-[#14F195] mb-1">
                  Confirmed Signature
                </div>
                <div className="font-mono text-sm font-bold text-white truncate mb-2">
                  3koB6M...BA1o
                </div>
                <p className="text-xs text-[#8B949E]">
                  Live test transaction deployed via Meteora DBC on devnet.
                </p>
              </div>

              <div className="card-neo-green p-6 hover:-translate-y-1 transition-transform">
                <div className="text-xs font-bold uppercase tracking-wider text-[#14F195] mb-1">
                  Target Program ID
                </div>
                <div className="font-mono text-sm font-bold text-white truncate mb-2">
                  dbcij3...aqN
                </div>
                <p className="text-xs text-[#8B949E]">
                  Meteora DBC v1.5 verified devnet deployment contract.
                </p>
              </div>

              <div className="card-neo-green p-6 hover:-translate-y-1 transition-transform">
                <div className="text-xs font-bold uppercase tracking-wider text-[#14F195] mb-1">
                  Token Mint
                </div>
                <div className="font-mono text-sm font-bold text-white truncate mb-2">
                  AUuhty...F8fQ
                </div>
                <p className="text-xs text-[#8B949E]">
                  Test launch token minted with 1,000,000,000 base token supply.
                </p>
              </div>

              <div className="card-neo-green p-6 hover:-translate-y-1 transition-transform">
                <div className="text-xs font-bold uppercase tracking-wider text-[#14F195] mb-1">
                  Math Parity
                </div>
                <div className="font-mono text-sm font-bold text-[#14F195] truncate mb-2">
                  Δ = 0 Lamports
                </div>
                <p className="text-xs text-[#8B949E]">
                  Zero difference between simulator prediction and on-chain logs.
                </p>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="card-neo-green p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-serif text-xl font-bold text-white">
                  Devnet Swap Execution vs. WindTunnel Simulator (Exact Match Proof)
                </h4>
                <span className="badge-neo-solana text-[11px]">4/4 Exact Matches</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-[#0D1912] border-b-2 border-[#14F195]/40 font-bold uppercase text-[#8B949E]">
                    <tr>
                      <th className="p-3">Swap Action</th>
                      <th className="p-3">Confirmed Slot</th>
                      <th className="p-3">On-Chain sqrtPrice</th>
                      <th className="p-3">Simulated sqrtPrice</th>
                      <th className="p-3">Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E3325] font-mono">
                    {devnetData.map((d, i) => (
                      <tr key={i} className="hover:bg-[#1A2C21] transition-colors">
                        <td className="p-3 font-sans font-bold text-white">{d.trade}</td>
                        <td className="p-3 text-[#8B949E]">{d.slot}</td>
                        <td className="p-3 font-semibold text-white">{d.onChainSqrt}</td>
                        <td className="p-3 font-semibold text-white">{d.simSqrt}</td>
                        <td className="p-3">
                          <span className="badge-neo-solana py-0.5 px-2.5">
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
        )}
      </div>
    </section>
  );
}
