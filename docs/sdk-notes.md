# Meteora DBC SDK Reconnaissance Notes

This document details the exact exported functions, types, and mathematical models in `@meteora-ag/dynamic-bonding-curve-sdk` (version `1.5.12`) that WindTunnel uses for simulating Dynamic Bonding Curve (DBC) token launches.

---

## 1. Building a Config from Parameters (Curve Segments, Fees, Migration, LP Split)

### Exported Functions

#### Curve Builders
All curve builders return a complete `ConfigParameters` struct ready for on-chain config creation.

1. **`buildCurve(params: BuildCurveParams): ConfigParameters`**
   - **Inputs**: `BuildCurveParams` extending `BuildCurveBaseParams` with:
     - `percentageSupplyOnMigration: number` (e.g. 20 for 20%)
     - `migrationQuoteThreshold: BN` (quote token amount in lamports/raw units)
   - **Outputs**: `ConfigParameters` with a single curve segment.
   - **Math**: Calculates `sqrtStartPrice` and single `curve[0]` segment liquidity such that selling `(100 - percentageSupplyOnMigration)%` of supply collects `migrationQuoteThreshold`.

2. **`buildCurveWithMarketCap(params: BuildCurveWithMarketCapParams): ConfigParameters`**
   - **Inputs**: `BuildCurveWithMarketCapParams` extending `BuildCurveBaseParams` with:
     - `initialMarketCap: number` (USD or quote denomination)
     - `migrationMarketCap: number` (target market cap at graduation)
   - **Outputs**: `ConfigParameters` with single segment calibrated to target market caps.

3. **`buildCurveWithTwoSegments(params: BuildCurveWithTwoSegmentsParams): ConfigParameters`**
   - **Inputs**: `BuildCurveWithTwoSegmentsParams` extending `BuildCurveBaseParams` with:
     - `initialMarketCap: number`
     - `migrationMarketCap: number`
     - `percentageSupplyOnMigration: number`
   - **Outputs**: `ConfigParameters` containing two distinct curve segments (`curve[0]` and `curve[1]`), allowing a flatter initial phase transitioning into a steeper price discovery phase.

4. **`buildCurveWithMidPrice(params: BuildCurveWithMidPriceParams): ConfigParameters`**
   - **Inputs**: `BuildCurveWithMidPriceParams` extending `BuildCurveBaseParams` with:
     - `initialMarketCap: number`, `migrationMarketCap: number`, `midPrice: number`, `percentageSupplyOnMigration: number`
   - **Outputs**: `ConfigParameters` with two segments segmented at `midPrice`.

5. **`buildCurveWithLiquidityWeights(params: BuildCurveWithLiquidityWeightsParams): ConfigParameters`**
   - **Inputs**: `BuildCurveWithLiquidityWeightsParams` with:
     - `initialMarketCap: number`, `migrationMarketCap: number`, `liquidityWeights: number[]` (array of weights for multi-segment liquidity distribution across up to 16 segments)
   - **Outputs**: Multi-segment `ConfigParameters`.

6. **`buildCurveWithCustomSqrtPrices(params: BuildCurveWithCustomSqrtPricesParams): ConfigParameters`**
   - **Inputs**: `BuildCurveWithCustomSqrtPricesParams` with:
     - `sqrtPrices: BN[]` (explicit square-root price checkpoints)
     - `liquidityWeights?: number[]`
   - **Outputs**: `ConfigParameters` directly configured with custom price boundaries.

#### Parameter Helper Functions
- **`getFeeSchedulerParams(startingFeeBps, endingFeeBps, baseFeeMode, numberOfPeriod, totalDuration): BaseFeeParameters`**
  - **Inputs**: `startingFeeBps: number` (e.g. 500 = 5%), `endingFeeBps: number` (e.g. 100 = 1%), `baseFeeMode: BaseFeeMode.FeeSchedulerLinear | FeeSchedulerExponential`, `numberOfPeriod: number`, `totalDuration: BN` (seconds or slots).
  - **Outputs**: `BaseFeeParameters` containing `cliff_fee_numerator`, `first_factor` (numberOfPeriod), `second_factor` (periodFrequency), `third_factor` (reductionFactor), `base_fee_mode`.
