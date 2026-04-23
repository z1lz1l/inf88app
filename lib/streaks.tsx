/**
 * 88inf — Streak & Daily Reward System
 * File: lib/streaks.ts
 *
 * Daily check-in streaks with escalating rewards.
 * Miss a day → streak resets (unless streak shield is active).
 * Long streaks → bigger bonuses + special badges.
 */

// ─── STREAK MILESTONES ────────────────────────────────────────────────────────

interface StreakMilestone {
  days: number;
  bonusTokens: number;   // extra tokens on hitting this milestone
  badge: string;
  title: string;
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 3,   bonusTokens: 30,   badge: "🌱", title: "3 ימים רצופים!" },
  { days: 7,   bonusTokens: 100,  badge: "🔥", title: "שבוע שלם!" },
  { days: 14,  bonusTokens: 250,  badge: "⚡", title: "שבועיים!" },
  { days: 30,  bonusTokens: 600,  badge: "💎", title: "חודש שלם!" },
  { days: 60,  bonusTokens: 1500, badge: "👑", title: "חודשיים!" },
  { days: 100, bonusTokens: 3000, badge: "🏆", title: "100 יום!" },
  { days: 365, bonusTokens: 15000,badge: "⬛", title: "שנה שלמה!" },
];

// ─── DAILY CHECK-IN REWARD CALCULATOR ────────────────────────────────────────

export function getDailyReward(streakDays: number): number {
  // Base reward = 10
  // Every 7 days → +5 bonus
  // Caps at 50 (after 56 days)
  const weekBonus = Math.min(Math.floor(streakDays / 7) * 5, 40);
  return 10 + weekBonus;
}

export function getMilestoneForDay(day: number): StreakMilestone | null {
  return STREAK_MILESTONES.find(m => m.days === day) || null;
}

// ─── CHECK-IN LOGIC (server-side) ────────────────────────────────────────────

export interface CheckInResult {
  success: boolean;
  baseReward: number;
  milestoneBonus: number;
  totalReward: number;
  newStreak: number;
  milestone?: StreakMilestone;
  streakBroken?: boolean;
  message: string;
}

export function calculateCheckIn(
  lastCheckin: number | null,
  currentStreak: number,
  hasShield: boolean = false
): CheckInResult {
  const now = Date.now();
  const today = new Date().setHours(0, 0, 0, 0);
  const yesterday = today - 86_400_000;

  // Already checked in today
  if (lastCheckin && lastCheckin >= today) {
    return {
      success: false,
      baseReward: 0, milestoneBonus: 0, totalReward: 0,
      newStreak: currentStreak,
      message: "כבר נכנסת היום. חזור מחר!",
    };
  }

  // Missed yesterday → streak breaks (unless shield)
  const streakBroken = lastCheckin !== null && lastCheckin < yesterday;
  let newStreak: number;

  if (streakBroken && hasShield) {
    // Shield protects streak
    newStreak = currentStreak + 1;
  } else if (streakBroken) {
    newStreak = 1; // Reset
  } else {
    newStreak = (currentStreak || 0) + 1;
  }

  const baseReward = getDailyReward(newStreak);
  const milestone = getMilestoneForDay(newStreak);
  const milestoneBonus = milestone?.bonusTokens || 0;
  const totalReward = baseReward + milestoneBonus;

  return {
    success: true,
    baseReward,
    milestoneBonus,
    totalReward,
    newStreak,
    milestone: milestone || undefined,
    streakBroken: streakBroken && !hasShield,
    message: milestone
      ? `${milestone.badge} ${milestone.title} +${totalReward} 88INF`
      : `+${totalReward} 88INF · יום ${newStreak}`,
  };
}

// ─── COMPONENT: Streak Calendar ───────────────────────────────────────────────

"use client";
import React from "react";

interface StreakCalendarProps {
  streak: number;
  lastCheckin: number | null;
}

