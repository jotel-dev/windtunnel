const { Connection, PublicKey } = require('@solana/web3.js');
const { DynamicBondingCurveClient } = require('@meteora-ag/dynamic-bonding-curve-sdk');

async function main() {
  const rpcs = [
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana',
    'https://solana-mainnet.rpc.extrnode.com'
  ];

  let config = null;
  const configPubkey = new PublicKey('HRTdrgErgvNtBabEQjtZusdvkm7FXYipjGh8BEdRPECf');

  for (const rpc of rpcs) {
    try {
      console.log(`Attempting connection to ${rpc}...`);
      const connection = new Connection(rpc, 'confirmed');
      const client = DynamicBondingCurveClient.create(connection);
      config = await client.state.getPoolConfig(configPubkey);
      if (config) {
        console.log(`Successfully fetched config from ${rpc}`);
        break;
      }
    } catch (e) {
      console.log(`Failed on ${rpc}: ${e.message}`);
    }
  }

  if (!config) {
    throw new Error('Failed to fetch config from all RPC endpoints.');
  }

  console.log('================================================================');
  console.log('MAINNET ON-CHAIN CONFIG ACCOUNT AUDIT');
  console.log('Config Pubkey:', configPubkey.toBase58());
  console.log('================================================================');

  const baseFee = config.poolFees.baseFee;
  const cliffNum = baseFee.cliffFeeNumerator.toNumber();
  const numPeriods = baseFee.firstFactor;
  const periodFreq = baseFee.secondFactor.toNumber();
  const reduction = baseFee.thirdFactor.toNumber();
  const mode = baseFee.baseFeeMode;

  const startingFeeBps = cliffNum / 100000;
  const totalDuration = numPeriods * periodFreq;
  const endingFeeBps = (cliffNum - (numPeriods * reduction)) / 100000;

  console.log('\n--- 1. BASE FEE PARAMETERS (On-Chain Decoded) ---');
  console.log(`Starting Fee:         ${startingFeeBps} bps (${(startingFeeBps / 100).toFixed(2)}%)`);
  console.log(`Ending Fee (Floor):   ${endingFeeBps} bps (${(endingFeeBps / 100).toFixed(2)}%)`);
  console.log(`Number of Periods:    ${numPeriods}`);
  console.log(`Period Frequency:     ${periodFreq} slots`);
  console.log(`Total Duration:       ${totalDuration} slots (~${((totalDuration * 0.4) / 60).toFixed(1)} minutes)`);
  console.log(`Base Fee Mode:        ${mode} (${mode === 0 ? 'FeeSchedulerLinear' : 'FeeSchedulerExponential'})`);

  console.log('\n--- 2. CREATOR & PROTOCOL FEE SHARES ---');
  console.log(`Creator Trading Fee:  ${config.creatorTradingFeePercentage}%`);
  console.log(`Fee Claimer:          ${config.feeClaimer}`);
  console.log(`Leftover Receiver:    ${config.leftoverReceiver}`);

  console.log('\n--- 3. MIGRATION & LIQUIDITY DISTRIBUTION ---');
  console.log(`Migration Option:     ${config.migrationOption} (${config.migrationOption === 1 ? 'MET_DAMM_V2' : config.migrationOption})`);
  console.log(`Migration Fee Option: ${config.migrationFeeOption} (${config.migrationFeeOption === 3 ? 'FixedBps200 (2.0%)' : config.migrationFeeOption})`);
  console.log(`Partner Locked LP %:  ${config.partnerPermanentLockedLiquidityPercentage}%`);
  console.log(`Creator Locked LP %:  ${config.creatorPermanentLockedLiquidityPercentage}%`);

  console.log('\n--- 4. CURVE & SUPPLY PARAMETERS ---');
  console.log(`Token Decimals:       ${config.tokenDecimal}`);
  console.log(`Pre-Migration Supply: ${config.preMigrationTokenSupply.toString()} raw (${(Number(config.preMigrationTokenSupply.toString()) / 1e6).toLocaleString()} tokens)`);
  console.log(`Swap Base Amount:     ${config.swapBaseAmount.toString()} raw (${(Number(config.swapBaseAmount.toString()) / 1e6).toLocaleString()} tokens for bonding curve)`);
  console.log(`Migration Quote Min:  ${config.migrationQuoteThreshold.toString()} lamports (${(config.migrationQuoteThreshold.toNumber() / 1e9).toFixed(6)} SOL)`);
  console.log(`Start Sqrt Price:     0x${config.sqrtStartPrice.toString(16)}`);
  console.log(`Migration Sqrt Price: 0x${config.migrationSqrtPrice.toString(16)}`);
  console.log('Curve Points:');
  config.curve.slice(0, 3).forEach((pt, i) => {
    if (pt.sqrtPrice.toString() !== '0' || pt.liquidity.toString() !== '0') {
      console.log(`  Point ${i}: sqrtPrice=0x${pt.sqrtPrice.toString(16)}, liquidity=0x${pt.liquidity.toString(16)}`);
    }
  });

  console.log('================================================================');
}

main().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
