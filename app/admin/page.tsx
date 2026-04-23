/**
 * 88inf — Admin Dashboard
 * File: app/admin/page.tsx
 *
 * Protected dashboard for the 88inf team.
 * Shows real-time stats, user management, withdrawal queue,
 * buyback history, and manual controls.
 *
 * Access: only wallets in ADMIN_WALLETS env var can view this page.
 */

"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface DashStats {
  totalUsers: number;
  dau: number;             // daily active users
  totalVirtualSupply: number;
  totalOnchain: number;
  pendingWithdrawals: number;
  pendingWithdrawalValue: number;
  rewardsPoolBalance: number;
  adRevenueToday: number;
  buybackToday: number;
  tokensBoughtToday: number;
  totalBuybacks: number;
  totalTokensBought: number;
  price: number;
  volume24h: number;
  liquidity: number;
}

interface Withdrawal {
  id: string;
  uid: string;
  amount: number;
  walletAddress: string;
  status: "pending" | "completed" | "failed";
  createdAt: number;
  txSignature?: string;
}

interface UserRow {
  uid: string;
  displayName: string;
  balance: number;
  totalEarned: number;
  streak: number;
  level: number;
  createdAt: number;
  walletAddress?: string;
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent = false, green = false
}: {
  label: string; value: string; sub?: string; accent?: boolean; green?: boolean;
}) {
  return (
    <div style={{
      background: "#0e0e0e",
      border: `1px solid ${accent ? "rgba(245,158,11,.3)" : "#1a1a1a"}`,
      borderRadius: 12,
      padding: "16px 18px",
    }}>
      <div style={{ fontSize: 11, color: "#555", marginBottom: 6, letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 700,
        color: accent ? "#f59e0b" : green ? "#4ade80" : "#e8e8e8",
        fontFamily: "monospace",
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── SECTION HEADER ──────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 11, color: "#f59e0b",
      letterSpacing: 2, marginBottom: 12, marginTop: 32,
      borderBottom: "1px solid #1a1a1a", paddingBottom: 8,
    }}>
      {title}
    </div>
  );
}

// ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashStats | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tab, setTab] = useState<"overview"|"withdrawals"|"users"|"buybacks"|"controls">("overview");
  const [actionMsg, setActionMsg] = useState("");

  // Auth check
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); return; }
      // Check admin claim
      const token = await user.getIdTokenResult();
      if (token.claims.admin) { setAuthed(true); }
      setLoading(false);
    });
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    if (!authed) return;
    fetchStats();
    fetchWithdrawals();
    fetchUsers();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [authed]);

  async function fetchStats() {
    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      setStats(data);
    } catch {}
  }

  async function fetchWithdrawals() {
    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch("/api/admin/withdrawals", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      setWithdrawals(data.withdrawals || []);
    } catch {}
  }

  async function fetchUsers() {
    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch("/api/admin/users?limit=50", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      setUsers(data.users || []);
    } catch {}
  }

  async function runManualAction(action: string) {
    setActionMsg(`מריץ: ${action}...`);
    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch(`/api/admin/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await r.json();
      setActionMsg(`✅ ${action}: ${JSON.stringify(data)}`);
    } catch (e: any) {
      setActionMsg(`❌ שגיאה: ${e.message}`);
    }
  }

  // ── Loading / Auth guard ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#080808",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#555", fontFamily: "monospace",
      }}>
        טוען...
      </div>
    );
  }

  if (!authed) {
    return (
      <div style={{
        minHeight: "100vh", background: "#080808",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        color: "#f87171", fontFamily: "monospace", gap: 8,
      }}>
        <div style={{ fontSize: 32 }}>🔒</div>
        <div>גישה מוגבלת — צוות 88inf בלבד</div>
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  const tabs = ["overview", "withdrawals", "users", "buybacks", "controls"] as const;
  const tabLabels = { overview: "סקירה", withdrawals: "משיכות", users: "משתמשים", buybacks: "Buybacks", controls: "שליטה" };

  return (
    <div style={{
      minHeight: "100vh", background: "#080808",
      color: "#e8e8e8", fontFamily: "'SF Pro Display',-apple-system,sans-serif",
    }}>
      {/* Top bar */}
      <div style={{
        background: "#0a0a0a", borderBottom: "1px solid #1a1a1a",
        padding: "14px 28px", display: "flex",
        justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          88<span style={{ color: "#f59e0b" }}>inf</span>
          <span style={{ color: "#333", marginLeft: 10, fontSize: 13, fontWeight: 400 }}>Admin</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "6px 14px", borderRadius: 8, border: "none",
              background: tab === t ? "#f59e0b" : "#111",
              color: tab === t ? "#000" : "#555",
              fontSize: 13, fontWeight: tab === t ? 600 : 400,
              cursor: "pointer",
            }}>
              {tabLabels[t]}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#555", fontFamily: "monospace" }}>
          {new Date().toLocaleTimeString("he-IL")}
        </div>
      </div>

      <div style={{ padding: "24px 28px" }}>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && stats && (
          <>
            <SectionHeader title="מדדי שוק" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <StatCard label="מחיר 88INF" value={`$${stats.price.toFixed(8)}`} accent />
              <StatCard label="נפח 24h" value={`$${stats.volume24h.toFixed(0)}`} />
              <StatCard label="נזילות" value={`$${stats.liquidity.toFixed(0)}`} />
              <StatCard label="Market Cap" value={`$${(stats.price * 88_000_000).toFixed(0)}`} />
            </div>

            <SectionHeader title="משתמשים" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <StatCard label="סה״כ רשומים" value={stats.totalUsers.toLocaleString()} />
              <StatCard label="פעילים היום (DAU)" value={stats.dau.toLocaleString()} green />
              <StatCard label="יתרות וירטואליות" value={`${(stats.totalVirtualSupply / 1000).toFixed(1)}K`} sub="88INF בסה״כ" />
              <StatCard label="על הבלוקצ'יין" value={`${(stats.totalOnchain / 1000).toFixed(1)}K`} sub="88INF הועברו" />
            </div>

            <SectionHeader title="הכנסות היום" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <StatCard label="הכנסת פרסומות" value={`$${stats.adRevenueToday.toFixed(2)}`} accent />
              <StatCard label="Buyback היום" value={`$${stats.buybackToday.toFixed(2)}`} />
              <StatCard label="מטבעות נרכשו" value={stats.tokensBoughtToday.toLocaleString()} sub="88INF" green />
              <StatCard label="Buyback כולל" value={`$${stats.totalBuybacks.toFixed(0)}`} />
            </div>

            <SectionHeader title="משיכות" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <StatCard label="ממתינות לעיבוד" value={stats.pendingWithdrawals.toString()} accent={stats.pendingWithdrawals > 10} />
              <StatCard label="שווי ממתין" value={`${stats.pendingWithdrawalValue.toLocaleString()} 88INF`} />
              <StatCard label="קופת תגמולים" value={`${(stats.rewardsPoolBalance / 1_000_000).toFixed(1)}M`} sub="88INF נותר" green />
            </div>
          </>
        )}

        {/* ── WITHDRAWALS ── */}
        {tab === "withdrawals" && (
          <>
            <SectionHeader title="תור משיכות" />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#111", color: "#555" }}>
                    {["UID", "כמות (88INF)", "ארנק", "סטטוס", "תאריך", "TX"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "right", fontWeight: 500, borderBottom: "1px solid #1a1a1a" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map(w => (
                    <tr key={w.id} style={{ borderBottom: "1px solid #111" }}>
                      <td style={{ padding: "10px 12px", color: "#555", fontFamily: "monospace", fontSize: 11 }}>
                        {w.uid.slice(0, 8)}...
                      </td>
                      <td style={{ padding: "10px 12px", color: "#f59e0b", fontWeight: 600, fontFamily: "monospace" }}>
                        {w.amount.toLocaleString()}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#555", fontFamily: "monospace", fontSize: 11 }}>
                        {w.walletAddress.slice(0, 8)}...{w.walletAddress.slice(-6)}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: 6, fontSize: 11,
                          background: w.status === "completed" ? "rgba(74,222,128,.1)" : w.status === "failed" ? "rgba(248,113,113,.1)" : "rgba(245,158,11,.1)",
                          color: w.status === "completed" ? "#4ade80" : w.status === "failed" ? "#f87171" : "#f59e0b",
                        }}>
                          {w.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#555", fontSize: 11 }}>
                        {new Date(w.createdAt).toLocaleDateString("he-IL")}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {w.txSignature && (
                          <a href={`https://solscan.io/tx/${w.txSignature}`} target="_blank"
                            style={{ color: "#f59e0b", fontSize: 11, fontFamily: "monospace" }}>
                            {w.txSignature.slice(0, 8)}...
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {withdrawals.length === 0 && (
                <div style={{ textAlign: "center", color: "#333", padding: 40 }}>אין משיכות ממתינות</div>
              )}
            </div>
          </>
        )}

        {/* ── USERS ── */}
        {tab === "users" && (
          <>
            <SectionHeader title="משתמשים מובילים (לפי יתרה)" />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#111", color: "#555" }}>
                    {["#", "שם", "יתרה", "סה״כ הרוויח", "רמה", "רצף", "הצטרף"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "right", fontWeight: 500, borderBottom: "1px solid #1a1a1a" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.uid} style={{ borderBottom: "1px solid #111" }}>
                      <td style={{ padding: "10px 12px", color: "#333" }}>{i + 1}</td>
                      <td style={{ padding: "10px 12px" }}>{u.displayName}</td>
                      <td style={{ padding: "10px 12px", color: "#f59e0b", fontFamily: "monospace", fontWeight: 600 }}>
                        {u.balance.toLocaleString()}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#555", fontFamily: "monospace" }}>
                        {u.totalEarned.toLocaleString()}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#4ade80" }}>Lv.{u.level}</td>
                      <td style={{ padding: "10px 12px", color: "#555" }}>{u.streak}🔥</td>
                      <td style={{ padding: "10px 12px", color: "#333", fontSize: 11 }}>
                        {new Date(u.createdAt).toLocaleDateString("he-IL")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── CONTROLS ── */}
        {tab === "controls" && (
          <>
            <SectionHeader title="פעולות ידניות" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              {[
                { label: "עבד משיכות עכשיו", action: "process_withdrawals", color: "#f59e0b", desc: "שולח 88INF לכל הממתינים" },
                { label: "חלק APY עכשיו", action: "distribute_apy", color: "#4ade80", desc: "מחלק קופת עמלות למחזיקים" },
                { label: "הרץ Buyback עכשיו", action: "run_buyback", color: "#60a5fa", desc: "קונה 88INF בכסף הפרסומות" },
                { label: "שלח Push לכולם", action: "broadcast_push", color: "#c084fc", desc: "שלח הודעה לכל המשתמשים" },
              ].map(btn => (
                <button key={btn.action}
                  onClick={() => runManualAction(btn.action)}
                  style={{
                    background: "#0e0e0e", border: `1px solid ${btn.color}22`,
                    borderRadius: 12, padding: "20px 18px",
                    cursor: "pointer", textAlign: "right",
                    transition: "border-color .2s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = btn.color + "66")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = btn.color + "22")}
                >
                  <div style={{ fontWeight: 600, color: btn.color, marginBottom: 6 }}>{btn.label}</div>
                  <div style={{ fontSize: 12, color: "#555" }}>{btn.desc}</div>
                </button>
              ))}
            </div>

            {actionMsg && (
              <div style={{
                marginTop: 16, background: "#0e0e0e", border: "1px solid #1a1a1a",
                borderRadius: 10, padding: "12px 16px",
                fontFamily: "monospace", fontSize: 13, color: "#4ade80",
              }}>
                {actionMsg}
              </div>
            )}

            <SectionHeader title="הגדרות מערכת" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                ["מינימום משיכה", "1,000 88INF"],
                ["מקסימום פרסומות ליום", "10 לייוזר"],
                ["עמלת משיכה", "1% (נשרפים)"],
                ["APY חלוקה", "1 לחודש"],
                ["Buyback תדירות", "כל שעה"],
                ["Max price impact", "3%"],
              ].map(([k, v]) => (
                <div key={k} style={{
                  background: "#0e0e0e", border: "1px solid #1a1a1a",
                  borderRadius: 10, padding: "14px 16px",
                  display: "flex", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 13, color: "#555" }}>{k}</span>
                  <span style={{ fontSize: 13, fontFamily: "monospace", color: "#f59e0b" }}>{v}</span>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
