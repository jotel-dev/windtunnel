import BN from 'bn.js';
import type { VolatilityTracker, DynamicFeeConfig } from '@meteora-ag/dynamic-bonding-curve-sdk';

/**
 * UNCONFIRMED Module:
 * Volatility tracker stepper across simulated block timestamps.
 * 
 * Context: The Meteora DBC TypeScript SDK calculates the variable dynamic fee
 * via getVariableFeeNumerator(dynamicFee, volatilityTracker), but does NOT export
 * an off-chain update function for mutating volatilityTracker across simulated blocks.
 *
 * This implementation models the on-chain EMA decay from Meteora dynamic fee specifications:
 * Source: https://docs.meteora.ag/core-products/dbc/fees/dynamic-fees.md
 */
export function createDefaultVolatilityTracker(sqrtPrice: BN, timestamp: number): VolatilityTracker {
  return {
    lastUpdateTimestamp: new BN(timestamp),
    sqrtPriceReference: sqrtPrice.clone(),
    volatilityAccumulator: new BN(0),
    volatilityReference: new BN(0),
    padding: [],
  };
}

export function updateVolatilityTracker(
  tracker: VolatilityTracker,
  dynamicFee: DynamicFeeConfig | undefined | null,
  currentPrice: BN,
  currentTimestamp: number
): VolatilityTracker {
  if (!dynamicFee || dynamicFee.initialized === 0) {
    return tracker;
  }

  const lastTime = tracker.lastUpdateTimestamp.toNumber();
  const elapsed = Math.max(0, currentTimestamp - lastTime);
  const filterPeriod = dynamicFee.filterPeriod;
  const decayPeriod = dynamicFee.decayPeriod;
  const reductionFactor = dynamicFee.reductionFactor; // in bps (max 10000)

  let newVolRef = tracker.volatilityReference;
  let newVolAcc = tracker.volatilityAccumulator;

  // If elapsed time exceeded decay period, decay volatility reference
  if (elapsed >= decayPeriod) {
    // Full decay
    newVolRef = new BN(0);
    newVolAcc = new BN(0);
  } else if (elapsed >= filterPeriod && decayPeriod > 0) {
    // Partial decay proportional to reduction factor
    newVolRef = newVolRef.mul(new BN(reductionFactor)).div(new BN(10000));
    newVolAcc = newVolRef.clone();
  }

  // Price movement impact (in price bins)
  const binStep = dynamicFee.binStep > 0 ? dynamicFee.binStep : 1;
  const priceDiff = currentPrice.gt(tracker.sqrtPriceReference)
    ? currentPrice.sub(tracker.sqrtPriceReference)
    : tracker.sqrtPriceReference.sub(currentPrice);

  // Approximate bin change: priceDiff / (sqrtPrice * binStep / 10000)
  if (!tracker.sqrtPriceReference.isZero()) {
    const binDelta = priceDiff
      .mul(new BN(10000))
      .div(tracker.sqrtPriceReference.mul(new BN(binStep)));

    newVolAcc = newVolAcc.add(binDelta);
    if (dynamicFee.maxVolatilityAccumulator > 0) {
      const maxAcc = new BN(dynamicFee.maxVolatilityAccumulator);
      if (newVolAcc.gt(maxAcc)) {
        newVolAcc = maxAcc;
      }
    }
  }

  return {
    lastUpdateTimestamp: new BN(currentTimestamp),
    sqrtPriceReference: currentPrice.clone(),
    volatilityAccumulator: newVolAcc,
    volatilityReference: newVolAcc,
    padding: tracker.padding,
  };
}