export function StreakCalendar({ streak, lastCheckin }: StreakCalendarProps) {
  const today = new Date().setHours(0, 0, 0, 0);
  const checkedInToday = lastCheckin && lastCheckin >= today;

  // Show last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today - (6 - i) * 86_400_000);
    const isToday = i === 6;
    const isPast = lastCheckin && d.getTime() <= (lastCheckin || 0);
    const label = ["א", "ב", "ג", "ד", "ה", "ו", "ש"][d.getDay()];
    return { label, isToday, filled: isPast, dayNum: d.getDate() };
  });

  const nextMilestone = STREAK_MILESTONES.find(m => m.days > streak);
  const daysToNext = nextMilestone ? nextMilestone.days - streak : 0;

  return (
    <div style={{
      background: "#0e0e0e", border: "1px solid #1a1a1a",
      borderRadius: 16, padding: 20,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>רצף נוכחי</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {streak}
            <span style={{ fontSize: 20, marginLeft: 4 }}>🔥</span>
          </div>
        </div>
        {nextMilestone && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>עד הבונוס הבא</div>
            <div style={{ fontSize: 20 }}>{nextMilestone.badge}</div>
            <div style={{ fontSize: 11, color: "#f59e0b" }}>{daysToNext} ימים</div>
          </div>
        )}
      </div>

      {/* 7-day calendar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, justifyContent: "space-between" }}>
        {days.map((d, i) => (
          <div key={i} style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 9, color: "#444", marginBottom: 4 }}>{d.label}</div>
            <div style={{
              width: "100%", aspectRatio: "1",
              borderRadius: 6,
              background: d.filled
                ? d.isToday && !checkedInToday ? "rgba(245,158,11,.3)" : "#f59e0b"
                : "#111",
              border: d.isToday ? "1px solid #f59e0b" : "1px solid #1a1a1a",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9,
              color: d.filled ? (d.isToday && !checkedInToday ? "#f59e0b" : "#000") : "#333",
            }}>
              {d.filled ? "✓" : d.dayNum}
            </div>
          </div>
        ))}
      </div>

      {/* Daily reward preview */}
      <div style={{
        background: "#080808", borderRadius: 10, padding: "10px 14px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontSize: 13, color: "#555" }}>
          {checkedInToday ? "כניסה בוצעה היום ✓" : "כניסה מחר"}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b" }}>
          +{getDailyReward(streak + (checkedInToday ? 1 : 0))} 88INF
        </div>
      </div>

      {/* Upcoming milestones */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 10, color: "#333", marginBottom: 8, letterSpacing: 1 }}>
          MILESTONES
        </div>
        {STREAK_MILESTONES.filter(m => m.days > streak).slice(0, 3).map(m => (
          <div key={m.days} style={{
            display: "flex", justifyContent: "space-between",
            padding: "6px 0", borderBottom: "1px solid #111",
            fontSize: 12,
          }}>
            <div style={{ color: "#555" }}>
              {m.badge} יום {m.days}
              <span style={{ color: "#333", marginLeft: 6, fontSize: 11 }}>{m.title}</span>
            </div>
            <div style={{ color: "#f59e0b", fontFamily: "monospace" }}>
              +{m.bonusTokens.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── STREAK SHIELD ITEM ────────────────────────────────────────────────────────
// Users can "buy" streak shields with 88INF to protect their streak for 1 day

export const SHIELD_COST_TOKENS = 50; // costs 50 88INF

export function StreakShield({ active, onActivate }: { active: boolean; onActivate: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: active ? "rgba(96,165,250,.08)" : "#0e0e0e",
      border: `1px solid ${active ? "rgba(96,165,250,.3)" : "#1a1a1a"}`,
      borderRadius: 12, padding: "12px 16px",
    }}>
      <div style={{ fontSize: 24 }}>🛡</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
          {active ? "מגן רצף פעיל" : "מגן רצף"}
        </div>
        <div style={{ fontSize: 12, color: "#555" }}>
          {active
            ? "הרצף שלך מוגן ליום הבא"
            : `הגן על הרצף שלך ב-${SHIELD_COST_TOKENS} 88INF`}
        </div>
      </div>
      {!active && (
        <button
          onClick={onActivate}
          style={{
            background: "rgba(96,165,250,.1)", border: "1px solid rgba(96,165,250,.3)",
            borderRadius: 8, padding: "6px 12px",
            color: "#60a5fa", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >
          הפעל
        </button>
      )}
    </div>
  );
}
