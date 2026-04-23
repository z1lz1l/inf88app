/**
 * 88inf — Step 2: Revoke Mint Authority
 *
 * This makes the 88M supply PERMANENT. No one — not even you —
 * can ever print more tokens after this script runs.
 *
 * Run AFTER 01_create_token.ts and BEFORE adding liquidity.
 * This is the most important trust signal for investors.
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
  createSetAuthorityInstruction,
  AuthorityType,
} from "@solana/spl-token";
import * as dotenv from "dotenv";
dotenv.config();

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

  console.log(`\n🔒 Revoking mint authority for ${MINT_ADDRESS}`);
  console.log("After this, no more tokens can EVER be created.");

  const tx = new Transaction();

  // Revoke MintTokens authority → null
  tx.add(
    createSetAuthorityInstruction(
      mint,
      payer.publicKey,
      AuthorityType.MintTokens,
      null, // null = permanently revoked
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [payer]);

  console.log(`\n✅ Mint authority REVOKED`);
  console.log(`TX: https://solscan.io/tx/${sig}?cluster=${NETWORK}`);
  console.log(`\nVerify on Solscan that "Mint Authority" shows "Disabled" ✓`);
}

main().catch(console.error);
