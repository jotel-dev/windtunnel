import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  Connection,
  Keypair,
  PublicKey,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  DynamicBondingCurveClient,
  buildCurveWithMarketCap,
  SwapMode,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import BN from 'bn.js';
import { VirtualPoolSimulator } from '../src/index.js';

interface ComparisonRecord {
  tradeIndex: number;
  direction: 'buy' | 'sell';
  amountIn: string;
  txSignature: string;
  explorerUrl: string;
  chain: {
    sqrtPrice: string;
    baseReserve: string;
    quoteReserve: string;
    protocolQuoteFee: string;
    creatorQuoteFee: string;
    partnerQuoteFee: string;
  };
  sim: {
    sqrtPrice: string;
    baseReserve: string;
    quoteReserve: string;
    protocolQuoteFee: string;
    creatorQuoteFee: string;
    partnerQuoteFee: string;
    amountOut: string;
    fee: string;
  };
  deltas: {
    sqrtPriceDelta: string;
    quoteReserveDelta: string;
    baseReserveChangeDelta: string;
    protocolFeeDelta: string;
    creatorFeeDelta: string;
    partnerFeeDelta: string;
  };
}

async function main() {
  console.log('================================================================');
  console.log('  WINDTUNNEL DEVNET LIVE TRADING & OBSERVATION (PART B)');
  console.log('================================================================\n');

  // 1. Load deployment metadata
  const deployedPath = path.join(process.cwd(), '.deployed.json');
  if (!fs.existsSync(deployedPath)) {
    throw new Error('Deployment metadata (.deployed.json) not found. Run devnet-deploy.ts first.');
  }

  const deployed = JSON.parse(fs.readFileSync(deployedPath, 'utf8'));
  const poolPubkey = new PublicKey(deployed.pool);
  const configPubkey = new PublicKey(deployed.config);
  console.log('Loaded Deployed Pool:', poolPubkey.toBase58());
  console.log('Loaded Deployed Config:', configPubkey.toBase58());
  console.log('Migration Threshold:', deployed.migrationThresholdLamports, 'lamports');

  // 2. Load wallet keypair
  const keypairPath = process.env.WALLET_KEYPAIR_PATH ||
    path.join(os.homedir(), '.config', 'solana', 'devnet-windtunnel.json');

  const wallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, 'utf8'))));
  console.log('Wallet:', wallet.publicKey.toBase58());

  // 3. Connect to Solana devnet
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  console.log('Solana RPC:', rpcUrl);
  const connection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });

  const balanceLamports = await connection.getBalance(wallet.publicKey);
  console.log(`Devnet SOL Balance: ${balanceLamports / 1e9} SOL (${balanceLamports} lamports)\n`);

  // 4. Fetch initial on-chain pool state
  const client = DynamicBondingCurveClient.create(connection);
  const initialPoolData = await client.state.getPool(poolPubkey);
  if (!initialPoolData) throw new Error('Pool not found on devnet');

  const initialChainState = initialPoolData.poolState;
  console.log('Initial On-Chain Pool State:');
  console.log('  Sqrt Price:       ', initialChainState.sqrtPrice.toString());
  console.log('  Base Reserve:     ', initialChainState.baseReserve.toString());
  console.log('  Quote Reserve:    ', initialChainState.quoteReserve.toString());
  console.log('  Protocol Quote Fee:', initialChainState.protocolQuoteFee.toString());
  console.log('  Creator Quote Fee: ', initialChainState.creatorQuoteFee.toString());
  console.log('  Partner Quote Fee: ', initialChainState.partnerQuoteFee.toString());
  console.log('  Activation Point: ', initialChainState.activationPoint.toString());

  // 5. Build identical curve params for VirtualPoolSimulator
  const baseFeeParams = {
    baseFeeMode: 0,
    feeSchedulerParam: {
      startingFeeBps: 500,
      endingFeeBps: 100,
      numberOfPeriod: 10,
      totalDuration: 1000,
    },
  };

  const migration = {
    migrationOption: 1,
    migrationFeeOption: 3,
    migrationFee: { feePercentage: 2, creatorFeePercentage: 0 },
    migratedPoolFee: {
      collectFeeMode: 0,
      dynamicFee: 0,
      poolFeeBps: 100,
      baseFeeMode: 0,
    },
  };

  const curveParams = buildCurveWithMarketCap({
    token: {
      tokenType: 0,
      tokenBaseDecimal: 6,
      tokenQuoteDecimal: 9,
      tokenAuthorityOption: 2,
      totalTokenSupply: 1000000000,
      leftover: 100000000,
    },
    fee: {
      baseFeeParams,
      dynamicFeeEnabled: false,
      collectFeeMode: 0,
      creatorTradingFeePercentage: 20,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration,
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 100,
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
    activationType: 0,
    initialMarketCap: 0.2,
    migrationMarketCap: 0.5,
  });

  const sim = new VirtualPoolSimulator(curveParams, {
    slot: 0,
    timestamp: Number(initialChainState.activationPoint),
  });

  console.log('\nInitialized VirtualPoolSimulator with matching config.');
  console.log('  Simulator Sqrt Price:  ', sim.getSnapshot().sqrtPrice.toString());
  console.log('  Simulator Base Reserve:', sim.getSnapshot().baseReserve.toString());
  console.log('  Simulator Quote Reserve:', sim.getSnapshot().quoteReserve.toString());

  // Check initial sqrt price equality
  if (sim.getSnapshot().sqrtPrice.eq(initialChainState.sqrtPrice)) {
    console.log('  [CONFIRMED] Initial sqrtPrice matches on-chain exactly!\n');
  } else {
    console.log(`  [NOTE] SqrtPrice difference: sim=${sim.getSnapshot().sqrtPrice}, chain=${initialChainState.sqrtPrice}\n`);
  }

  // 6. Define trade plan
  // Trade 1: Buy 0.04 SOL
  // Trade 2: Buy 0.05 SOL
  // Trade 3: Sell fraction of acquired tokens
  // Trade 4: Buy 0.03 SOL
  const tradePlan: Array<{ direction: 'buy' | 'sell'; quoteLamports?: number; baseFraction?: number }> = [
    { direction: 'buy', quoteLamports: 40_000_000 }, // 0.04 SOL
    { direction: 'buy', quoteLamports: 50_000_000 }, // 0.05 SOL
    { direction: 'sell', baseFraction: 0.25 },        // Sell 25% of tokens held
    { direction: 'buy', quoteLamports: 30_000_000 }, // 0.03 SOL
  ];

  let cumulativeBaseTokensBought = new BN(0);
  let previousChainBaseReserve = initialChainState.baseReserve.clone();
  const comparisonResults: ComparisonRecord[] = [];

  for (let i = 0; i < tradePlan.length; i++) {
    const item = tradePlan[i];
    const tradeNum = i + 1;
    console.log('----------------------------------------------------------------');
    console.log(`[Trade ${tradeNum}/${tradePlan.length}] Preparing ${item.direction.toUpperCase()}...`);

    let amountIn: BN;
    if (item.direction === 'buy') {
      amountIn = new BN(item.quoteLamports!);
      console.log(`  Action: BUY with ${amountIn.toString()} lamports (${amountIn.toNumber() / 1e9} SOL)`);
    } else {
      // Calculate 25% of tokens bought
      amountIn = cumulativeBaseTokensBought.mul(new BN(25)).div(new BN(100));
      console.log(`  Action: SELL ${amountIn.toString()} base tokens (~ ${amountIn.toNumber() / 1e6} WIND)`);
    }

    // Step the simulator first to get predicted output & state
    const simStepResult = sim.step({
      side: item.direction,
      amount: amountIn,
      mode: 'exactIn',
    });

    const expectedAmountOut = simStepResult.quoteResult.outputAmount;
    const expectedFee = simStepResult.quoteResult.tradingFee;
    const simSnapshot = sim.getSnapshot();
    const expectedNextSqrtPrice = simSnapshot.sqrtPrice;
    const expectedNextQuoteReserve = simSnapshot.quoteReserve;
    const expectedNextBaseReserve = simSnapshot.baseReserve;

    console.log('  Simulator prediction:');
    console.log(`    Amount Out:         ${expectedAmountOut.toString()}`);
    console.log(`    Fee:                ${expectedFee.toString()}`);
    console.log(`    Next Sqrt Price:    ${expectedNextSqrtPrice.toString()}`);
    console.log(`    Next Quote Reserve: ${expectedNextQuoteReserve.toString()}`);
    console.log(`    Next Base Reserve:  ${expectedNextBaseReserve.toString()}`);

    // Build real swap on-chain
    console.log('  Building on-chain swap transaction...');
    const swapTx = await client.pool.swap2({
      pool: poolPubkey,
      swapBaseForQuote: item.direction === 'sell',
      swapMode: SwapMode.ExactIn,
      amountIn,
      minimumAmountOut: new BN(0),
      owner: wallet.publicKey,
      payer: wallet.publicKey,
      referralTokenAccount: null,
    });

    const bh = await connection.getLatestBlockhash('confirmed');
    swapTx.feePayer = wallet.publicKey;
    swapTx.recentBlockhash = bh.blockhash;
    swapTx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));

    console.log('  Sending transaction to devnet...');
    const txSig = await sendAndConfirmTransaction(connection, swapTx, [wallet], {
      commitment: 'confirmed',
    });
    console.log('  Transaction confirmed!');
    console.log('  Signature:', txSig);
    console.log(`  Explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);

    // Fetch updated on-chain pool state
    const updatedPoolData = await client.state.getPool(poolPubkey);
    if (!updatedPoolData) throw new Error('Failed to fetch updated pool state');
    const updatedChain = updatedPoolData.poolState;

    // Track acquired base tokens
    if (item.direction === 'buy') {
      const baseOut = previousChainBaseReserve.sub(updatedChain.baseReserve);
      cumulativeBaseTokensBought = cumulativeBaseTokensBought.add(baseOut);
    } else {
      cumulativeBaseTokensBought = cumulativeBaseTokensBought.sub(amountIn);
    }
    const chainBaseReserveDelta = previousChainBaseReserve.sub(updatedChain.baseReserve).abs();
    previousChainBaseReserve = updatedChain.baseReserve.clone();

    // Compute deltas between chain and simulator
    const sqrtPriceDelta = updatedChain.sqrtPrice.sub(expectedNextSqrtPrice);
    const quoteReserveDelta = updatedChain.quoteReserve.sub(expectedNextQuoteReserve);
    const baseReserveChangeDelta = chainBaseReserveDelta.sub(expectedAmountOut);

    const simAccumFees = simSnapshot.accumulatedFees;
    const protocolFeeDelta = updatedChain.protocolQuoteFee.sub(simAccumFees.protocolQuoteFee);
    const creatorFeeDelta = updatedChain.creatorQuoteFee.sub(simAccumFees.creatorQuoteFee);
    const partnerFeeDelta = updatedChain.partnerQuoteFee.sub(simAccumFees.partnerQuoteFee);

    console.log('\n  === COMPARISON: On-Chain vs Simulator ===');
    console.log(`    Sqrt Price:
      On-Chain:  ${updatedChain.sqrtPrice.toString()}
      Simulator: ${expectedNextSqrtPrice.toString()}
      Delta:     ${sqrtPriceDelta.toString()} (${sqrtPriceDelta.isZero() ? 'EXACT MATCH' : 'DIVERGENCE'})`);
    console.log(`    Quote Reserve:
      On-Chain:  ${updatedChain.quoteReserve.toString()}
      Simulator: ${expectedNextQuoteReserve.toString()}
      Delta:     ${quoteReserveDelta.toString()} (${quoteReserveDelta.isZero() ? 'EXACT MATCH' : 'DIVERGENCE'})`);
    console.log(`    Base Output (Reserve Change):
      On-Chain:  ${chainBaseReserveDelta.toString()}
      Simulator: ${expectedAmountOut.toString()}
      Delta:     ${baseReserveChangeDelta.toString()} (${baseReserveChangeDelta.isZero() ? 'EXACT MATCH' : 'DIVERGENCE'})`);
    console.log(`    Accumulated Protocol Fee:
      On-Chain:  ${updatedChain.protocolQuoteFee.toString()}
      Simulator: ${simAccumFees.protocolQuoteFee.toString()}
      Delta:     ${protocolFeeDelta.toString()} (${protocolFeeDelta.isZero() ? 'EXACT MATCH' : 'DIVERGENCE'})`);
    console.log(`    Accumulated Creator Fee:
      On-Chain:  ${updatedChain.creatorQuoteFee.toString()}
      Simulator: ${simAccumFees.creatorQuoteFee.toString()}
      Delta:     ${creatorFeeDelta.toString()} (${creatorFeeDelta.isZero() ? 'EXACT MATCH' : 'DIVERGENCE'})`);
    console.log(`    Accumulated Partner Fee:
      On-Chain:  ${updatedChain.partnerQuoteFee.toString()}
      Simulator: ${simAccumFees.partnerQuoteFee.toString()}
      Delta:     ${partnerFeeDelta.toString()} (${partnerFeeDelta.isZero() ? 'EXACT MATCH' : 'DIVERGENCE'})`);

    comparisonResults.push({
      tradeIndex: tradeNum,
      direction: item.direction,
      amountIn: amountIn.toString(),
      txSignature: txSig,
      explorerUrl: `https://explorer.solana.com/tx/${txSig}?cluster=devnet`,
      chain: {
        sqrtPrice: updatedChain.sqrtPrice.toString(),
        baseReserve: updatedChain.baseReserve.toString(),
        quoteReserve: updatedChain.quoteReserve.toString(),
        protocolQuoteFee: updatedChain.protocolQuoteFee.toString(),
        creatorQuoteFee: updatedChain.creatorQuoteFee.toString(),
        partnerQuoteFee: updatedChain.partnerQuoteFee.toString(),
      },
      sim: {
        sqrtPrice: expectedNextSqrtPrice.toString(),
        baseReserve: expectedNextBaseReserve.toString(),
        quoteReserve: expectedNextQuoteReserve.toString(),
        protocolQuoteFee: simAccumFees.protocolQuoteFee.toString(),
        creatorQuoteFee: simAccumFees.creatorQuoteFee.toString(),
        partnerQuoteFee: simAccumFees.partnerQuoteFee.toString(),
        amountOut: expectedAmountOut.toString(),
        fee: expectedFee.toString(),
      },
      deltas: {
        sqrtPriceDelta: sqrtPriceDelta.toString(),
        quoteReserveDelta: quoteReserveDelta.toString(),
        baseReserveChangeDelta: baseReserveChangeDelta.toString(),
        protocolFeeDelta: protocolFeeDelta.toString(),
        creatorFeeDelta: creatorFeeDelta.toString(),
        partnerFeeDelta: partnerFeeDelta.toString(),
      },
    });
  }

  // Save comparison results
  const resultsPath = path.join(process.cwd(), '.trade-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(comparisonResults, null, 2), 'utf8');
  console.log(`\nSaved comparison results to ${resultsPath}`);

  console.log('\n================================================================');
  console.log('  PART B OBSERVATION COMPLETE');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\nTrade Execution Error:', err);
  process.exit(1);
});
