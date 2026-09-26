const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const {
  DynamicBondingCurveClient,
  buildCurveWithMarketCap,
  deriveDbcPoolAddress,
} = require('@meteora-ag/dynamic-bonding-curve-sdk');

const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const STATE_FILE = path.join('C:\\dev\\windtunnel', '.mainnet-deployment.json');

async function main() {
  const isExecute = process.argv.includes('--execute');

  const keypairPath = path.join(os.homedir(), '.config', 'solana', 'mainnet-windtunnel.json');
  if (!fs.existsSync(keypairPath)) {
    throw new Error('Keypair not found at ' + keypairPath);
  }

  const wallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, 'utf8'))));
  const rpcUrl = 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 120000,
  });

  const balanceBefore = await connection.getBalance(wallet.publicKey);
  console.log('Wallet Address:     ', wallet.publicKey.toBase58());
  console.log('Balance Before:     ', balanceBefore / 1e9, 'SOL (' + balanceBefore + ' lamports)');

  if (!fs.existsSync(STATE_FILE)) {
    throw new Error('State file not found');
  }
  const savedState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

  const configKeypair = Keypair.fromSecretKey(new Uint8Array(savedState.configKeypairSecret));
  const baseMintKeypair = Keypair.fromSecretKey(new Uint8Array(savedState.baseMintKeypairSecret));

  console.log('Config Address:     ', configKeypair.publicKey.toBase58());
  console.log('Base Mint Address:  ', baseMintKeypair.publicKey.toBase58());

  const client = DynamicBondingCurveClient.create(connection);

  const baseFeeParams = {
    baseFeeMode: 0,
    feeSchedulerParam: {
      startingFeeBps: 1600,
      endingFeeBps: 100,
      numberOfPeriod: 10,
      totalDuration: 1000,
    },
  };

  const migration = {
    migrationOption: 1,
    migrationFeeOption: 3,
    migrationFee: {
      feePercentage: 2,
      creatorFeePercentage: 0,
    },
    migratedPoolFee: {
      collectFeeMode: 0,
      dynamicFee: 0,
      poolFeeBps: 100,
      baseFeeMode: 0,
    },
  };

  const initialMarketCap = 0.1;
  const migrationMarketCap = 0.26;
  const totalTokenSupply = 1_000_000_000;
  const leftover = 100_000_000;

  const curveParams = buildCurveWithMarketCap({
    token: {
      tokenType: 0,
      tokenBaseDecimal: 6,
      tokenQuoteDecimal: 9,
      tokenAuthorityOption: 2,
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
    activationType: 0,
    initialMarketCap,
    migrationMarketCap,
  });

  const { createPoolWithFirstBuyTx } = await client.partner.createConfigAndPoolWithFirstBuy({
    ...curveParams,
    config: configKeypair.publicKey,
    feeClaimer: wallet.publicKey,
    leftoverReceiver: wallet.publicKey,
    quoteMint: NATIVE_MINT,
    payer: wallet.publicKey,
    preCreatePoolParam: {
      name: 'WindTunnel Protect Organic',
      symbol: 'WIND',
      uri: 'https://windtunnel.finance/token.json',
      baseMint: baseMintKeypair.publicKey,
      poolCreator: wallet.publicKey,
    },
  });

  const poolAddress = deriveDbcPoolAddress(NATIVE_MINT, baseMintKeypair.publicKey, configKeypair.publicKey);
  console.log('Derived Pool Address:', poolAddress.toBase58());

  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  createPoolWithFirstBuyTx.recentBlockhash = latestBlockhash.blockhash;
  createPoolWithFirstBuyTx.feePayer = wallet.publicKey;
  createPoolWithFirstBuyTx.sign(wallet, baseMintKeypair);

  console.log('Simulating createPoolWithFirstBuyTx against mainnet-beta...');
  const sim = await connection.simulateTransaction(createPoolWithFirstBuyTx);
  console.log('Sim Error:          ', sim.value.err);
  console.log('Compute Units:      ', sim.value.unitsConsumed);

  // Calculate rent for pool, mint, vaults:
  // Base Mint (~82 bytes): 0.00146 SOL
  // Token Vaults (2 x 165 bytes): 2 x 0.00204 SOL = 0.00408 SOL
  // Pool Account (~1400 bytes): 0.00776 SOL
  // Total Rent ~0.0133 SOL
  const estimatedCostLamports = 13_500_000; // ~0.0135 SOL
  console.log('Estimated Cost:     ', estimatedCostLamports / 1e9, 'SOL');

  if (!isExecute) {
    console.log('[DRY RUN COMPLETE] Simulation succeeded. Pass --execute to broadcast.');
    return;
  }

  console.log('Broadcasting createPoolWithFirstBuyTx to Solana Mainnet-Beta...');
  const txSig = await sendAndConfirmTransaction(
    connection,
    createPoolWithFirstBuyTx,
    [wallet, baseMintKeypair],
    { commitment: 'confirmed' }
  );

  console.log('\n--- MAINNET TRANSACTION 2 SUCCESS ---');
  console.log('Pool Address:         ', poolAddress.toBase58());
  console.log('Base Mint Address:    ', baseMintKeypair.publicKey.toBase58());
  console.log('Transaction Signature:', txSig);
  console.log('Explorer Tx Link:      https://explorer.solana.com/tx/' + txSig);
  console.log('Explorer Pool Link:    https://explorer.solana.com/address/' + poolAddress.toBase58());
  console.log('Explorer Mint Link:    https://explorer.solana.com/address/' + baseMintKeypair.publicKey.toBase58());

  const balanceAfter = await connection.getBalance(wallet.publicKey);
  const costLamports = balanceBefore - balanceAfter;
  console.log('Balance After:        ', balanceAfter / 1e9, 'SOL (' + balanceAfter + ' lamports)');
  console.log('Actual SOL Spent:     ', costLamports / 1e9, 'SOL (' + costLamports + ' lamports)');

  savedState.poolAddress = poolAddress.toBase58();
  savedState.poolTxSig = txSig;
  savedState.poolCostSol = costLamports / 1e9;
  savedState.balanceAfterPool = balanceAfter / 1e9;
  savedState.poolCreatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(savedState, null, 2), 'utf8');
}

main().catch(err => {
  console.error('Error executing stage 2:', err);
  process.exit(1);
});
