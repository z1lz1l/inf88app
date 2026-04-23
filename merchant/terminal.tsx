/**
 * 88inf — Merchant Payment Terminal
 * File: merchant/terminal.tsx
 *
 * Simple web app for businesses to:
 * 1. Enter an amount in ILS (₪)
 * 2. Show QR code using Solana Pay
 * 3. Confirm payment received
 *
 * Install: npm install @solana/pay @solana/web3.js qrcode.react
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicKey, Connection } from "@solana/web3.js";
import QRCode from "qrcode";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const TOKEN_PRICE_USD = 0.000199;   // fetch live from DexScreener in production
const ILS_TO_USD = 0.27;            // fetch live from forex API in production
const MERCHANT_WALLET = new PublicKey(process.env.NEXT_PUBLIC_MERCHANT_WALLET!);
const MINT = new PublicKey(process.env.NEXT_PUBLIC_MINT_ADDRESS!);
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC!;

type Screen = "amount" | "qr" | "confirmed" | "failed";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function ilsToTokens(ils: number): number {
  const usd = ils * ILS_TO_USD;
  return Math.ceil(usd / TOKEN_PRICE_USD);
}

/** Build a Solana Pay URL for SPL token payment */
function buildSolanaPayUrl(tokenAmount: number, reference: PublicKey, label: string): string {
  const amount = (tokenAmount / 1e6).toFixed(6); // convert from raw
  const params = new URLSearchParams({
    "spl-token": MINT.toBase58(),
    amount,
    reference: reference.toBase58(),
    label: `88inf · ${label}`,
    message: "Thank you for your payment",
  });
  return `solana:${MERCHANT_WALLET.toBase58()}?${params.toString()}`;
}

