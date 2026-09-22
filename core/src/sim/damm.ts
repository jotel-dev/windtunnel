import BN from 'bn.js';
import DecimalConstructor from 'decimal.js';
import { PublicKey } from '@solana/web3.js';
import {
  ConfigParameters,
  PoolConfig,
  getPriceFromSqrtPrice,
  getQuoteReserveFromNextSqrtPrice,
  MIN_SQRT_PRICE,
  MAX_SQRT_PRICE,
  PROTOCOL_FEE_PERCENT,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import {
  swapQuoteExactInput,
  swapQuoteExactOutput,
  swapQuotePartialInput,
  applySwapResult,
  getFeeMode,
  cpAmmCoder,
  getAmountBFromLiquidityDeltaForConcentratedLiquidity,
  type PoolState,
  type Quote2Result,
} from '@meteora-ag/cp-amm-sdk';
import type { SimTrade, SimClock, MigrationData, Decimal } from './types.js';
import { VirtualPoolSimulator } from './pool.js';

export interface DammStepResult {
  trade: SimTrade;
  quoteResult: Quote2Result;
  isPartialFill: boolean;
  priceImpact: number;
  spotPriceBefore: Decimal;
  spotPriceAfter: Decimal;
  executionPrice: Decimal;
  netQuoteFlow: BN;
  netBaseFlow: BN;
  feeQuote: BN;
  feeBase: BN;
}

export interface DammStateSnapshot {
  sqrtPrice: BN;
  currentPriceUI: Decimal;
  liquidity: BN;
  tokenAAmount: BN;
  tokenBAmount: BN;
  tradesExecuted: number;
  accumulatedFees: {
    protocolAFee: BN;
    protocolBFee: BN;
    lpAFee: BN;
    lpBFee: BN;
  };
  clock: SimClock;
}

/**
 * Builds the initial CP-AMM (DAMM v2) PoolState from DBC migration data.
 *
 * Mapping documentation:
 * - sqrtPrice: initialized to migrationData.sqrtMigrationPrice (the exact bonding curve graduation price)
 * - sqrtMinPrice: MIN_SQRT_PRICE (4295048016, full range lower bound [0, inf))
 * - sqrtMaxPrice: MAX_SQRT_PRICE (79226673521066979257578248091, full range upper bound)
 * - liquidity: computed from migration quote amount via concentrated liquidity math:
 *              migrationQuoteAmountAfterFees * 2^128 / (sqrtMigrationPrice - MIN_SQRT_PRICE)
 * - tokenAAmount (Base Token): migrationData.baseTokensMigrated
 * - tokenBAmount (Quote Token): migrationData.migrationQuoteAmountAfterFees
 * - fee settings: mapped from config.migratedPoolFee:
 *     - If marketCapFeeSchedulerParams exists, encoded as PodAlignedFeeMarketCapScheduler (modes 3 or 4)
 *     - If rateLimiterParams exists, encoded as PodAlignedFeeRateLimiter (mode 2)
 *     - If baseFeeMode is linear/exponential (modes 0 or 1), encoded as PodAlignedFeeTimeScheduler
 *     - If fixed fee, encoded as PodAlignedFeeTimeScheduler with 0 periods / 0 duration
 *     - dynamicFee: mapped if enabled (initialized=1, binStep, etc.), else zero-initialized
 *     - collectFeeMode: mapped from migratedPoolFee.collectFeeMode (0=BothToken, 1=OnlyB, 2=Compounding)
 *     - protocolFeePercent: fixed at 20% (PROTOCOL_FEE_PERCENT)
 */
export function buildDammV2PoolState(
  migrationData: MigrationData,
  rawConfig: ConfigParameters,
  clock: SimClock = { slot: 1000, timestamp: 1700000000 }
): PoolState {
  const sqrtPrice = migrationData.sqrtMigrationPrice;
  const sqrtMinPrice = new BN(MIN_SQRT_PRICE.toString());
  const sqrtMaxPrice = new BN(MAX_SQRT_PRICE.toString());

  // Migration liquidity calculation
  const priceDelta = sqrtPrice.sub(sqrtMinPrice);
  const quoteShifted = migrationData.migrationQuoteAmountAfterFees.shln(128);
  const liquidity = priceDelta.isZero() ? new BN(0) : quoteShifted.div(priceDelta);

  const migratedPoolFee = rawConfig.migratedPoolFee;
  const poolFeeBps = migratedPoolFee?.poolFeeBps ?? 25;
  const cliffFeeNumerator = new BN(poolFeeBps).mul(new BN(1000000000000)).div(new BN(10000)); // 1e12 denominator

  let encodedFeeData: Buffer;

  // Check which fee mode is specified for post-graduation
  const baseFeeMode = (migratedPoolFee as any)?.baseFeeMode ?? 0;
  const mcParams = (migratedPoolFee as any)?.marketCapFeeSchedulerParams;
  const rlParams = (migratedPoolFee as any)?.rateLimiterParams;
  const timeParams = (migratedPoolFee as any)?.feeSchedulerParam;

  if (mcParams) {
    // Mode 3 (Linear) or 4 (Exponential) Market Cap Scheduler
    const mcData = {
      cliff_fee_numerator: cliffFeeNumerator,
      number_of_period: mcParams.numberOfPeriod ?? 0,
      sqrt_price_step_bps: mcParams.sqrtPriceStepBps ?? 0,
      scheduler_expiration_duration: mcParams.schedulerExpirationDuration ?? 0,
      reduction_factor: new BN(mcParams.reductionFactor?.toString() ?? '0'),
      base_fee_mode: baseFeeMode === 4 ? 4 : 3,
      padding: [0, 0, 0, 0, 0, 0, 0],
    };
    encodedFeeData = cpAmmCoder.types.encode('PodAlignedFeeMarketCapScheduler', mcData);
  } else if (rlParams || baseFeeMode === 2) {
    // Mode 2 Rate Limiter (Allowed on DAMM v2 post-graduation!)
    const rlData = {
      cliff_fee_numerator: cliffFeeNumerator,
      fee_increment_bps: rlParams?.feeIncrementBps ?? 10,
      max_fee_bps: rlParams?.maxFeeBps ?? 1000,
      max_limiter_duration: rlParams?.maxLimiterDuration ?? 60,
      reference_amount: new BN(rlParams?.referenceAmount?.toString() ?? '1000000000'),
      base_fee_mode: 2,
      padding: [0, 0, 0, 0, 0, 0, 0],
    };
    encodedFeeData = cpAmmCoder.types.encode('PodAlignedFeeRateLimiter', rlData);
  } else if (timeParams && (timeParams.numberOfPeriod > 0 || timeParams.totalDuration > 0)) {
    // Mode 0 or 1 Time Scheduler
    const periodFrequency = timeParams.numberOfPeriod > 0
      ? new BN(Math.floor(timeParams.totalDuration / timeParams.numberOfPeriod))
      : new BN(0);
    const timeData = {
      cliff_fee_numerator: cliffFeeNumerator,
      number_of_period: timeParams.numberOfPeriod,
      period_frequency: periodFrequency,
      reduction_factor: new BN(timeParams.reductionFactor?.toString() ?? '0'),
      base_fee_mode: baseFeeMode === 1 ? 1 : 0,
      padding: [0, 0, 0, 0, 0, 0, 0],
    };
    encodedFeeData = cpAmmCoder.types.encode('PodAlignedFeeTimeScheduler', timeData);
  } else {
    // Fixed fee (Time Scheduler with 0 periods)
    const fixedData = {
      cliff_fee_numerator: cliffFeeNumerator,
      number_of_period: 0,
      period_frequency: new BN(0),
      reduction_factor: new BN(0),
      base_fee_mode: 0,
      padding: [0, 0, 0, 0, 0, 0, 0],
    };
    encodedFeeData = cpAmmCoder.types.encode('PodAlignedFeeTimeScheduler', fixedData);
  }

  // Dynamic fee configuration
  const dynamicFeeConfig = rawConfig.poolFees?.dynamicFee;
  const isDynamicEnabled = (migratedPoolFee?.dynamicFee ?? 0) === 1 && dynamicFeeConfig;

  const dynamicFeeStruct = isDynamicEnabled
    ? {
        initialized: 1,
        padding: [0, 0, 0, 0, 0, 0, 0],
        maxVolatilityAccumulator: dynamicFeeConfig.maxVolatilityAccumulator ?? 0,
        variableFeeControl: dynamicFeeConfig.variableFeeControl ?? 0,
        binStep: dynamicFeeConfig.binStep ?? 0,
        filterPeriod: dynamicFeeConfig.filterPeriod ?? 0,
        decayPeriod: dynamicFeeConfig.decayPeriod ?? 0,
        reductionFactor: dynamicFeeConfig.reductionFactor ?? 0,
        lastUpdateTimestamp: new BN(clock.timestamp),
        binStepU128: new BN(dynamicFeeConfig.binStepU128?.toString() ?? '0'),
        sqrtPriceReference: sqrtPrice.clone(),
        volatilityAccumulator: new BN(0),
        volatilityReference: new BN(0),
      }
    : {
        initialized: 0,
        padding: [0, 0, 0, 0, 0, 0, 0],
        maxVolatilityAccumulator: 0,
        variableFeeControl: 0,
        binStep: 0,
        filterPeriod: 0,
        decayPeriod: 0,
        reductionFactor: 0,
        lastUpdateTimestamp: new BN(0),
        binStepU128: new BN(0),
        sqrtPriceReference: new BN(0),
        volatilityAccumulator: new BN(0),
        volatilityReference: new BN(0),
      };

  const activationPoint = rawConfig.activationType === 0
    ? new BN(clock.slot)
    : new BN(clock.timestamp);

  const poolState: PoolState = {
    poolFees: {
      baseFee: {
        baseFeeInfo: {
          data: Array.from(encodedFeeData),
        },
        padding1: new BN(0),
      },
      protocolFeePercent: PROTOCOL_FEE_PERCENT,
      padding0: 0,
      referralFeePercent: 0,
      padding1: [0, 0, 0],
      compoundingFeeBps: 0,
      dynamicFee: dynamicFeeStruct,
      initSqrtPrice: sqrtPrice.clone(),
    },
    tokenAMint: PublicKey.default,
    tokenBMint: PublicKey.default,
    tokenAVault: PublicKey.default,
    tokenBVault: PublicKey.default,
    whitelistedVault: PublicKey.default,
    padding0: new Array(32).fill(0),
    liquidity,
    padding1: new BN(0),
    protocolAFee: new BN(0),
    protocolBFee: new BN(0),
    deadLiquidityFeeCheckpoint: new BN(0),
    padding2: [0, 0, 0, 0, 0, 0, 0, 0],
    sqrtMinPrice,
    sqrtMaxPrice,
    sqrtPrice: sqrtPrice.clone(),
    activationPoint,
    activationType: rawConfig.activationType ?? 1,
    poolStatus: 0, // Enable
    tokenAFlag: 0,
    tokenBFlag: 0,
    collectFeeMode: migratedPoolFee?.collectFeeMode ?? 0,
    poolType: 0,
    feeVersion: 1,
    padding3: 0,
    feeAPerLiquidity: new Array(32).fill(0),
    feeBPerLiquidity: new Array(32).fill(0),
    permanentLockLiquidity: new BN(0),
    metrics: {
      totalLpAFee: new BN(0),
      totalLpBFee: new BN(0),
      totalProtocolAFee: new BN(0),
      totalProtocolBFee: new BN(0),
      padding0: new Array(32).fill(0),
      totalPosition: new BN(0),
      padding: new BN(0),
    } as any,
    creator: PublicKey.default,
    tokenAAmount: migrationData.migrationBaseTokens.clone(),
    tokenBAmount: migrationData.migrationQuoteAmountAfterFees.clone(),
    layoutVersion: 0,
    padding4: [0, 0, 0, 0, 0, 0, 0],
    padding5: [new BN(0), new BN(0), new BN(0)],
    rewardInfos: [],
  };

  return poolState;
}

/**
 * PostGraduationPool:
 * Simulates pure in-memory swaps on the DAMM v2 CP-AMM pool created upon DBC graduation.
 * Reuses SimTrade and SimClock types from VirtualPoolSimulator.
 */
export class PostGraduationPool {
  readonly pool: PoolState;
  readonly tokenBaseDecimal: number;
  readonly tokenQuoteDecimal: number;
  private _clock: SimClock;
  private _tradesExecuted: number = 0;
  private _accumulatedFees = {
    protocolAFee: new BN(0),
    protocolBFee: new BN(0),
    lpAFee: new BN(0),
    lpBFee: new BN(0),
  };

  constructor(
    pool: PoolState,
    tokenBaseDecimal: number = 6,
    tokenQuoteDecimal: number = 9,
    clock: SimClock = { slot: 1000, timestamp: 1700000000 }
  ) {
    this.pool = pool;
    this.tokenBaseDecimal = tokenBaseDecimal;
    this.tokenQuoteDecimal = tokenQuoteDecimal;
    this._clock = { ...clock };
  }

  getSpotPrice(): Decimal {
    return getPriceFromSqrtPrice(
      this.pool.sqrtPrice,
      this.tokenBaseDecimal,
      this.tokenQuoteDecimal
    );
  }

  getSnapshot(): DammStateSnapshot {
    return {
      sqrtPrice: this.pool.sqrtPrice.clone(),
      currentPriceUI: this.getSpotPrice(),
      liquidity: this.pool.liquidity.clone(),
      tokenAAmount: this.pool.tokenAAmount.clone(),
      tokenBAmount: this.pool.tokenBAmount.clone(),
      tradesExecuted: this._tradesExecuted,
      accumulatedFees: {
        protocolAFee: this._accumulatedFees.protocolAFee.clone(),
        protocolBFee: this._accumulatedFees.protocolBFee.clone(),
        lpAFee: this._accumulatedFees.lpAFee.clone(),
        lpBFee: this._accumulatedFees.lpBFee.clone(),
      },
      clock: { ...this._clock },
    };
  }

  step(trade: SimTrade, clock?: SimClock): DammStepResult {
    if (clock) {
      if (clock.slot < this._clock.slot || clock.timestamp < this._clock.timestamp) {
        throw new Error('Clock cannot move backwards');
      }
      this._clock = { ...clock };
    }

    if (trade.amount.isZero()) {
      throw new Error('Trade amount must be non-zero');
    }

    const currentPoint = this.pool.activationType === 0
      ? new BN(this._clock.slot)
      : new BN(this._clock.timestamp);

    const isBuy = trade.side === 'buy';
    // In DAMM v2: Token A is Base, Token B is Quote.
    // Buy (Quote in -> Base out): aToB = false, tradeDirection = 1 (BtoA)
    // Sell (Base in -> Quote out): aToB = true, tradeDirection = 0 (AtoB)
    const aToB = !isBuy;
    const tradeDirection = isBuy ? 1 : 0;
    const slippageBps = trade.slippageBps ?? 0;
    const hasReferral = trade.hasReferral ?? false;

    const spotPriceBefore = this.getSpotPrice();

    let quoteResult: Quote2Result;
    const mode = trade.mode ?? 'exactIn';

    if (mode === 'exactIn') {
      quoteResult = swapQuoteExactInput(
        this.pool,
        currentPoint,
        trade.amount,
        slippageBps,
        aToB,
        hasReferral,
        this.tokenBaseDecimal,
        this.tokenQuoteDecimal
      );
    } else {
      quoteResult = swapQuoteExactOutput(
        this.pool,
        currentPoint,
        trade.amount,
        slippageBps,
        aToB,
        hasReferral,
        this.tokenBaseDecimal,
        this.tokenQuoteDecimal
      );
    }

    // Apply the swap to update pool sqrtPrice and token amounts
    const feeMode = getFeeMode(this.pool.collectFeeMode, tradeDirection, hasReferral);
    const nextSqrtPrice = applySwapResult(this.pool, quoteResult, feeMode, tradeDirection);
    this.pool.sqrtPrice = nextSqrtPrice;

    // Update reserves and fees
    let netQuoteFlow: BN;
    let netBaseFlow: BN;
    let feeQuote: BN = new BN(0);
    let feeBase: BN = new BN(0);

    const totalTradingFee = quoteResult.claimingFee.add(quoteResult.compoundingFee);
    const totalProtocolFee = quoteResult.protocolFee;

    if (isBuy) {
      // User puts in quote, receives base
      netQuoteFlow = trade.amount.clone();
      netBaseFlow = quoteResult.outputAmount.clone();
      this.pool.tokenBAmount = this.pool.tokenBAmount.add(trade.amount);
      this.pool.tokenAAmount = this.pool.tokenAAmount.sub(quoteResult.outputAmount);

      if (feeMode.feesOnTokenA) {
        feeBase = totalTradingFee.add(totalProtocolFee);
        this._accumulatedFees.protocolAFee = this._accumulatedFees.protocolAFee.add(totalProtocolFee);
        this._accumulatedFees.lpAFee = this._accumulatedFees.lpAFee.add(totalTradingFee);
      } else {
        feeQuote = totalTradingFee.add(totalProtocolFee);
        this._accumulatedFees.protocolBFee = this._accumulatedFees.protocolBFee.add(totalProtocolFee);
        this._accumulatedFees.lpBFee = this._accumulatedFees.lpBFee.add(totalTradingFee);
      }
    } else {
      // User puts in base, receives quote
      netBaseFlow = trade.amount.clone();
      netQuoteFlow = quoteResult.outputAmount.clone();
      this.pool.tokenAAmount = this.pool.tokenAAmount.add(trade.amount);
      this.pool.tokenBAmount = this.pool.tokenBAmount.sub(quoteResult.outputAmount);

      if (feeMode.feesOnTokenA) {
        feeBase = totalTradingFee.add(totalProtocolFee);
        this._accumulatedFees.protocolAFee = this._accumulatedFees.protocolAFee.add(totalProtocolFee);
        this._accumulatedFees.lpAFee = this._accumulatedFees.lpAFee.add(totalTradingFee);
      } else {
        feeQuote = totalTradingFee.add(totalProtocolFee);
        this._accumulatedFees.protocolBFee = this._accumulatedFees.protocolBFee.add(totalProtocolFee);
        this._accumulatedFees.lpBFee = this._accumulatedFees.lpBFee.add(totalTradingFee);
      }
    }

    const spotPriceAfter = this.getSpotPrice();

    const baseScale = new (DecimalConstructor as any)(10).pow(this.tokenBaseDecimal);
    const quoteScale = new (DecimalConstructor as any)(10).pow(this.tokenQuoteDecimal);

    let executionPrice: Decimal;
    if (isBuy) {
      const qUi = new (DecimalConstructor as any)(trade.amount.toString()).div(quoteScale);
      const bUi = new (DecimalConstructor as any)(quoteResult.outputAmount.toString()).div(baseScale);
      executionPrice = bUi.isZero() ? spotPriceAfter : qUi.div(bUi);
    } else {
      const qUi = new (DecimalConstructor as any)(quoteResult.outputAmount.toString()).div(quoteScale);
      const bUi = new (DecimalConstructor as any)(trade.amount.toString()).div(baseScale);
      executionPrice = bUi.isZero() ? spotPriceAfter : qUi.div(bUi);
    }

    const priceImpact = parseFloat(quoteResult.priceImpact.toString());
    this._tradesExecuted++;

    return {
      trade,
      quoteResult,
      isPartialFill: !quoteResult.amountLeft.isZero(),
      priceImpact,
      spotPriceBefore,
      spotPriceAfter,
      executionPrice,
      netQuoteFlow,
      netBaseFlow,
      feeQuote,
      feeBase,
    };
  }
}

export interface MigrationGapOptions {
  /** Trade size in USD to measure price impact (default: 1000) */
  usdTradeSize?: number;
  /** USD price of the quote token (e.g. 150 for SOL at $150) */
  quoteUsdPrice: number;
  /** Simulation clock */
  clock?: SimClock;
}

export interface MigrationGapResult {
  /** BPS gap between last DBC price and DAMM v2 starting price */
  priceGapBps: number;
  /** Last DBC execution price (UI Quote/Base) */
  lastDbcPriceUI: Decimal;
  /** DAMM v2 starting spot price (UI Quote/Base) */
  dammStartingPriceUI: Decimal;
  /** Price impact comparison for the specified USD trade size */
  priceImpactBeforeVsAfter: {
    tradeSizeUsd: number;
    tradeSizeQuoteLamports: BN;
    dbcPriceImpactBps: number;
    dammPriceImpactBps: number;
    impactRatio: number;
  };
  /** Depth comparison: quote lamports needed to move price by 1%, 5%, 10% */
  depthComparison: {
    quoteNeeded1Pct: { dbc: BN; damm: BN; ratio: number };
    quoteNeeded5Pct: { dbc: BN; damm: BN; ratio: number };
    quoteNeeded10Pct: { dbc: BN; damm: BN; ratio: number };
  };
}

/**
 * Measures the liquidity and price continuity gap across DBC graduation into DAMM v2.
 */
export function measureMigrationGap(
  configParams: ConfigParameters,
  options: MigrationGapOptions
): MigrationGapResult {
  const usdTradeSize = options.usdTradeSize ?? 1000;
  const quoteUsdPrice = options.quoteUsdPrice;
  if (quoteUsdPrice <= 0) throw new Error('quoteUsdPrice must be positive');

  // Convert USD trade size to quote lamports
  const quoteTokensUI = new (DecimalConstructor as any)(usdTradeSize).div(new (DecimalConstructor as any)(quoteUsdPrice));
  const quoteDecimals = (configParams as any).quoteTokenFlag ?? 9;
  const quoteScale = new (DecimalConstructor as any)(10).pow(quoteDecimals);
  const tradeSizeQuoteLamports = new BN(quoteTokensUI.mul(quoteScale).floor().toFixed());

  // 1. Run DBC simulator until graduation
  const sim = new VirtualPoolSimulator(configParams, options.clock);
  
  // Fill curve up to ~99% of threshold to capture the immediate pre-graduation state
  const threshold = sim.config.migrationQuoteThreshold;
  const preGradThreshold = threshold.muln(95).divn(100);
  let lastDbcStep: any = null;

  if (preGradThreshold.gt(new BN(0))) {
    lastDbcStep = sim.step({ side: 'buy', amount: preGradThreshold });
  }

  // Measure DBC price impact of the USD trade size immediately before graduation
  const dbcSimForImpact = new VirtualPoolSimulator(configParams, options.clock);
  if (preGradThreshold.gt(new BN(0))) {
    dbcSimForImpact.step({ side: 'buy', amount: preGradThreshold });
  }
  const dbcPreGradState = {
    sqrtPrice: dbcSimForImpact.virtualPool.poolState.sqrtPrice.clone(),
    quoteReserve: dbcSimForImpact.virtualPool.poolState.quoteReserve.clone(),
  };
  const dbcImpactStep = dbcSimForImpact.step({ side: 'buy', amount: tradeSizeQuoteLamports });
  const dbcPriceImpactBps = Math.round(dbcImpactStep.priceImpact * 100);

  // Now complete graduation on the main simulator
  const graduationStep = sim.step({ side: 'buy', amount: threshold });
  const lastDbcPriceUI = graduationStep.executionPrice;

  // 2. Build DAMM v2 pool from migration data
  const migrationData = sim.getMigrationData();
  const dammPoolState = buildDammV2PoolState(migrationData, configParams, options.clock);
  const dammPool = new PostGraduationPool(
    dammPoolState,
    configParams.tokenDecimal,
    quoteDecimals,
    options.clock
  );

  const dammStartingPriceUI = dammPool.getSpotPrice();

  // Price gap in basis points: |P_damm - P_dbc| / P_dbc * 10000
  const pDbc = new (DecimalConstructor as any)(lastDbcPriceUI.toString());
  const pDamm = new (DecimalConstructor as any)(dammStartingPriceUI.toString());
  const priceDiff = pDamm.sub(pDbc).abs();
  const priceGapRatio = pDbc.isZero() ? new (DecimalConstructor as any)(0) : priceDiff.div(pDbc);
  const priceGapBps = Math.round(priceGapRatio.mul(10000).toNumber());

  // 3. Measure DAMM v2 price impact of the exact same USD trade size immediately after graduation
  const dammImpactStep = dammPool.step({ side: 'buy', amount: tradeSizeQuoteLamports });
  const dammPriceImpactBps = Math.round(dammImpactStep.priceImpact * 100);

  const impactRatio = dbcPriceImpactBps > 0 ? dammPriceImpactBps / dbcPriceImpactBps : 0;

  // 4. Depth comparison: quote lamports needed to move price by 1%, 5%, and 10%
  const getTargetSqrtPrice = (sqrtP: BN, pct: number): BN => {
    const mult = new (DecimalConstructor as any)(1).add(new (DecimalConstructor as any)(pct)).sqrt();
    const next = new (DecimalConstructor as any)(sqrtP.toString()).mul(mult);
    return new BN(next.floor().toFixed());
  };

  const measureDepthForPct = (pct: number) => {
    // On DAMM v2: exact concentrated liquidity formula
    const targetSqrtPriceDamm = getTargetSqrtPrice(dammPoolState.sqrtPrice, pct);
    const dammNeeded = getAmountBFromLiquidityDeltaForConcentratedLiquidity(
      dammPoolState.sqrtPrice,
      targetSqrtPriceDamm,
      dammPoolState.liquidity,
      0 // Rounding.Up
    );

    // On DBC curve: incremental quote needed from current reserve to target reserve
    const targetSqrtPriceDbc = getTargetSqrtPrice(dbcPreGradState.sqrtPrice, pct);
    let dbcNeeded: BN;
    try {
      const targetReserve = getQuoteReserveFromNextSqrtPrice(targetSqrtPriceDbc, sim.config);
      dbcNeeded = targetReserve.gt(dbcPreGradState.quoteReserve)
        ? targetReserve.sub(dbcPreGradState.quoteReserve)
        : new BN(0);
    } catch {
      // Beyond curve boundary
      dbcNeeded = new BN(0);
    }

    const ratio = !dbcNeeded.isZero() ? dammNeeded.toNumber() / dbcNeeded.toNumber() : 0;
    return { dbc: dbcNeeded, damm: dammNeeded, ratio };
  };

  return {
    priceGapBps,
    lastDbcPriceUI,
    dammStartingPriceUI,
    priceImpactBeforeVsAfter: {
      tradeSizeUsd: usdTradeSize,
      tradeSizeQuoteLamports,
      dbcPriceImpactBps,
      dammPriceImpactBps,
      impactRatio,
    },
    depthComparison: {
      quoteNeeded1Pct: measureDepthForPct(0.01),
      quoteNeeded5Pct: measureDepthForPct(0.05),
      quoteNeeded10Pct: measureDepthForPct(0.10),
    },
  };
}
