/**
 * 88inf — Referral System
 * File: lib/referral.ts + components/ReferralCard.tsx
 *
 * Full referral system:
 * - Each user gets a unique referral code
 * - Referrer gets 500 88INF per successful signup
 * - New user gets 100 88INF bonus
 * - Multi-level: referrer of referrer gets 50 88INF (optional)
 * - Leaderboard for top referrers
 */

// ── TYPES ─────────────────────────────────────────────────────────────────────

export interface ReferralStats {
  code: string;
  totalReferrals: number;
  pendingRewards: number;    // not yet claimed
  claimedRewards: number;
  rank: number;              // leaderboard position
  referralLink: string;
}

// ── CLIENT: Generate referral link ────────────────────────────────────────────

export function getReferralLink(code: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://app.88inf.com";
  return `${base}/?ref=${code}`;
}

// ── CLIENT: Share referral ─────────────────────────────────────────────────

export async function shareReferral(code: string, displayName: string) {
  const link = getReferralLink(code);
  const text = `הצטרף ל-88INF וקבל 100 מטבעות בונוס! 🎁\n${link}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: "88inf", text, url: link });
      return true;
    } catch {}
  }

  // Fallback: copy to clipboard
  await navigator.clipboard.writeText(text);
  return false; // false = used clipboard
}

// ── SERVER: Apply referral on signup ─────────────────────────────────────────
// Add this logic to the POST /api/reward endpoint or a dedicated /api/referral endpoint

/*
Server-side referral application (add to api.ts):

app.post("/api/referral/apply", authMiddleware, async (req, res) => {
  const { uid } = req;
  const { code } = req.body;

  if (!code || typeof code !== "string" || code.length !== 8) {
    return res.status(400).json({ error: "Invalid referral code" });
  }

  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  // Can't apply if already used a referral
  if (userData?.referredBy) {
    return res.status(400).json({ error: "Referral already applied" });
  }

  // Can't refer yourself
  if (userData?.referralCode === code) {
    return res.status(400).json({ error: "Cannot use your own referral code" });
  }

  // Find the referrer
  const refSnap = await db.collection("users")
    .where("referralCode", "==", code.toUpperCase())
    .limit(1)
    .get();

  if (refSnap.empty) {
    return res.status(404).json({ error: "Referral code not found" });
  }

  const referrerDoc = refSnap.docs[0];
  const referrerUid = referrerDoc.id;

  // Apply rewards atomically
  const batch = db.batch();

  // New user gets 100 88INF bonus
  batch.update(userRef, {
    balance: increment(100),
    totalEarned: increment(100),
    referredBy: code,
  });

  // Referrer gets 500 88INF
  batch.update(referrerDoc.ref, {
    balance: increment(500),
    totalEarned: increment(500),
    totalReferrals: increment(1),
    referralEarnings: increment(500),
  });

  // Log the referral
  batch.set(db.collection("referralLog").doc(), {
    referrerUid,
    newUserUid: uid,
    code,
    referrerReward: 500,
    newUserReward: 100,
    timestamp: Date.now(),
  });

  await batch.commit();

  res.json({
    success: true,
    newUserBonus: 100,
    message: "קיבלת 100 88INF בונוס הצטרפות!",
  });
});
*/

// ── COMPONENT: Referral Card ──────────────────────────────────────────────────

"use client";
import { useState } from "react";

interface ReferralCardProps {
  code: string;
  totalReferrals: number;
  earnings: number;
}

export function ReferralCard({ code, totalReferrals, earnings }: ReferralCardProps) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const link = `https://app.88inf.com/?ref=${code}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    setSharing(true);
    const used_native = await shareReferral(code, "");
    if (!used_native) setCopied(true);
    setTimeout(() => { setCopied(false); setSharing(false); }, 2000);
  }

  return (
    <div style={{
      background: "#0e0e0e",
      border: "1px solid rgba(245,158,11,.2)",
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>קוד ההפניה שלך</div>
          <div style={{
            fontSize: 22, fontWeight: 700, letterSpacing: 3,
            fontFamily: "monospace", color: "#f59e0b",
          }}>
            {code}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>הרווחת</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#4ade80", fontFamily: "monospace" }}>
            {earnings.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: "#555" }}>88INF מהפניות</div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: "flex", gap: 12,
        background: "#080808", borderRadius: 10, padding: "10px 14px",
        marginBottom: 16, fontSize: 13,
      }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ color: "#555", fontSize: 11, marginBottom: 2 }}>חברים שהצטרפו</div>
          <div style={{ fontWeight: 700, color: "#e8e8e8" }}>{totalReferrals}</div>
        </div>
        <div style={{ width: 1, background: "#1a1a1a" }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ color: "#555", fontSize: 11, marginBottom: 2 }}>בונוס לחבר חדש</div>
          <div style={{ fontWeight: 700, color: "#f59e0b" }}>100 88INF</div>
        </div>
        <div style={{ width: 1, background: "#1a1a1a" }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ color: "#555", fontSize: 11, marginBottom: 2 }}>בונוס לך</div>
          <div style={{ fontWeight: 700, color: "#f59e0b" }}>500 88INF</div>
        </div>
      </div>

      {/* Link display */}
      <div style={{
        background: "#080808", border: "1px solid #1a1a1a",
        borderRadius: 8, padding: "10px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12, gap: 8,
      }}>
        <div style={{ fontSize: 12, color: "#444", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {link}
        </div>
        <button
          onClick={handleCopy}
          style={{
            background: copied ? "rgba(74,222,128,.1)" : "transparent",
            border: `1px solid ${copied ? "rgba(74,222,128,.3)" : "#222"}`,
            borderRadius: 6, padding: "5px 10px",
            fontSize: 11, color: copied ? "#4ade80" : "#555",
            cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          {copied ? "✓ הועתק!" : "העתק"}
        </button>
      </div>

      {/* Share buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button onClick={handleShare} style={{
          background: "#f59e0b", border: "none", borderRadius: 10,
          padding: "11px 0", fontSize: 14, fontWeight: 600,
          color: "#000", cursor: "pointer",
        }}>
          {sharing ? "שולח..." : "שתף עכשיו ↗"}
        </button>
        <button onClick={handleCopy} style={{
          background: "transparent", border: "1px solid #1a1a1a",
          borderRadius: 10, padding: "11px 0",
          fontSize: 14, color: "#555", cursor: "pointer",
        }}>
          העתק קישור
        </button>
      </div>
    </div>
  );
}

// ── COMPONENT: Referral Leaderboard ──────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  referrals: number;
  earnings: number;
}

export function ReferralLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div style={{
      background: "#0e0e0e", border: "1px solid #1a1a1a",
      borderRadius: 16, padding: 20,
    }}>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 16, letterSpacing: 1 }}>
        TOP REFERRERS
      </div>
      {entries.map((e) => (
        <div key={e.rank} style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "10px 0",
          borderBottom: e.rank < entries.length ? "1px solid #111" : "none",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: e.rank === 1 ? "#f59e0b" : e.rank === 2 ? "#888" : e.rank === 3 ? "#cd7f32" : "#1a1a1a",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700,
            color: e.rank <= 3 ? "#000" : "#555",
          }}>
            {e.rank}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{e.displayName}</div>
            <div style={{ fontSize: 12, color: "#555" }}>{e.referrals} חברים</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", fontFamily: "monospace" }}>
            {e.earnings.toLocaleString()} 88INF
          </div>
        </div>
      ))}
    </div>
  );
}
