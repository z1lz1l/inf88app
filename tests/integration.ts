/**
 * 88inf — Integration Test Suite
 * File: tests/integration.ts
 *
 * Validates the full system before going live.
 * Run on Devnet BEFORE deploying to Mainnet.
 *
 * npx ts-node tests/integration.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getMint,
  getTransferFeeConfig,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as dotenv from "dotenv";
dotenv.config();

const RPC = "https://api.devnet.solana.com";
const connection = new Connection(RPC, "confirmed");

// ── Colors ────────────────────────────────────────────────────────────────────
const G = "\x1b[32m"; // green
const R = "\x1b[31m"; // red
const Y = "\x1b[33m"; // yellow
const B = "\x1b[36m"; // blue
const X = "\x1b[0m";  // reset

let passed = 0, failed = 0;

function ok(msg: string) { console.log(`  ${G}✓${X} ${msg}`); passed++; }
function fail(msg: string, detail?: string) {
  console.log(`  ${R}✗${X} ${msg}`);
  if (detail) console.log(`    ${R}${detail}${X}`);
  failed++;
}
function section(title: string) { console.log(`\n${B}▶ ${title}${X}`); }
function info(msg: string) { console.log(`  ${Y}→${X} ${msg}`); }

// ─── TEST SUITE ───────────────────────────────────────────────────────────────

async function testTokenConfig() {
  section("Token Configuration");

  const MINT_ADDRESS = process.env.MINT_ADDRESS;
  if (!MINT_ADDRESS) { fail("MINT_ADDRESS not set in .env"); return; }

  let mint: Awaited<ReturnType<typeof getMint>>;
  try {
    mint = await getMint(
      connection,
      new PublicKey(MINT_ADDRESS),
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
  } catch (e: any) {
    fail("Could not fetch mint — is the token created on Devnet?", e.message);
    return;
  }

  // Supply check
  const supply = Number(mint.supply) / 10 ** mint.decimals;
  if (Math.abs(supply - 88_000_000) < 1) {
    ok(`Supply = ${supply.toLocaleString()} 88INF`);
  } else {
    fail(`Supply mismatch: expected 88,000,000 got ${supply.toLocaleString()}`);
  }

  // Decimals
  if (mint.decimals === 6) ok("Decimals = 6 ✓");
  else fail(`Decimals wrong: expected 6, got ${mint.decimals}`);

  // Mint authority revoked
  if (mint.mintAuthority === null) ok("Mint authority = REVOKED ✓");
  else fail("Mint authority NOT revoked — run 02_revoke_mint.ts!");

  // Freeze authority = none
  if (mint.freezeAuthority === null) ok("Freeze authority = NONE ✓");
  else fail("Freeze authority is set — should be null for trust!");

  // Transfer fee config
  const feeConfig = getTransferFeeConfig(mint);
  if (!feeConfig) {
    fail("Transfer fee config NOT found — token needs Token-2022 extension");
    return;
  }

  const basisPoints = feeConfig.newerTransferFee.transferFeeBasisPoints;
  if (basisPoints === 30) ok("Transfer fee = 30 basis points (0.3%) ✓");
  else fail(`Transfer fee wrong: expected 30bp, got ${basisPoints}bp`);

  info(`Mint address: ${MINT_ADDRESS}`);
}

async function testWalletBalances() {
  section("Wallet Balances");

  const wallets = {
    "Deployer":   process.env.DEPLOYER_WALLET,
    "Liquidity":  process.env.LIQUIDITY_WALLET,
    "App Rewards":process.env.APP_REWARDS_WALLET,
    "Marketing":  process.env.MARKETING_WALLET,
    "Team":       process.env.TEAM_WALLET,
  };

  const MINT_ADDRESS = process.env.MINT_ADDRESS;
  if (!MINT_ADDRESS) { fail("MINT_ADDRESS not set"); return; }
  const mint = new PublicKey(MINT_ADDRESS);

  const expectedPct: Record<string, number> = {
    "Liquidity":   0.40,
    "App Rewards": 0.30,
    "Marketing":   0.20,
    "Team":        0.10,
  };

  for (const [name, addr] of Object.entries(wallets)) {
    if (!addr) { fail(`${name} wallet not configured`); continue; }

    try {
      const pk = new PublicKey(addr);
      const ata2 = getAssociatedTokenAddressSync(mint, pk, false, TOKEN_2022_PROGRAM_ID);
      const account = await getAccount(connection, ata2, "confirmed", TOKEN_2022_PROGRAM_ID);
      const balance = Number(account.amount) / 1e6;

      if (name in expectedPct) {
        const expected = 88_000_000 * expectedPct[name];
        const diff = Math.abs(balance - expected);
        const tolerance = expected * 0.001; // 0.1% tolerance
        if (diff <= tolerance) {
          ok(`${name}: ${balance.toLocaleString()} 88INF (${(expectedPct[name]*100).toFixed(0)}%) ✓`);
        } else {
          fail(`${name}: ${balance.toLocaleString()} 88INF (expected ${expected.toLocaleString()})`);
        }
      } else {
        ok(`${name}: ${balance.toLocaleString()} 88INF`);
      }
    } catch {
      fail(`${name}: no token account found (run 03_distribute.ts)`);
    }
  }
}

async function testRpcConnection() {
  section("Network & RPC");

  try {
    const slot = await connection.getSlot();
    ok(`Devnet connected — slot ${slot.toLocaleString()}`);
  } catch {
    fail("Cannot connect to Devnet RPC");
  }

  try {
    const version = await connection.getVersion();
    ok(`Solana version ${version["solana-core"]}`);
  } catch {
    fail("Cannot get Solana version");
  }
}

async function testEnvVars() {
  section("Environment Variables");

  const required = [
    "MINT_ADDRESS",
    "PRIVATE_KEY",
    "TREASURY_PRIVATE_KEY",
    "CRON_SECRET",
    "FIREBASE_SERVICE_ACCOUNT",
    "NEXT_PUBLIC_PRIVY_APP_ID",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_SOLANA_RPC",
  ];

  const optional = [
    "VAPID_PUBLIC_KEY",
    "TELEGRAM_BOT_TOKEN",
    "OPS_PRIVATE_KEY",
    "REWARDS_WALLET",
    "OPS_WALLET",
    "COMPANY_WALLET",
  ];

  for (const key of required) {
    if (process.env[key]) ok(`${key} is set`);
    else fail(`${key} is MISSING — required!`);
  }

  for (const key of optional) {
    if (process.env[key]) ok(`${key} is set`);
    else info(`${key} not set (optional)`);
  }
}

async function testApiHealth() {
  section("API Health");

  const API_URL = process.env.API_BASE || "http://localhost:3001";

  try {
    const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) ok(`API at ${API_URL} is healthy`);
    else fail(`API returned ${res.status}`);
  } catch {
    fail(`API not reachable at ${API_URL} — is the server running?`);
  }
}

async function testDexScreener() {
  section("DexScreener Integration");

  const MINT_ADDRESS = process.env.MINT_ADDRESS;
  if (!MINT_ADDRESS) { info("Skip — no MINT_ADDRESS"); return; }

  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${MINT_ADDRESS}`
    );
    const data = await res.json();
    if (data.pairs?.length > 0) {
      const pair = data.pairs[0];
      ok(`Listed on DexScreener: $${pair.priceUsd}`);
      ok(`Liquidity: $${pair.liquidity?.usd?.toFixed(0)}`);
      ok(`Volume 24h: $${pair.volume?.h24?.toFixed(0)}`);
    } else {
      info("Not yet listed on DexScreener (normal before first trade)");
    }
  } catch {
    fail("Cannot reach DexScreener API");
  }
}

// ─── RUN ALL TESTS ────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${B}════════════════════════════════════${X}`);
  console.log(`${B} 88inf Integration Test Suite${X}`);
  console.log(`${B}════════════════════════════════════${X}`);

  await testRpcConnection();
  await testEnvVars();
  await testTokenConfig();
  await testWalletBalances();
  await testApiHealth();
  await testDexScreener();

  // Summary
  const total = passed + failed;
  const allPassed = failed === 0;
  console.log(`\n${B}════════════════════════════════════${X}`);
  console.log(
    allPassed
      ? `${G}✓ All ${total} tests passed! Ready for Mainnet.${X}`
      : `${R}✗ ${failed} of ${total} tests failed. Fix before going to Mainnet.${X}`
  );

  if (!allPassed) {
    console.log(`\n${Y}Next steps:${X}`);
    console.log("  1. Fix all ✗ errors above");
    console.log("  2. Run: npm run devnet:create (if token not created)");
    console.log("  3. Run: npm run devnet:revoke");
    console.log("  4. Run: npm run devnet:distribute");
    console.log("  5. Re-run this test suite");
    console.log("  6. Only then: npm run mainnet:create");
  }

  console.log();
  process.exit(allPassed ? 0 : 1);
}

main().catch(e => {
  console.error(R, "Fatal error:", e.message, X);
  process.exit(1);
});
