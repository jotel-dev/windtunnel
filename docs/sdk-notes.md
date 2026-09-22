# Meteora DBC SDK Reconnaissance Notes

This document details the exact exported functions, types, and mathematical models in `@meteora-ag/dynamic-bonding-curve-sdk` (version `1.5.12`) used by WindTunnel for simulating Dynamic Bonding Curve (DBC) token launches. Every claim is marked **CONFIRMED** (with exact file, type, or function citations from `node_modules/@meteora-ag/dynamic-bonding-curve-sdk` or Meteora documentation) or **UNCONFIRMED**.

---

## 1. Building a Config from Parameters (Curve Segments, Fees, Migration, LP Split)

### Exported Functions
All curve builders return a complete `ConfigParameters` struct ready for on-chain config creation.

1. **`buildCurve(params: BuildCurveParams): ConfigParameters`** — **CONFIRMED**
   - *Reference*: `node_modules/@meteora-ag/dynamic-bonding-curve-sdk/dist/index.d.ts:7666`
   - *Inputs*: `BuildCurveParams` extending `BuildCurveBaseParams` with:
     - `percentageSupplyOnMigration: number` (e.g. 20 for 20%)
     - `migrationQuoteThreshold: BN` (quote token amount in lamports/raw units)
   - *Outputs*: `ConfigParameters` with a single curve segment.
   - *Math*: Calculates `sqrtStartPrice` and single `curve[0]` segment liquidity such that selling `(100 - percentageSupplyOnMigration)%` of supply collects `migrationQuoteThreshold`.

2. **`buildCurveWithMarketCap(params: BuildCurveWithMarketCapParams): ConfigParameters`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:7670`
   - *Inputs*: `BuildCurveWithMarketCapParams` extending `BuildCurveBaseParams` with `initialMarketCap: number`, `migrationMarketCap: number`.
   - *Outputs*: `ConfigParameters` with single segment calibrated to target market caps.

3. **`buildCurveWithTwoSegments(params: BuildCurveWithTwoSegmentsParams): ConfigParameters`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:7674`
   - *Inputs*: `BuildCurveWithTwoSegmentsParams` extending `BuildCurveBaseParams` with `initialMarketCap: number`, `migrationMarketCap: number`, `percentageSupplyOnMigration: number`.
   - *Outputs*: `ConfigParameters` containing two distinct curve segments (`curve[0]` and `curve[1]`), allowing a flatter initial phase transitioning into a steeper price discovery phase.

4. **`buildCurveWithMidPrice(params: BuildCurveWithMidPriceParams): ConfigParameters`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:7678`
   - *Inputs*: `initialMarketCap`, `migrationMarketCap`, `midPrice`, `percentageSupplyOnMigration`.
   - *Outputs*: `ConfigParameters` with two segments segmented at `midPrice`.

5. **`buildCurveWithLiquidityWeights(params: BuildCurveWithLiquidityWeightsParams): ConfigParameters`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:7698`
   - *Inputs*: `initialMarketCap`, `migrationMarketCap`, `liquidityWeights: number[]` (up to 16 weights).
   - *Outputs*: Multi-segment `ConfigParameters`.

