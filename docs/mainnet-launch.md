# Mainnet Proof of Usage: Tuned Meteora DBC Launch & Live Swaps

This document provides official on-chain proof for **Phase 8** of WindTunnel, establishing live traction on Solana Mainnet-Beta. It records the deployment of our tuned bonding curve preset discovered during Phase 6 optimization, the creation of a real Meteora Dynamic Bonding Curve (DBC) pool, and the execution of real mainnet swaps.

---

## 1. Executive Summary

| Item | Details |
| :--- | :--- |
| **Network** | Solana Mainnet-Beta (`https://api.mainnet-beta.solana.com`) |
| **DBC Program ID** | `dbcv15TupqaDMsrDUcWhbBs9S1Z4bH6Fv6n8L7uMete` |
| **Payer / Deployer Wallet** | [`5EwgThE4vi7iaUP3SXSq1n1m9aiSrx3WSeDa35BZQye5`](https://explorer.solana.com/address/5EwgThE4vi7iaUP3SXSq1n1m9aiSrx3WSeDa35BZQye5) |
| **Partner Config Address** | [`HRTdrgErgvNtBabEQjtZusdvkm7FXYipjGh8BEdRPECf`](https://explorer.solana.com/address/HRTdrgErgvNtBabEQjtZusdvkm7FXYipjGh8BEdRPECf) |
| **Base Token Mint (WIND)** | [`2M5bnNecFmnasuFKnq9NcX99fGwAvYKDWmVFjf3Qe7jZ`](https://explorer.solana.com/address/2M5bnNecFmnasuFKnq9NcX99fGwAvYKDWmVFjf3Qe7jZ) |
| **Quote Token Mint** | [`So11111111111111111111111111111111111111112`](https://explorer.solana.com/address/So11111111111111111111111111111111111111112) (Native SOL) |
| **Live DBC Pool PDA** | [`F5rMhAuXyc2qVWencT6Uc1H4DnxuJtCF6V1WJpNQ7PMV`](https://explorer.solana.com/address/F5rMhAuXyc2qVWencT6Uc1H4DnxuJtCF6V1WJpNQ7PMV) |
| **Deployer ATA (WIND)** | [`3kSQuuY5Soh3ivZxJ4HoyrgC3Cewif2UmW7hT3Wwvbsk`](https://explorer.solana.com/address/3kSQuuY5Soh3ivZxJ4HoyrgC3Cewif2UmW7hT3Wwvbsk) |
| **Total Real Transactions** | 4 on-chain transactions confirmed (100% success rate) |
| **Initial Wallet Budget** | `0.04855861 SOL` (~$5.88) |
| **Total SOL Spent** | `0.03407416 SOL` (~$4.12) |
| **Remaining Wallet Balance** | **`0.01448445 SOL`** (~$1.75) |

---

## 2. Tuned Preset: Why This Config Was Chosen

During Phase 6 automated genetic tuning, WindTunnel evaluated hundreds of parameter permutations under coordinated sniper attacks (Jito bundle extraction). The top-performing preset—termed **"Protect-Organic" Anti-Sniper Fee Decay**—drastically outperformed standard flat curves:

- **16.0% Starting Fee Barrier (`startingFeeBps: 1600`)**: Creates an immediate friction barrier that makes slot-0 MEV bundle arbitrage mathematically unprofitable for snipers.
- **1,000 Slots Linear Decay (`totalDuration: 1000`)**: Fee smoothly decays over ~6.6 minutes on mainnet down to a low 1.0% floor (`endingFeeBps: 100`).
- **20% Creator Trading Fee Share (`creatorTradingFeePercentage: 20`)**: Channels 20% of all swap fees directly to the token creator/curator, tripling creator revenue compared to unprotected pools.
- **~2.6x Expansion Ratio**: Initial market cap set to 0.10 SOL with a migration threshold of 0.26 SOL, maintaining the exact curve curvature and expansion dynamics from Phase 6 simulation.
- **Token Supply**: 1,000,000,000 WIND (6 decimals) with 10% leftover reserve.

---

## 3. On-Chain Transaction Ledger

All transactions were executed directly on Solana Mainnet-Beta and verified via the Solana Explorer:

| Tx # | Action | Transaction Signature | Cost (SOL) | Explorer Link |
| :---: | :--- | :--- | :---: | :--- |
| **1** | **Create Partner Config** | `QWFUuhi9KjrA3Pd1v5srTsuP48KFg7C9TaFDUTKp7cJqev2hSKDrG1HAVm3aWcTct8XGhQVKkq8XuWA6fRHfgGq` | `0.00598408 SOL` | [View Tx](https://explorer.solana.com/tx/QWFUuhi9KjrA3Pd1v5srTsuP48KFg7C9TaFDUTKp7cJqev2hSKDrG1HAVm3aWcTct8XGhQVKkq8XuWA6fRHfgGq) |
| **2** | **Create Pool & Token** | `d8gcWY4Looh4xht6Wss4Uqboiw1Ceih5vP3oQXbdG27BEgwXg4PanuRzygYUJBn6S4F5z3cTGB6K3HrU11YXUvW` | `0.02059164 SOL` | [View Tx](https://explorer.solana.com/tx/d8gcWY4Looh4xht6Wss4Uqboiw1Ceih5vP3oQXbdG27BEgwXg4PanuRzygYUJBn6S4F5z3cTGB6K3HrU11YXUvW) |
| **3** | **Swap 1 (Buy 0.003 SOL)** | `2TpaPqMqq4hZWQSb7HVXt3EhTeUzA8NEiU9mJML4GSms1CmGNFcTsiCS6XkUMX8sbYYu1MEmVbNRWyDW5FyXAngU` | `0.00449344 SOL` | [View Tx](https://explorer.solana.com/tx/2TpaPqMqq4hZWQSb7HVXt3EhTeUzA8NEiU9mJML4GSms1CmGNFcTsiCS6XkUMX8sbYYu1MEmVbNRWyDW5FyXAngU) |
| **4** | **Swap 2 (Buy 0.003 SOL)** | `2njtYBv3aVngGGk5GUPE5GTtzoYpHWiLJFH9a1stmBNhKUch9AzTFhSgzb2qw5ToXm8DUm7T3SQ2P9nrkCdExrv1` | `0.00300500 SOL` | [View Tx](https://explorer.solana.com/tx/2njtYBv3aVngGGk5GUPE5GTtzoYpHWiLJFH9a1stmBNhKUch9AzTFhSgzb2qw5ToXm8DUm7T3SQ2P9nrkCdExrv1) |

---

## 4. Empirical Trade Economics & Bonding Curve Behavior

The two consecutive swaps provide empirical proof of the dynamic bonding curve's mathematical execution on mainnet:

### Swap 1 Analysis:
- **Input**: `0.003000 SOL` (3,000,000 lamports)
- **Tokens Acquired**: `27,814,906.180632 WIND`
- **Effective Price**: `1.078558 × 10⁻¹⁰ SOL per WIND` (~9.27B WIND / SOL)
- **Fee Execution**: Tuned 16.0% fee barrier successfully charged at curve origin, funding protocol and creator fee accrual accounts.
- **Account Creation**: Automatically initialized Associated Token Account `3kSQuu...` (costing 0.00148844 SOL rent exemption).

### Swap 2 Analysis:
- **Input**: `0.003000 SOL` (3,000,000 lamports)
- **Tokens Acquired**: `19,865,223.246350 WIND`
- **Effective Price**: `1.510177 × 10⁻¹⁰ SOL per WIND` (~6.62B WIND / SOL)
- **Price Progression**: Price increased by **+40.0%** along the curve between Swap 1 and Swap 2, demonstrating real bonding curve price discovery with zero slippage failures.
- **Total WIND Portfolio Balance**: `47,680,129.426982 WIND`

---

## 5. Budget Accounting

Strict budget adherence was enforced across all stages:

```text
Starting Wallet Balance:     0.04855861 SOL  (100.0%)
------------------------------------------------------
Transaction 1 (Config Rent): -0.00598408 SOL  ( 12.3%)
Transaction 2 (Pool Rent):   -0.02059164 SOL  ( 42.4%)
Transaction 3 (Swap 1 + ATA):-0.00449344 SOL  (  9.3%)
Transaction 4 (Swap 2):      -0.00300500 SOL  (  6.2%)
------------------------------------------------------
Total Spent:                 0.03407416 SOL  ( 70.2%)
Remaining Wallet Balance:    0.01448445 SOL  ( 29.8% SURPLUS)
```

The launch was executed safely within the ~$5.88 budget constraint, leaving 29.8% of the budget unspent.

---

## 6. Conclusion & Hackathon Traction

Phase 8 successfully validates that WindTunnel is not merely a theoretical modeling tool or a testnet sandbox. The tuned presets engineered in WindTunnel's offline simulation engine can be published directly to Solana Mainnet-Beta as live Meteora DBC partner configurations, verified on-chain, and actively traded with real economic value.