- **`getRateLimiterParams(baseFeeBps, feeIncrementBps, referenceAmount, maxLimiterDuration, tokenQuoteDecimal, activationType): BaseFeeParameters`**
  - **Inputs**: `baseFeeBps: number`, `feeIncrementBps: number`, `referenceAmount: BN`, `maxLimiterDuration: BN`, `tokenQuoteDecimal: TokenDecimal`, `activationType: ActivationType`.
  - **Outputs**: `BaseFeeParameters` configured for rate limiting.
- **`getDynamicFeeParams(dynamicFeeEnabled: boolean, maxPriceChangeBps?: number): DynamicFeeParameters`**
  - **Outputs**: Volatility fee configuration parameters.
- **`getLockedVestingParams(totalLockedVestingAmount, numberOfVestingPeriod, cliffUnlockAmount, totalVestingDuration, cliffDurationFromMigrationTime): LockedVestingParameters`**
  - **Outputs**: Base token team/creator vesting config locked at migration.
- **`getLiquidityVestingInfoParams(vestingPercentage, bpsPerPeriod, numberOfPeriods, cliffDurationFromMigrationTime, totalDuration): LiquidityVestingInfoParameters`**
  - **Outputs**: LP position token vesting parameters for partner and creator.
- **`getMigratedPoolFeeParams(migratedPoolFeeConfig: MigratedPoolFeeConfig): MigratedPoolFee`**
  - **Outputs**: Fee parameters for the migrated DAMM v2 pool.
- **`getMigratedPoolMarketCapFeeSchedulerParams(endingBaseFeeBps, numberOfPeriod, priceMultiple, schedulerExpirationDuration): MigratedPoolMarketCapFeeSchedulerParameters`**
  - **Outputs**: Market-cap fee scheduler parameters for migrated DAMM v2 pool.
- **`validateConfigParameters(configParam: ConfigParameters, options?): boolean`**
  - Validates all boundaries, curve ordering, fee bounds, and compatibility.
- **`client.partner.createConfig(params: CreateConfigParams): Promise<Transaction>`**
  - Builds on-chain transaction to register a new partner config.

### Core Types

```typescript
type ConfigParameters = {
  poolFees: PoolFeeParameters;
  collectFeeMode: CollectFeeMode; // QuoteToken = 0, OutputToken = 1
  migrationOption: MigrationOption; // MET_DAMM_V2 = 1 (MET_DAMM = 0 deprecated)
  activationType: ActivationType; // Slot = 0, Timestamp = 1
  tokenType: TokenType; // SPLToken = 0, Token2022 = 1
  tokenDecimal: TokenDecimal; // 6, 7, 8, 9
  partnerLiquidityPercentage: number;
  partnerPermanentLockedLiquidityPercentage: number;
  partnerLiquidityVestingInfo: LiquidityVestingInfoParameters;
  creatorLiquidityPercentage: number;
  creatorPermanentLockedLiquidityPercentage: number;
  creatorLiquidityVestingInfo: LiquidityVestingInfoParameters;
  migrationQuoteThreshold: BN;
  sqrtStartPrice: BN;
  lockedVesting: LockedVestingParameters;
  migrationFeeOption: MigrationFeeOption;
  migrationFee: MigrationFee;
  tokenSupply: BN;
  creatorTradingFeePercentage: number;
  tokenAuthorityOption: TokenAuthorityOption;
  migratedPoolFee: MigratedPoolFee;
  poolCreationFee: BN;
  migratedPoolBaseFeeMode: number;
  migratedPoolMarketCapFeeSchedulerParams: MigratedPoolMarketCapFeeSchedulerParameters;
  enableFirstSwapWithMinFee: boolean;
  compoundingFeeBps: number;
  curve: LiquidityDistributionConfig[]; // up to 16-20 curve segments
};
```

### SDK Gaps & Quirks
- **RateLimiter Deprecation for New Virtual Pools**: Calling `buildCurve*` or `validateConfigParameters` with `baseFeeMode = BaseFeeMode.RateLimiter` triggers `assertConfigAllowsNewPool`:
  ```
  "BaseFeeMode.RateLimiter is deprecated. New configs and pools must use FeeSchedulerLinear or FeeSchedulerExponential. Existing rate-limiter pools are unaffected."
  ```
  *WindTunnel implication*: For new DBC bonding curves, adversarial buy damping must be modeled primarily via `FeeSchedulerLinear` / `FeeSchedulerExponential` with high initial cliff fees and steep decay. However, RateLimiter *is* valid for migrated DAMM v2 pools (`DammV2BaseFeeMode.RateLimiter`) and the DBC quote math still supports existing rate limiter pools.