6. **`buildCurveWithCustomSqrtPrices(params: BuildCurveWithCustomSqrtPricesParams): ConfigParameters`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:7706`
   - *Inputs*: `sqrtPrices: BN[]`, optional `liquidityWeights: number[]`.
   - *Outputs*: `ConfigParameters` directly configured with custom price boundaries.

#### Parameter Helper Functions
- **`getFeeSchedulerParams(startingFeeBps, endingFeeBps, baseFeeMode, numberOfPeriod, totalDuration): BaseFeeParameters`** — **CONFIRMED**
  - *Reference*: `dist/index.d.ts:6990`, `dist/index.js:139634`
  - *Outputs*: `BaseFeeParameters` with `cliffFeeNumerator`, `firstFactor` (`numberOfPeriod`), `secondFactor` (`periodFrequency`), `thirdFactor` (`reductionFactor`), `baseFeeMode`.
- **`getRateLimiterParams(baseFeeBps, feeIncrementBps, referenceAmount, maxLimiterDuration, tokenQuoteDecimal, activationType): BaseFeeParameters`** — **CONFIRMED**
  - *Reference*: `dist/index.d.ts:6997`, `dist/index.js:140020`
  - *Outputs*: `BaseFeeParameters` configured for rate limiting.
- **`getDynamicFeeParams(dynamicFeeEnabled: boolean, maxPriceChangeBps?: number): DynamicFeeParameters`** — **CONFIRMED**
  - *Reference*: `dist/index.d.ts:7005`
- **`getLockedVestingParams(...): LockedVestingParameters`** — **CONFIRMED**
  - *Reference*: `dist/index.d.ts:7010`
- **`getLiquidityVestingInfoParams(...): LiquidityVestingInfoParameters`** — **CONFIRMED**
  - *Reference*: `dist/index.d.ts:7016`
- **`getMigratedPoolFeeParams(migratedPoolFeeConfig: MigratedPoolFeeConfig): MigratedPoolFee`** — **CONFIRMED**
  - *Reference*: `dist/index.d.ts:7022`
- **`getMigratedPoolMarketCapFeeSchedulerParams(...): MigratedPoolMarketCapFeeSchedulerParameters`** — **CONFIRMED**
  - *Reference*: `dist/index.d.ts:7027`
- **`validateConfigParameters(configParam: ConfigParameters, options?): boolean`** — **CONFIRMED**
  - *Reference*: `dist/index.d.ts:7563`, `dist/index.js:129165`
- **`client.partner.createConfig(params: CreateConfigParams): Promise<Transaction>`** — **CONFIRMED**
  - *Reference*: `dist/index.d.ts:6627`

### Verification of Deprecations & Constraints
1. **`assertConfigAllowsNewPool` strictly rejects `BaseFeeMode.RateLimiter` for new DBC pools** — **CONFIRMED**
   - *Reference*: `dist/index.js:114425-114445` and `dist/index.js:139615-139625`
   - *Exact Code in SDK*:
     ```javascript
     function assertConfigAllowsNewPool(params) {
       if (params.baseFeeMode === 2 /* RateLimiter */) {
         throw new Error(
           "BaseFeeMode.RateLimiter is deprecated. New configs and pools must use FeeSchedulerLinear or FeeSchedulerExponential. Existing rate-limiter pools are unaffected."
         );
       }
       if (params.migrationOption === 0 /* MET_DAMM */) {
         throw new Error(
           "MigrationOption.MET_DAMM (DAMM v1) is deprecated. New configs and pools must use MigrationOption.MET_DAMM_V2. Existing DAMM v1 pools can still migrate."
         );
       }
     }
     ```
   - *Exact Code in `getBaseFeeParams`*:
     ```javascript
     function getBaseFeeParams(baseFeeParams) {
       if (baseFeeParams.baseFeeMode === 2 /* RateLimiter */) {
         throw new Error(
           "BaseFeeMode.RateLimiter is deprecated. New configs must use FeeSchedulerLinear or FeeSchedulerExponential."
         );
       }
       ...
     }
     ```
   - *Architectural Implication*: For all new DBC bonding curves, sniper defense modeling **must** use the fee scheduler (linear or exponential) plus dynamic fees. RateLimiter cannot be used for new DBC virtual pools, though it remains available on migrated DAMM v2 pools (`DammV2BaseFeeMode.RateLimiter = 2`).

---

## 2. Reading Curve State and Price

### Exported Functions
1. **`getPriceFromSqrtPrice(sqrtPrice: BN, tokenBaseDecimal: TokenDecimal, tokenQuoteDecimal: TokenDecimal): Decimal`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:6928`, `dist/index.js:114510`
   - *Outputs*: `Decimal` representing UI price (Quote / Base).
   - *Math*: Price = (sqrtPrice / 2^64)^2 * 10^(baseDecimals - quoteDecimals).
2. **`getSqrtPriceFromPrice(price: number | string | Decimal, tokenADecimal: TokenDecimal, tokenBDecimal: TokenDecimal): BN`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:6935`
3. **`getSqrtPriceFromMarketCap(marketCap: number | Decimal, tokenSupply: BN, tokenBaseDecimal: TokenDecimal, tokenQuoteDecimal: TokenDecimal): BN`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:6942`
4. **`getQuoteReserveFromNextSqrtPrice(nextSqrtPrice: BN, config: PoolConfig): BN`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:6955`, `dist/index.js:139655`
5. **`getCurveBreakdown(curve: CurvePoint[], sqrtStartPrice: BN, tokenBaseDecimal: TokenDecimal, tokenQuoteDecimal: TokenDecimal): CurveBreakdown[]`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:6968`
6. **`buildSimulatedVirtualPool(sqrtStartPrice: BN): VirtualPool`** — **CONFIRMED**
   - *Reference*: `dist/index.js:731550`

### State Types — **CONFIRMED**
- `VirtualPool`: Defined in Anchor IDL `types.VirtualPool` with embedded `PoolState` (`dist/index.d.ts:486`).
- `PoolConfig`: Defined in Anchor IDL `types.PoolConfig` (`dist/index.d.ts:486`).

---

## 3. Quoting a Swap (Buy and Sell) Against a Virtual Pool

