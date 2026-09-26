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
} = require('@meteora-ag/dynamic-bonding-curve-sdk');

const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const STATE_FILE = path.join('C:\\dev\\windtunnel', '.mainnet-deployment.json');

async function main() {
  const keypairPath = path.join(os.homedir(), '.config', 'solana', 'mainnet-windtunnel.json');
  if (!fs.existsSync(keypairPath)) {
    throw new Error(`Keypair not found at ${keypairPath}`);
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

  const client = DynamicBondingCurveClient.create(connection);

  const baseFeeParams = {
    baseFeeMode: 0,
    feeSchedulerParam: {
      startingFeeBps: 1600, // 16.0% (protect-organic anti-sniper fee barrier)
      endingFeeBps: 100,   // 1.0% floor
      numberOfPeriod: 10,
      totalDuration: 1000, // 1,000 slots decay (~6.6 mins)
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
      poolFeeBps: 100, // 1.0%
      baseFeeMode: 0,
    },
  };

  const initialMarketCap = 0.1;   // 0.1 SOL initial MC
  const migrationMarketCap = 0.26; // 0.26 SOL migration MC (~2.6x expansion ratio)
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

  let savedState = {};
  if (fs.existsSync(STATE_FILE)) {
    try {
      savedState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {}
  }

  let configKeypair;
  if (savedState.configKeypairSecret) {
    configKeypair = Keypair.fromSecretKey(new Uint8Array(savedState.configKeypairSecret));
    console.log('Using saved Config Keypair: ', configKeypair.publicKey.toBase58());
  } else {
    configKeypair = Keypair.generate();
    savedState.configKeypairSecret = Array.from(configKeypair.secretKey);
    savedState.config = configKeypair.publicKey.toBase58();
    fs.writeFileSync(STATE_FILE, JSON.stringify(savedState, null, 2), 'utf8');
    console.log('Generated Config Keypair:   ', configKeypair.publicKey.toBase58());
  }

  let baseMintKeypair;
  if (savedState.baseMintKeypairSecret) {
    baseMintKeypair = Keypair.fromSecretKey(new Uint8Array(savedState.baseMintKeypairSecret));
    console.log('Using saved Base Mint:      ', baseMintKeypair.publicKey.toBase58());
  } else {
    baseMintKeypair = Keypair.generate();
    savedState.baseMintKeypairSecret = Array.from(baseMintKeypair.secretKey);
    savedState.baseMint = baseMintKeypair.publicKey.toBase58();
    fs.writeFileSync(STATE_FILE, JSON.stringify(savedState, null, 2), 'utf8');
    console.log('Generated Base Mint:        ', baseMintKeypair.publicKey.toBase58());
  }

  console.log('Building DBC partner config transaction...');
  const { createConfigTx } = await client.partner.createConfigAndPoolWithFirstBuy({
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

  console.log('Fetching latest blockhash...');
  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  createConfigTx.recentBlockhash = latestBlockhash.blockhash;
  createConfigTx.feePayer = wallet.publicKey;

  console.log('Broadcasting createConfigTx to Solana Mainnet-Beta...');
  const txSig = await sendAndConfirmTransaction(
    connection,
    createConfigTx,
    [wallet, configKeypair],
    { commitment: 'confirmed' }
  );

  console.log('\n--- MAINNET TRANSACTION 1 SUCCESS ---');
  console.log('Config Address:       ', configKeypair.publicKey.toBase58());
  console.log('Transaction Signature:', txSig);
  console.log('Explorer Tx Link:      https://explorer.solana.com/tx/' + txSig);
  console.log('Explorer Config Link:  https://explorer.solana.com/address/' + configKeypair.publicKey.toBase58());

  const balanceAfter = await connection.getBalance(wallet.publicKey);
  const costLamports = balanceBefore - balanceAfter;
  console.log('Balance After:        ', balanceAfter / 1e9, 'SOL (' + balanceAfter + ' lamports)');
  console.log('Actual SOL Spent:     ', costLamports / 1e9, 'SOL (' + costLamports + ' lamports)');

  savedState.network = 'mainnet-beta';
  savedState.configAddress = configKeypair.publicKey.toBase58();
  savedState.configTxSig = txSig;
  savedState.configCostSol = costLamports / 1e9;
  savedState.balanceAfterConfig = balanceAfter / 1e9;
  savedState.configCreatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(savedState, null, 2), 'utf8');

  // Copy state file to scratch as well
  fs.writeFileSync(path.join(__dirname, '.mainnet-deployment.json'), JSON.stringify(savedState, null, 2), 'utf8');
}

main().catch(err => {
  console.error('Error executing stage 1:', err);
  process.exit(1);
});
