import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  DynamicBondingCurveClient,
  buildCurveWithMarketCap,
  deriveDbcPoolAddress,
} from '@meteora-ag/dynamic-bonding-curve-sdk';

const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112');

async function main() {
  console.log('================================================================');
  console.log('  WINDTUNNEL DEVNET DEPLOYMENT (DBC Partner Config & Pool)');
  console.log('================================================================\n');

  // 1. Load keypair
  const keypairPath = process.env.WALLET_KEYPAIR_PATH ||
    path.join(os.homedir(), '.config', 'solana', 'devnet-windtunnel.json');

  if (!fs.existsSync(keypairPath)) {
    throw new Error(`Keypair not found at ${keypairPath}`);
  }

  const secretKey = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log('Loaded Devnet Wallet:', wallet.publicKey.toBase58());

  // 2. Connect to Solana devnet
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  console.log('Solana RPC:', rpcUrl);
  const connection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });

  const balanceLamports = await connection.getBalance(wallet.publicKey);
  const balanceSol = balanceLamports / 1e9;
  console.log(`Devnet SOL Balance: ${balanceSol} SOL (${balanceLamports} lamports)`);
  if (balanceSol < 0.2) {
    throw new Error('Insufficient devnet SOL balance for deployment (minimum 0.2 SOL required).');
  }

  // 3. Prepare DBC client and curve configuration
  const client = DynamicBondingCurveClient.create(connection);

  const baseFeeParams = {
    baseFeeMode: 0, // Linear Fee Scheduler
    feeSchedulerParam: {
      startingFeeBps: 500, // 5.0%
      endingFeeBps: 100,   // 1.0%
      numberOfPeriod: 10,
      totalDuration: 1000,
    },
  };

  const migration = {
    migrationOption: 1, // MET_DAMM_V2
    migrationFeeOption: 3, // FixedBps200 (2.0%)
    migrationFee: {
      feePercentage: 2,
      creatorFeePercentage: 0,
    },
    migratedPoolFee: {
      collectFeeMode: 0,
      dynamicFee: 0,
      poolFeeBps: 100, // 1.0% in DAMM v2
      baseFeeMode: 0,
    },
  };

  const initialMarketCap = 0.2;  // 0.2 SOL initial market cap
  const migrationMarketCap = 0.5; // 0.5 SOL migration market cap
  const totalTokenSupply = 1000000000;
  const leftover = 100000000; // 10% leftover allocated to wallet buffer

  console.log('\nCurve parameters:');
  console.log(`  - Token supply: ${totalTokenSupply.toLocaleString()} WIND (6 decimals)`);
  console.log(`  - Leftover buffer: ${leftover.toLocaleString()} WIND`);
  console.log(`  - Quote: SOL (${NATIVE_MINT.toBase58()})`);
  console.log(`  - Initial Market Cap: ${initialMarketCap} SOL`);
  console.log(`  - Migration Market Cap: ${migrationMarketCap} SOL`);
  console.log(`  - Fee: Linear scheduler 500 bps -> 100 bps`);
  console.log(`  - Migration target: Meteora DAMM v2 (2% migration fee)`);

  const curveParams = buildCurveWithMarketCap({
    token: {
      tokenType: 0, // Standard SPL Token
      tokenBaseDecimal: 6,
      tokenQuoteDecimal: 9,
      tokenAuthorityOption: 2, // PartnerUpdateAuthority
      totalTokenSupply,
      leftover,
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
    activationType: 0, // Timestamp
    initialMarketCap,
    migrationMarketCap,
  });

  const migrationThresholdLamports = curveParams.migrationQuoteThreshold.toString();
  console.log(`  - Migration Quote Threshold: ${migrationThresholdLamports} lamports (~ ${Number(migrationThresholdLamports) / 1e9} SOL)\n`);

  const configKeypair = Keypair.generate();
  const baseMintKeypair = Keypair.generate();

  console.log('Generating keys:');
  console.log('  Config Public Key:', configKeypair.publicKey.toBase58());
  console.log('  Base Mint Public Key:', baseMintKeypair.publicKey.toBase58());

  // 4. Build transactions
  console.log('\nBuilding DBC partner config and pool transactions via SDK...');
  const { createConfigTx, createPoolWithFirstBuyTx } = await client.partner.createConfigAndPoolWithFirstBuy({
    ...curveParams,
    config: configKeypair.publicKey,
    feeClaimer: wallet.publicKey,
    leftoverReceiver: wallet.publicKey,
    quoteMint: NATIVE_MINT,
    payer: wallet.publicKey,
    preCreatePoolParam: {
      name: 'WindTunnel Devnet Token',
      symbol: 'WIND',
      uri: 'https://windtunnel.finance/token.json',
      baseMint: baseMintKeypair.publicKey,
      poolCreator: wallet.publicKey,
    },
  });

  // 5. Send Transaction 1: Create Config
  console.log('\n[Transaction 1/2] Creating Partner Config on devnet...');
  console.log('  Signers: Payer (' + wallet.publicKey.toBase58() + '), Config (' + configKeypair.publicKey.toBase58() + ')');
  const latestBlockhash1 = await connection.getLatestBlockhash('confirmed');
  createConfigTx.recentBlockhash = latestBlockhash1.blockhash;
  createConfigTx.feePayer = wallet.publicKey;

  const configTxSig = await sendAndConfirmTransaction(
    connection,
    createConfigTx,
    [wallet, configKeypair],
    { commitment: 'confirmed' }
  );
  console.log('  Transaction confirmed!');
  console.log('  Signature:', configTxSig);
  console.log(`  Explorer: https://explorer.solana.com/tx/${configTxSig}?cluster=devnet`);

  // 6. Send Transaction 2: Create Pool
  console.log('\n[Transaction 2/2] Creating Base Mint & DBC Virtual Pool on devnet...');
  console.log('  Signers: Payer (' + wallet.publicKey.toBase58() + '), Base Mint (' + baseMintKeypair.publicKey.toBase58() + ')');
  const latestBlockhash2 = await connection.getLatestBlockhash('confirmed');
  createPoolWithFirstBuyTx.recentBlockhash = latestBlockhash2.blockhash;
  createPoolWithFirstBuyTx.feePayer = wallet.publicKey;

  const poolTxSig = await sendAndConfirmTransaction(
    connection,
    createPoolWithFirstBuyTx,
    [wallet, baseMintKeypair],
    { commitment: 'confirmed' }
  );
  console.log('  Transaction confirmed!');
  console.log('  Signature:', poolTxSig);
  console.log(`  Explorer: https://explorer.solana.com/tx/${poolTxSig}?cluster=devnet`);

  // 7. Verify pool on-chain
  const poolAddress = deriveDbcPoolAddress(NATIVE_MINT, baseMintKeypair.publicKey, configKeypair.publicKey);
  console.log('\nDerived Pool Address:', poolAddress.toBase58());

  console.log('Fetching on-chain pool state to verify...');
  const poolData = await client.state.getPool(poolAddress);
  if (!poolData) throw new Error('Pool not found on devnet');
  console.log('Pool successfully verified on devnet:');
  console.log('  Base Reserve:', poolData.poolState.baseReserve.toString());
  console.log('  Quote Reserve:', poolData.poolState.quoteReserve.toString());
  console.log('  Sqrt Price:', poolData.poolState.sqrtPrice.toString());
  console.log('  Activation Point:', poolData.poolState.activationPoint.toString());

  // 8. Save deployment addresses to .deployed.json
  const deploymentRecord = {
    network: 'devnet',
    timestamp: new Date().toISOString(),
    payer: wallet.publicKey.toBase58(),
    config: configKeypair.publicKey.toBase58(),
    pool: poolAddress.toBase58(),
    baseMint: baseMintKeypair.publicKey.toBase58(),
    quoteMint: NATIVE_MINT.toBase58(),
    migrationThresholdLamports,
    initialMarketCap,
    migrationMarketCap,
    txSignatures: {
      createConfig: configTxSig,
      createPool: poolTxSig,
    },
    explorerUrls: {
      config: `https://explorer.solana.com/address/${configKeypair.publicKey.toBase58()}?cluster=devnet`,
      pool: `https://explorer.solana.com/address/${poolAddress.toBase58()}?cluster=devnet`,
      baseMint: `https://explorer.solana.com/address/${baseMintKeypair.publicKey.toBase58()}?cluster=devnet`,
      createConfigTx: `https://explorer.solana.com/tx/${configTxSig}?cluster=devnet`,
      createPoolTx: `https://explorer.solana.com/tx/${poolTxSig}?cluster=devnet`,
    },
  };

  const deployedJsonPath = path.join(process.cwd(), '.deployed.json');
  fs.writeFileSync(deployedJsonPath, JSON.stringify(deploymentRecord, null, 2), 'utf8');
  console.log(`\nSaved deployment metadata to ${deployedJsonPath}`);

  // Also write to .env
  const envContent = `SOLANA_RPC_URL=${rpcUrl}
WALLET_KEYPAIR_PATH=${keypairPath}
DEPLOYED_CONFIG_PUBKEY=${configKeypair.publicKey.toBase58()}
DEPLOYED_POOL_PUBKEY=${poolAddress.toBase58()}
DEPLOYED_BASE_MINT=${baseMintKeypair.publicKey.toBase58()}
DEPLOYED_QUOTE_MINT=${NATIVE_MINT.toBase58()}
MIGRATION_THRESHOLD_LAMPORTS=${migrationThresholdLamports}
`;
  fs.writeFileSync(path.join(process.cwd(), '.env'), envContent, 'utf8');
  console.log('Saved .env file with active deployment addresses.');

  console.log('\n================================================================');
  console.log('  DEPLOYMENT SUMMARY');
  console.log('================================================================');
  console.log(`  Pool Address: ${poolAddress.toBase58()}`);
  console.log(`  Pool Explorer: ${deploymentRecord.explorerUrls.pool}`);
  console.log(`  Config Address: ${configKeypair.publicKey.toBase58()}`);
  console.log(`  Config Explorer: ${deploymentRecord.explorerUrls.config}`);
  console.log(`  Base Mint: ${baseMintKeypair.publicKey.toBase58()}`);
  console.log(`  Base Mint Explorer: ${deploymentRecord.explorerUrls.baseMint}`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\nDeployment Error:', err);
  process.exit(1);
});
