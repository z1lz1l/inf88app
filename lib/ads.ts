/**
 * 88inf — Ad Integration
 * File: lib/ads.ts
 *
 * Two ad networks, both free to join:
 *
 * 1. Google AdMob — best for mobile apps (iOS/Android)
 *    Sign up: admob.google.com
 *    Revenue: $0.01–$0.10 per rewarded video view
 *
 * 2. AdSense / Google Ad Manager — for web (Next.js PWA)
 *    Sign up: adsense.google.com
 *    Revenue: $0.005–$0.05 per view
 *
 * For a PWA (what we're building), use Google Publisher Tag (GPT).
 * For native app (later), use AdMob SDK.
 *
 * IMPORTANT: Never credit tokens before verifying the ad was actually watched.
 * The verification happens server-side via the reward callback.
 */

// ── Web Ad Player (for PWA) ───────────────────────────────────────────────────

export interface AdResult {
  watched: boolean;
  estimatedRevenueCents: number; // in cents USD
}

/**
 * Shows a rewarded ad and returns whether it was completed.
 * In production: integrate actual AdMob Web SDK or IronSource.
 *
 * For MVP: use a simple 30-second countdown with a real ad iframe.
 */
export async function showRewardedAd(): Promise<AdResult> {
  return new Promise((resolve) => {
    // Create fullscreen ad overlay
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; background: #000; z-index: 9999;
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 24px;
    `;

    // Ad container — replace with actual ad network iframe
    const adContainer = document.createElement("div");
    adContainer.style.cssText = `
      width: 320px; height: 480px;
      background: #111; border-radius: 12px;
      border: 1px solid #222;
      display: flex; align-items: center; justify-content: center;
    `;
    adContainer.innerHTML = `
      <div style="color: #555; font-size: 13px; text-align: center; padding: 20px;">
        <!-- In production: replace with actual AdMob/AdSense slot -->
        <!-- <ins class="adsbygoogle" data-ad-slot="YOUR_SLOT_ID"></ins> -->
        <div style="font-size: 40px; margin-bottom: 12px;">📱</div>
        Ad plays here<br/>
        <span style="font-size: 11px; color: #333;">Google AdMob slot</span>
      </div>
    `;

    // Timer display
    let seconds = 30;
    const timer = document.createElement("div");
    timer.style.cssText = `
      color: #f59e0b; font-size: 18px; font-weight: 700;
      font-family: monospace;
    `;
    timer.textContent = `${seconds}s — ממתין לסיום הפרסומת`;

    const label = document.createElement("div");
    label.style.cssText = "color: #555; font-size: 12px;";
    label.textContent = "תרוויח 50 88INF לאחר הצפייה";

    overlay.appendChild(adContainer);
    overlay.appendChild(timer);
    overlay.appendChild(label);
    document.body.appendChild(overlay);

    // Countdown
    const interval = setInterval(() => {
      seconds--;
      timer.textContent = seconds > 0
        ? `${seconds}s — ממתין לסיום הפרסומת`
        : "✓ פרסומת הסתיימה!";

      if (seconds <= 0) {
        clearInterval(interval);
        setTimeout(() => {
          document.body.removeChild(overlay);
          // Estimated CPM: $5 per 1000 views = $0.005 per view = 0.5 cents
          resolve({ watched: true, estimatedRevenueCents: 0.5 });
        }, 800);
      }
    }, 1000);

    // No skip button — must watch full ad
  });
}

/**
 * Verify ad completion server-side and credit tokens.
 * Always verify on backend — never trust client-side claims.
 */
export async function verifyAndCreditAd(
  firebaseIdToken: string,
  adResult: AdResult
): Promise<{ success: boolean; reward: number }> {
  if (!adResult.watched) return { success: false, reward: 0 };

  const response = await fetch("/api/reward", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${firebaseIdToken}`,
    },
    body: JSON.stringify({
      taskId: "ad_short",
      adRevenue: adResult.estimatedRevenueCents / 100, // convert to dollars
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error("Reward failed:", err);
    return { success: false, reward: 0 };
  }

  const data = await response.json();
  return { success: true, reward: data.reward };
}

// ── AdSense Setup (add to app/layout.tsx) ────────────────────────────────────
// Add this to your <head> in layout.tsx:
//
// <script
//   async
//   src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=YOUR_CLIENT_ID"
//   crossOrigin="anonymous"
// />
//
// Your AdSense publisher ID looks like: ca-pub-1234567890123456
// Get it from adsense.google.com after account approval (takes 2-7 days)

// ── Revenue Estimator ─────────────────────────────────────────────────────────

/**
 * Estimate monthly revenue and token buyback potential
 * based on number of daily active users
 */
export function estimateRevenue(dailyActiveUsers: number) {
  const adsPerUserPerDay = 5;          // avg per user
  const cpm = 5;                       // $5 CPM (industry average for rewarded)
  const surveysPerUserPerDay = 0.3;    // 30% complete one survey
  const avgSurveyRevenue = 1.0;        // $1 per survey

  const dailyAdRevenue = (dailyActiveUsers * adsPerUserPerDay / 1000) * cpm;
  const dailySurveyRevenue = dailyActiveUsers * surveysPerUserPerDay * avgSurveyRevenue;
  const dailyTotal = dailyAdRevenue + dailySurveyRevenue;

  const buybackBudget = dailyTotal * 0.6; // 60% goes to token buyback
  const tokensPerDollar = 1 / 0.000199;  // at launch price
  const dailyTokensBought = buybackBudget * tokensPerDollar;

  return {
    dailyAdRevenue: dailyAdRevenue.toFixed(2),
    dailySurveyRevenue: dailySurveyRevenue.toFixed(2),
    dailyTotal: dailyTotal.toFixed(2),
    monthlyTotal: (dailyTotal * 30).toFixed(2),
    dailyBuybackBudget: buybackBudget.toFixed(2),
    dailyTokensBought: Math.floor(dailyTokensBought).toLocaleString(),
    buyPressurePerMonth: Math.floor(dailyTokensBought * 30).toLocaleString(),
  };
}

/*
Revenue at different user scales (for planning):

DAU     Daily Revenue   Monthly     Tokens bought/day
100     $0.35           $10.50      ~1,000
1,000   $3.50           $105        ~10,000
10,000  $35             $1,050      ~100,000
100,000 $350            $10,500     ~1,000,000

At 10,000 DAU: buying 100,000 tokens/day = serious buy pressure
That's 3M tokens per month out of 88M supply = 3.4% monthly demand
*/
