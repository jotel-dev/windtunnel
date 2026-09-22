import BN from 'bn.js';
import DecimalConstructor from 'decimal.js';
import type { Decimal } from './types.js';
import {
  SwapMode,
  ActivationType,
  CollectFeeMode,
  swapQuoteExactIn,
  swapQuoteExactOut,
  swapQuotePartialFill,
  getPriceFromSqrtPrice,
  getQuoteReserveFromNextSqrtPrice,
  getBaseTokenForSwap,
  getMigrationThresholdPrice,
  getMigrationQuoteAmountFromMigrationQuoteThreshold,
  getMigrationBaseToken,
  getProtocolMigrationFee,
  PoolService,
  PROTOCOL_FEE_PERCENT,
} from '@meteora-ag/dynamic-bonding-curve-sdk';

import type {
  ConfigParameters,
  VirtualPool,
  PoolConfig,
  SimTrade,
  SimClock,
  StepResult,
  AccumulatedFees,
  MigrationData,
  SimulatorStateSnapshot,
} from './types.js';

import { createDefaultVolatilityTracker, updateVolatilityTracker } from './volatility.js';

/**
 * Normalizes a ConfigParameters object (from buildCurve*) into the PoolConfig
 * structure required by the SDK's quote functions.
 */
export function normalizeConfig(config: ConfigParameters): PoolConfig {
  if (!config.curve || config.curve.length === 0) {
    throw new Error('config.curve is empty');
  }
  const migrationSqrtPrice = getMigrationThresholdPrice(
    config.migrationQuoteThreshold,
    config.sqrtStartPrice,
    config.curve
  );
  const dynamicFee = config.poolFees?.dynamicFee;

  return {
    ...config,
    migrationSqrtPrice,
    poolFees: {
      ...config.poolFees,
      dynamicFee: dynamicFee
        ? {
            ...dynamicFee,
            initialized: (dynamicFee as any).initialized ?? 1,
          }
        : {
            initialized: 0,
            maxVolatilityAccumulator: 0,
            variableFeeControl: 0,
            binStep: 0,
            filterPeriod: 0,
            decayPeriod: 0,
            reductionFactor: 0,
            binStepU128: new BN(0),
            padding: [],
            padding2: [],
          },
    },
  } as unknown as PoolConfig;
}

/**
 * WindTunnel VirtualPoolSimulator:
 * Pure in-memory stateful simulator for DBC bonding curve launches.
 * Uses real Meteora SDK curve and quote math without any RPC connection.
 */
export class VirtualPoolSimulator {
  readonly rawConfig: ConfigParameters;
  readonly config: PoolConfig;
  readonly virtualPool: VirtualPool;
  readonly totalBaseTokensForCurve: BN;

  private _clock: SimClock;
  private _accumulatedFees: AccumulatedFees;
  private _tradesExecuted: number = 0;
  private _isGraduated: boolean = false;
  private _useDynamicFeeTracker: boolean;

