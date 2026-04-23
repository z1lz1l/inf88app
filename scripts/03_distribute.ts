/**
 * 88inf — Step 3: Distribute to Allocation Wallets
 *
 * Sends tokens from deployer wallet to each allocation wallet.
 * Update the wallet addresses below before running.
 */

import {
  Connection,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import * as dotenv from "dotenv";
dotenv.config();

const DECIMALS = 6;

// ── REPLACE THESE WITH YOUR ACTUAL WALLET ADDRESSES IN .ENV ──
const WALLETS: Record<string, { address: string; amount: bigint; note: string }> = {
  liquidity: {
    address: process.env.LIQUIDITY_WALLET || "11111111111111111111111111111111",
    amount: 35_200_000n,
    note: "40% → Raydium pool (will be locked 1 year)",
  },
  app_rewards: {
    address: process.env.APP_REWARDS_WALLET || "11111111111111111111111111111111",
    amount: 26_400_000n,
    note: "30% → Mining sim treasury (release slowly per ad-view)",
  },
  marketing: {
    address: process.env.MARKETING_WALLET || "11111111111111111111111111111111",
    amount: 17_600_000n,
    note: "20% → Marketing (10% released per month over 10 months)",
  },
  team: {
    address: process.env.TEAM_WALLET || "11111111111111111111111111111111",
    amount: 8_800_000n,
    note: "10% → Team (locked 12 months via Streamflow)",
  },
};

const NETWORK = process.argv.includes("--network")
  ? process.argv[process.argv.indexOf("--network") + 1]
  : "devnet";

const RPC_URL =
  NETWORK === "mainnet"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";

async function main() {
  const MINT_ADDRESS = process.env.MINT_ADDRESS;
  if (!MINT_ADDRESS) throw new Error("Set MINT_ADDRESS in .env");
  if (!process.env.PRIVATE_KEY) throw new Error("Set PRIVATE_KEY in .env");

  const connection = new Connection(RPC_URL, "confirmed");
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(process.env.PRIVATE_KEY))
  );
  const mint = new PublicKey(MINT_ADDRESS);

  const sourceATA = getAssociatedTokenAddressSync(
    mint,
    payer.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log(`\n📦 Distributing 88INF tokens to allocation wallets\n`);

  for (const [name, { address, amount, note }] of Object.entries(WALLETS)) {
    const dest = new PublicKey(address);
    const destATA = getAssociatedTokenAddressSync(
      mint,
      dest,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new Transaction();

    try {
      await connection.getTokenAccountBalance(destATA);
    } catch (e) {
      // Create destination ATA if it doesn't exist
      tx.add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          destATA,
          dest,
          mint,
          TOKEN_2022_PROGRAM_ID
        )
      );
    }

    tx.add(
      createTransferCheckedInstruction(
        sourceATA,
        mint,
        destATA,
        payer.publicKey,
        amount * 10n ** BigInt(DECIMALS),
        DECIMALS,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log(`✅ ${name}: ${amount.toLocaleString()} tokens → ${address}`);
    console.log(`   ${note}`);
    console.log(`   TX: https://solscan.io/tx/${sig}?cluster=${NETWORK}\n`);
  }

  console.log("─────────────────────────────────");
  console.log("NEXT STEPS:");
  console.log("1. Go to streamflow.finance → lock team + marketing wallets");
  console.log("2. Run 04_add_liquidity.ts to create Raydium pool");
  console.log("3. Lock LP tokens via Streamflow for 365 days");
}

main().catch(console.error);