- **DAMM v1 Deprecation**: `MigrationOption.MET_DAMM` throws an error in `assertConfigAllowsNewPool`. All new launches must migrate to `MigrationOption.MET_DAMM_V2`.

---

## 2. Reading Curve State and Price

### Exported Functions

1. **`getPriceFromSqrtPrice(sqrtPrice: BN, tokenBaseDecimal: TokenDecimal, tokenQuoteDecimal: TokenDecimal): Decimal`**
   - **Inputs**: `sqrtPrice: BN` (Q64.64 fixed-point integer), `tokenBaseDecimal: TokenDecimal`, `tokenQuoteDecimal: TokenDecimal`.
   - **Outputs**: `Decimal` representing UI price ($\text{Quote} / \text{Base}$).
   - **Math**: $\text{Price} = \left(\frac{\text{sqrtPrice}}{2^{64}}\right)^2 \times 10^{\text{baseDecimals} - \text{quoteDecimals}}$.

2. **`getSqrtPriceFromPrice(price: number | string | Decimal, tokenADecimal: TokenDecimal, tokenBDecimal: TokenDecimal): BN`**
   - **Inputs**: UI price, token decimals.
   - **Outputs**: `BN` in Q64.64 representation.

3. **`getSqrtPriceFromMarketCap(marketCap: number | Decimal, tokenSupply: BN, tokenBaseDecimal: TokenDecimal, tokenQuoteDecimal: TokenDecimal): BN`**
   - **Inputs**: Market cap value, token supply, decimals.
   - **Outputs**: Corresponding `sqrtPrice: BN`.

4. **`getQuoteReserveFromNextSqrtPrice(nextSqrtPrice: BN, config: PoolConfig): BN`**
   - **Inputs**: Target `nextSqrtPrice: BN`, `config: PoolConfig`.
   - **Outputs**: Total cumulative quote reserve (`BN`) accumulated along the curve segments up to `nextSqrtPrice`.

5. **`getCurveBreakdown(curve: CurvePoint[], sqrtStartPrice: BN, tokenBaseDecimal: TokenDecimal, tokenQuoteDecimal: TokenDecimal): CurveBreakdown[]`**
   - **Outputs**: Array detailing per-segment quote allocation, base token allocation, and lower/upper price bounds.

6. **`client.pool.buildSimulatedVirtualPool(sqrtStartPrice: BN): VirtualPool`** (Internal helper on `PoolService`)
   - **Outputs**: A pristine `VirtualPool` instance initialized at `sqrtStartPrice` with zero reserves.

### Core Types

```typescript
type VirtualPool = {
  poolState: PoolState;
};

type PoolState = {
  volatilityTracker: VolatilityTracker;
  config: PublicKey;
  creator: PublicKey;
  baseMint: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
  baseReserve: BN;
  quoteReserve: BN;
  protocolBaseFee: BN;
  protocolQuoteFee: BN;
  partnerBaseFee: BN;
  partnerQuoteFee: BN;
  creatorBaseFee: BN;
  creatorQuoteFee: BN;
  sqrtPrice: BN;
  activationPoint: BN;
  poolType: number;
  isMigrated: number;
  migrationProgress: number; // 0 = PreBondingCurve, 1 = PostBondingCurve, 2 = LockedVesting, 3 = CreatedPool
  finishCurveTimestamp: BN;
  metrics: PoolMetrics;
};
```

### SDK Gaps
- **No In-Memory Pool State Mutator**: The SDK provides readers and quote evaluators, but does not provide a simulation stepper `applySwap(pool: VirtualPool, quote: SwapQuote2Result): void`.
- **No Direct Base Reserve Formula from SqrtPrice**: The SDK has `getQuoteReserveFromNextSqrtPrice(nextSqrtPrice, config)`, but no `getBaseReserveFromSqrtPrice`. In WindTunnel, we track base reserve using `getDeltaAmountBaseUnsigned` across active segments.

---

## 3. Quoting a Swap (Buy and Sell) Against a Virtual Pool

### Exported Functions