  constructor(
    configParams: ConfigParameters,
    initialClock: SimClock = { slot: 1000, timestamp: 1700000000 },
    options: { useDynamicFeeTracker?: boolean } = {}
  ) {
    this.rawConfig = configParams;
    this.config = normalizeConfig(configParams);
    this._clock = { ...initialClock };
    this._useDynamicFeeTracker = options.useDynamicFeeTracker ?? false;

    // Calculate total base tokens reserved on curve from start to migration threshold
    this.totalBaseTokensForCurve = getBaseTokenForSwap(
      this.config.sqrtStartPrice,
      this.config.migrationSqrtPrice,
      this.config.curve
    );

    const activationPoint =
      this.config.activationType === ActivationType.Slot
        ? new BN(initialClock.slot)
        : new BN(initialClock.timestamp);

    // Build initial virtual pool
    this.virtualPool = {
      poolState: {
        config: null as any,
        creator: null as any,
        baseMint: null as any,
        baseVault: null as any,
        quoteVault: null as any,
        sqrtPrice: this.config.sqrtStartPrice.clone(),
        baseReserve: this.totalBaseTokensForCurve.clone(),
        quoteReserve: new BN(0),
        activationPoint,
        volatilityTracker: createDefaultVolatilityTracker(
          this.config.sqrtStartPrice,
          initialClock.timestamp
        ),
        poolType: this.config.tokenType ?? 0,
        isMigrated: 0,
        migrationProgress: 0, // PreBondingCurve
        finishCurveTimestamp: new BN(0),
        protocolBaseFee: new BN(0),
        protocolQuoteFee: new BN(0),
        partnerBaseFee: new BN(0),
        partnerQuoteFee: new BN(0),
        creatorBaseFee: new BN(0),
        creatorQuoteFee: new BN(0),
        protocolLiquidityMigrationFeeBps: 20, // 0.2%
        protocolMigrationBaseFeeAmount: new BN(0),
        protocolMigrationQuoteFeeAmount: new BN(0),
        metrics: {
          totalTradingBaseFee: new BN(0),
          totalTradingQuoteFee: new BN(0),
        } as any,
      } as any,
    };

    this._accumulatedFees = {
      creatorQuoteFee: new BN(0),
      creatorBaseFee: new BN(0),
      partnerQuoteFee: new BN(0),
      partnerBaseFee: new BN(0),
      protocolQuoteFee: new BN(0),
      protocolBaseFee: new BN(0),
      referralQuoteFee: new BN(0),
      referralBaseFee: new BN(0),
      totalTradingQuoteFee: new BN(0),
      totalTradingBaseFee: new BN(0),
    };
  }

  get clock(): SimClock {
    return { ...this._clock };
  }

  get isGraduated(): boolean {
    return this._isGraduated;
  }

  get tradesExecuted(): number {
    return this._tradesExecuted;
  }

  get accumulatedFees(): AccumulatedFees {
    return {
      creatorQuoteFee: this._accumulatedFees.creatorQuoteFee.clone(),
      creatorBaseFee: this._accumulatedFees.creatorBaseFee.clone(),
      partnerQuoteFee: this._accumulatedFees.partnerQuoteFee.clone(),
      partnerBaseFee: this._accumulatedFees.partnerBaseFee.clone(),
      protocolQuoteFee: this._accumulatedFees.protocolQuoteFee.clone(),
      protocolBaseFee: this._accumulatedFees.protocolBaseFee.clone(),
      referralQuoteFee: this._accumulatedFees.referralQuoteFee.clone(),
      referralBaseFee: this._accumulatedFees.referralBaseFee.clone(),
      totalTradingQuoteFee: this._accumulatedFees.totalTradingQuoteFee.clone(),
      totalTradingBaseFee: this._accumulatedFees.totalTradingBaseFee.clone(),
    };
  }

  /**
   * Returns UI spot price (Quote / Base)
   */
  getSpotPrice(): Decimal {
    return getPriceFromSqrtPrice(
      this.virtualPool.poolState.sqrtPrice,
      this.config.tokenDecimal,
      this.config.quoteTokenFlag ?? 9
    );
  }

  getQuoteReserve(): BN {
    return this.virtualPool.poolState.quoteReserve.clone();
  }

  getBaseReserve(): BN {
    return this.virtualPool.poolState.baseReserve.clone();
  }

