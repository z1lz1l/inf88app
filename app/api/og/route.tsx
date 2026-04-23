/**
 * 88inf — Dynamic OG Image Generation
 * File: app/api/og/route.tsx
 *
 * Generates personalized social preview images using Next.js Edge Runtime.
 * Each referral link gets a unique card showing the user's stats.
 *
 * npm install @vercel/og
 *
 * URL format:
 * /api/og?type=referral&code=ABC12345&balance=5000&level=3
 * /api/og?type=price&price=0.000450&change=127
 * /api/og?type=default
 */

import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "default";
  const code = searchParams.get("code") || "";
  const balance = parseInt(searchParams.get("balance") || "0");
  const level = parseInt(searchParams.get("level") || "1");
  const price = searchParams.get("price") || "0.000199";
  const change = parseFloat(searchParams.get("change") || "0");

  const AMBER = "#f59e0b";
  const DARK = "#080808";
  const DARK2 = "#0e0e0e";
  const MUTED = "#555555";
  const LIGHT = "#e8e8e8";

  // ── DEFAULT / MAIN ────────────────────────────────────────────────────────

  if (type === "default") {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%", height: "100%",
            background: DARK,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            fontFamily: "sans-serif",
            border: `1px solid #1a1a1a`,
          }}
        >
          {/* Logo */}
          <div style={{ fontSize: 72, fontWeight: 800, color: LIGHT, marginBottom: 8 }}>
            88<span style={{ color: AMBER }}>INF</span>
          </div>
          <div style={{ fontSize: 22, color: MUTED, marginBottom: 48 }}>
            הרוויח. שלם. החזק לנצח.
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 40 }}>
            {[
              ["88M", "היצע מקסימלי"],
              ["0.3%", "עמלה בלבד"],
              ["<1s", "זמן עסקה"],
              ["365d", "נזילות נעולה"],
            ].map(([val, label]) => (
              <div
                key={label}
                style={{
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 4,
                  background: DARK2, border: "1px solid #1a1a1a",
                  borderRadius: 12, padding: "16px 24px",
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 800, color: AMBER }}>{val}</div>
                <div style={{ fontSize: 13, color: MUTED }}>{label}</div>
              </div>
            ))}
          </div>

          {/* URL */}
          <div style={{ marginTop: 40, fontSize: 16, color: "#333" }}>
            app.88inf.com
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // ── REFERRAL CARD ─────────────────────────────────────────────────────────

  if (type === "referral") {
    const levelNames = ["", "Newcomer", "Explorer", "Collector", "Staker", "Miner", "Hodler", "Whale", "Legend"];
    const levelName = levelNames[Math.min(level, 8)] || "Newcomer";

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%", height: "100%",
            background: DARK,
            display: "flex", flexDirection: "column",
            padding: 60, fontFamily: "sans-serif",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 40 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: LIGHT }}>
              88<span style={{ color: AMBER }}>INF</span>
            </div>
            <div
              style={{
                background: `${AMBER}18`,
                border: `1px solid ${AMBER}44`,
                borderRadius: 20,
                padding: "8px 20px",
                fontSize: 14, color: AMBER, fontWeight: 600,
              }}
            >
              קוד הפניה: {code}
            </div>
          </div>

          {/* Main message */}
          <div style={{ fontSize: 48, fontWeight: 800, color: LIGHT, marginBottom: 8, lineHeight: 1.1 }}>
            קבל 100 88INF
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, color: AMBER, marginBottom: 32, lineHeight: 1.1 }}>
            בונוס הצטרפות! 🎁
          </div>

          <div style={{ fontSize: 20, color: MUTED, marginBottom: 48 }}>
            חבר שלך כבר מחזיק {balance.toLocaleString()} 88INF · Level {level} {levelName}
          </div>

          {/* Features */}
          <div style={{ display: "flex", gap: 20 }}>
            {[
              "✓ ארנק ללא seed phrase",
              "✓ הרוויח על פרסומות",
              "✓ שלם בעסקים",
              "✓ APY אוטומטי",
            ].map(f => (
              <div
                key={f}
                style={{
                  background: DARK2, border: "1px solid #1a1a1a",
                  borderRadius: 10, padding: "10px 16px",
                  fontSize: 14, color: LIGHT,
                }}
              >
                {f}
              </div>
            ))}
          </div>

          {/* URL */}
          <div style={{ marginTop: "auto", fontSize: 18, color: "#333" }}>
            app.88inf.com/?ref={code}
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // ── PRICE UPDATE ──────────────────────────────────────────────────────────

  if (type === "price") {
    const isPositive = change >= 0;
    const changeColor = isPositive ? "#4ade80" : "#f87171";

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%", height: "100%",
            background: DARK,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ fontSize: 28, color: MUTED, marginBottom: 16 }}>88INF</div>
          <div style={{ fontSize: 80, fontWeight: 800, color: AMBER, marginBottom: 16, fontFamily: "monospace" }}>
            ${price}
          </div>
          <div
            style={{
              fontSize: 32, fontWeight: 700,
              color: changeColor,
              background: `${changeColor}18`,
              padding: "10px 28px",
              borderRadius: 20,
              marginBottom: 48,
            }}
          >
            {isPositive ? "+" : ""}{change.toFixed(1)}% (24h)
          </div>
          <div style={{ fontSize: 18, color: MUTED }}>
            88,000,000 מטבעות · לנצח · Solana
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // Default fallback
  return new Response("Not found", { status: 404 });
}