/** Poll for transaction confirmation */
async function waitForPayment(reference: PublicKey): Promise<string | null> {
  const connection = new Connection(RPC, "confirmed");
  const deadline = Date.now() + 5 * 60 * 1000; // 5 minutes

  while (Date.now() < deadline) {
    const sigs = await connection.getSignaturesForAddress(reference, { limit: 1 });
    if (sigs.length > 0) {
      return sigs[0].signature;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function MerchantTerminal() {
  const [screen, setScreen] = useState<Screen>("amount");
  const [ils, setIls] = useState("");
  const [tokens, setTokens] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [reference, setReference] = useState<PublicKey | null>(null);
  const [txSig, setTxSig] = useState("");
  const [polling, setPolling] = useState(false);

  // Recalculate tokens when amount changes
  useEffect(() => {
    const n = parseFloat(ils);
    if (n > 0) setTokens(ilsToTokens(n));
    else setTokens(0);
  }, [ils]);

  const startPayment = useCallback(async () => {
    if (!tokens || tokens <= 0) return;

    // Generate fresh reference key for this transaction
    const { Keypair } = await import("@solana/web3.js");
    const ref = Keypair.generate().publicKey;
    setReference(ref);

    // Build Solana Pay URL
    const url = buildSolanaPayUrl(tokens * 1e6, ref, `₪${ils}`);

    // Generate QR code
    const qr = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
    setQrDataUrl(qr);
    setScreen("qr");

    // Start polling for confirmation
    setPolling(true);
    const sig = await waitForPayment(ref);
    setPolling(false);

    if (sig) {
      setTxSig(sig);
      setScreen("confirmed");
    } else {
      setScreen("failed");
    }
  }, [tokens, ils]);

  function reset() {
    setScreen("amount");
    setIls("");
    setTokens(0);
    setQrDataUrl("");
    setReference(null);
    setTxSig("");
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const base: React.CSSProperties = {
    minHeight: "100vh",
    background: "#080808",
    color: "#e8e8e8",
    fontFamily: "'SF Pro Display', -apple-system, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  };

  const card: React.CSSProperties = {
    background: "#0e0e0e",
    border: "1px solid #1a1a1a",
    borderRadius: 20,
    padding: 32,
    width: "100%",
    maxWidth: 360,
    textAlign: "center",
  };

  // ── Screens ───────────────────────────────────────────────────────────────

  if (screen === "amount") {
    return (
      <div style={base}>
        <div style={{ marginBottom: 8, fontSize: 20, fontWeight: 700 }}>
          88<span style={{ color: "#f59e0b" }}>inf</span> Terminal
        </div>
        <div style={{ fontSize: 12, color: "#444", marginBottom: 32 }}>
          קבל תשלום ממשתמשי 88INF
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>
            הכנס סכום לתשלום
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 28, color: "#555" }}>₪</span>
            <input
              type="number"
              value={ils}
              onChange={(e) => setIls(e.target.value)}
              placeholder="0.00"
              style={{
                background: "transparent",
                border: "none",
                fontSize: 48,
                fontWeight: 700,
                color: "#e8e8e8",
                width: 180,
                outline: "none",
                textAlign: "center",
              }}
            />
          </div>
          {tokens > 0 && (
            <div style={{ fontSize: 14, color: "#555", marginBottom: 24 }}>
              = {tokens.toLocaleString()} 88INF
            </div>
          )}
          <button
            onClick={startPayment}
            disabled={!tokens || tokens <= 0}
            style={{
              width: "100%",
              padding: "16px 0",
              borderRadius: 12,
              border: "none",
              background: tokens > 0 ? "#f59e0b" : "#1a1a1a",
              color: tokens > 0 ? "#000" : "#333",
              fontWeight: 700,
              fontSize: 16,
              cursor: tokens > 0 ? "pointer" : "default",
            }}
          >
            הצג QR לתשלום
          </button>
        </div>
      </div>
    );
  }

  if (screen === "qr") {
    return (
      <div style={base}>
        <div style={card}>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>
            סכום לתשלום
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
            ₪{ils}
          </div>
          <div style={{ fontSize: 13, color: "#f59e0b", marginBottom: 24 }}>
            {tokens.toLocaleString()} 88INF
          </div>

          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="QR Code"
              style={{ borderRadius: 12, width: 240, height: 240, margin: "0 auto 24px" }}
            />
          )}

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, color: "#555", fontSize: 13
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#f59e0b",
              animation: "pulse 1s infinite",
            }} />
            {polling ? "ממתין לאישור תשלום..." : "מתחבר..."}
          </div>

          <button
            onClick={reset}
            style={{
              marginTop: 20,
              background: "transparent",
              border: "1px solid #1a1a1a",
              color: "#555",
              borderRadius: 10,
              padding: "10px 24px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            ביטול
          </button>
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      </div>
    );
  }

  if (screen === "confirmed") {
    return (
      <div style={base}>
        <div style={card}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✓</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#4ade80", marginBottom: 8 }}>
            תשלום אושר!
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>₪{ils}</div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 24 }}>
            {tokens.toLocaleString()} 88INF התקבלו
          </div>
          <div style={{
            background: "#0a0a0a",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 11,
            color: "#333",
            wordBreak: "break-all",
            marginBottom: 20,
          }}>
            TX: {txSig.slice(0, 20)}...
          </div>
          <button
            onClick={reset}
            style={{
              width: "100%",
              padding: "14px 0",
              borderRadius: 12,
              border: "none",
              background: "#f59e0b",
              color: "#000",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            עסקה חדשה
          </button>
        </div>
      </div>
    );
  }

  // Failed
  return (
    <div style={base}>
      <div style={card}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✕</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#f87171", marginBottom: 8 }}>
          התשלום לא הושלם
        </div>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 24 }}>
          פג תוקף הבקשה (5 דקות)
        </div>
        <button
          onClick={reset}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: 12,
            border: "none",
            background: "#f59e0b",
            color: "#000",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          נסה שוב
        </button>
      </div>
    </div>
  );
}
