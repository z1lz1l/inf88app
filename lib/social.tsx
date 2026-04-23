/**
 * 88inf — Social Sharing & Viral Growth
 * File: lib/social.ts
 *
 * Everything needed to make 88inf spread virally:
 * - Dynamic OG images for referral links
 * - Pre-written share text for every occasion
 * - Telegram bot integration for community alerts
 * - Twitter/X card support
 */

// ─── SHARE TEMPLATES ──────────────────────────────────────────────────────────

interface ShareContext {
  balance?: number;
  level?: number;
  streak?: number;
  referralCode?: string;
  milestone?: string;
  priceUsd?: number;
  priceChange?: number;
}

export function getShareText(
  type: "referral" | "milestone" | "price" | "withdrawal" | "payment",
  ctx: ShareContext
): string {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.88inf.com";

  switch (type) {
    case "referral":
      return `הצטרף ל-88INF וקבל 100 מטבעות בונוס! 🎁

המטבע הדפלציוני עם 88 מיליון מטבעות בלבד.
הרוויח על זמן תשומת הלב שלך.
שלם בעסקים.
קבל APY אוטומטי.

${APP_URL}/?ref=${ctx.referralCode}

#88INF #Solana #DeFi`;

    case "milestone":
      return `${ctx.milestone} 🔥

יש לי ${ctx.balance?.toLocaleString()} 88INF ורצף של ${ctx.streak} ימים!

הרוויח גם אתה: ${APP_URL}/?ref=${ctx.referralCode}
#88INF #Crypto`;

    case "price":
      const dir = (ctx.priceChange || 0) >= 0 ? "📈" : "📉";
      return `${dir} 88INF עכשיו ב-$${ctx.priceUsd?.toFixed(8)}
${(ctx.priceChange || 0) >= 0 ? "+" : ""}${ctx.priceChange?.toFixed(1)}% ב-24 שעות

88,000,000 מטבעות בלבד — לנצח.
קנה: raydium.io
#88INF #Solana`;

    case "withdrawal":
      return `משכתי ${ctx.balance?.toLocaleString()} 88INF לארנק שלי! 💰

הרוויח גם אתה: ${APP_URL}
#88INF`;

    case "payment":
      return `שילמתי עם #88INF בעסק אמיתי! ⬡

מהיר כמו כרטיס אשראי, עמלה של 0.3% בלבד.
הורד: ${APP_URL}`;
  }
}

// ─── NATIVE SHARE + FALLBACKS ────────────────────────────────────────────────

export interface ShareResult {
  method: "native" | "clipboard" | "whatsapp" | "telegram";
  success: boolean;
}

export async function shareContent(
  text: string,
  url: string,
  preferredMethod?: "whatsapp" | "telegram"
): Promise<ShareResult> {
  // Try native share first (mobile)
  if (navigator.share && !preferredMethod) {
    try {
      await navigator.share({ text, url });
      return { method: "native", success: true };
    } catch (e: any) {
      if (e.name !== "AbortError") {
        // Fall through to other methods
      } else {
        return { method: "native", success: false }; // user cancelled
      }
    }
  }

  // WhatsApp
  if (preferredMethod === "whatsapp") {
    const waText = encodeURIComponent(`${text}\n${url}`);
    window.open(`https://wa.me/?text=${waText}`, "_blank");
    return { method: "whatsapp", success: true };
  }

  // Telegram
  if (preferredMethod === "telegram") {
    const tgText = encodeURIComponent(text);
    const tgUrl = encodeURIComponent(url);
    window.open(`https://t.me/share/url?url=${tgUrl}&text=${tgText}`, "_blank");
    return { method: "telegram", success: true };
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return { method: "clipboard", success: true };
  } catch {
    return { method: "clipboard", success: false };
  }
}

// ─── COMPONENT: Share Sheet ───────────────────────────────────────────────────

"use client";
import React, { useState } from "react";

