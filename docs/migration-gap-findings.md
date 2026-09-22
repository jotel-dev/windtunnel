# Migration Gap Findings: DBC to DAMM v2

> **Important Notice:** The DAMM v2 liquidity shape and post-graduation state modeled here are based on Meteora's SDK constants (`MIN_SQRT_PRICE`, `MAX_SQRT_PRICE`, and `getMigrationData()` from `@meteora-ag/cp-amm-sdk` and `@meteora-ag/dynamic-bonding-curve-sdk`). This post-graduation liquidity shape is **not yet verified on devnet**.

---

## 1. Executive Summary

When a Meteora Dynamic Bonding Curve (DBC) token reaches its `migrationQuoteThreshold`, the pool graduates and migrates liquidity into a DAMM v2 (CP-AMM) pool. This analysis benchmarks the **price continuity** and **liquidity depth transition** across graduation using WindTunnel's `measureMigrationGap` model.

### Key Takeaways:
1. **Price Gap on Migration**: Ranged between **140 bps (1.40%)** and **382 bps (3.82%)** across test profiles. This gap is driven by protocol and creator migration fee subtractions (e.g. 2% protocol fee) and the mathematical reconciliation between discrete DBC curve segments and DAMM v2's continuous concentrated sqrt price.
2. **Severe Liquidity Thinning on Graduation**: Across all curves, the price impact of a standard **$1,000 buy immediately after graduation on DAMM v2 is 67x to 79x higher** than immediately before graduation on DBC.
3. **Root Cause (Full-Range Dilution)**: Upon migration, quote and base reserves are deployed into a full-range position (`MIN_SQRT_PRICE` to `MAX_SQRT_PRICE`). Because the price range spans from $10^{-12}$ to $10^{12}$, active liquidity density around the spot price is diluted compared to the DBC bonding curve, where accumulated quote reserves were tightly concentrated.

---

## 2. Experimental Setup

- **Quote Currency**: SOL (9 decimals)
- **Reference Price**: **$150.00 / SOL**
- **Test Trade Size**: **$1,000 USD** (equivalent to **6.6667 SOL** or `6,666,666,666` lamports)
- **Pre-Graduation State**: Evaluated at **95% curve fill** immediately before the graduating trade.
- **Post-Graduation State**: Initialized via `buildDammV2PoolState` using exact `getMigrationData()` outputs and 1% DAMM v2 base fee.

### Evaluated Configurations:
1. **Steep Curve**: `buildCurveWithMarketCap`
   - Initial Market Cap: 10 SOL ($1,500)
   - Migration Market Cap: 600 SOL ($90,000)
   - Price Growth: 60x over the curve.
2. **Flat Curve**: `buildCurveWithMarketCap`
   - Initial Market Cap: 200 SOL ($30,000)
   - Migration Market Cap: 400 SOL ($60,000)
   - Price Growth: 2x over the curve.
3. **Multi-Segment Curve**: `buildCurveWithTwoSegments`
   - Initial Market Cap: 20 SOL ($3,000)
   - Migration Market Cap: 400 SOL ($60,000)
   - Supply on Migration: 30%
   - 2-stage piece-wise curve slope.

---

## 3. Results Matrix