  /**
   * Execute a single trade step and update the simulator's state.
   */
  step(trade: SimTrade, clock?: SimClock): StepResult {
    if (this._isGraduated) {
      throw new Error('Virtual pool is already graduated; cannot accept further trades');
    }

    if (clock) {
      if (clock.slot < this._clock.slot || clock.timestamp < this._clock.timestamp) {
        throw new Error('Clock cannot move backwards');
      }
      this._clock = { ...clock };
    }

    if (trade.amount.isZero()) {
      throw new Error('Trade amount must be non-zero');
    }

    // Determine current point for fee scheduler decay (slot or timestamp)
    const currentPoint =
      this.config.activationType === ActivationType.Slot
        ? new BN(this._clock.slot)
        : new BN(this._clock.timestamp);

    // Update volatility tracker if enabled
    if (this._useDynamicFeeTracker) {
      this.virtualPool.poolState.volatilityTracker = updateVolatilityTracker(
        this.virtualPool.poolState.volatilityTracker,
        this.config.poolFees.dynamicFee,
        this.virtualPool.poolState.sqrtPrice,
        this._clock.timestamp
      );
    }

    const swapBaseForQuote = trade.side === 'sell';
    const swapMode = trade.mode === 'exactOut' ? SwapMode.ExactOut : SwapMode.ExactIn;
    const slippageBps = trade.slippageBps ?? 0;
    const hasReferral = trade.hasReferral ?? false;
    const eligibleForFirstSwapWithMinFee = trade.eligibleForFirstSwapWithMinFee ?? false;

    const spotPriceBefore = this.getSpotPrice();
    let isPartialFill = false;
    let quoteResult: any;

    if (!swapBaseForQuote) {
      // BUY: quote -> base
      if (swapMode === SwapMode.ExactOut) {
        quoteResult = swapQuoteExactOut(
          this.virtualPool,
          this.config,
          swapBaseForQuote,
          trade.amount,
          slippageBps,
          hasReferral,
          currentPoint,
          eligibleForFirstSwapWithMinFee
        );
      } else {
        // ExactIn buy: try exact-in first; if amount overshoots graduation threshold, fall back to partial fill
        try {
          quoteResult = swapQuoteExactIn(
            this.virtualPool,
            this.config,
            swapBaseForQuote,
            trade.amount,
            slippageBps,
            hasReferral,
            currentPoint,
            eligibleForFirstSwapWithMinFee
          );
        } catch (err: any) {
          if (err.message && (err.message.includes('Insufficient Liquidity') || err.message.includes('completed'))) {
            // Overshoots curve cap: use partial fill to complete the curve cleanly
            quoteResult = swapQuotePartialFill(
              this.virtualPool,
              this.config,
              swapBaseForQuote,
              trade.amount,
              slippageBps,
              hasReferral,
              currentPoint,
              eligibleForFirstSwapWithMinFee
            );
            isPartialFill = true;
          } else {
            throw err;
          }
        }
      }
    } else {
      // SELL: base -> quote
      if (swapMode === SwapMode.ExactOut) {
        quoteResult = swapQuoteExactOut(
          this.virtualPool,
          this.config,
          swapBaseForQuote,
          trade.amount,
          slippageBps,
          hasReferral,
          currentPoint,
          eligibleForFirstSwapWithMinFee
        );
      } else {
        quoteResult = swapQuoteExactIn(
          this.virtualPool,
          this.config,
          swapBaseForQuote,
          trade.amount,
          slippageBps,
          hasReferral,
          currentPoint,
          eligibleForFirstSwapWithMinFee
        );
      }
    }

    // Apply quoteResult to state
    this.virtualPool.poolState.sqrtPrice = quoteResult.nextSqrtPrice.clone();

    // Recompute reserves
    const newQuoteReserve = getQuoteReserveFromNextSqrtPrice(
      quoteResult.nextSqrtPrice,
      this.config
    );
    this.virtualPool.poolState.quoteReserve = newQuoteReserve;

    const baseSold = getBaseTokenForSwap(
      this.config.sqrtStartPrice,
      quoteResult.nextSqrtPrice,
      this.config.curve
    );
    this.virtualPool.poolState.baseReserve = this.totalBaseTokensForCurve.sub(baseSold);

    // Fee splits: 20% protocol, 80% trading fee. Trading fee split by creatorTradingFeePercentage
    const creatorFeePct = this.config.creatorTradingFeePercentage ?? 0;
    const tradingFee = quoteResult.tradingFee;
    const protocolFee = quoteResult.protocolFee;
    const referralFee = quoteResult.referralFee;

    const creatorShare = tradingFee.mul(new BN(creatorFeePct)).div(new BN(100));
    const partnerShare = tradingFee.sub(creatorShare);

    const isQuoteTokenFee = this.config.collectFeeMode === CollectFeeMode.QuoteToken || swapBaseForQuote;

    if (isQuoteTokenFee) {
      this._accumulatedFees.creatorQuoteFee = this._accumulatedFees.creatorQuoteFee.add(creatorShare);
      this._accumulatedFees.partnerQuoteFee = this._accumulatedFees.partnerQuoteFee.add(partnerShare);
      this._accumulatedFees.protocolQuoteFee = this._accumulatedFees.protocolQuoteFee.add(protocolFee);
      this._accumulatedFees.referralQuoteFee = this._accumulatedFees.referralQuoteFee.add(referralFee);
      this._accumulatedFees.totalTradingQuoteFee = this._accumulatedFees.totalTradingQuoteFee.add(tradingFee);
    } else {
      this._accumulatedFees.creatorBaseFee = this._accumulatedFees.creatorBaseFee.add(creatorShare);
      this._accumulatedFees.partnerBaseFee = this._accumulatedFees.partnerBaseFee.add(partnerShare);
      this._accumulatedFees.protocolBaseFee = this._accumulatedFees.protocolBaseFee.add(protocolFee);
      this._accumulatedFees.referralBaseFee = this._accumulatedFees.referralBaseFee.add(referralFee);
      this._accumulatedFees.totalTradingBaseFee = this._accumulatedFees.totalTradingBaseFee.add(tradingFee);
    }

    // Spot price after swap
    const spotPriceAfter = this.getSpotPrice();

    // Compute execution price & price impact
    const baseDecimals = this.config.tokenDecimal;
    const quoteDecimals = this.config.quoteTokenFlag ?? 9;
    const baseScale = new (DecimalConstructor as any)(10).pow(baseDecimals);
    const quoteScale = new (DecimalConstructor as any)(10).pow(quoteDecimals);

    let quoteVolumeUI: Decimal;
    let baseVolumeUI: Decimal;
    let netQuoteFlow: BN;
    let netBaseFlow: BN;

    if (!swapBaseForQuote) {
      // BUY: Trader inputs quote (includedFeeInputAmount), receives base (outputAmount)
      quoteVolumeUI = new (DecimalConstructor as any)(quoteResult.includedFeeInputAmount.toString()).div(quoteScale);
      baseVolumeUI = new (DecimalConstructor as any)(quoteResult.outputAmount.toString()).div(baseScale);
      netQuoteFlow = quoteResult.includedFeeInputAmount;
      netBaseFlow = quoteResult.outputAmount.neg();
    } else {
      // SELL: Trader inputs base (includedFeeInputAmount), receives quote (outputAmount)
      baseVolumeUI = new (DecimalConstructor as any)(quoteResult.includedFeeInputAmount.toString()).div(baseScale);
      quoteVolumeUI = new (DecimalConstructor as any)(quoteResult.outputAmount.toString()).div(quoteScale);
      netQuoteFlow = quoteResult.outputAmount.neg();
      netBaseFlow = quoteResult.includedFeeInputAmount;
    }

    const executionPrice = baseVolumeUI.isZero() ? spotPriceBefore : quoteVolumeUI.div(baseVolumeUI);

    // Price impact = (executionPrice - spotPriceBefore) / spotPriceBefore
    const priceImpact = spotPriceBefore.isZero()
      ? 0
      : executionPrice.sub(spotPriceBefore).div(spotPriceBefore).toNumber();

    this._tradesExecuted++;

    // Graduation check
    if (this.virtualPool.poolState.quoteReserve.gte(this.config.migrationQuoteThreshold)) {
      this._isGraduated = true;
      this.virtualPool.poolState.isMigrated = 1;
      this.virtualPool.poolState.migrationProgress = 1; // PostBondingCurve
      this.virtualPool.poolState.finishCurveTimestamp = new BN(this._clock.timestamp);
    }

    return {
      trade,
      quoteResult,
      isPartialFill,
      priceImpact,
      spotPriceBefore,
      spotPriceAfter,
      executionPrice,
      netQuoteFlow,
      netBaseFlow,
      graduated: this._isGraduated,
    };
  }