1. **`swapQuote2(params: SwapQuote2Params): SwapQuote2Result`**
   - Main entry point for quoting trades. Pure in-memory calculation (synchronous, 0 RPC calls).
   - **Inputs** (`SwapQuote2Params`):
     - `virtualPool: VirtualPool` (current state)
     - `config: PoolConfig` (curve configuration)
     - `swapBaseForQuote: boolean` (false = Buy token with quote, true = Sell token for quote)
     - `swapMode: SwapMode` (`ExactIn = 0`, `PartialFill = 1`, `ExactOut = 2`)
     - `hasReferral: boolean`
     - `eligibleForFirstSwapWithMinFee: boolean`
     - `currentPoint: BN` (current slot or unix timestamp)
     - `slippageBps?: number`
     - `amountIn?: BN` (for `ExactIn` or `PartialFill`)
     - `amountOut?: BN` (for `ExactOut`)
   - **Outputs** (`SwapQuote2Result`):
     - `outputAmount: BN` (tokens received after fees)
     - `nextSqrtPrice: BN` (new curve price after swap)
     - `amountLeft: BN` (unfilled amount, 0 for exact in/out)
     - `includedFeeInputAmount: BN`
     - `excludedFeeInputAmount: BN`
     - `tradingFee: BN` (fee for partner + creator)
     - `protocolFee: BN` (protocol portion)
     - `referralFee: BN` (referral portion)
     - `minimumAmountOut?: BN` (slippage floor)

2. **Specialized Quote Functions**:
   - **`swapQuoteExactIn(...)`**: Used when trader specifies exact input amount (e.g. spend exactly 1 SOL).
   - **`swapQuoteExactOut(...)`**: Used when trader wants exact tokens out (e.g. sniper wants exact 5,000,000 tokens).
   - **`swapQuotePartialFill(...)`**: Used when remaining liquidity on curve may not satisfy entire input; fills up to the migration threshold without reverting.

3. **Lower-Level Delta Math Functions**:
   - **`calculateQuoteToBaseFromAmountIn(config, currentSqrtPrice, amountIn, stopSqrtPrice)`**: Iterates curve segments forward to compute base tokens acquired and next `sqrtPrice`.
   - **`calculateBaseToQuoteFromAmountIn(config, currentSqrtPrice, amountIn)`**: Iterates curve segments backward to compute quote tokens received and next `sqrtPrice`.
   - **`getDeltaAmountBaseUnsigned(sqrtPriceA, sqrtPriceB, liquidity, rounding)`**: Calculates exact $\Delta x = L \times \left|\frac{1}{\sqrt{P_a}} - \frac{1}{\sqrt{P_b}}\right|$.
   - **`getDeltaAmountQuoteUnsigned(sqrtPriceA, sqrtPriceB, liquidity, rounding)`**: Calculates exact $\Delta y = L \times |\sqrt{P_a} - \sqrt{P_b}|$.

### SDK Gaps
- **Price Impact Metric**: The SDK does not output `priceImpactPercent`.
  - *WindTunnel solution*: We compute price impact:
    $$\text{executionPrice} = \frac{\text{quoteSpent}}{\text{baseReceived}}, \quad \text{spotPrice} = \text{getPriceFromSqrtPrice}(\text{sqrtPrice}), \quad \text{priceImpact} = \frac{\text{executionPrice} - \text{spotPrice}}{\text{spotPrice}}$$
- **Graduation Boundary Clamp**: `swapQuoteExactIn` throws `"Virtual pool is completed"` if `quoteReserve >= migrationQuoteThreshold`. If a large buy overshoots graduation, `swapQuoteExactIn` fails with `"Insufficient Liquidity"`. To simulate adversarial snipers attempting to complete the curve in a single block, `swapQuotePartialFill` must be used.

---

## 4. Computing Fees (Fee Scheduler, Rate Limiter, and Fee Splits)

### Exported Classes and Functions

1. **`getBaseFeeHandler(cliffFeeNumerator, firstFactor, secondFactor, thirdFactor, baseFeeMode): BaseFeeHandler`**
   - Instantiates `FeeScheduler` or `FeeRateLimiter` based on `baseFeeMode`.

