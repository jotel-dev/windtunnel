# Devnet Live Validation: On-Chain DBC Trading vs. Simulator

This document records the empirical results from Phase 5 Part B & Part C, executing real swaps and graduation on Solana Devnet against a live deployed Meteora Dynamic Bonding Curve (DBC) pool, and comparing each on-chain state transition against predictions from `VirtualPoolSimulator`.

---

## 1. Environment & Deployed Assets

| Property | Value / Address |
| :--- | :--- |
| **Network** | Solana Devnet (`https://api.devnet.solana.com`) |
| **DBC Program ID** | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` |
| **Payer / Deployer Wallet** | `Au8rC1EL7TkwWoBdmy9WVsU3UkrvBq3PEQe5QeUSHhi1` |
| **Partner Config Pubkey** | `HqzYqop5KQXxGxWte7iaH2DUTDU74XdvnozoW4D1oDm4` |
| **Base Mint (WIND)** | `AUuhty7DY1yn2KF2T1uTGQajnZ7CKTxJmaHAceF8fQrs` (6 decimals) |
| **Quote Mint** | `So11111111111111111111111111111111111111112` (SOL, 9 decimals) |
| **Virtual Pool Address** | `2zJFqXFqoJDt7kvf1vpCXRa8qTS11ATNmy19TPZjRXBV` |
| **Config Explorer** | [Solana Explorer - Config](https://explorer.solana.com/address/HqzYqop5KQXxGxWte7iaH2DUTDU74XdvnozoW4D1oDm4?cluster=devnet) |
| **Pool Explorer** | [Solana Explorer - Pool](https://explorer.solana.com/address/2zJFqXFqoJDt7kvf1vpCXRa8qTS11ATNmy19TPZjRXBV?cluster=devnet) |
| **Activation Slot** | `502602412` (`ActivationType.Slot`) |
| **Migration Threshold** | `175,703,087` lamports (~0.1757 SOL) |
| **Initial Market Cap** | 0.2 SOL |
| **Migration Market Cap** | 0.5 SOL |

---

## 2. On-Chain Trade Sequence & Signatures

Four real on-chain swaps were executed in sequence via `client.pool.swap2`:

1. **Trade 1: Buy (0.04 SOL)**
   - Input: `40,000,000` lamports
   - Confirmed Slot: `502,898,411` (Elapsed: `295,999` slots since pool activation)
   - Signature: [`3koB6MR96MUhBmyy162xTtzatVX6uSRVViXiyW8fUs8snpaWkK6Jbd5QH5ZuEPi4ddQZmybkSNdkDsh6BA1oF93Z`](https://explorer.solana.com/tx/3koB6MR96MUhBmyy162xTtzatVX6uSRVViXiyW8fUs8snpaWkK6Jbd5QH5ZuEPi4ddQZmybkSNdkDsh6BA1oF93Z?cluster=devnet)
2. **Trade 2: Buy (0.05 SOL)**
   - Input: `50,000,000` lamports
   - Confirmed Slot: `502,898,422` (Elapsed: `296,010` slots)
   - Signature: [`2o6Qg1ckA6tvm2zE8dRteXtLHL8KTwjTyeEpE4VAgEKegoSTzUF4ZuiBYr5EePgfGWL62gi1NRKWSwo58DNJVwwg`](https://explorer.solana.com/tx/2o6Qg1ckA6tvm2zE8dRteXtLHL8KTwjTyeEpE4VAgEKegoSTzUF4ZuiBYr5EePgfGWL62gi1NRKWSwo58DNJVwwg?cluster=devnet)
3. **Trade 3: Sell (~25% of tokens held)**
   - Input: `86,023,813,766,898` atomic units (~86,023,813.76 WIND)
   - Confirmed Slot: `502,898,438` (Elapsed: `296,026` slots)
   - Signature: [`5MJrLV1WJemKLty5g8JKBFGTNpf9w3JhJdsmvCXyYowF2dUccb8S7Ene1aRh3RCyo9kWfkFo3XxBNsdcjGp77buB`](https://explorer.solana.com/tx/5MJrLV1WJemKLty5g8JKBFGTNpf9w3JhJdsmvCXyYowF2dUccb8S7Ene1aRh3RCyo9kWfkFo3XxBNsdcjGp77buB?cluster=devnet)
4. **Trade 4: Buy (0.03 SOL)**
   - Input: `30,000,000` lamports
   - Confirmed Slot: `502,898,451` (Elapsed: `296,039` slots)
   - Signature: [`2rgbGgfyr7Zx3okM8N9nbaR3VGFYKTj3Yikj5JyNhoG2HbSruMh6WQUyMeQwaJBMYe7dqkg4EHuCJFjPsawiusnZ`](https://explorer.solana.com/tx/2rgbGgfyr7Zx3okM8N9nbaR3VGFYKTj3Yikj5JyNhoG2HbSruMh6WQUyMeQwaJBMYe7dqkg4EHuCJFjPsawiusnZ?cluster=devnet)

---

## 3. Corrected Comparison: On-Chain vs. VirtualPoolSimulator (Using Real On-Chain Slots)

When each trade is simulated using its **exact confirmed on-chain slot** (`clock: { slot, timestamp }`), the simulator's fee scheduler decays in lockstep with the on-chain Rust contract.

### Comparison Table

| Metric | Trade 1 (Buy 0.04 SOL) | Trade 2 (Buy 0.05 SOL) | Trade 3 (Sell ~86M WIND) | Trade 4 (Buy 0.03 SOL) |
| :--- | :--- | :--- | :--- | :--- |
| **Confirmed Slot** | `502,898,411` | `502,898,422` | `502,898,438` | `502,898,451` |
| **Elapsed Slots** | 295,999 | 296,010 | 296,026 | 296,039 |
| **On-Chain sqrtPrice** | `9,330,152,131,849,556` | `10,680,793,442,633,488` | `9,947,887,160,515,008` | `10,758,271,946,985,367` |
| **Simulated sqrtPrice** | `9,330,152,131,849,556` | `10,680,793,442,633,488` | `9,947,887,160,515,008` | `10,758,271,946,985,367` |
| **sqrtPrice Delta** | **0 (EXACT MATCH)** | **0 (EXACT MATCH)** | **0 (EXACT MATCH)** | **0 (EXACT MATCH)** |
| **On-Chain quoteReserve** | 39,600,000 lamports | 89,100,000 lamports | 62,239,530 lamports | 91,939,530 lamports |
| **Simulated quoteReserve** | 39,600,000 lamports | 89,100,000 lamports | 62,239,530 lamports | 91,939,530 lamports |
| **quoteReserve Delta** | **0 (EXACT MATCH)** | **0 (EXACT MATCH)** | **0 (EXACT MATCH)** | **0 (EXACT MATCH)** |
| **On-Chain Trade Fee** | 400,000 (1.00%) | 500,000 (1.00%) | 268,605 (1.00%) | 300,000 (1.00%) |
| **Simulated Trade Fee** | 400,000 (1.00%) | 500,000 (1.00%) | 268,605 (1.00%) | 300,000 (1.00%) |
| **Trade Fee Delta** | **0 (EXACT MATCH)** | **0 (EXACT MATCH)** | **0 (EXACT MATCH)** | **0 (EXACT MATCH)** |
| **Accumulated Protocol Fee** | `80,000` vs `80,000` (**0**) | `180,000` vs `180,000` (**0**) | `233,721` vs `233,721` (**0**) | `293,721` vs `293,721` (**0**) |
| **Accumulated Creator Fee** | `64,000` vs `64,000` (**0**) | `144,000` vs `144,000` (**0**) | `186,976` vs `186,976` (**0**) | `234,976` vs `234,976` (**0**) |
| **Accumulated Partner Fee** | `256,000` vs `256,000` (**0**) | `576,000` vs `576,000` (**0**) | `747,908` vs `747,908` (**0**) | `939,908` vs `939,908` (**0**) |
| **Output Token Delta** | -1 atomic unit | 0 atomic units | 0 atomic units | -1 atomic unit |

---

## 4. Test Setup Limitation vs. Model Divergence Analysis

### A. Clarification: Test Setup Limitation (Now Resolved)
- In the initial test execution, `devnet-trade.ts` initialized `VirtualPoolSimulator` with `slot: 0` and called `sim.step(trade)` without passing the actual transaction slot.
- Because the pool's configuration uses `activationType: 0` (`ActivationType.Slot`), both the on-chain Rust contract and the SDK calculate elapsed time via slots:
  $$\text{elapsed} = \text{current\_slot} - \text{activation\_slot}$$
- On devnet, the pool was created at slot `502,602,412`, and the trades were executed at slots `502,898,411` through `502,898,451` (~296,000 slots later). Because `totalDuration = 1000` slots, the on-chain contract had naturally decayed to its minimum floor fee of `100 bps` (1.00%).
- The initial simulator run, receiving `slot: 0` ($elapsed = 0$), applied the starting fee of `500 bps` (5.00%).
- **Conclusion**: This was strictly a **test setup harness limitation**, not a divergence in simulator math. Once the simulator is passed the actual on-chain transaction slot, the fee scheduler decays to `100 bps` and matches the on-chain fee to the exact lamport.

### B. What Matched Exactly (0 Delta / 100% Confirmation)
1. **Sqrt Price**:
   - Matches to the exact integer unit across every single trade (0 delta).
2. **Quote Reserves**:
   - Matches to the exact lamport across every single trade (0 delta).
3. **Fee Accounting & Splits**:
   - Total trade fees match to the exact lamport across all buys and sells.
   - The 3-way fee split (20% Protocol, 16% Creator, 64% Partner) matches to the exact lamport across all trades.

### C. Base Reserve Structure Note
- On-chain, `poolState.baseReserve` is initialized to the full total supply (`1,000,000,000,000,000` units = 1B WIND). This includes:
  1. `swapBaseAmount` (`555,621,654,488,520` units) allocated for DBC trading.
  2. `migrationBaseAmount` (`444,378,345,511,480` units) reserved for DAMM v2 migration.
- In `VirtualPoolSimulator`, `baseReserve` tracks the bonding curve swap inventory (`totalBaseTokensForCurve = 555,621,654,488,521`).
- Consequently, there is an invariant constant offset between the on-chain `baseReserve` and simulator `baseReserve` of exactly `444,378,345,511,480` atomic units (the migration reserve).
- The actual base token transfer amounts (`outputAmount`) match within **1 atomic unit** (1 unit out of ~175 trillion units, or $5 \times 10^{-13}\%$), representing integer division truncation in the Rust contract.

---

## 5. Conclusion & Verification

- **Fee Scheduler Math Confirmed**: Given the real on-chain slot/timestamp, the linear fee scheduler decay math in `VirtualPoolSimulator` matches on-chain execution 100% identically.
- **Zero Real Divergences**: Once timing parity is established, there are **0 divergences** in `sqrtPrice`, `quoteReserve`, `protocolFee`, `creatorFee`, or `partnerFee`.
- All swap logic (both buys and sells) conforms exactly to Meteora DBC on-chain behavior.

---

## 6. Phase 5 Part C: Pool Graduation & DAMM v2 Migration Verification

### 6.1 Graduation Swap
To transition the DBC pool to the graduation state (`migrationProgress = 2`), a final buy swap was executed:
- **Quote In**: `100,000,000` lamports (0.1 SOL) with `SwapMode.PartialFill` (Mode 1).
- **Behavior**: Partial fill allowed the contract to consume exactly the quote needed to reach the threshold (`83,763,558` lamports net) and refund the excess quote token back to the trader without hitting `InsufficientLiquidity (6033)`.
- **Tx Signature**: [`5j2jb6EJykALhENftzKYRkXKJbe2hFskQ1JQcXsxdxCr8zhPPnnpY1uZnaHqS2yrjgCN2NgXd33y56WLb1FtbUgi`](https://explorer.solana.com/tx/5j2jb6EJykALhENftzKYRkXKJbe2hFskQ1JQcXsxdxCr8zhPPnnpY1uZnaHqS2yrjgCN2NgXd33y56WLb1FtbUgi?cluster=devnet)
- **Resulting DBC State**:
  - `migrationProgress`: `2` (Graduated / Ready to Migrate)
  - `quoteReserve`: `175,703,088` lamports (Threshold: `175,703,087` lamports)
  - Final DBC `sqrtPrice`: `13,043,817,825,332,782`

### 6.2 On-Chain Migration to DAMM v2
Migration was executed using the DBC SDK's `client.migration.migrateToDammV2`:
- **Target DAMM v2 Config**: `2c4cYd4reUYVRAB9kUUkrq55VPyy2FNQ3FDL4o12JXmq` (canonical devnet config for `migrationFeeOption: 3` / FixedBps200).
- **Migration Tx Signature**: [`tMXi4mVSqj6fJyFLsEphYbUG6JMQuXJ3EiZZ8eR2asgGk4tGsM7xkqYFHvLCiT6Q1dcGiK6xYdVJgvML4ZXvMuC`](https://explorer.solana.com/tx/tMXi4mVSqj6fJyFLsEphYbUG6JMQuXJ3EiZZ8eR2asgGk4tGsM7xkqYFHvLCiT6Q1dcGiK6xYdVJgvML4ZXvMuC?cluster=devnet)
- **Deployed DAMM v2 Pool**: [`DyEz6XSvhDnmgjUcU4EHEDM27z4p9yGRHJaPFJH3wWHp`](https://explorer.solana.com/address/DyEz6XSvhDnmgjUcU4EHEDM27z4p9yGRHJaPFJH3wWHp?cluster=devnet)
- **Token Vaults**:
  - Token A Vault (Base WIND): `2opG599z4Can4owKfKZLefWGowX4PHDjTz45rkgJwTim`
  - Token B Vault (Quote SOL): `HbyE3faUKcuPWb2utjrdjvTkqcJsgeWtU4cD91ynzZTv`

### 6.3 DAMM v2 On-Chain State vs. WindTunnel Phase 3 Model

| Parameter | On-Chain Value | WindTunnel Phase 3 Prediction | Match? |
| :--- | :--- | :--- | :--- |
| **Starting Sqrt Price** | `13,043,817,825,332,782` | `13,043,817,825,332,782` (DBC final spot price) | **EXACT MATCH** (0 delta) |
| **Config `sqrtMinPrice`** | `4,295,048,016` | `MIN_SQRT_PRICE = 4295048016` | **EXACT MATCH** |
| **Config `sqrtMaxPrice`** | `79,226,673,521,066,979,257,578,248,091` | `MAX_SQRT_PRICE = 79226673521066979257578248091` | **EXACT MATCH** |
| **Liquidity Range** | `[MIN_SQRT_PRICE, MAX_SQRT_PRICE]` | Full-Range Concentrated Liquidity | **CONFIRMED** |
| **Pool Liquidity ($L$)** | `4,483,022,041,703,389,930,996,411,811,566` | Full-range formula: $L = \frac{\Delta y \cdot 2^{128}}{\sqrt{P} - \sqrt{P_{min}}}$ | **CONFIRMED** |

### 6.4 On-Chain LP Position Structure
In Meteora DAMM v2, the migrated liquidity is represented as follows:
- **Representation**: An on-chain `Position` account (`86DV2caaDUY3zjJCmsWPwzgQFbkSjmSnG53EAK5c7rgj`) indexed by an NFT mint (`CQyRG96am5m6fgcsgiuJamMhB28iLVGubQ2hTVEGu7iT`).
- **Locking Mechanism**:
  - `unlockedLiquidity`: `0`
  - `vestedLiquidity`: `0`
  - `permanentLockedLiquidity`: `4,483,022,041,703,389,930,996,411,811,566` (100% of pool liquidity)
- The liquidity is permanently non-withdrawable, providing permanent on-chain depth for post-graduation trading.
