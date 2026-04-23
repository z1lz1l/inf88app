/**
 * 88inf — Token Creation Script
 * Solana Token-2022 with Transfer Fee Extension
 *
 * HOW TO RUN:
 * 1. npm install @solana/web3.js @solana/spl-token dotenv
 * 2. Create .env file with your PRIVATE_KEY
 * 3. npx ts-node 01_create_token.ts --network devnet
 * 4. After testing on devnet, run with --network mainnet
 */

import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  getMintLen,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import * as dotenv from "dotenv";
dotenv.config();

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const NETWORK = process.argv.includes("--network")
  ? process.argv[process.argv.indexOf("--network") + 1]
  : "devnet";

const RPC_URL =
  NETWORK === "mainnet"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";

// Token parameters
const TOKEN_NAME = "88inf";
const TOKEN_SYMBOL = "88INF";
const DECIMALS = 6; // 6 decimals: display as 1.000000 (easier for payments)
const TOTAL_SUPPLY = 88_000_000n; // 88 million
const TOTAL_SUPPLY_RAW = TOTAL_SUPPLY * 10n ** BigInt(DECIMALS);

// Transfer fee: 0.3% = 30 basis points (1 basis point = 0.01%)
const TRANSFER_FEE_BASIS_POINTS = 30; // 30 / 10000 = 0.003 = 0.3%
const MAX_FEE = BigInt(1_000_000 * 10 ** DECIMALS); // Max fee cap per tx (safety)

// Wallet addresses — REPLACE WITH YOUR ACTUAL WALLETS IN .ENV
const REWARDS_WALLET = process.env.REWARDS_WALLET || "11111111111111111111111111111111";   // 0.1% → APY to holders
const OPS_WALLET = process.env.OPS_WALLET || "11111111111111111111111111111111";           // 0.1% → Marketing/dev
const COMPANY_WALLET = process.env.COMPANY_WALLET || "11111111111111111111111111111111";   // 0.1% → Company profit

// Token allocation (in tokens, not raw)
const ALLOCATION = {
  liquidity:  35_200_000n, // 40% → Raydium pool
  app_rewards: 26_400_000n, // 30% → Mining sim rewards (vested)
  marketing:  17_600_000n, // 20% → Marketing (vested 10%/month)
  team:        8_800_000n, // 10% → Team (locked 12 months)
};

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 88inf Token Deployment`);
  console.log(`Network: ${NETWORK.toUpperCase()}`);
  console.log(`─────────────────────────────────`);

  if (!process.env.PRIVATE_KEY) {
    throw new Error("Missing PRIVATE_KEY in .env file");
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(process.env.PRIVATE_KEY))
  );

  console.log(`Deployer wallet: ${payer.publicKey.toBase58()}`);

  const balance = await connection.getBalance(payer.publicKey);
  console.log(`Wallet balance: ${balance / 1e9} SOL`);

  if (balance < 0.1 * 1e9) {
    if (NETWORK === "devnet") {
      console.log("⚠️  Low balance. Requesting airdrop...");
      try {
        await connection.requestAirdrop(payer.publicKey, 2 * 1e9);
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        console.log("⚠️  Airdrop failed. Trying 1 SOL...");
        try {
          await connection.requestAirdrop(payer.publicKey, 1 * 1e9);
          await new Promise((r) => setTimeout(r, 2000));
        } catch (e2) {
          console.log("⚠️  Airdrop failed. Trying 0.5 SOL...");
          try {
            await connection.requestAirdrop(payer.publicKey, 0.5 * 1e9);
            await new Promise((r) => setTimeout(r, 2000));
          } catch (e3) {
             throw new Error("Devnet Airdrop failed. Please manually airdrop SOL to " + payer.publicKey.toBase58() + " at https://faucet.solana.com/");
          }
        }
      }
    } else {
      throw new Error("Insufficient SOL for mainnet deployment. Need at least 0.1 SOL.");
    }
  }

  // Generate a new keypair for the mint (token address)
  const mintKeypair = Keypair.generate();
  console.log(`\nMint address (token address): ${mintKeypair.publicKey.toBase58()}`);
  console.log("⚠️  SAVE THIS ADDRESS — it's your token's permanent identifier\n");

  // ── Step 1: Calculate space for Token-2022 with TransferFee extension
  const extensions = [ExtensionType.TransferFeeConfig];
  const mintLength = getMintLen(extensions);

  const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLength);

  // ── Step 2: Build transaction
  const tx = new Transaction();

  // Create mint account
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLength,
      lamports: mintLamports,
      programId: TOKEN_2022_PROGRAM_ID,
    })
  );

  // Initialize TransferFee extension BEFORE initializing mint
  // Fee goes to a "withdraw authority" wallet — we use OPS_WALLET to collect
  // then distribute manually (or via distributor script)
  tx.add(
    createInitializeTransferFeeConfigInstruction(
      mintKeypair.publicKey,
      new PublicKey(OPS_WALLET),    // fee collector authority
      new PublicKey(OPS_WALLET),    // withdraw withheld authority
      TRANSFER_FEE_BASIS_POINTS,
      MAX_FEE,
      TOKEN_2022_PROGRAM_ID
    )
  );

  // Initialize the mint itself
  tx.add(
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      DECIMALS,
      payer.publicKey,   // mint authority (will be revoked after minting)
      null,              // freeze authority = null (IMPORTANT for trust)
      TOKEN_2022_PROGRAM_ID
    )
  );

  console.log("Creating mint account...");
  const txSig = await sendAndConfirmTransaction(connection, tx, [payer, mintKeypair]);
  console.log(`✅ Mint created: https://solscan.io/tx/${txSig}?cluster=${NETWORK}`);

  // ── Step 3: Mint all 88 million tokens to deployer's wallet
  // Then we'll distribute to allocation wallets
  const deployerATA = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    payer.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const mintTx = new Transaction();

  mintTx.add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      deployerATA,
      payer.publicKey,
      mintKeypair.publicKey,
      TOKEN_2022_PROGRAM_ID
    )
  );

  mintTx.add(
    createMintToInstruction(
      mintKeypair.publicKey,
      deployerATA,
      payer.publicKey,
      TOTAL_SUPPLY_RAW,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  console.log("\nMinting 88,000,000 tokens...");
  const mintTxSig = await sendAndConfirmTransaction(connection, mintTx, [payer]);
  console.log(`✅ Minted: https://solscan.io/tx/${mintTxSig}?cluster=${NETWORK}`);

  // ── Step 4: Summary
  console.log(`
─────────────────────────────────
✅ 88INF TOKEN CREATED SUCCESSFULLY
─────────────────────────────────
Token address:  ${mintKeypair.publicKey.toBase58()}
Network:        ${NETWORK}
Supply:         88,000,000 88INF
Decimals:       6
Transfer fee:   0.3% (30 basis points)
Freeze auth:    NONE (users can't be frozen)

NEXT STEPS:
1. Run 02_revoke_mint.ts  → Remove ability to print more tokens
2. Run 03_distribute.ts   → Send to allocation wallets
3. Run 04_add_liquidity.ts → Create Raydium pool with $7,000 SOL
4. Run 05_lock_lp.ts      → Lock LP tokens via Streamflow for 1 year

⚠️  DO NOT share your PRIVATE_KEY with anyone.
`);
}

main().catch(console.error);