interface ShareSheetProps {
  text: string;
  url: string;
  onClose: () => void;
  onShared?: (method: string) => void;
}

export function ShareSheet({ text, url, onClose, onShared }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);

  async function share(method?: "whatsapp" | "telegram") {
    const result = await shareContent(text, url, method);
    if (result.success) {
      onShared?.(result.method);
      if (result.method === "clipboard") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        onClose();
      }
    }
  }

  const buttons = [
    { label: "WhatsApp", icon: "💬", color: "#25d366", method: "whatsapp" as const },
    { label: "Telegram", icon: "✈", color: "#229ed9", method: "telegram" as const },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,.7)",
      display: "flex", alignItems: "flex-end",
      justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div
        style={{
          background: "#0e0e0e",
          border: "1px solid #1a1a1a",
          borderRadius: "20px 20px 0 0",
          padding: 24, width: "100%", maxWidth: 440,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: "#333", margin: "0 auto 20px",
        }} />

        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
          שתף 88INF
        </div>

        {/* Preview */}
        <div style={{
          background: "#080808", border: "1px solid #1a1a1a",
          borderRadius: 10, padding: 12, marginBottom: 16,
          fontSize: 12, color: "#555", lineHeight: 1.6,
          whiteSpace: "pre-wrap", maxHeight: 80, overflow: "hidden",
        }}>
          {text.slice(0, 120)}...
        </div>

        {/* Share buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          {buttons.map(btn => (
            <button
              key={btn.method}
              onClick={() => share(btn.method)}
              style={{
                padding: "12px 0",
                borderRadius: 10,
                border: "none",
                background: `${btn.color}18`,
                color: btn.color,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {btn.icon} {btn.label}
            </button>
          ))}
        </div>

        {/* Copy link */}
        <button
          onClick={() => share()}
          style={{
            width: "100%", padding: "12px 0",
            borderRadius: 10,
            border: "1px solid #1a1a1a",
            background: copied ? "rgba(74,222,128,.08)" : "transparent",
            color: copied ? "#4ade80" : "#555",
            fontSize: 14, cursor: "pointer",
            transition: "all .2s",
          }}
        >
          {copied ? "✓ הועתק ללוח!" : "📋 העתק קישור"}
        </button>
      </div>
    </div>
  );
}

// ─── TELEGRAM BOT INTEGRATION ─────────────────────────────────────────────────
/**
 * Send announcements to the 88inf Telegram channel.
 * Add your bot token to .env: TELEGRAM_BOT_TOKEN=
 * Channel: @88inf
 */

export async function sendTelegramAnnouncement(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID || "@88inf";

  if (!token) return false;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: channelId,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ─── AUTO ANNOUNCEMENTS ───────────────────────────────────────────────────────
// Called by cron or admin dashboard

export const TelegramTemplates = {
  newUser: (count: number) =>
    `🚀 <b>88INF Community Update</b>\n\n` +
    `${count.toLocaleString()} משתמשים רשומים ✅\n\n` +
    `הצטרף: https://app.88inf.com`,

  priceMilestone: (price: string, mcap: string) =>
    `📈 <b>88INF Price Update</b>\n\n` +
    `מחיר: <code>$${price}</code>\n` +
    `Market Cap: <code>$${mcap}</code>\n\n` +
    `📊 Trade: https://raydium.io`,

  apyDistributed: (totalTokens: number, recipients: number) =>
    `💰 <b>APY חולק!</b>\n\n` +
    `${totalTokens.toLocaleString()} 88INF חולקו ל-${recipients.toLocaleString()} מחזיקים\n\n` +
    `הרוויח יותר: https://app.88inf.com`,

  newMerchant: (businessName: string, city: string) =>
    `🏪 <b>עסק חדש מקבל 88INF!</b>\n\n` +
    `${businessName} — ${city}\n\n` +
    `בוא לשלם עם 88INF 👉 https://app.88inf.com`,
};
