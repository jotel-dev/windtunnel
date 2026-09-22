import { describe, it, expect } from 'vitest';
import BN from 'bn.js';
import DecimalConstructor from 'decimal.js';
import {
  ActivationType,
  CollectFeeMode,
  MigrationOption,
  buildCurve,
  buildCurveWithMarketCap,
  buildCurveWithTwoSegments,
  swapQuoteExactIn,
  getPriceFromSqrtPrice,
  getFeeSchedulerParams,
  getBaseFeeHandler,
  getMigrationQuoteAmountFromMigrationQuoteThreshold,
  FEE_DENOMINATOR,
  getExcludedFeeAmount,
  ConfigParameters,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import { VirtualPoolSimulator, SeededRng, Mulberry32 } from '../src/index.js';

describe('VirtualPoolSimulator Hardened Test Suite', () => {
  // --------------------------------------------------------------------------
  // PART A - 1: EQUIVALENCE (50 Random Valid Configs)
  // --------------------------------------------------------------------------
  it('Equivalence: step() on fresh state equals direct swapQuoteExactIn for buys and sells across 50 random configs', () => {
    const masterSeed = 104729;
    const rng = new SeededRng(masterSeed);

    for (let i = 0; i < 50; i++) {
      const seed = rng.nextInt(1, 10000000);
      const prng = new SeededRng(seed);

      try {
        const modeChoice = prng.nextInt(0, 2);
        let baseFeeParams: any;
        if (modeChoice === 0) {
          // Linear decaying fee scheduler
          const endingFeeBps = prng.nextInt(25, 200);
          const startingFeeBps = prng.nextInt(endingFeeBps + 10, 1000);
          const numberOfPeriod = prng.nextInt(2, 20);
          const totalDuration = prng.nextInt(60, 3600);
          baseFeeParams = {
            baseFeeMode: 0,
            feeSchedulerParam: {
              startingFeeBps,
              endingFeeBps,
              numberOfPeriod,
              totalDuration,
            },
          };
        } else if (modeChoice === 1) {
          // Exponential decaying fee scheduler
          const endingFeeBps = prng.nextInt(25, 200);
          const startingFeeBps = prng.nextInt(endingFeeBps + 10, 1000);
          const numberOfPeriod = prng.nextInt(2, 20);
          const totalDuration = prng.nextInt(60, 3600);
          baseFeeParams = {
            baseFeeMode: 1,
            feeSchedulerParam: {
              startingFeeBps,
              endingFeeBps,
              numberOfPeriod,
              totalDuration,
            },
          };
        } else {
          // Fixed fee
          const feeBps = prng.nextInt(25, 1000);
          baseFeeParams = {
            baseFeeMode: 0,
            feeSchedulerParam: {
              startingFeeBps: feeBps,
              endingFeeBps: feeBps,
              numberOfPeriod: 0,
              totalDuration: 0,
            },
          };
        }

        const initialMarketCap = prng.nextInt(5, 50);
        const migrationMarketCap = prng.nextInt(initialMarketCap + 10, 200);
        const migrationQuoteThreshold = prng.nextInt(20, 100);

        const configParams = buildCurveWithMarketCap({
          token: {
            tokenType: 0,
            tokenBaseDecimal: 6,
            tokenQuoteDecimal: 9,
            tokenAuthorityOption: 0,
            totalTokenSupply: 1000000000,
            leftover: 0,
          },
          fee: {
            baseFeeParams,
            dynamicFeeEnabled: false,
            collectFeeMode: 0,
            creatorTradingFeePercentage: 0,
            poolCreationFee: 0,
            enableFirstSwapWithMinFee: false,
          },
          migration: {
            migrationOption: 1,
            migrationFeeOption: 0,
            migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
          },
          liquidityDistribution: {
            partnerPermanentLockedLiquidityPercentage: 0,
            partnerLiquidityPercentage: 0,
            creatorPermanentLockedLiquidityPercentage: 0,
            creatorLiquidityPercentage: 0,
          },
          lockedVesting: {
            totalLockedVestingAmount: 0,
            numberOfVestingPeriod: 0,
            cliffUnlockAmount: 0,
            totalVestingDuration: 0,
            cliffDurationFromMigrationTime: 0,
          },
          activationType: 1,
          initialMarketCap,
          migrationMarketCap,
        });

        // 1. Fresh Buy Equivalence
        const simBuy = new VirtualPoolSimulator(configParams);
        const freshBuyPool = new VirtualPoolSimulator(configParams);
        const buyAmount = new BN(prng.nextInt(1000000, 50000000)); // 0.001 - 0.05 SOL

        const directBuy = swapQuoteExactIn(
          freshBuyPool.virtualPool,
          freshBuyPool.config,
          false, // buy (Quote to Base)
          buyAmount,
          0,
          false,
          freshBuyPool.virtualPool.poolState.activationPoint,
          false
        );
        const buyStep = simBuy.step({ side: 'buy', amount: buyAmount });

        expect(buyStep.quoteResult.outputAmount.toString()).toBe(directBuy.outputAmount.toString());
        expect(buyStep.quoteResult.nextSqrtPrice.toString()).toBe(directBuy.nextSqrtPrice.toString());
        expect(buyStep.quoteResult.tradingFee.toString()).toBe(directBuy.tradingFee.toString());
        expect(buyStep.quoteResult.protocolFee.toString()).toBe(directBuy.protocolFee.toString());

        // 2. Sell Equivalence (after initial buy provides quote reserves)
        const simSell = new VirtualPoolSimulator(configParams);
        const directSellPool = new VirtualPoolSimulator(configParams);
        const initBuyAmount = new BN(prng.nextInt(10000000, 100000000)); // 0.01 - 0.1 SOL

        const preBuyStep = simSell.step({ side: 'buy', amount: initBuyAmount });
        directSellPool.step({ side: 'buy', amount: initBuyAmount });

        const sellAmount = preBuyStep.quoteResult.outputAmount.divn(2); // sell half base tokens received

        const directSell = swapQuoteExactIn(
          directSellPool.virtualPool,
          directSellPool.config,
          true, // sell (Base to Quote)
          sellAmount,
          0,
          false,
          simSell.virtualPool.poolState.activationPoint,
          false
        );
        const sellStep = simSell.step({ side: 'sell', amount: sellAmount });

        expect(sellStep.quoteResult.outputAmount.toString()).toBe(directSell.outputAmount.toString());
        expect(sellStep.quoteResult.nextSqrtPrice.toString()).toBe(directSell.nextSqrtPrice.toString());
        expect(sellStep.quoteResult.tradingFee.toString()).toBe(directSell.tradingFee.toString());
        expect(sellStep.quoteResult.protocolFee.toString()).toBe(directSell.protocolFee.toString());
      } catch (err) {
        console.error(`Equivalence test failed at config iteration ${i} with seed ${seed}`);
        throw err;
      }
    }
  });

  // --------------------------------------------------------------------------
  // PART A - 2: INVARIANTS (200 Trades on 20 Configs)
  // --------------------------------------------------------------------------
  it('Invariants: 200-trade random sequences across 20 configs preserve fees, reserves, and price monotonicity', () => {
    const masterSeed = 54321;
    const rng = new SeededRng(masterSeed);

    for (let c = 0; c < 20; c++) {
      const seed = rng.nextInt(1, 10000000);
      const prng = new SeededRng(seed);

      try {
        const modeChoice = prng.nextInt(0, 2);
        let baseFeeParams: any;
        if (modeChoice === 0) {
          const endingFeeBps = prng.nextInt(25, 200);
          const startingFeeBps = prng.nextInt(endingFeeBps + 10, 1000);
          baseFeeParams = {
            baseFeeMode: 0,
            feeSchedulerParam: {
              startingFeeBps,
              endingFeeBps,
              numberOfPeriod: prng.nextInt(2, 20),
              totalDuration: prng.nextInt(60, 3600),
            },
          };
        } else if (modeChoice === 1) {
          const endingFeeBps = prng.nextInt(25, 200);
          const startingFeeBps = prng.nextInt(endingFeeBps + 10, 1000);
          baseFeeParams = {
            baseFeeMode: 1,
            feeSchedulerParam: {
              startingFeeBps,
              endingFeeBps,
              numberOfPeriod: prng.nextInt(2, 20),
              totalDuration: prng.nextInt(60, 3600),
            },
          };
        } else {
          const feeBps = prng.nextInt(25, 1000);
          baseFeeParams = {
            baseFeeMode: 0,
            feeSchedulerParam: {
              startingFeeBps: feeBps,
              endingFeeBps: feeBps,
              numberOfPeriod: 0,
              totalDuration: 0,
            },
          };
        }

        const creatorTradingFeePercentage = prng.nextInt(0, 100);

        const configParams = buildCurveWithMarketCap({
          token: { tokenType: 0, tokenBaseDecimal: 6, tokenQuoteDecimal: 9, tokenAuthorityOption: 0, totalTokenSupply: 1000000000, leftover: 0 },
          fee: { baseFeeParams, dynamicFeeEnabled: false, collectFeeMode: 0, creatorTradingFeePercentage, poolCreationFee: 0, enableFirstSwapWithMinFee: false },
          migration: { migrationOption: 1, migrationFeeOption: 0, migrationFee: { feePercentage: 0, creatorFeePercentage: 0 } },
          liquidityDistribution: { partnerPermanentLockedLiquidityPercentage: 0, partnerLiquidityPercentage: 0, creatorPermanentLockedLiquidityPercentage: 0, creatorLiquidityPercentage: 0 },
          lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
          activationType: 1,
          initialMarketCap: 10,
          migrationMarketCap: 500,
        });

        const sim = new VirtualPoolSimulator(configParams);

        for (let t = 0; t < 200; t++) {
          const isBuy = sim.virtualPool.poolState.quoteReserve.isZero() ? true : prng.next() < 0.6;
          const side = isBuy ? 'buy' : 'sell';

          let amount: BN;
          if (isBuy) {
            amount = new BN(prng.nextInt(100000, 2000000));
          } else {
            const maxSell = sim.virtualPool.poolState.baseReserve.divn(10);
            const randBase = new BN(prng.nextInt(1000, 500000));
            amount = BN.min(randBase, maxSell);
            if (amount.isZero()) amount = new BN(1000);
          }

          const snapBefore = sim.getSnapshot();
          const stepRes = sim.step({ side, amount });
          const snapAfter = sim.getSnapshot();

          // Invariant 1: Fee components (protocol + creator + partner) sum to total fee
          const stepTotalFee = stepRes.quoteResult.protocolFee.add(stepRes.quoteResult.tradingFee);
          const deltaProtocol = snapAfter.accumulatedFees.protocolQuoteFee.sub(snapBefore.accumulatedFees.protocolQuoteFee)
            .add(snapAfter.accumulatedFees.protocolBaseFee.sub(snapBefore.accumulatedFees.protocolBaseFee));
          const deltaCreator = snapAfter.accumulatedFees.creatorQuoteFee.sub(snapBefore.accumulatedFees.creatorQuoteFee)
            .add(snapAfter.accumulatedFees.creatorBaseFee.sub(snapBefore.accumulatedFees.creatorBaseFee));
          const deltaPartner = snapAfter.accumulatedFees.partnerQuoteFee.sub(snapBefore.accumulatedFees.partnerQuoteFee)
            .add(snapAfter.accumulatedFees.partnerBaseFee.sub(snapBefore.accumulatedFees.partnerBaseFee));
          const feeSum = deltaProtocol.add(deltaCreator).add(deltaPartner);

          expect(feeSum.toString()).toBe(stepTotalFee.toString());

          // Invariant 2: No negative reserves or amounts
          expect(snapAfter.quoteReserve.isNeg()).toBe(false);
          expect(snapAfter.baseReserve.isNeg()).toBe(false);
          expect(stepRes.quoteResult.outputAmount.isNeg()).toBe(false);

          // Invariant 3: Price never decreases under buy operations
          if (isBuy) {
            const currentPrice = sim.getSpotPrice();
            expect(currentPrice.gte(snapBefore.currentPriceUI)).toBe(true);
          }
        }
      } catch (err) {
        console.error(`Invariants test failed at config ${c} with seed ${seed}`);
        throw err;
      }
    }
  });

  // --------------------------------------------------------------------------
  // PART A - 3: SIMULATOR DETERMINISM
  // --------------------------------------------------------------------------
  it('Simulator determinism: identical config, seed, and trade list produce deep-equal final snapshots', () => {
    const prng = new SeededRng(777);
    const baseFeeParams = {
      baseFeeMode: 0,
      feeSchedulerParam: {
        startingFeeBps: 500,
        endingFeeBps: 50,
        numberOfPeriod: 10,
        totalDuration: 1000,
      },
    };
    const config = buildCurveWithMarketCap({
      token: { tokenType: 0, tokenBaseDecimal: 6, tokenQuoteDecimal: 9, tokenAuthorityOption: 0, totalTokenSupply: 1000000000, leftover: 0 },
      fee: { baseFeeParams, dynamicFeeEnabled: false, collectFeeMode: 0, creatorTradingFeePercentage: 20, poolCreationFee: 0, enableFirstSwapWithMinFee: false },
      migration: { migrationOption: 1, migrationFeeOption: 0, migrationFee: { feePercentage: 0, creatorFeePercentage: 0 } },
      liquidityDistribution: { partnerPermanentLockedLiquidityPercentage: 0, partnerLiquidityPercentage: 0, creatorPermanentLockedLiquidityPercentage: 0, creatorLiquidityPercentage: 0 },
      lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
      activationType: 1,
      initialMarketCap: 10,
      migrationMarketCap: 200,
    });

    const trades: any[] = [];
    for (let i = 0; i < 50; i++) {
      trades.push({
        side: i % 3 === 0 ? 'sell' : 'buy',
        amount: new BN(prng.nextInt(100000, 5000000)),
      });
    }

    const sim1 = new VirtualPoolSimulator(config);
    const sim2 = new VirtualPoolSimulator(config);

    for (const t of trades) {
      if (t.side === 'sell' && sim1.virtualPool.poolState.quoteReserve.isZero()) {
        sim1.step({ side: 'buy', amount: t.amount });
        sim2.step({ side: 'buy', amount: t.amount });
      } else {
        sim1.step(t);
        sim2.step(t);
      }
    }

    const snap1 = sim1.getSnapshot();
    const snap2 = sim2.getSnapshot();

    expect(snap1.sqrtPrice.toString()).toBe(snap2.sqrtPrice.toString());
    expect(snap1.quoteReserve.toString()).toBe(snap2.quoteReserve.toString());
    expect(snap1.baseReserve.toString()).toBe(snap2.baseReserve.toString());
    expect(snap1.totalBaseTokensSold.toString()).toBe(snap2.totalBaseTokensSold.toString());
    expect(snap1.tradesExecuted).toBe(snap2.tradesExecuted);
    expect(snap1.accumulatedFees.protocolQuoteFee.toString()).toBe(snap2.accumulatedFees.protocolQuoteFee.toString());
    expect(snap1.accumulatedFees.creatorQuoteFee.toString()).toBe(snap2.accumulatedFees.creatorQuoteFee.toString());
    expect(snap1.accumulatedFees.partnerQuoteFee.toString()).toBe(snap2.accumulatedFees.partnerQuoteFee.toString());
  });

  // --------------------------------------------------------------------------
  // PART A - 4: FEE SCHEDULER AT MULTIPLE ELAPSED TIMES
  // --------------------------------------------------------------------------
  it('Fee scheduler: base fee used at multiple elapsed times equals SDK getBaseFeeHandler across linear/exponential and slot/timestamp', () => {
    const modes = [
      { mode: 0, name: 'linear' },
      { mode: 1, name: 'exponential' },
    ];
    const activations = [
      { type: 0, name: 'slot' },
      { type: 1, name: 'timestamp' },
    ];

    for (const m of modes) {
      for (const a of activations) {
        const startingFeeBps = 600;
        const endingFeeBps = 100;
        const numberOfPeriod = 5;
        const totalDuration = 500;
        const baseFeeParams = {
          baseFeeMode: m.mode,
          feeSchedulerParam: {
            startingFeeBps,
            endingFeeBps,
            numberOfPeriod,
            totalDuration,
          },
        };

        const config = buildCurveWithMarketCap({
          token: { tokenType: 0, tokenBaseDecimal: 6, tokenQuoteDecimal: 9, tokenAuthorityOption: 0, totalTokenSupply: 1000000000, leftover: 0 },
          fee: { baseFeeParams, dynamicFeeEnabled: false, collectFeeMode: 0, creatorTradingFeePercentage: 0, poolCreationFee: 0, enableFirstSwapWithMinFee: false },
          migration: { migrationOption: 1, migrationFeeOption: 0, migrationFee: { feePercentage: 0, creatorFeePercentage: 0 } },
          liquidityDistribution: { partnerPermanentLockedLiquidityPercentage: 0, partnerLiquidityPercentage: 0, creatorPermanentLockedLiquidityPercentage: 0, creatorLiquidityPercentage: 0 },
          lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
          activationType: a.type,
          initialMarketCap: 10,
          migrationMarketCap: 200,
        });

        const initialClock = { slot: 1000, timestamp: 1700000000 };
        const sim = new VirtualPoolSimulator(config, initialClock);

        const handler = getBaseFeeHandler(
          sim.config.poolFees.baseFee.cliffFeeNumerator,
          sim.config.poolFees.baseFee.firstFactor,
          sim.config.poolFees.baseFee.secondFactor,
          sim.config.poolFees.baseFee.thirdFactor,
          sim.config.poolFees.baseFee.baseFeeMode
        );

        const elapsedList = [0, 50, 150, 350, 600];
        for (const elapsed of elapsedList) {
          const testClock = {
            slot: initialClock.slot + (a.type === 0 ? elapsed : 0),
            timestamp: initialClock.timestamp + (a.type === 1 ? elapsed : 0),
          };
          const currentPoint = a.type === 0 ? new BN(testClock.slot) : new BN(testClock.timestamp);
          const activationPoint = a.type === 0 ? new BN(initialClock.slot) : new BN(initialClock.timestamp);

          const expectedNumerator = handler.getBaseFeeNumeratorFromIncludedFeeAmount(
            currentPoint,
            activationPoint,
            1, // QuoteToBase (buy)
            new BN(1000000)
          );

          const simStep = new VirtualPoolSimulator(config, initialClock);
          const res = simStep.step({ side: 'buy', amount: new BN(1000000) }, testClock);

          const totalFee = res.quoteResult.tradingFee.add(res.quoteResult.protocolFee);
          const [, expectedFee] = getExcludedFeeAmount(expectedNumerator, new BN(1000000));

          expect(totalFee.toString()).toBe(expectedFee.toString());
        }
      }
    }
  });

  // --------------------------------------------------------------------------
  // PART A - 5: GRADUATION THRESHOLD & SDK QUOTE FORMULA MATCH
  // --------------------------------------------------------------------------
  it('Graduation: migration quote equals SDK getMigrationQuoteAmountFromMigrationQuoteThreshold and final partial fill lands on threshold', () => {
    const config = buildCurveWithMarketCap({
      token: { tokenType: 0, tokenBaseDecimal: 6, tokenQuoteDecimal: 9, tokenAuthorityOption: 0, totalTokenSupply: 1000000000, leftover: 0 },
      fee: {
        baseFeeParams: {
          baseFeeMode: 0,
          feeSchedulerParam: { startingFeeBps: 100, endingFeeBps: 100, numberOfPeriod: 0, totalDuration: 0 },
        },
        dynamicFeeEnabled: false,
        collectFeeMode: 0,
        creatorTradingFeePercentage: 0,
        poolCreationFee: 0,
        enableFirstSwapWithMinFee: false,
      },
      migration: {
        migrationOption: 1,
        migrationFeeOption: 0,
        migrationFee: { feePercentage: 2, creatorFeePercentage: 0 },
      },
      liquidityDistribution: { partnerPermanentLockedLiquidityPercentage: 0, partnerLiquidityPercentage: 0, creatorPermanentLockedLiquidityPercentage: 0, creatorLiquidityPercentage: 0 },
      lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
      activationType: 1,
      initialMarketCap: 2,
      migrationMarketCap: 20,
    });

    const sim = new VirtualPoolSimulator(config);
    const sdkQuoteDecimal = getMigrationQuoteAmountFromMigrationQuoteThreshold(
      new (DecimalConstructor as any)(config.migrationQuoteThreshold.toString()),
      config.migrationFee.feePercentage
    );
    const expectedQuoteAfterFees = new BN(sdkQuoteDecimal.floor().toFixed());

    const bigBuy = sim.step({ side: 'buy', amount: new BN('15000000000') });

    expect(bigBuy.isPartialFill).toBe(true);
    expect(sim.isGraduated).toBe(true);
    expect(sim.virtualPool.poolState.quoteReserve.toString()).toBe(sim.config.migrationQuoteThreshold.toString());

    const migrationData = sim.getMigrationData();
    expect(migrationData.migrationQuoteAmountAfterFees.toString()).toBe(expectedQuoteAfterFees.toString());
  });

  // --------------------------------------------------------------------------
  // EXISTING TESTS (Renamed PRNG test to say it tests PRNG only)
  // --------------------------------------------------------------------------
  it('PRNG only: Seeded Mulberry32 determinism and repeatability', () => {
    const rng1 = new Mulberry32(12345);
    const rng2 = new Mulberry32(12345);

    const f1 = Array.from({ length: 10 }, () => rng1.next());
    const f2 = Array.from({ length: 10 }, () => rng2.next());
    expect(f1).toEqual(f2);

    const i1 = Array.from({ length: 10 }, () => rng1.nextInt(10, 100));
    const i2 = Array.from({ length: 10 }, () => rng2.nextInt(10, 100));
    expect(i1).toEqual(i2);
  });
});