2. **`FeeScheduler` (Class)**
   - Implements `BaseFeeHandler`:
     - `getMinBaseFeeNumerator(): BN`
     - `getBaseFeeNumeratorFromIncludedFeeAmount(currentPoint, activationPoint): BN`
     - `getBaseFeeNumeratorFromExcludedFeeAmount(currentPoint, activationPoint): BN`
   - **Math**:
     - Fee numerator decays over `numberOfPeriod` from `cliffFeeNumerator` to `endingFeeNumerator`.
     - In **Linear** mode: decays evenly per `periodFrequency`.
     - In **Exponential** mode: decays proportionally to $(1 - r)^k$.
     - Evaluated via `getFeeNumeratorOnLinearFeeScheduler(...)` or `getFeeNumeratorOnExponentialFeeScheduler(...)`.

3. **`FeeRateLimiter` (Class)**
   - Implements `BaseFeeHandler`:
     - `getMinBaseFeeNumerator(): BN`
     - `getBaseFeeNumeratorFromIncludedFeeAmount(currentPoint, activationPoint, tradeDirection, includedFeeAmount): BN`
   - **Math**:
     - Active only if `isRateLimiterApplied(...)` returns true (i.e. `currentPoint - activationPoint < maxLimiterDuration` and trade is `QuoteToBase`).
     - Fee numerator scales up linearly with trade size relative to `referenceAmount`:
       $$\text{Fee} = \text{cliffFee} + \left\lfloor\frac{\text{buyAmount}}{\text{referenceAmount}}\right\rfloor \times \text{feeIncrement}$$

4. **Fee Splitting & Accounting**:
   - **`getTotalFeeNumerator(baseFeeNumerator, dynamicFee, volatilityTracker): BN`**
     Combines scheduled/rate-limited base fee with dynamic volatility fee:
     $$\text{Total Fee Numerator} = \min(\text{baseFee} + \text{dynamicFee}, 990\,000\,000)$$
     *(Denominator is $1\,000\,000\,000$)*
   - **`splitFees(tradingFee: BN, creatorTradingFeePercentage: number)`**:
     - Protocol gets $20\%$ of total fee.
     - Remaining $80\%$ is `LP Fee`.
     - Creator gets: $\text{creatorFee} = \text{LP Fee} \times \frac{\text{creatorTradingFeePercentage}}{100}$.
     - Partner gets: $\text{partnerFee} = \text{LP Fee} - \text{creatorFee}$.

### SDK Gaps
- **Off-chain Volatility Stepper**: The SDK calculates `getVariableFeeNumerator(dynamicFee, volatilityTracker)`, but contains no off-chain function to decay or update `volatilityTracker` across simulated block timestamps.
  - *WindTunnel solution*: WindTunnel implements the on-chain exponential decay formula for `volatilityAccumulator` between simulation ticks.

---

## 5. Migration Price & DAMM v2 Starting Price

### Exported Functions

1. **`getMigrationThresholdPrice(migrationThreshold: BN, sqrtStartPrice: BN, curve: LiquidityDistributionConfig[]): BN`**
   - **Inputs**: `migrationQuoteThreshold`, `sqrtStartPrice`, curve segments.
   - **Outputs**: `sqrtMigrationPrice: BN` (the exact stop price where cumulative quote deposits equal threshold).

2. **`getMigrationQuoteAmountFromMigrationQuoteThreshold(migrationQuoteThreshold: Decimal, migrationFeePercent: number): Decimal`**
   - Deducts configured partner/creator migration fee:
     $$\text{migrationQuoteAmount} = \left\lceil\text{migrationQuoteThreshold} \times \frac{100 - \text{migrationFeePercent}}{100}\right\rceil$$

3. **`getMigrationBaseToken(migrationQuoteAmount: BN, sqrtMigrationPrice: BN, migrationOption: MigrationOption): BN`**
   - Computes base token reserve needed to initialize DAMM v2:
     - Derives DAMM v2 initial liquidity:
       $$L_{\text{DAMM}} = \text{getInitialLiquidityFromDeltaQuote}(\text{migrationQuoteAmount}, \text{MIN\_SQRT\_PRICE}, \text{sqrtMigrationPrice})$$
     - Calculates required base token allocation:
       $$\text{baseAmount} = \text{getDeltaAmountBaseUnsigned}(\text{sqrtMigrationPrice}, \text{MAX\_SQRT\_PRICE}, L_{\text{DAMM}}, \text{Up})$$

