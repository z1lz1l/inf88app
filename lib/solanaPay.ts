/**
 * 88inf — Solana Pay Full Integration
 * File: lib/solanaPay.ts
 *
 * Handles the complete payment flow:
 * 1. Create payment request (merchant side)
 * 2. Generate QR code
 * 3. Listen for on-chain confirmation
 * 4. Handle off-ramp to ILS (merchant receives shekels)
 *
 * npm install @solana/pay @solana/web3.js bignumber.js qrcode
 */

import {
  createTransfer,
  encodeURL,
  findReference,
  validateTransfer,
  parseURL,
  TransferRequestURL,
} from "@solana/pay";
import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import BigNumber from "bignumber.js";
import QRCode from "qrcode";

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("mainnet-beta"),
  "confirmed"
);

const MINT_88INF = new PublicKey(process.env.NEXT_PUBLIC_MINT_ADDRESS!);
const DECIMALS = 6;

// ─── EXCHANGE RATE ────────────────────────────────────────────────────────────

interface RateCache {
  ils_to_usd: number;
  token_price_usd: number;
  updatedAt: number;
}

let rateCache: RateCache | null = null;

export async function getLiveRates(): Promise<RateCache> {
  // Cache for 60 seconds
  if (rateCache && Date.now() - rateCache.updatedAt < 60_000) {
    return rateCache;
  }

  let ils_to_usd = 0.27; // fallback
  let token_price_usd = 0.000199; // fallback launch price

  try {
    // Fetch ILS/USD rate from frankfurter.app (free, no API key)
    const fxRes = await fetch("https://api.frankfurter.app/latest?from=ILS&to=USD");
    const fxData = await fxRes.json();
    ils_to_usd = fxData.rates?.USD || ils_to_usd;
  } catch {}

  try {
    // Fetch live token price from DexScreener
    const dexRes = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${MINT_88INF.toBase58()}`
    );
    const dexData = await dexRes.json();
    const price = parseFloat(dexData.pairs?.[0]?.priceUsd);
    if (price > 0) token_price_usd = price;
  } catch {}

  rateCache = { ils_to_usd, token_price_usd, updatedAt: Date.now() };
  return rateCache;
}

export async function ilsToTokenAmount(ils: number): Promise<BigNumber> {
  const rates = await getLiveRates();
  const usd = ils * rates.ils_to_usd;
  const tokens = usd / rates.token_price_usd;
  // Round up to nearest whole token (6 decimal places)
  return new BigNumber(tokens).decimalPlaces(6, BigNumber.ROUND_UP);
}

// ─── CREATE PAYMENT REQUEST ───────────────────────────────────────────────────

export interface PaymentRequest {
  reference: PublicKey;
  url: string;
  qrDataUrl: string;
  amountIls: number;
  amountTokens: BigNumber;
  merchantWallet: PublicKey;
  expiresAt: number;
}

export async function createPaymentRequest(
  merchantWalletAddress: string,
  amountIls: number,
  label: string = "88inf Payment",
  message: string = "Thank you!"
): Promise<PaymentRequest> {
  const merchantWallet = new PublicKey(merchantWalletAddress);
  const amountTokens = await ilsToTokenAmount(amountIls);

  // Unique reference key for this payment — used to detect on-chain confirmation
  const reference = Keypair.generate().publicKey;

  // Build Solana Pay URL (SPL token transfer)
  const url = encodeURL({
    recipient: merchantWallet,
    splToken: MINT_88INF,
    amount: amountTokens as any,
    reference,
    label,
    message,
    memo: `88inf:₪${amountIls}`,
  });

  // Generate QR code
  const qrDataUrl = await QRCode.toDataURL(url.toString(), {
    width: 320,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });

  return {
    reference,
    url: url.toString(),
    qrDataUrl,
    amountIls,
    amountTokens,
    merchantWallet,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  };
}

// ─── LISTEN FOR PAYMENT ───────────────────────────────────────────────────────

export interface PaymentResult {
  confirmed: boolean;
  signature?: string;
  error?: string;
}

/**
 * Polls the blockchain every 2 seconds until payment is confirmed or timeout.
 * Uses the reference public key to find the transaction.
 */
export async function waitForPaymentConfirmation(
  request: PaymentRequest,
  onProgress?: (status: string) => void
): Promise<PaymentResult> {
  const deadline = request.expiresAt;

  while (Date.now() < deadline) {
    try {
      // findReference looks for any transaction that includes our reference key
      const signatureInfo = await findReference(connection, request.reference, {
        finality: "confirmed",
      });

      onProgress?.("אימות תשלום...");

      // Validate the transfer is correct amount + token
      await validateTransfer(
        connection,
        signatureInfo.signature,
        {
          recipient: request.merchantWallet,
          amount: request.amountTokens as any,
          splToken: MINT_88INF,
          reference: request.reference,
        },
        { commitment: "confirmed" }
      );

      return {
        confirmed: true,
        signature: signatureInfo.signature,
      };
    } catch (err: any) {
      // findReference throws if not found yet — that's expected
      if (err.message?.includes("not found")) {
        onProgress?.("ממתין לתשלום...");
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      // Validation error — wrong amount or token
      return {
        confirmed: false,
        error: `תשלום לא תקין: ${err.message}`,
      };
    }
  }

  return { confirmed: false, error: "פג תוקף הבקשה (5 דקות)" };
}

// ─── OFF-RAMP: TOKEN → ILS ────────────────────────────────────────────────────
/**
 * After merchant receives 88INF, this queues conversion to ILS.
 *
 * Flow:
 * 1. Merchant's 88INF is swapped to USDC via Jupiter (buyback.ts does the reverse)
 * 2. USDC is converted to ILS via a banking API (Coinbase Commerce or similar)
 * 3. ILS is transferred to merchant's bank account within 24h
 *
 * For MVP: accumulate daily and batch-convert.
 * For production: use Coinbase Commerce or Banxa for real-time off-ramp.
 */
export async function queueOffRamp(
  merchantId: string,
  tokenAmount: BigNumber,
  amountIls: number,
  txSignature: string
) {
  // Store in Firestore for processing
  const { db } = await import("@/lib/firebase");
  const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");

  await addDoc(collection(db, "offRampQueue"), {
    merchantId,
    tokenAmount: tokenAmount.toFixed(6),
    amountIls,
    txSignature,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

// ─── PAYMENT HISTORY ─────────────────────────────────────────────────────────

export interface PaymentRecord {
  id: string;
  amountIls: number;
  amountTokens: string;
  txSignature: string;
  timestamp: number;
  status: "confirmed" | "pending_offramp" | "settled";
}

export async function getMerchantPayments(
  merchantId: string,
  limit = 20
): Promise<PaymentRecord[]> {
  const { db } = await import("@/lib/firebase");
  const {
    collection, query, where, orderBy, limit: fbLimit, getDocs
  } = await import("firebase/firestore");

  const q = query(
    collection(db, "merchantPayments"),
    where("merchantId", "==", merchantId),
    orderBy("timestamp", "desc"),
    fbLimit(limit)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentRecord));
}

// ─── PAYMENT SUMMARY WIDGET (for merchant terminal) ──────────────────────────

export function formatPaymentSummary(records: PaymentRecord[]) {
  const today = new Date().toDateString();
  const todayPayments = records.filter(
    r => new Date(r.timestamp).toDateString() === today
  );

  return {
    todayCount: todayPayments.length,
    todayIls: todayPayments.reduce((s, r) => s + r.amountIls, 0),
    totalCount: records.length,
    totalIls: records.reduce((s, r) => s + r.amountIls, 0),
    lastPayment: records[0] || null,
  };
}
