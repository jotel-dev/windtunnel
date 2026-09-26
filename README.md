# WindTunnel 🌪️

> Stress-test flight simulator and genetic config tuner for Meteora Dynamic Bonding Curves (DBC), validated bit-for-bit on Solana mainnet and devnet.

[![Live Demo](https://img.shields.io/badge/Live_Demo-windtunnel--six.vercel.app-14F195?style=for-the-badge&logo=vercel)](https://windtunnel-six.vercel.app)
[![Solana Mainnet](https://img.shields.io/badge/Solana-Mainnet--Beta%20Verified-00FFA3?style=for-the-badge&logo=solana)](https://explorer.solana.com/address/F5rMhAuXyc2qVWencT6Uc1H4DnxuJtCF6V1WJpNQ7PMV)
[![Tests Passing](https://img.shields.io/badge/Tests-37%20Passed-brightgreen?style=for-the-badge)](https://github.com/jotel-dev/windtunnel)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

---

## What is WindTunnel?

WindTunnel is a discrete-event market simulator and parameter optimization engine for Meteora Dynamic Bonding Curve (DBC) token launches. It allows founders, liquidity engineers, and token creators to simulate bonding curve launches under adversarial conditions—modeling snipers, MEV bundlers, retail momentum traders, and whales—before committing funds on-chain. Every mathematical model in WindTunnel has been validated against live Meteora DBC program state transitions on Solana Devnet and Mainnet-Beta.

---

## The Problem

Launching a bonding curve token blind is dangerous. Founders typically choose bonding curve parameters—such as initial market cap, migration targets, and fee decay schedules—without empirical data on how those choices behave under adversarial pressure. 

Our empirical benchmarks revealed two structural failure modes common to blind launches:
1. **Unprotected sniper extraction**: Standard flat 1.0% fee curves allow slot-0 Jito snipers to extract over 18% of early liquidity within the first few blocks, leaving organic buyers underwater.
2. **Severe migration liquidity drop**: Moving from a discrete DBC curve into Meteora DAMM v2 (CP-AMM) full-range liquidity causes an immediate **67x to 79x surge in price impact**, exposing graduating tokens to violent post-migration dump volatility.

---

## What We Built

WindTunnel provides a full-stack flight simulator across four core capabilities:

1. **Adversarial Trader Simulator**: A deterministic, multi-agent simulation engine running 5 distinct trader archetypes:
   - `JitoSniperAgent`: Slot-0 bundle extractors targeting early supply.
   - `RetailMomentumAgent`: Trend-following retail buyers with slippage thresholds.
   - `WhaleDumpAgent`: High-capital market orders designed to test pool resilience.
   - `NoiseTraderAgent`: Stochastic background liquidity.
   - `ArbitrageurAgent`: Cross-pool price reconcilers.
2. **DBC → DAMM v2 Migration-Gap Analyzer**: Measures price continuity, migration fees (protocol & creator splits), and the order book liquidity cliff across pool graduation.
3. **Evolutionary Auto-Tuner**: An evolutionary genetic algorithm that searches the continuous DBC parameter space to optimize user-specified objectives (e.g. `protect-organic`, `creator-yield`, `whale-absorption`) across hundreds of simulated attack scenarios.
4. **Interactive Web Flight Simulator**: A Next.js web application ([windtunnel-six.vercel.app](https://windtunnel-six.vercel.app)) featuring side-by-side curve comparison, real-time adversarial playback, and interactive parameter tuning.

---

## Key Findings

Through millions of simulated ticks and on-chain benchmarks, WindTunnel uncovered critical economic insights:

- **67x – 79x Post-Graduation Slippage Jump**: A standard $1,000 buy order incurs **67x to 79x higher price impact** immediately after migration onto DAMM v2 compared to immediately before migration on the bonding curve. This occurs because migrated liquidity is deployed across the entire range (`MIN_SQRT_PRICE` to `MAX_SQRT_PRICE`), substantially diluting active depth near spot.
- **Auto-Tuner Outperforms Hand-Picked Baselines (+6.28 pts)**: In head-to-head testing against coordinated sniper bundles, WindTunnel's auto-tuner discovered a 16.0% fee barrier with a 1,000-slot decay and 20% creator split that beat baseline configurations by **+6.28 objective points**, while driving a **+225% increase in creator fee capture** (from 0.126 SOL to 0.410 SOL) without choking organic buyers.
- **Exact-Match Devnet Validation (0 Lamport Delta)**: Across 4 consecutive devnet swaps, WindTunnel's discrete mathematical engine predicted on-chain `sqrtPrice`, base reserves, quote reserves, and 3-way fee splits with **exact 0-lamport delta** against the live Meteora DBC program.

---

## Verified on Real Infrastructure

WindTunnel is tested and verified on live Solana networks:

### 1. Mainnet-Beta Live Traction (Phase 8)
- **Tuned Partner Config**: [`HRTdrgErgvNtBabEQjtZusdvkm7FXYipjGh8BEdRPECf`](https://explorer.solana.com/address/HRTdrgErgvNtBabEQjtZusdvkm7FXYipjGh8BEdRPECf)
- **Virtual DBC Pool PDA**: [`F5rMhAuXyc2qVWencT6Uc1H4DnxuJtCF6V1WJpNQ7PMV`](https://explorer.solana.com/address/F5rMhAuXyc2qVWencT6Uc1H4DnxuJtCF6V1WJpNQ7PMV)
- **Base Token Mint (WIND)**: [`2M5bnNecFmnasuFKnq9NcX99fGwAvYKDWmVFjf3Qe7jZ`](https://explorer.solana.com/address/2M5bnNecFmnasuFKnq9NcX99fGwAvYKDWmVFjf3Qe7jZ)
- **Swap 1 (Buy 0.003 SOL → 27.81M WIND)**: [`2TpaPqM...`](https://explorer.solana.com/tx/2TpaPqMqq4hZWQSb7HVXt3EhTeUzA8NEiU9mJML4GSms1CmGNFcTsiCS6XkUMX8sbYYu1MEmVbNRWyDW5FyXAngU) @ `1.079e-10 SOL/WIND`
- **Swap 2 (Buy 0.003 SOL → 19.87M WIND)**: [`2njtYBv...`](https://explorer.solana.com/tx/2njtYBv3aVngGGk5GUPE5GTtzoYpHWiLJFH9a1stmBNhKUch9AzTFhSgzb2qw5ToXm8DUm7T3SQ2P9nrkCdExrv1) @ `1.510e-10 SOL/WIND` (+40.0% curve price discovery)
- **Full Report**: [`docs/mainnet-launch.md`](docs/mainnet-launch.md)

### 2. Devnet Mathematical Parity (Phase 5)
- **Devnet Partner Config**: [`HqzYqop5KQXxGxWte7iaH2DUTDU74XdvnozoW4D1oDm4`](https://explorer.solana.com/address/HqzYqop5KQXxGxWte7iaH2DUTDU74XdvnozoW4D1oDm4?cluster=devnet)
- **Devnet Pool**: [`2zJFqXFqoJDt7kvf1vpCXRa8qTS11ATNmy19TPZjRXBV`](https://explorer.solana.com/address/2zJFqXFqoJDt7kvf1vpCXRa8qTS11ATNmy19TPZjRXBV?cluster=devnet)
- **Full Report**: [`docs/devnet-validation.md`](docs/devnet-validation.md)

---

## Architecture

```text
windtunnel/
├── core/                           # Pure simulation & optimization engine
│   ├── src/
│   │   ├── sim/
│   │   │   ├── simulator.ts        # In-memory Meteora DBC virtual curve
│   │   │   ├── damm.ts             # Post-graduation DAMM v2 CP-AMM model
│   │   │   ├── agents.ts           # 5 adversarial trader archetypes
│   │   │   ├── runner.ts           # Scenario harness & discrete-event clock
│   │   │   └── scorecard.ts        # Comprehensive launch scorecards
│   │   ├── tuner/
│   │   │   ├── optimizer.ts        # Evolutionary genetic tuner
│   │   │   └── objectives.ts       # Fitness scoring functions
│   ├── scripts/                    # Deployment, benchmark & tuning scripts
│   └── tests/                      # 37 hardened invariant & parity tests
│
├── web/                            # Interactive Next.js web application
│   ├── src/app/                    # Next.js App Router & server simulation APIs
│   └── src/components/             # Bold dark-theme dashboard & charts
│
└── docs/                           # Empirical research papers & on-chain proof
```

The Next.js frontend calls the simulation engine through server-side API routes (`/api/simulate`, `/api/compare`), guaranteeing 100% mathematical fidelity between the CLI and the web interface without duplicating code.

---

## Running Locally

### Prerequisites
- Node.js v20+ (tested on Node v24)
- npm v10+

### 1. Test the Simulation Engine
```bash
# Clone the repository
git clone https://github.com/jotel-dev/windtunnel.git
cd windtunnel

# Install dependencies and run tests in core
cd core
npm install
npm test
```

### 2. Run Benchmarks & Genetic Tuner
```bash
# Run 3-way launch comparison harness
npm run compare

# Run the evolutionary auto-tuner
npx tsx scripts/tune-demo.ts
```

### 3. Launch the Interactive Web Dashboard
```bash
cd ../web
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Documentation

- [`docs/mainnet-launch.md`](docs/mainnet-launch.md): Solana Mainnet-Beta launch ledger, transaction signatures, and budget accounting.
- [`docs/devnet-validation.md`](docs/devnet-validation.md): Empirical bit-for-bit validation of simulator predictions against Solana Devnet.
- [`docs/migration-gap-findings.md`](docs/migration-gap-findings.md): Research paper on the 67-79x liquidity cliff transitioning from DBC to DAMM v2.
- [`docs/sdk-notes.md`](docs/sdk-notes.md): Technical deep-dive into Meteora DBC SDK internals, bit shifts, and math equations.

---

## Built For

Built with precision for the **Meteora Dynamic Bonding Curve Bounty** on **Superteam Earn**.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
