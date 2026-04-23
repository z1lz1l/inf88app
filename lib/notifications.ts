/**
 * 88inf — Push Notifications
 * File: lib/notifications.ts
 *
 * Sends push notifications to users for:
 * - APY distribution (monthly)
 * - New task available
 * - Withdrawal completed
 * - Price milestones
 */

// ── CLIENT SIDE: Register for push ───────────────────────────────────────────

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function registerPushNotifications(firebaseIdToken: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("Push not supported");
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
    });

    // Save subscription to backend
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firebaseIdToken}`,
      },
      body: JSON.stringify({ subscription }),
    });

    return true;
  } catch (err) {
    console.error("Push registration failed:", err);
    return false;
  }
}

// ── SERVER SIDE: Send push ────────────────────────────────────────────────────
// Add to server/api.ts — requires: npm install web-push

/*
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:hello@88inf.com",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Generate VAPID keys once: npx web-push generate-vapid-keys

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushToUser(uid: string, payload: PushPayload) {
  const db = admin.firestore();
  const subDoc = await db.collection("pushSubscriptions").doc(uid).get();
  if (!subDoc.exists) return;

  try {
    await webpush.sendNotification(
      subDoc.data() as webpush.PushSubscription,
      JSON.stringify(payload)
    );
  } catch (err: any) {
    if (err.statusCode === 410) {
      // Subscription expired — remove it
      await subDoc.ref.delete();
    }
  }
}

// Example usage in APY distribution:
// await sendPushToUser(uid, {
//   title: "88inf — APY חולק!",
//   body: `קיבלת ${reward} 88INF כ-APY החודשי שלך`,
//   url: "/"
// });

// Send to ALL users (for major announcements):
export async function broadcastPush(payload: PushPayload) {
  const db = admin.firestore();
  const subs = await db.collection("pushSubscriptions").get();
  
  await Promise.allSettled(
    subs.docs.map(async (doc) => {
      try {
        await webpush.sendNotification(
          doc.data() as webpush.PushSubscription,
          JSON.stringify(payload)
        );
      } catch {}
    })
  );
}
*/

// ── NOTIFICATION TEMPLATES ───────────────────────────────────────────────────

export const NOTIFICATIONS = {
  apyDistributed: (amount: number) => ({
    title: "88inf — APY חולק! 🎉",
    body: `קיבלת ${amount} 88INF כ-APY החודשי. הכסף כבר בארנק שלך.`,
    url: "/?tab=wallet",
  }),

  withdrawalComplete: (amount: number) => ({
    title: "88inf — משיכה הושלמה ✅",
    body: `${amount} 88INF הועברו לארנק הסולאנה שלך.`,
    url: "/?tab=wallet",
  }),

  newTaskAvailable: () => ({
    title: "88inf — יש משימה חדשה!",
    body: "סקר חדש זמין. הרוויח עד 200 88INF עכשיו.",
    url: "/?tab=earn",
  }),

  adReady: () => ({
    title: "88inf — פרסומת מוכנה",
    body: "צפה בפרסומת קצרה וקבל 50 88INF.",
    url: "/?tab=earn",
  }),

  priceMilestone: (price: string, changePercent: number) => ({
    title: `88INF עלה ${changePercent}%! 📈`,
    body: `המחיר הנוכחי: $${price}`,
    url: "/?tab=wallet",
  }),
};
