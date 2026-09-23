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
  SwapMode,
  deriveDammV2PoolAddress,
  DAMM_V2_MIGRATION_FEE_ADDRESS,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import {
  CpAmm,
  MIN_SQRT_PRICE,
  MAX_SQRT_PRICE,
} from '@meteora-ag/cp-amm-sdk';
import BN from 'bn.js';

async function main() {
  console.log('================================================================');
  console.log('  WINDTUNNEL DEVNET GRADUATION & DAMM V2 MIGRATION (PART C)');
  console.log('================================================================\n');

  // 1. Load deployment metadata
  const deployedPath = path.join(process.cwd(), '.deployed.json');
  if (!fs.existsSync(deployedPath)) {
    throw new Error('Deployment metadata (.deployed.json) not found.');
  }

  const deployed = JSON.parse(fs.readFileSync(deployedPath, 'utf8'));
  const poolPubkey = new PublicKey(deployed.pool);
  const baseMint = new PublicKey(deployed.baseMint);
  const quoteMint = new PublicKey(deployed.quoteMint);
  const threshold = new BN(deployed.migrationThresholdLamports);

  console.log('Target DBC Pool:', poolPubkey.toBase58());
  console.log('Base Mint (WIND):', baseMint.toBase58());
  console.log('Quote Mint (SOL):', quoteMint.toBase58());
  console.log('Migration Threshold:', threshold.toString(), 'lamports (~', threshold.toNumber() / 1e9, 'SOL)');

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

  // 4. Inspect current DBC pool state
  const dbcClient = DynamicBondingCurveClient.create(connection);
  const poolData = await dbcClient.state.getPool(poolPubkey);
  if (!poolData) throw new Error('Pool not found on devnet');

  let currentQuoteReserve = poolData.poolState.quoteReserve;
  console.log('Current DBC Pool State:');
  console.log('  Quote Reserve:      ', currentQuoteReserve.toString(), 'lamports');
  console.log('  Base Reserve:       ', poolData.poolState.baseReserve.toString());
  console.log('  Sqrt Price:         ', poolData.poolState.sqrtPrice.toString());
  console.log('  Migration Progress: ', poolData.poolState.migrationProgress);
  console.log('  Is Migrated:        ', poolData.poolState.isMigrated);

  let gradTxSig: string | null = null;

  // 5. If not graduated, execute graduation push swap using SwapMode.PartialFill
  if (currentQuoteReserve.lt(threshold)) {
    const remainingQuote = threshold.sub(currentQuoteReserve);
    console.log(`\n[Step 1/2] Pool requires ${remainingQuote.toString()} lamports (~ ${remainingQuote.toNumber() / 1e9} SOL) to graduate.`);

    // Add small buffer for fee so partial fill cleanly hits threshold
    const quoteIn = remainingQuote.mul(new BN(102)).div(new BN(99));
    console.log(`  Executing PartialFill buy with ${quoteIn.toString()} lamports (~ ${quoteIn.toNumber() / 1e9} SOL)...`);

    const swapTx = await dbcClient.pool.swap2({
      pool: poolPubkey,
      swapBaseForQuote: false,
      swapMode: SwapMode.PartialFill, // 1
      amountIn: quoteIn,
      minimumAmountOut: new BN(0),
      owner: wallet.publicKey,
      payer: wallet.publicKey,
      referralTokenAccount: null,
    });

    const bh = await connection.getLatestBlockhash('confirmed');
    swapTx.feePayer = wallet.publicKey;
    swapTx.recentBlockhash = bh.blockhash;
    swapTx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));

    console.log('  Sending graduation push swap transaction to devnet...');
    gradTxSig = await sendAndConfirmTransaction(connection, swapTx, [wallet], {
      commitment: 'confirmed',
    });
    console.log('  Transaction confirmed!');
    console.log('  Signature:', gradTxSig);
    console.log(`  Explorer: https://explorer.solana.com/tx/${gradTxSig}?cluster=devnet`);

    // Verify graduated pool state
    const afterSwap = await dbcClient.state.getPool(poolPubkey);
    if (!afterSwap) throw new Error('Failed to fetch pool after graduation swap');
    currentQuoteReserve = afterSwap.poolState.quoteReserve;
    console.log('\nUpdated Pool State after graduation push:');
    console.log('  Quote Reserve:      ', currentQuoteReserve.toString());
    console.log('  Base Reserve:       ', afterSwap.poolState.baseReserve.toString());
    console.log('  Sqrt Price:         ', afterSwap.poolState.sqrtPrice.toString());
    console.log('  Migration Progress: ', afterSwap.poolState.migrationProgress);
    console.log('  Finish Curve Time:  ', afterSwap.poolState.finishCurveTimestamp.toString());
  } else {
    console.log('\nPool has already reached the migration threshold (Migration Progress = ' + poolData.poolState.migrationProgress + ')!');
  }

  // 6. Trigger migration to Meteora DAMM v2
  console.log('----------------------------------------------------------------');
  console.log('[Step 2/2] Triggering Migration to Meteora DAMM v2...');

  // Use the canonical DAMM v2 migration fee config for migrationFeeOption = 3 (FixedBps200 = 2%)
  const dammConfig = DAMM_V2_MIGRATION_FEE_ADDRESS[3];
  console.log('Target DAMM v2 Config Address:', dammConfig.toBase58());

  const dammPoolAddress = deriveDammV2PoolAddress(dammConfig, baseMint, quoteMint);
  console.log('Target DAMM v2 Pool Address:', dammPoolAddress.toBase58());

  console.log('Building migration transaction via DBC SDK...');
  const {
    transaction: migrateTx,
    firstPositionNftKeypair,
    secondPositionNftKeypair,
  } = await dbcClient.migration.migrateToDammV2({
    pool: poolPubkey,
    dammConfig,
    payer: wallet.publicKey,
  });

  const bhMig = await connection.getLatestBlockhash('confirmed');
  migrateTx.feePayer = wallet.publicKey;
  migrateTx.recentBlockhash = bhMig.blockhash;
  
  console.log('Signers for Migration:');
  console.log('  Payer:               ', wallet.publicKey.toBase58());
  console.log('  First Position NFT:  ', firstPositionNftKeypair.publicKey.toBase58());
  console.log('  Second Position NFT: ', secondPositionNftKeypair.publicKey.toBase58());

  console.log('Sending migrateToDammV2 transaction to devnet...');
  const migTxSig = await sendAndConfirmTransaction(
    connection,
    migrateTx,
    [wallet, firstPositionNftKeypair, secondPositionNftKeypair],
    { commitment: 'confirmed' }
  );
  console.log('Migration transaction confirmed!');
  console.log('Signature:', migTxSig);
  console.log(`Explorer: https://explorer.solana.com/tx/${migTxSig}?cluster=devnet`);

  // 7. Fetch resulting DAMM v2 on-chain pool, config, and position state
  console.log('\n----------------------------------------------------------------');
  console.log('Fetching on-chain DAMM v2 config & pool state...');
  const cpAmmClient = new CpAmm(connection);

  const dammConfigState = await cpAmmClient.fetchConfigState(dammConfig);
  console.log('DAMM v2 Config State:');
  console.log('  Config Pubkey:      ', dammConfig.toBase58());
  console.log('  Config sqrtMinPrice:', dammConfigState.sqrtMinPrice.toString());
  console.log('  Config sqrtMaxPrice:', dammConfigState.sqrtMaxPrice.toString());

  const dammPoolState = await cpAmmClient.fetchPoolState(dammPoolAddress);
  console.log('\nDAMM v2 Pool State:');
  console.log('  Pool Address:       ', dammPoolAddress.toBase58());
  console.log('  Token A (Base):     ', dammPoolState.tokenAMint.toBase58());
  console.log('  Token B (Quote):    ', dammPoolState.tokenBMint.toBase58());
  console.log('  Starting Sqrt Price:', dammPoolState.sqrtPrice.toString());
  console.log('  Pool Liquidity:     ', dammPoolState.liquidity.toString());
  console.log('  Token A Vault:      ', dammPoolState.tokenAVault.toBase58());
  console.log('  Token B Vault:      ', dammPoolState.tokenBVault.toBase58());

  // Fetch on-chain positions
  console.log('\nFetching DAMM v2 positions for pool...');
  const positions = await cpAmmClient.getAllPositionsByPool(dammPoolAddress);
  console.log(`Found ${positions.length} position(s) in DAMM v2 pool:`);

  for (let idx = 0; idx < positions.length; idx++) {
    const pos = positions[idx];
    const acc = pos.account;
    const totalPosLiq = acc.unlockedLiquidity.add(acc.vestedLiquidity).add(acc.permanentLockedLiquidity);
    console.log(`\n  Position ${idx + 1}:`);
    console.log('    Position Pubkey:             ', pos.publicKey.toBase58());
    console.log('    NFT Mint:                    ', acc.nftMint.toBase58());
    console.log('    Unlocked Liquidity:          ', acc.unlockedLiquidity.toString());
    console.log('    Vested Liquidity:            ', acc.vestedLiquidity.toString());
    console.log('    Permanent Locked Liquidity:  ', acc.permanentLockedLiquidity.toString());
    console.log('    Total Position Liquidity:    ', totalPosLiq.toString());
  }

  // 8. Compare against Phase 3 assumptions
  console.log('\n================================================================');
  console.log('  COMPARISON: PHASE 3 ASSUMPTIONS VS ON-CHAIN DAMM V2');
  console.log('================================================================');
  console.log('Constants:');
  console.log('  Phase 3 / SDK MIN_SQRT_PRICE: ', MIN_SQRT_PRICE.toString());
  console.log('  Phase 3 / SDK MAX_SQRT_PRICE: ', MAX_SQRT_PRICE.toString());

  const isMinMatch = dammConfigState.sqrtMinPrice.eq(MIN_SQRT_PRICE);
  const isMaxMatch = dammConfigState.sqrtMaxPrice.eq(MAX_SQRT_PRICE);

  console.log(`\nLiquidity Bounds Comparison:
  On-Chain Config sqrtMinPrice: ${dammConfigState.sqrtMinPrice.toString()} (Matches MIN_SQRT_PRICE: ${isMinMatch})
  On-Chain Config sqrtMaxPrice: ${dammConfigState.sqrtMaxPrice.toString()} (Matches MAX_SQRT_PRICE: ${isMaxMatch})`);

  if (isMinMatch && isMaxMatch) {
    console.log('\n  >>> [CONFIRMED] DAMM v2 pool is 100% FULL-RANGE (MIN_SQRT_PRICE to MAX_SQRT_PRICE)! <<<');
  } else {
    console.log('\n  >>> [REVISED] Pool bounds differ from constants. See values above.');
  }

  // 9. Save migration verification record
  const migrationRecord = {
    network: 'devnet',
    timestamp: new Date().toISOString(),
    dbcPool: poolPubkey.toBase58(),
    dammPool: dammPoolAddress.toBase58(),
    dammConfig: dammConfig.toBase58(),
    txSignatures: {
      graduationSwap: gradTxSig,
      migration: migTxSig,
    },
    explorerUrls: {
      migrationTx: `https://explorer.solana.com/tx/${migTxSig}?cluster=devnet`,
      dammPool: `https://explorer.solana.com/address/${dammPoolAddress.toBase58()}?cluster=devnet`,
      dbcPool: `https://explorer.solana.com/address/${poolPubkey.toBase58()}?cluster=devnet`,
    },
    onChainDammV2: {
      sqrtPrice: dammPoolState.sqrtPrice.toString(),
      liquidity: dammPoolState.liquidity.toString(),
      tokenAMint: dammPoolState.tokenAMint.toBase58(),
      tokenBMint: dammPoolState.tokenBMint.toBase58(),
      configSqrtMinPrice: dammConfigState.sqrtMinPrice.toString(),
      configSqrtMaxPrice: dammConfigState.sqrtMaxPrice.toString(),
      positions: positions.map((p) => ({
        pubkey: p.publicKey.toBase58(),
        nftMint: p.account.nftMint.toBase58(),
        unlockedLiquidity: p.account.unlockedLiquidity.toString(),
        vestedLiquidity: p.account.vestedLiquidity.toString(),
        permanentLockedLiquidity: p.account.permanentLockedLiquidity.toString(),
      })),
    },
    comparisonWithPhase3: {
      minSqrtPriceConstant: MIN_SQRT_PRICE.toString(),
      maxSqrtPriceConstant: MAX_SQRT_PRICE.toString(),
      isFullRangeConfirmed: isMinMatch && isMaxMatch,
    },
  };

  const migResultsPath = path.join(process.cwd(), '.migration-results.json');
  fs.writeFileSync(migResultsPath, JSON.stringify(migrationRecord, null, 2), 'utf8');
  console.log(`\nSaved migration results to ${migResultsPath}`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\nMigration Error:', err);
  process.exit(1);
});