  /**
   * Return full migration accounting data at or after graduation.
   */
  getMigrationData(): MigrationData {
    const sqrtMigrationPrice = this.config.migrationSqrtPrice;
    const migrationPriceUI = getPriceFromSqrtPrice(
      sqrtMigrationPrice,
      this.config.tokenDecimal,
      this.config.quoteTokenFlag ?? 9
    );

    const migrationFeePercent = (this.config as any).migrationFee?.feePercentage ?? 0;
    const migrationQuoteAmountDecimal = getMigrationQuoteAmountFromMigrationQuoteThreshold(
      new (DecimalConstructor as any)(this.config.migrationQuoteThreshold.toString()),
      migrationFeePercent
    );
    const migrationQuoteAmountAfterFees = new BN(migrationQuoteAmountDecimal.floor().toFixed());

    const migrationBaseTokens = getMigrationBaseToken(
      migrationQuoteAmountAfterFees,
      sqrtMigrationPrice,
      this.config.migrationOption
    );

    const [protocolMigrationBaseFee, protocolMigrationQuoteFee] = getProtocolMigrationFee(
      migrationBaseTokens,
      migrationQuoteAmountAfterFees,
      sqrtMigrationPrice,
      20, // 20 bps = 0.2%
      this.config.migrationOption
    );

    const currentQuoteReserve = this.virtualPool.poolState.quoteReserve;
    const surplusQuoteAmount = currentQuoteReserve.gt(this.config.migrationQuoteThreshold)
      ? currentQuoteReserve.sub(this.config.migrationQuoteThreshold)
      : new BN(0);

    // Surplus split: 80% partner & creator, 20% protocol. Creator share = 80% * creatorTradingFeePercentage
    const partnerAndCreatorSurplus = surplusQuoteAmount.mul(new BN(80)).div(new BN(100));
    const protocolSurplusQuoteAmount = surplusQuoteAmount.sub(partnerAndCreatorSurplus);
    const creatorTradingFeePercentage = this.config.creatorTradingFeePercentage ?? 0;
    const creatorSurplusQuoteAmount = partnerAndCreatorSurplus
      .mul(new BN(creatorTradingFeePercentage))
      .div(new BN(100));
    const partnerSurplusQuoteAmount = partnerAndCreatorSurplus.sub(creatorSurplusQuoteAmount);

    return {
      sqrtMigrationPrice,
      migrationPriceUI,
      migrationQuoteThreshold: this.config.migrationQuoteThreshold.clone(),
      finalQuoteReserve: currentQuoteReserve.clone(),
      migrationQuoteAmountAfterFees,
      migrationBaseTokens,
      protocolMigrationQuoteFee,
      protocolMigrationBaseFee,
      surplusQuoteAmount,
      creatorSurplusQuoteAmount,
      partnerSurplusQuoteAmount,
      protocolSurplusQuoteAmount,
    };
  }

  /**
   * Return an immutable snapshot of current simulator state.
   */
  getSnapshot(): SimulatorStateSnapshot {
    const currentPriceUI = this.getSpotPrice();
    const baseSold = getBaseTokenForSwap(
      this.config.sqrtStartPrice,
      this.virtualPool.poolState.sqrtPrice,
      this.config.curve
    );

    return {
      sqrtPrice: this.virtualPool.poolState.sqrtPrice.clone(),
      currentPriceUI,
      quoteReserve: this.virtualPool.poolState.quoteReserve.clone(),
      baseReserve: this.virtualPool.poolState.baseReserve.clone(),
      totalBaseTokensSold: baseSold,
      totalBaseTokensForCurve: this.totalBaseTokensForCurve.clone(),
      migrationQuoteThreshold: this.config.migrationQuoteThreshold.clone(),
      isGraduated: this._isGraduated,
      tradesExecuted: this._tradesExecuted,
      accumulatedFees: this.accumulatedFees,
      clock: this.clock,
    };
  }
}
