/**
 * 88inf — XP & Levels System
 * File: lib/levels.ts
 *
 * Gamification layer that keeps users engaged.
 * Every earned token = 1 XP.
 * Higher levels unlock:
 * - Higher ad reward multipliers
 * - Exclusive tasks
 * - Lower withdrawal minimum
 * - Special badges
 */

// ─── LEVEL DEFINITIONS ────────────────────────────────────────────────────────

export interface Level {
  level: number;
  name: string;
  xpRequired: number;       // total XP to reach this level
  badge: string;            // emoji badge
  color: string;            // hex color for UI
  perks: {
    adMultiplier: number;   // multiply ad rewards (1.0 = base)
    withdrawMin: number;    // minimum 88INF to withdraw
    maxAdsPerDay: number;   // max ad views per day
    bonusCheckin: number;   // extra 88INF on daily check-in
  };
}

export const LEVELS: Level[] = [
  {
    level: 1, name: "Newcomer",      xpRequired: 0,
    badge: "○", color: "#555",
    perks: { adMultiplier: 1.0, withdrawMin: 1000, maxAdsPerDay: 10, bonusCheckin: 0 },
  },
  {
    level: 2, name: "Explorer",      xpRequired: 500,
    badge: "◎", color: "#888",
    perks: { adMultiplier: 1.1, withdrawMin: 800,  maxAdsPerDay: 12, bonusCheckin: 5 },
  },
  {
    level: 3, name: "Collector",     xpRequired: 1500,
    badge: "◉", color: "#a78bfa",
    perks: { adMultiplier: 1.2, withdrawMin: 600,  maxAdsPerDay: 14, bonusCheckin: 10 },
  },
  {
    level: 4, name: "Staker",        xpRequired: 4000,
    badge: "⬡", color: "#60a5fa",
    perks: { adMultiplier: 1.3, withdrawMin: 500,  maxAdsPerDay: 16, bonusCheckin: 15 },
  },
  {
    level: 5, name: "Miner",         xpRequired: 10_000,
    badge: "⬢", color: "#34d399",
    perks: { adMultiplier: 1.5, withdrawMin: 400,  maxAdsPerDay: 18, bonusCheckin: 20 },
  },
  {
    level: 6, name: "Hodler",        xpRequired: 25_000,
    badge: "★", color: "#f59e0b",
    perks: { adMultiplier: 1.7, withdrawMin: 300,  maxAdsPerDay: 20, bonusCheckin: 30 },
  },
  {
    level: 7, name: "Whale",         xpRequired: 60_000,
    badge: "⬛", color: "#f97316",
    perks: { adMultiplier: 2.0, withdrawMin: 200,  maxAdsPerDay: 25, bonusCheckin: 50 },
  },
  {
    level: 8, name: "Legend",        xpRequired: 150_000,
    badge: "◆", color: "#f43f5e",
    perks: { adMultiplier: 2.5, withdrawMin: 100,  maxAdsPerDay: 30, bonusCheckin: 100 },
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export function getLevelForXp(xp: number): Level {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.xpRequired) current = lvl;
    else break;
  }
  return current;
}

export function getNextLevel(xp: number): Level | null {
  const current = getLevelForXp(xp);
  const next = LEVELS.find(l => l.level === current.level + 1);
  return next || null;
}

export function getProgressToNextLevel(xp: number): number {
  const current = getLevelForXp(xp);
  const next = getNextLevel(xp);
  if (!next) return 100;
  const range = next.xpRequired - current.xpRequired;
  const progress = xp - current.xpRequired;
  return Math.min(Math.floor((progress / range) * 100), 100);
}

export function getXpToNextLevel(xp: number): number {
  const next = getNextLevel(xp);
  if (!next) return 0;
  return next.xpRequired - xp;
}

export function applyLevelMultiplier(baseReward: number, xp: number): number {
  const level = getLevelForXp(xp);
  return Math.floor(baseReward * level.perks.adMultiplier);
}

// ─── COMPONENT: Level Badge ───────────────────────────────────────────────────

"use client";
import React from "react";

