# WindTunnel 🌪️

> Stress-test lab and adversarial simulation engine for Meteora Dynamic Bonding Curve (DBC) token launches.

Built for the **Meteora Dynamic Bonding Curve Bounty** on Superteam Earn.

---

## 1. Overview

WindTunnel enables token creators to simulate, benchmark, and optimize Meteora Dynamic Bonding Curve configurations before deployment. It models both the pre-graduation DBC phase and the post-graduation DAMM v2 (CP-AMM) phase against realistic adversarial market dynamics (snipers, bundlers, whales, and arbitrageurs).

### Key Features (Phase 3)
- **High-Fidelity Virtual DBC Simulator**: Pure in-memory discrete execution replicating Meteora's on-chain DBC math (`swapQuote2`, reserve equations, fee splits, price impact).
- **Post-Graduation DAMM v2 Engine**: Concentrated liquidity pool simulator utilizing Meteora's `@meteora-ag/cp-amm-sdk` (`swapQuoteExactInput`, `applySwapResult`, `getBaseFeeHandlerFromPodAlignedData`).
- **Migration Gap & Continuity Analyzer**: Quantifies price gaps (in bps), immediate post-graduation price impact, and order book depth transition (1%, 5%, 10% move liquidity).
- **Hardened Invariant Test Suite**: Rigorous automated verification across 50+ random valid curves and 200-trade sequences using seeded Mulberry32 PRNG.

---

## 2. Directory Structure

```text
windtunnel/
├── core/                       # Core simulation engine and test suite
│   ├── src/
│   │   ├── sim/
│   │   │   ├── simulator.ts    # DBC VirtualPoolSimulator
│   │   │   ├── damm.ts         # DAMM v2 PostGraduationPool & measureMigrationGap
│   │   │   ├── rng.ts          # Seeded Mulberry32 deterministic PRNG
│   │   │   ├── types.ts        # Common simulation interfaces
│   │   │   └── volatility.ts   # Volatility and dynamic fee tracker
│   │   └── index.ts            # Public library exports
│   └── tests/
│       ├── simulator.test.ts   # Equivalence, invariants, fee schedulers, graduation
│       └── damm.test.ts        # DAMM v2 state construction, swaps, and gap analysis
├── docs/
│   ├── sdk-notes.md            # Comprehensive SDK reconnaissance (CONFIRMED / UNCONFIRMED)
│   └── migration-gap-findings.md # Empirical benchmark of DBC to DAMM v2 migration
└── README.md
```

---

## 3. Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or later (tested on v24.15.0)
- **npm**: v9.0.0 or later

### Installation
Clone the repository and install dependencies in the `core/` workspace:

```bash
cd core
npm install
```

### Building the Project
Compile the TypeScript source to JavaScript and type declaration files:

```bash
npm run build
```
This invokes `tsc` using TypeScript strict mode.

### Running Tests
Execute the comprehensive test suite with Vitest:

```bash
npm test
```

To run Vitest in watch mode:
```bash
npx vitest
```

To run a specific test suite:
```bash
npx vitest run tests/simulator.test.ts
npx vitest run tests/damm.test.ts
```

---

## 4. Test Suite Coverage

The hardened test suite verifies:
1. **DBC Equivalence**: Matches pure SDK `swapQuote2` across 50+ randomized valid curves (linear, exponential, and fixed fee schedulers).
2. **Economic Invariants**: 200-trade adversarial sequences over 20+ configs verifying quote conservation, zero fee leakage (`protocol + creator + partner == totalFee`), monotonic price increases under buy-only pressure, and non-negative balances.
3. **Deterministic Repeatability**: Identical PRNG seeds yield bitwise identical simulation trajectories.
4. **Fee Schedulers**: Time-decaying fee evaluation exactly matches `getBaseFeeHandler` across slot and timestamp activation modes.
5. **Graduation & Migration Data**: Partial fills land precisely on `migrationQuoteThreshold`, and quote reserves transfer accurately via `getMigrationData()`.
6. **DAMM v2 Liquidity Transition**: Validates post-graduation swap quotes, sqrt price updates, reserve accounting, and migration gap measurement.

---

## 5. Documentation
- [Meteora DBC SDK Reconnaissance Notes](docs/sdk-notes.md)
- [Migration Gap Findings: DBC to DAMM v2](docs/migration-gap-findings.md)
