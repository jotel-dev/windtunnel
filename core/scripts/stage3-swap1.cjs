const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  Connection,
  Keypair,
  PublicKey,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const {
  DynamicBondingCurveClient,
  SwapMode,
} = require('@meteora-ag/dynamic-bonding-curve-sdk');
const BN = require('bn.js');

const STATE_FILE = path.join('C:\\dev\\windtunnel', '.mainnet-deployment.json');

async function main() {
  const isExecute = process.argv.includes('--execute');

  const keypairPath = path.join(os.homedir(), '.config', 'solana', 'mainnet-windtunnel.json');
  const wallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, 'utf8'))));
  const rpcUrl = 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 120000,
  });

  const balanceBefore = await connection.getBalance(wallet.publicKey);
  console.log('Wallet Address:     ', wallet.publicKey.toBase58());
  console.log('Balance Before:     ', balanceBefore / 1e9, 'SOL (' + balanceBefore + ' lamports)');

  const savedState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const poolPubkey = new PublicKey(savedState.poolAddress);
  const baseMintPubkey = new PublicKey(savedState.baseMint);
  console.log('Target DBC Pool:    ', poolPubkey.toBase58());
  console.log('Base Mint:          ', baseMintPubkey.toBase58());

  const client = DynamicBondingCurveClient.create(connection);

  const swapAmountLamports = 3_000_000; // 0.003 SOL
  const amountIn = new BN(swapAmountLamports);

  console.log('\nBuilding swap2 transaction (Buy ExactIn: 0.003 SOL)...');
  const swapTx = await client.pool.swap2({
    pool: poolPubkey,
    swapBaseForQuote: false, // Buy base token with SOL
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

  if (!isExecute) {
    swapTx.sign(wallet);
    console.log('Simulating Swap 1 transaction against mainnet-beta...');
    const sim = await connection.simulateTransaction(swapTx);
    console.log('Sim Error:          ', sim.value.err);
    console.log('Compute Units:      ', sim.value.unitsConsumed);
    return;
  }

  console.log('Broadcasting Swap 1 to Solana Mainnet-Beta...');
  const txSig = await sendAndConfirmTransaction(
    connection,
    swapTx,
    [wallet],
    { commitment: 'confirmed' }
  );

  console.log('\n--- MAINNET SWAP 1 CONFIRMED ---');
  console.log('Transaction Signature:', txSig);
  console.log('Explorer Tx Link:      https://explorer.solana.com/tx/' + txSig);

  // Allow a moment for RPC commitments
  await new Promise(res => setTimeout(res, 2000));

  const balanceAfter = await connection.getBalance(wallet.publicKey);
  const costLamports = balanceBefore - balanceAfter;
  console.log('Wallet SOL Balance:   ', balanceAfter / 1e9, 'SOL (' + balanceAfter + ' lamports)');
  console.log('Total SOL Deducted:   ', costLamports / 1e9, 'SOL (' + costLamports + ' lamports)');

  // Query user token accounts for baseMint
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
    mint: baseMintPubkey,
  });

  let tokensReceivedFormatted = '0';
  let rawTokenAmount = '0';
  if (tokenAccounts.value && tokenAccounts.value.length > 0) {
    const parsedInfo = tokenAccounts.value[0].account.data.parsed.info;
    tokensReceivedFormatted = parsedInfo.tokenAmount.uiAmountString;
    rawTokenAmount = parsedInfo.tokenAmount.amount;
    console.log('\nToken Balance Details:');
    console.log('  Token Account (ATA):', tokenAccounts.value[0].pubkey.toBase58());
    console.log('  WIND Received:      ', tokensReceivedFormatted, 'WIND');
    console.log('  Raw Token Units:    ', rawTokenAmount, '(6 decimals)');
  }

  // Calculate effective price paid:
  const tokensReceivedNum = parseFloat(tokensReceivedFormatted);
  const solSpentOnTokens = swapAmountLamports / 1e9; // 0.003 SOL
  const effectivePriceSolPerToken = tokensReceivedNum > 0 ? (solSpentOnTokens / tokensReceivedNum) : 0;
  const tokensPerSol = tokensReceivedNum > 0 ? (tokensReceivedNum / solSpentOnTokens) : 0;

  console.log('\nEffective Execution Economics:');
  console.log('  SOL Input:           0.003000 SOL (3,000,000 lamports)');
  console.log('  Tokens Output:      ', tokensReceivedFormatted, 'WIND');
  console.log('  Effective Price:    ', effectivePriceSolPerToken.toExponential(6), 'SOL per WIND');
  console.log('  Tokens per SOL:     ', tokensPerSol.toLocaleString(), 'WIND / SOL');

  // Query updated pool state
  const poolState = await client.state.getPool(poolPubkey);
  console.log('\nUpdated On-Chain Pool State:');
  console.log('  Base Reserve:       ', poolState.poolState.baseReserve.toString(), 'WIND raw');
  console.log('  Quote Reserve:      ', poolState.poolState.quoteReserve.toString(), 'lamports (~' + (Number(poolState.poolState.quoteReserve.toString()) / 1e9) + ' SOL)');
  console.log('  Total Fees Collected:', poolState.poolState.totalFeeCollected ? poolState.poolState.totalFeeCollected.toString() : 'N/A');

  savedState.swap1 = {
    txSig,
    inputSol: 0.003,
    tokensReceived: tokensReceivedFormatted,
    rawTokensReceived: rawTokenAmount,
    effectivePriceSolPerToken: effectivePriceSolPerToken.toExponential(6),
    tokensPerSol,
    balanceAfter: balanceAfter / 1e9,
    totalSpentSol: costLamports / 1e9,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(savedState, null, 2), 'utf8');
}

main().catch(err => {
  console.error('Error in swap 1:', err);
  process.exit(1);
});
