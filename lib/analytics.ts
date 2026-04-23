import * as admin from "firebase-admin";

/**
 * 88inf — Analytics System
 * File: lib/analytics.ts
 *
 * Tracks everything needed to grow the product:
 * - User acquisition (how they found us)
 * - Retention (DAU/WAU/MAU, streak distribution)
 * - Revenue (ad RPM, survey completion, buyback efficiency)
 * - Funnel (onboarding → earn → withdraw → pay)
 *
 * Uses Firebase Analytics + custom Firestore events.
 * No third-party analytics SaaS needed.
 */

import { getAnalytics, logEvent, setUserProperties } from "firebase/analytics";
import { analytics } from "./firebase";

// ─── EVENT TYPES ──────────────────────────────────────────────────────────────

export type AnalyticsEvent =
  | "onboarding_started"
  | "onboarding_completed"
  | "referral_applied"
  | "first_earn"
  | "ad_viewed"
  | "ad_skipped"
  | "survey_started"
  | "survey_completed"
  | "level_up"
  | "withdrawal_requested"
  | "withdrawal_completed"
  | "payment_initiated"
  | "payment_confirmed"
  | "merchant_viewed"
  | "app_installed"       // PWA install prompt accepted
  | "push_enabled"
  | "share_tapped"
  | "referral_shared";

// ─── CLIENT-SIDE TRACKING ─────────────────────────────────────────────────────

export async function track(
  event: AnalyticsEvent,
  params: Record<string, string | number | boolean> = {}
) {
  try {
    const instance = await analytics;
    if (instance) {
      logEvent(instance, event, {
        ...params,
        timestamp: Date.now(),
        platform: "web",
      });
    }
    // Also send to our own backend for custom dashboards
    await fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, params }),
    }).catch(() => {}); // non-blocking
  } catch {}
}

export async function setUserLevel(uid: string, level: number, xp: number) {
  try {
    const instance = await analytics;
    if (instance) {
      setUserProperties(instance, {
        user_level: level.toString(),
        user_xp_bucket: Math.floor(xp / 1000).toString(),
      });
    }
  } catch {}
}

// ─── KEY FUNNELS ──────────────────────────────────────────────────────────────

/** Track the full earn funnel */
export const Funnel = {
  onboardingStart: () => track("onboarding_started"),
  onboardingComplete: (withReferral: boolean) =>
    track("onboarding_completed", { with_referral: withReferral }),

  firstEarn: (taskType: string, amount: number) =>
    track("first_earn", { task_type: taskType, amount }),

  adViewed: (durationMs: number, reward: number) =>
    track("ad_viewed", { duration_ms: durationMs, reward }),

  levelUp: (newLevel: number, xp: number) =>
    track("level_up", { new_level: newLevel, total_xp: xp }),

  withdrawalRequested: (amount: number) =>
    track("withdrawal_requested", { amount }),

  paymentConfirmed: (amountIls: number, amountTokens: number) =>
    track("payment_confirmed", { amount_ils: amountIls, amount_tokens: amountTokens }),

  shareReferral: (method: "native" | "clipboard") =>
    track("referral_shared", { method }),
};

// ─── SERVER-SIDE ANALYTICS API ────────────────────────────────────────────────
// Add to server/api.ts:

/*
app.post("/api/analytics/event", authMiddleware, async (req, res) => {
  const { uid } = req;
  const { event, params } = req.body;

  if (!event || typeof event !== "string") return res.status(400).end();

  // Store in Firestore for custom dashboards
  await db.collection("analyticsEvents").add({
    uid,
    event,
    params: params || {},
    timestamp: Date.now(),
    date: new Date().toISOString().split("T")[0], // YYYY-MM-DD for grouping
  });

  res.status(204).end();
});
*/

// ─── ANALYTICS AGGREGATOR (runs nightly via cron) ─────────────────────────────

/*
Nightly job that aggregates events into daily summaries.
Run at midnight via cron: "0 0 * * *"

async function aggregateDailyStats() {
  const db = admin.firestore();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0];

  const eventsSnap = await db.collection("analyticsEvents")
    .where("date", "==", dateStr)
    .get();

  const events = eventsSnap.docs.map(d => d.data());

  const summary = {
    date: dateStr,
    totalEvents: events.length,
    uniqueUsers: new Set(events.map(e => e.uid)).size,
    byEvent: {} as Record<string, number>,
    adViews: 0,
    totalAdRevenue: 0,
    paymentsConfirmed: 0,
    paymentVolumeIls: 0,
    withdrawals: 0,
    levelUps: 0,
    newReferrals: 0,
  };

  for (const e of events) {
    summary.byEvent[e.event] = (summary.byEvent[e.event] || 0) + 1;
    if (e.event === "ad_viewed") {
      summary.adViews++;
      summary.totalAdRevenue += (e.params?.reward || 0) * 0.000199 * 0.6;
    }
    if (e.event === "payment_confirmed") {
      summary.paymentsConfirmed++;
      summary.paymentVolumeIls += e.params?.amount_ils || 0;
    }
    if (e.event === "withdrawal_requested") summary.withdrawals++;
    if (e.event === "level_up") summary.levelUps++;
    if (e.event === "referral_shared") summary.newReferrals++;
  }

  await db.collection("dailyStats").doc(dateStr).set(summary);
  console.log(`[ANALYTICS] Aggregated ${dateStr}:`, summary);
}
*/

// ─── RETENTION METRICS ────────────────────────────────────────────────────────

/**
 * Calculate DAU / WAU / MAU for the admin dashboard.
 * Called by /api/admin/stats
 */
export async function getRetentionMetrics(db: admin.firestore.Firestore) {
  const now = Date.now();
  const day = 86_400_000;

  const [dau, wau, mau] = await Promise.all([
    db.collection("users").where("updatedAt", ">=", now - day).count().get(),
    db.collection("users").where("updatedAt", ">=", now - 7 * day).count().get(),
    db.collection("users").where("updatedAt", ">=", now - 30 * day).count().get(),
  ]);

  return {
    dau: dau.data().count,
    wau: wau.data().count,
    mau: mau.data().count,
    dauWauRatio: dau.data().count / Math.max(wau.data().count, 1),
    wauMauRatio: wau.data().count / Math.max(mau.data().count, 1),
  };
}
