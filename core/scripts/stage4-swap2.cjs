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
    swapBaseForQuote: false,
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
    console.log('Simulating Swap 2 transaction against mainnet-beta...');
    const sim = await connection.simulateTransaction(swapTx);
    console.log('Sim Error:          ', sim.value.err);
    console.log('Compute Units:      ', sim.value.unitsConsumed);
    return;
  }

  console.log('Broadcasting Swap 2 to Solana Mainnet-Beta...');
  const txSig = await sendAndConfirmTransaction(
    connection,
    swapTx,
    [wallet],
    { commitment: 'confirmed' }
  );

  console.log('\n--- MAINNET SWAP 2 CONFIRMED ---');
  console.log('Transaction Signature:', txSig);
  console.log('Explorer Tx Link:      https://explorer.solana.com/tx/' + txSig);

  await new Promise(res => setTimeout(res, 2000));

  const balanceAfter = await connection.getBalance(wallet.publicKey);
  const costLamports = balanceBefore - balanceAfter;
  console.log('Wallet SOL Balance:   ', balanceAfter / 1e9, 'SOL (' + balanceAfter + ' lamports)');
  console.log('Total SOL Deducted:   ', costLamports / 1e9, 'SOL (' + costLamports + ' lamports)');

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
    mint: baseMintPubkey,
  });

  let totalTokensFormatted = '0';
  let rawTokenAmount = '0';
  if (tokenAccounts.value && tokenAccounts.value.length > 0) {
    const parsedInfo = tokenAccounts.value[0].account.data.parsed.info;
    totalTokensFormatted = parsedInfo.tokenAmount.uiAmountString;
    rawTokenAmount = parsedInfo.tokenAmount.amount;
  }

  const prevTokens = parseFloat(savedState.swap1.tokensReceived || '0');
  const currentTokens = parseFloat(totalTokensFormatted);
  const swap2TokensReceived = currentTokens - prevTokens;
  const solSpentOnTokens = swapAmountLamports / 1e9;
  const effectivePrice = swap2TokensReceived > 0 ? (solSpentOnTokens / swap2TokensReceived) : 0;

  console.log('\nToken Balance Details:');
  console.log('  Total WIND Held:    ', totalTokensFormatted, 'WIND');
  console.log('  WIND from Swap 2:   ', swap2TokensReceived.toLocaleString(), 'WIND');
  console.log('  Effective Price:    ', effectivePrice.toExponential(6), 'SOL per WIND');

  savedState.swap2 = {
    txSig,
    inputSol: 0.003,
    tokensReceived: swap2TokensReceived.toString(),
    totalHoldingWIND: totalTokensFormatted,
    effectivePriceSolPerToken: effectivePrice.toExponential(6),
    balanceAfter: balanceAfter / 1e9,
    totalSpentSol: costLamports / 1e9,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(savedState, null, 2), 'utf8');
}

main().catch(err => {
  console.error('Error in swap 2:', err);
  process.exit(1);
});