export function LevelBadge({ xp, size = "sm" }: { xp: number; size?: "sm" | "lg" }) {
  const level = getLevelForXp(xp);
  const next = getNextLevel(xp);
  const progress = getProgressToNextLevel(xp);

  if (size === "sm") {
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: `${level.color}18`,
        border: `1px solid ${level.color}44`,
        borderRadius: 20, padding: "3px 10px",
      }}>
        <span style={{ fontSize: 12, color: level.color }}>{level.badge}</span>
        <span style={{ fontSize: 12, color: level.color, fontWeight: 600 }}>Lv.{level.level}</span>
        <span style={{ fontSize: 11, color: "#555" }}>{level.name}</span>
      </div>
    );
  }

  // Large version
  return (
    <div style={{
      background: "#0e0e0e", border: "1px solid #1a1a1a",
      borderRadius: 16, padding: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: `${level.color}18`,
          border: `2px solid ${level.color}66`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, color: level.color,
        }}>
          {level.badge}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Level {level.level}</div>
          <div style={{ fontSize: 13, color: "#555" }}>{level.name}</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>XP</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: level.color }}>
            {xp.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {next && (
        <>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 11, color: "#444", marginBottom: 6,
          }}>
            <span>התקדמות ל-Lv.{next.level} {next.name}</span>
            <span>{getXpToNextLevel(xp).toLocaleString()} XP נותרו</span>
          </div>
          <div style={{ height: 6, background: "#1a1a1a", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3,
              background: level.color,
              width: `${progress}%`,
              transition: "width .4s",
            }} />
          </div>
        </>
      )}

      {/* Perks */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 8, marginTop: 16,
      }}>
        {[
          ["מכפיל פרסומות", `×${level.perks.adMultiplier.toFixed(1)}`],
          ["מינימום משיכה", `${level.perks.withdrawMin} 88INF`],
          ["פרסומות ליום", `${level.perks.maxAdsPerDay}`],
          ["בונוס כניסה", `+${level.perks.bonusCheckin} 88INF`],
        ].map(([label, value]) => (
          <div key={label} style={{
            background: "#080808", borderRadius: 8, padding: "8px 10px",
          }}>
            <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: level.color }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── COMPONENT: Level Up Modal ────────────────────────────────────────────────

export function LevelUpModal({
  newLevel, onClose
}: { newLevel: Level; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000,
    }}>
      <div style={{
        background: "#0e0e0e",
        border: `2px solid ${newLevel.color}66`,
        borderRadius: 20, padding: 32,
        textAlign: "center", maxWidth: 300, width: "100%", margin: 24,
      }}>
        <div style={{
          fontSize: 64, marginBottom: 16,
          color: newLevel.color,
        }}>
          {newLevel.badge}
        </div>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 6, letterSpacing: 2 }}>
          LEVEL UP!
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
          Level {newLevel.level}
        </div>
        <div style={{ color: newLevel.color, fontSize: 16, marginBottom: 20 }}>
          {newLevel.name}
        </div>

        {/* New perks */}
        <div style={{
          background: "#080808", borderRadius: 10, padding: "12px 16px",
          marginBottom: 24, fontSize: 13, color: "#555",
          lineHeight: 2,
        }}>
          <div>מכפיל פרסומות: <strong style={{ color: "#e8e8e8" }}>×{newLevel.perks.adMultiplier.toFixed(1)}</strong></div>
          <div>מינימום משיכה: <strong style={{ color: "#e8e8e8" }}>{newLevel.perks.withdrawMin} 88INF</strong></div>
          <div>פרסומות ליום: <strong style={{ color: "#e8e8e8" }}>{newLevel.perks.maxAdsPerDay}</strong></div>
        </div>

        <button onClick={onClose} style={{
          width: "100%", padding: "13px 0",
          borderRadius: 10, border: "none",
          background: newLevel.color, color: "#000",
          fontWeight: 700, fontSize: 15, cursor: "pointer",
        }}>
          ממשיך להרוויח →
        </button>
      </div>
    </div>
  );
}