### Exported Functions
1. **`swapQuote2(params: SwapQuote2Params): SwapQuote2Result`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:6713`, `dist/index.js:731420`
   - *Purity*: **100% synchronous, in-memory math, 0 RPC calls required**.
   - *Inputs* (`SwapQuote2Params`):
     - `virtualPool: VirtualPool`
     - `config: PoolConfig`
     - `swapBaseForQuote: boolean` (false = Buy base with quote; true = Sell base for quote)
     - `swapMode: SwapMode` (`ExactIn = 0`, `PartialFill = 1`, `ExactOut = 2`)
     - `hasReferral: boolean`
     - `eligibleForFirstSwapWithMinFee: boolean`
     - `currentPoint: BN` (slot or timestamp)
     - `slippageBps?: number`
     - `amountIn?: BN` (for ExactIn / PartialFill)
     - `amountOut?: BN` (for ExactOut)
   - *Outputs* (`SwapQuote2Result`):
     - `outputAmount: BN`
     - `nextSqrtPrice: BN`
     - `amountLeft: BN`
     - `includedFeeInputAmount: BN`
     - `excludedFeeInputAmount: BN`
     - `tradingFee: BN`
     - `protocolFee: BN`
     - `referralFee: BN`
     - `minimumAmountOut?: BN`
2. **`swapQuoteExactIn`** / **`swapQuoteExactOut`** / **`swapQuotePartialFill`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:20884-20910`, `dist/index.js:241200-241350`
3. **`calculateQuoteToBaseFromAmountIn`** / **`calculateBaseToQuoteFromAmountIn`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:20800-20830`, `dist/index.js:239100-239500`
4. **`getDeltaAmountBaseUnsigned`** / **`getDeltaAmountQuoteUnsigned`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:20840-20860`

---

## 4. Computing Fees (Fee Scheduler, Rate Limiter, and Fee Splits)

### Exported Classes and Functions
1. **`getBaseFeeHandler(cliffFeeNumerator, firstFactor, secondFactor, thirdFactor, baseFeeMode): BaseFeeHandler`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:20974`, `dist/index.js:242950`
2. **`FeeScheduler` (Class)** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:20953`, `dist/index.js:242810`
   - Implements `BaseFeeHandler`: `getMinBaseFeeNumerator()`, `getBaseFeeNumeratorFromIncludedFeeAmount(currentPoint, activationPoint)`, `getBaseFeeNumeratorFromExcludedFeeAmount(currentPoint, activationPoint)`.
