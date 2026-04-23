"use client";

// Thin wrapper around the backend API.
// All calls include the Firebase auth token so the server can verify the user.

import { auth } from "./firebase";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

async function authHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/** Award tokens after a verified task. Returns new virtual balance. */
export async function claimReward(
  taskId: string,
  adRevenue?: number
): Promise<{ success: boolean; reward?: number; newBalance?: number; error?: string }> {
  try {
    const res = await fetch(`${BASE}/api/reward`, {
      method: "POST",
      headers: await authHeader(),
      body: JSON.stringify({ taskId, adRevenue }),
    });
    return await res.json();
  } catch {
    // Fallback: offline or backend not set up yet — use localStorage
    return { success: false, error: "offline" };
  }
}

/**
 * Request a real on-chain withdrawal.
 * Backend deducts the balance and queues an SPL token transfer.
 */
export async function requestWithdrawal(
  amount: number,
  walletAddress: string
): Promise<{ success: boolean; netAmount?: number; fee?: number; error?: string }> {
  try {
    const res = await fetch(`${BASE}/api/withdraw`, {
      method: "POST",
      headers: await authHeader(),
      body: JSON.stringify({ amount, walletAddress }),
    });
    return await res.json();
  } catch {
    return { success: false, error: "offline" };
  }
}
