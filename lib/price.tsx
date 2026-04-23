/**
 * 88inf — Live Price & Stats
 * File: lib/price.ts
 *
 * Fetches live token data from DexScreener (free, no API key needed).
 * Also includes a React hook for real-time price updates.
 */

export interface TokenStats {
  priceUsd: number;
  priceChange24h: number;    // percent
  volume24h: number;         // USD
  liquidity: number;         // USD
  marketCap: number;         // USD
  txns24h: number;           // number of transactions
  holders: number;           // approximate
  fdv: number;               // fully diluted valuation
}

const MINT = process.env.NEXT_PUBLIC_MINT_ADDRESS!;
const DEXSCREENER_URL = `https://api.dexscreener.com/latest/dex/tokens/${MINT}`;
const BIRDEYE_URL = `https://public-api.birdeye.so/defi/token_overview?address=${MINT}`;

/** Fetch current token price and stats */
export async function fetchTokenStats(): Promise<TokenStats | null> {
  try {
    const res = await fetch(DEXSCREENER_URL, {
      next: { revalidate: 60 }, // cache for 60 seconds in Next.js
    });
    const data = await res.json();
    const pair = data.pairs?.[0];
    if (!pair) return null;

    return {
      priceUsd: parseFloat(pair.priceUsd) || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      volume24h: pair.volume?.h24 || 0,
      liquidity: pair.liquidity?.usd || 0,
      marketCap: pair.marketCap || 0,
      txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
      holders: 0, // DexScreener doesn't provide this — use Birdeye
      fdv: pair.fdv || 0,
    };
  } catch {
    return null;
  }
}

/** Format price for display (handles very small numbers) */
export function formatPrice(price: number): string {
  if (price === 0) return "$0.00";
  if (price < 0.000001) return `$${price.toExponential(2)}`;
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
}

/** Format large numbers: 1,234,567 → "1.23M" */
export function formatLarge(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/** Convert 88INF amount to USD at current price */
export function toUsd(tokenAmount: number, priceUsd: number): string {
  return (tokenAmount * priceUsd).toFixed(4);
}

/** Convert ILS to 88INF tokens at current price */
export function ilsToTokens(ils: number, priceUsd: number, ilsToUsdRate: number): number {
  const usd = ils * ilsToUsdRate;
  return Math.ceil(usd / priceUsd);
}

// ── React hook ────────────────────────────────────────────────────────────────

// File: lib/usePrice.ts
import { useState, useEffect } from "react";

export function useTokenPrice(refreshInterval = 30_000) {
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await fetchTokenStats();
      if (data) {
        setStats(data);
        setError(null);
      } else {
        // Fallback to launch price if not listed yet
        setStats({
          priceUsd: 0.000199,
          priceChange24h: 0,
          volume24h: 0,
          liquidity: 7000,
          marketCap: 17512,
          txns24h: 0,
          holders: 0,
          fdv: 17512,
        });
      }
    } catch (e) {
      setError("Price unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, refreshInterval);
    return () => clearInterval(interval);
  }, []);

  return { stats, loading, error, refresh: load };
}

// ── Price ticker component ────────────────────────────────────────────────────

// File: components/PriceTicker.tsx
import React from "react";

export function PriceTicker() {
  const { stats, loading } = useTokenPrice();

  if (loading) {
    return (
      <div style={{
        display: "flex", gap: 8, alignItems: "center",
        fontSize: 13, color: "#555"
      }}>
        <span>88INF</span>
        <span>טוען...</span>
      </div>
    );
  }

  if (!stats) return null;

  const isPositive = stats.priceChange24h >= 0;

  return (
    <div style={{
      display: "flex", gap: 16, alignItems: "center",
      fontSize: 13, flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
        <span style={{ color: "#555" }}>88INF</span>
        <span style={{ fontWeight: 700 }}>{formatPrice(stats.priceUsd)}</span>
        <span style={{ color: isPositive ? "#4ade80" : "#f87171", fontSize: 12 }}>
          {isPositive ? "+" : ""}{stats.priceChange24h.toFixed(1)}%
        </span>
      </div>
      <div style={{ color: "#333", fontSize: 12 }}>
        Vol: {formatLarge(stats.volume24h)}
      </div>
      <div style={{ color: "#333", fontSize: 12 }}>
        Liq: {formatLarge(stats.liquidity)}
      </div>
    </div>
  );
}