3. **`FeeRateLimiter` (Class)** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:20939`, `dist/index.js:242680`
   - Implements `BaseFeeHandler`: `getMinBaseFeeNumerator()`, `getBaseFeeNumeratorFromIncludedFeeAmount(currentPoint, activationPoint, tradeDirection, includedFeeAmount)`.
4. **`splitFees` & `getFeeOnAmount`** — **CONFIRMED**
   - *Reference*: `dist/index.js:141010-141150`
   - Protocol fee calculation: `protocolFee = mulDiv(feeAmount, new BN(PROTOCOL_FEE_PERCENT), new BN(100), Down)` with `PROTOCOL_FEE_PERCENT = 20`.
   - Trading fee (LP fee) calculation: `tradingFee = SafeMath.sub(feeAmount, protocolFee)` (80%).
5. **Creator / Partner Fee Split** — **CONFIRMED**
   - *Reference*: `dist/index.js:663367-663590` (`StateService.getPoolFeeMetrics`)
   - `creatorTotalTradingFee = totalTradingFee.mul(new BN(creatorTradingFeePercentage)).div(new BN(100))`
   - `partnerTotalTradingFee = totalTradingFee.sub(creatorTotalTradingFee)`
6. **Protocol Migration Fee (0.2% = 20 bps)** — **CONFIRMED**
   - *Reference*: `dist/index.js:71862` (`getProtocolMigrationFee`), `docs/core-products/dbc/formulas.md:180`, `docs/core-products/dbc/migration-and-liquidity.md:111`.
   - Defined as `protocol_liquidity_migration_fee_bps` (u16 = 20 bps) in `VirtualPool.poolState`.
7. **Dynamic Fee Variable Numerator** — **CONFIRMED**
   - *Reference*: `dist/index.js:140650` (`getVariableFeeNumerator`), `docs/core-products/dbc/fees/dynamic-fees.md:51`
   - `scaledVFee = ((volatilityAccumulator * binStep)^2 * variableFeeControl + offset) / scalingFactor`
8. **Off-Chain Volatility Tracker Stepper** — **UNCONFIRMED**
   - *Status*: The on-chain DBC program updates `volatilityTracker.volatilityAccumulator` based on timestamp/slot and price change, but the TypeScript SDK does NOT export an update function for `volatilityTracker`.
   - *WindTunnel handling*: Modeled as an optional, isolated module (`src/sim/volatility.ts`) following the Meteora DLMM/DBC exponential decay formula.

---

## 5. Migration Price & DAMM v2 Starting Price

### Exported Functions
1. **`getMigrationThresholdPrice(migrationThreshold, sqrtStartPrice, curve)`** — **CONFIRMED**
   - *Reference*: `dist/index.d.ts:6960`, `dist/index.js:71650`
   - Returns `sqrtMigrationPrice: BN` where cumulative quote reserve equals `migrationQuoteThreshold`.
2. **`getMigrationQuoteAmountFromMigrationQuoteThreshold`** — **CONFIRMED**
   - *Reference*: `dist/index.js:71810`
   - `migrationQuoteAmount = migrationQuoteThreshold * (100 - migrationFeePercent) / 100`.
3. **`getMigrationBaseToken(migrationQuoteAmount, sqrtMigrationPrice, migrationOption)`** — **CONFIRMED**
   - *Reference*: `dist/index.js:72050`
4. **`getProtocolMigrationFee(depositBaseAmount, depositQuoteAmount, migrationSqrtPrice, migrationFeeBps, migrationOption)`** — **CONFIRMED**
   - *Reference*: `dist/index.js:71862`

### DAMM v2 Liquidity Shaping — **CONFIRMED**
- *Reference*: `dist/index.js:72070-72110` in `getMigrationBaseToken`:
  ```javascript
  const liquidity = getInitialLiquidityFromDeltaQuote(
    migrationQuoteAmount,
    MIN_SQRT_PRICE,
    sqrtMigrationPrice
  );
  const baseAmount = getDeltaAmountBaseUnsigned(
    sqrtMigrationPrice,
    MAX_SQRT_PRICE,
    liquidity,
    0 /* Up */
  );
  ```
- *Constants*:
  - `MIN_SQRT_PRICE = new BN("4295048016")` (~0)
  - `MAX_SQRT_PRICE = new BN("79226673521066979257578248091")` (~infinity)
- *Conclusion*: DAMM v2 liquidity is **full-range** ([0, infinity)), centered at the starting price `sqrtMigrationPrice`. Quote tokens back prices below `sqrtMigrationPrice`, and base tokens back prices above `sqrtMigrationPrice`.

### In-Memory Swap Quoting for DAMM v2 via `@meteora-ag/cp-amm-sdk` — **CONFIRMED**
- *Verification*: Inspected `@meteora-ag/cp-amm-sdk` (version `1.4.9`).
- *Exported Pure In-Memory Functions*:
  - `swapQuoteExactInput(pool: PoolState, currentPoint: BN, amountIn: BN, slippage: number, aToB: boolean, hasReferral: boolean, tokenADecimal: number, tokenBDecimal: number, ...): Quote2Result`
  - `swapQuoteExactOutput(...): Quote2Result`
  - `swapQuotePartialInput(...): Quote2Result`
  - `applySwapResult(poolState: PoolState, result: SwapResult2, feeMode: FeeMode, tradeDirection: TradeDirection): BN`
- *Architectural Benefit*: In Phase 3, we can reuse `@meteora-ag/cp-amm-sdk`'s native in-memory swap quotes and `applySwapResult` for 100% authentic DAMM v2 post-graduation simulation without writing custom CP-AMM math.

---

## 6. Summary of Claims Status

| Area | Topic | Status | File / Reference |
| :--- | :--- | :--- | :--- |
| **Config** | RateLimiter rejected for new DBC pools | **CONFIRMED** | `dist/index.js:114425` (`assertConfigAllowsNewPool`) |
| **Config** | DAMM v1 rejected for new DBC pools | **CONFIRMED** | `dist/index.js:114435` (`assertConfigAllowsNewPool`) |
| **Fees** | 20% protocol fee / 80% LP fee | **CONFIRMED** | `dist/index.js:141010` (`PROTOCOL_FEE_PERCENT = 20`) |
| **Fees** | Creator/Partner split via `creatorTradingFeePercentage` | **CONFIRMED** | `dist/index.js:663367` (`StateService.getPoolFeeMetrics`) |
| **Fees** | 0.2% protocol migration fee | **CONFIRMED** | `dist/index.js:71862` (`getProtocolMigrationFee`) & docs |
| **Fees** | FeeScheduler (Linear / Exponential) | **CONFIRMED** | `dist/index.js:242810` (`FeeScheduler`) |
| **Fees** | Volatility Tracker state transition across blocks | **UNCONFIRMED** | No SDK function; isolated in `volatility.ts` |
| **Quotes** | Pure in-memory DBC quotes (`swapQuote2`) | **CONFIRMED** | `dist/index.js:731420` |
| **Migration** | Full-range DAMM v2 liquidity [MIN, MAX] | **CONFIRMED** | `dist/index.js:72070` (`getMigrationBaseToken`) |
| **Migration** | Pure in-memory DAMM v2 quotes via `@meteora-ag/cp-amm-sdk` | **CONFIRMED** | `@meteora-ag/cp-amm-sdk:1.4.9` (`swapQuoteExactInput`) |