| Metric | Steep Curve (10 → 600 SOL) | Flat Curve (200 → 400 SOL) | Multi-Segment (20 → 400 SOL) |
| :--- | :--- | :--- | :--- |
| **Migration Threshold** | ~68.76 SOL | ~387.89 SOL | ~306.12 SOL |
| **Price Gap (bps)** | **382 bps** (3.82%) | **221 bps** (2.21%) | **140 bps** (1.40%) |
| **Last DBC Spot Price** | 5.779e-7 SOL | 4.090e-7 SOL | 4.057e-7 SOL |
| **DAMM v2 Starting Price** | 6.000e-7 SOL | 4.000e-7 SOL | 4.000e-7 SOL |
| **DBC $1k Buy Impact** | **14 bps** (0.14%) | **6 bps** (0.06%) | **7 bps** (0.07%) |
| **DAMM v2 $1k Buy Impact** | **989 bps** (9.89%) | **407 bps** (4.07%) | **556 bps** (5.56%) |
| **Price Impact Multiplier** | **70.64x** | **67.83x** | **79.43x** |
| **1% Move Depth: DBC** | 0.3603 SOL | 2.7637 SOL | 1.5734 SOL |
| **1% Move Depth: DAMM v2** | 0.3693 SOL | 0.8499 SOL | 0.6318 SOL |
| **1% Depth Ratio (DAMM/DBC)**| 1.02x | 0.31x | 0.40x |
| **5% Move Depth: DBC** | 1.7842 SOL | 13.6841 SOL | 7.7903 SOL |
| **5% Move Depth: DAMM v2** | 1.8287 SOL | 4.2079 SOL | 3.1280 SOL |
| **5% Depth Ratio (DAMM/DBC)**| 1.02x | 0.31x | 0.40x |
| **10% Move Depth: DBC** | 3.5264 SOL | 16.2893 SOL | 11.9388 SOL |
| **10% Move Depth: DAMM v2** | 3.6144 SOL | 8.3168 SOL | 6.1825 SOL |
| **10% Depth Ratio (DAMM/DBC)**| 1.02x | 0.51x | 0.52x |

---

## 4. Plain-Language Interpretation

### 1. Price Gap Dynamics
When a curve finishes, the last execution price on DBC differs slightly from DAMM v2's opening price:
- On the **Steep Curve**, DAMM v2 opens ~3.82% higher than the DBC's 95% execution price as the final buying wave finishes ascending the steep curve.
- On the **Flat Curve** and **Multi-Segment Curve**, the price gap is smaller (1.4% - 2.2%).
- In all cases, protocol migration fees (deducted from quote reserves prior to pool creation) alter the effective quote-to-base ratio deposited into DAMM v2, creating a measurable spread.

### 2. The Post-Graduation Liquidity Void
The most striking finding is the **massive increase in price impact** for post-graduation swaps:
- A $1,000 buy before graduation moved DBC price by only **6 to 14 basis points**.
- The identical $1,000 buy on the freshly created DAMM v2 pool moved price by **407 to 989 basis points (4.0% to 9.9%)**.
- This is a **~70x surge in slippage**.

**Why does this happen?**
In the DBC bonding curve, all trading is concentrated on a single active segment calibrated specifically to the token's initial supply. But when migrating to DAMM v2, standard initialization creates a **full-range position** spanning from `MIN_SQRT_PRICE` (~4.29e9) to `MAX_SQRT_PRICE` (~7.92e28). 
Because capital is distributed across thousands of ticks outside the active trading band, the *effective depth* ($L$) around spot price is substantially lower than on the terminal bonding curve.

### 3. Depth Profiles (1%, 5%, 10%)
- **Steep Curve**: Because the steep curve concentrated very little quote liquidity until the very end, its depth at 95% fill (0.36 SOL for 1%) closely matches DAMM v2's full-range depth (0.37 SOL).
- **Flat and Multi-Segment Curves**: These curves require massive amounts of capital to move on the bonding curve (2.76 SOL and 1.57 SOL for 1%). Once migrated to DAMM v2, their depth collapses to **0.85 SOL and 0.63 SOL** (a 60-70% drop in market depth).

---

## 5. Strategic Implications for WindTunnel & Launchers

1. **Vulnerability to Post-Graduation Sniping & Arbitrage**:
   Because DAMM v2 opens with significantly higher price impact, arbitrageurs and snipers who wait for the graduation transaction can push the price dramatically with minimal capital, leading to post-graduation dumping.
2. **Fee Scheduler Defense on DAMM v2**:
   Unlike DBC (where rate limiters are rejected on pool initialization), DAMM v2 supports fee schedulers and rate limiters. Configuring a higher initial post-graduation fee (e.g. 5% decaying to 1%) is crucial to deter post-migration front-running.
3. **Auto-Tuning Objectives**:
   WindTunnel's optimizer should incorporate the `priceGapBps` and `impactRatio` into its objective function to balance curve steepness against post-graduation stability.