4. **`getProtocolMigrationFee(depositBaseAmount, depositQuoteAmount, migrationSqrtPrice, migrationFeeBps, migrationOption): [BN, BN]`**
   - Calculates fixed 0.2% (20 bps) protocol liquidity deduction taken from both base and quote tokens before pool creation.

5. **`client.migration.migrateToDammV2(params: MigrateToDammV2Params): Promise<MigrateToDammV2Response>`**
   - Generates position NFT keypairs and Anchor migration instruction calling `migrationDammV2`.

### Mathematical Structure of the Migration Price Gap
In DBC launches, the "Migration Price Gap" is a critical risk factor for post-graduation arbitrage:
1. **Marginal Start Price Alignment**:
   In DAMM v2, the quote tokens are placed in range $[\text{MIN\_SQRT\_PRICE}, \text{sqrtMigrationPrice}]$, and base tokens are placed in $[\text{sqrtMigrationPrice}, \text{MAX\_SQRT\_PRICE}]$.
   Therefore, at initialization, the DAMM v2 pool's theoretical zero-volume spot price equals:
   $$P_{\text{DAMM\_start}} = P_{\text{migration}} = \left(\frac{\text{sqrtMigrationPrice}}{2^{64}}\right)^2$$
2. **Surplus-Induced Price Dislocation**:
   If the graduating swap overshoots the migration threshold, the final swap execution price $P_{\text{final\_swap}}$ is higher than the curve's migration threshold price.
   Furthermore, if surplus trading occurs, the curve may end at $P_{\text{DBC\_last}} > P_{\text{migration}}$.
3. **Liquidity Depth Shock**:
   On the DBC curve, the virtual liquidity $L_{\text{DBC}}$ is tailored by curve segments (often concentrated to achieve fast price discovery with limited capital).
   In DAMM v2, full-range liquidity $L_{\text{DAMM}}$ is:
   $$L_{\text{DAMM}} = \frac{\text{migrationQuoteAmount}}{\text{sqrtMigrationPrice} - \text{MIN\_SQRT\_PRICE}}$$
   Because full-range liquidity is stretched across the entire range $[0, \infty)$, $L_{\text{DAMM}}$ is typically much thinner than $L_{\text{DBC}}$ near graduation.
   An arbitrageur can immediately execute a swap on DAMM v2, causing a severe price crash if the initial buying pressure does not carry over.

### SDK Gaps
- **No DAMM v2 In-Memory Swap Quoter**: The DBC SDK (`@meteora-ag/dynamic-bonding-curve-sdk`) quotes only DBC bonding curves, not DAMM v2 (`cp-amm`) pools.
  - *WindTunnel solution*: WindTunnel models the post-graduation DAMM v2 constant-product swap math using the exact DAMM v2 liquidity $L_{\text{DAMM}}$ derived by `getMigrationBaseToken` and `getInitialLiquidityFromDeltaQuote`, enabling post-graduation arbitrage simulation.

---

## 6. Summary of Key WindTunnel Architectural Takeaways

| Feature | DBC SDK Status | WindTunnel Implementation Strategy |
| :--- | :--- | :--- |
| **Config Parameter Construction** | Fully supported (`buildCurve*`, `getFeeSchedulerParams`, etc.) | Direct SDK reuse with validation |
| **Swap Quote Simulation** | Fully supported (`swapQuote2`, `swapQuoteExactIn`, `swapQuotePartialFill`) | Direct SDK reuse (pure in-memory math, 0 RPC calls) |
| **Fee Calculation** | Fully supported (`FeeScheduler`, `splitFees`, `getFeeOnAmount`) | Direct SDK reuse |
| **DBC Virtual Pool State Transitions** | Not provided (only static quote evaluation) | WindTunnel engine wraps `VirtualPool` state and advances reserves, `sqrtPrice`, and cumulative metrics |
| **Graduation & Migration Math** | Fully supported (`getMigrationThresholdPrice`, `getMigrationBaseToken`) | Direct SDK reuse |
| **DAMM v2 Post-Graduation Swaps** | Not provided in DBC SDK | WindTunnel implements DAMM v2 CP-AMM swap simulator using calibrated $L_{\text{DAMM}}$ |
| **Adversarial Trader Agents** | Not provided | WindTunnel agent models: Snipers (Jito bundles), Whales, Momentum Buyers, Arbitrageurs |
| **Scorecard & Auto-Tuner** | Not provided | WindTunnel multi-objective search over config space |
