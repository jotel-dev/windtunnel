# WindTunnel 🌪️

> Stress-test flight simulator and config tuner for Meteora Dynamic Bonding Curves (DBC), validated bit-for-bit on Solana mainnet and devnet.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-windtunnel--six.vercel.app-14F195?style=flat&logo=vercel)](https://windtunnel-six.vercel.app)
[![Solana Mainnet](https://img.shields.io/badge/Solana-Mainnet%20Verified-00FFA3?style=flat&logo=solana)](https://explorer.solana.com/address/HRTdrgErgvNtBabEQjtZusdvkm7FXYipjGh8BEdRPECf)
[![Meteora DBC](https://img.shields.io/badge/Meteora-DBC%20v1.5-F4805D?style=flat)](https://meteora.ag)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What is WindTunnel?

WindTunnel is a discrete-event market simulator and parameter optimization engine for Meteora Dynamic Bonding Curve (DBC) token launches. It allows founders, liquidity engineers, and token creators to simulate bonding curve launches under adversarial conditions—modeling snipers, MEV bundlers, retail momentum traders, and whales—before committing funds on-chain. Every mathematical model in WindTunnel has been validated against live Meteora DBC program state transitions on Solana Devnet and Mainnet-Beta.

---

## The Problem

Launching a bonding curve token blind is dangerous. Founders typically choose bonding curve parameters—such as initial market cap, migration targets, and fee decay schedules—without empirical data on how those choices behave under adversarial pressure. 

Our empirical benchmarks revealed two structural failure modes common to blind launches:
1. **Unprotected sniper extraction**: Across benchmark scenarios, slot-0 Jito snipers extract **18.3% to 18.5%** of token supply under whale-heavy order flow (generating up to 96.6 SOL net profit in `scripts/compare-demo.ts`), and **38.2% to 42.8%** under coordinated sniper bundles on flat and low-fee curves (`scripts/tune-demo.ts`), capturing early tokens before organic buyers can execute.
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
3. **Evolutionary Auto-Tuner**: A two-stage evolutionary optimization search (`core/src/tuner/tuner.ts`). Generation 0 samples random candidate configurations across the continuous DBC parameter space (`core/src/tuner/space.ts`), evaluates them against adversarial scenarios, and selects the top-scoring elite candidates. Generation 1 mutates the parameters of those top performers within bounded perturbation ranges to converge on optimal fee barriers, decay rates, and curve dimensions for user-specified objectives (e.g. `protect-organic`, `creator-yield`).
4. **Interactive Web Flight Simulator**: A Next.js web application ([windtunnel-six.vercel.app](https://windtunnel-six.vercel.app)) featuring side-by-side curve comparison, real-time adversarial playback, and interactive parameter tuning.

---

## Key Findings

Through millions of simulated ticks and on-chain benchmarks, WindTunnel uncovered critical economic insights:

- **67x – 79x Post-Graduation Slippage Jump**: In migration gap benchmarks across steep, flat, and multi-segment curves (`scripts/compare-demo.ts`), a standard $1,000 buy order incurs **67x to 79x higher price impact** immediately after migration onto DAMM v2 compared to immediately before migration on the bonding curve (67.8x on flat, 70.6x on steep, 79.4x on multi-segment). This occurs because migrated liquidity is deployed across the full range (`MIN_SQRT_PRICE` to `MAX_SQRT_PRICE`), substantially diluting active depth near spot.
- **Auto-Tuner Outperforms Hand-Picked Baseline (+6.28 pts, +225% Creator Fees)**: In a 40-iteration two-stage parameter search against the coordinated snipers scenario (`seed: 4242`), the tuner refined a 16.0% starting fee barrier with a 1,000-slot linear decay (to 1.5% floor) and 2.6x curve expansion (15 to 39 SOL). Comparing this tuned preset against the hand-picked baseline (5% decaying to 1%, 20 to 40 SOL), the tuned config improved the objective score by **+6.28 points** and drove a **+225% increase in creator fee revenue** (from 0.126 SOL to 0.410 SOL) by taxing early sniper bundles at 16%, with sniper token share changing only slightly (38.2% to 37.2%) while organic buyer returns rose from +88.8% to +93.6%.
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
│   │   ├── agents/                 # 5 adversarial trader archetypes
│   │   │   ├── sniper.ts           # Slot-0 sniper extractor
│   │   │   ├── bundler.ts          # Coordinated Jito MEV bundles
│   │   │   ├── momentum.ts         # Retail trend-following buyers
│   │   │   ├── whale.ts            # High-capital market orders
│   │   │   └── arbitrageur.ts      # Cross-pool price reconciler
│   │   ├── scenario/               # Discrete-event simulation runner
│   │   │   ├── runner.ts           # Event loop, clock & step execution
│   │   │   ├── agentMix.ts         # Pre-configured trader compositions
│   │   │   └── compare.ts          # Multi-configuration comparison harness
│   │   ├── sim/                    # Mathematical models & AMM mechanics
│   │   │   ├── pool.ts             # In-memory Meteora DBC virtual curve
│   │   │   ├── damm.ts             # Post-graduation DAMM v2 CP-AMM & migration gap
│   │   │   ├── rng.ts              # Seeded Mulberry32 deterministic PRNG
│   │   │   └── volatility.ts       # Stochastic price volatility models
│   │   ├── scorecard/              # Multi-dimensional evaluation metrics
│   │   │   └── compute.ts          # Sniper extraction, organic returns & fees
│   │   ├── tuner/                  # Two-stage evolutionary parameter optimizer
│   │   │   ├── space.ts            # Parameter search space & random sampling
│   │   │   ├── objectives.ts       # Multi-objective fitness scoring functions
│   │   │   └── tuner.ts            # Gen 0 sampling + Gen 1 elite mutation
│   │   └── index.ts                # Public library exports
│   ├── scripts/                    # CLI demos & on-chain deployment scripts
│   │   ├── devnet-deploy.ts        # Devnet DBC config & pool creation
│   │   ├── devnet-trade.ts         # Devnet swap observation harness
│   │   ├── devnet-migrate.ts       # Devnet liquidity migration execution
│   │   ├── stage1-create-config.cjs# Mainnet partner config creation
│   │   ├── stage2-create-pool.cjs  # Mainnet DBC pool & mint initialization
│   │   ├── stage3-swap1.cjs        # Mainnet real swap 1 (buy)
│   │   ├── stage4-swap2.cjs        # Mainnet real swap 2 (buy)
│   │   ├── tune-demo.ts            # CLI auto-tuner demonstration
│   │   └── compare-demo.ts         # CLI 3-way launch comparison demo
│   └── tests/                      # 37 hardened invariant & parity tests
│
├── web/                            # Interactive Next.js web dashboard
│   ├── src/app/                    # Next.js App Router & server simulation APIs
│   │   ├── api/simulate/route.ts   # Server-side simulation API endpoint
│   │   └── api/compare/route.ts    # Server-side comparison API endpoint
│   ├── src/components/             # Dark-theme dashboard & charts
│   │   ├── Simulator.tsx           # Interactive curve flight simulator
│   │   ├── CompareView.tsx         # Side-by-side launch comparison
│   │   ├── DevnetVerified.tsx      # Mainnet traction & devnet parity proof
│   │   └── Findings.tsx            # Empirical research findings cards
│   └── src/lib/core.ts             # Server-side bindings to windtunnel-core
│
└── docs/                           # Empirical research papers & on-chain proof
    ├── mainnet-launch.md           # Mainnet-beta ledger & real swap proof
    ├── devnet-validation.md        # Devnet 0-delta mathematical parity proof
    ├── migration-gap-findings.md   # Research paper on 67-79x liquidity jump
    └── sdk-notes.md                # Meteora DBC SDK deep dive & bit math
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
