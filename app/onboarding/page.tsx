/**
 * 88inf — Onboarding Flow
 * File: app/onboarding/page.tsx
 *
 * 4-step onboarding shown once to new users:
 * 1. Welcome + what is 88inf
 * 2. Create wallet (Privy)
 * 3. Enter referral code (optional)
 * 4. First task — claim 10 88INF check-in bonus
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithGoogle, ensureUserDoc } from "@/lib/firebase";
import { usePrivy, useWallets } from "@privy-io/react-auth";

type Step = 0 | 1 | 2 | 3;

// ── Step indicator ────────────────────────────────────────────────────────────

function Steps({ current }: { current: Step }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 8, marginBottom: 40,
    }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          width: i === current ? 24 : 8,
          height: 8, borderRadius: 4,
          background: i === current ? "#f59e0b" : i < current ? "#633806" : "#1a1a1a",
          transition: "all .3s",
        }} />
      ))}
    </div>
  );
}

// ── Slide wrapper ─────────────────────────────────────────────────────────────

function Slide({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", textAlign: "center",
      padding: "0 8px", flex: 1, justifyContent: "center",
    }}>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const [step, setStep] = useState<Step>(0);
  const [refCode, setRefCode] = useState("");
  const [refError, setRefError] = useState("");
  const [refApplied, setRefApplied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const router = useRouter();
  const { login, authenticated, user } = usePrivy();
  const { wallets } = useWallets();

  // If already authed, skip step 1
  useEffect(() => {
    if (authenticated && step === 1) setStep(2);
  }, [authenticated]);

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      await login();
      if (user) await ensureUserDoc(user.id, user.google?.name || "User");
      setStep(2);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function applyReferral() {
    if (!refCode.trim()) { setStep(3); return; }
    setLoading(true);
    setRefError("");
    try {
      const token = await (window as any).__privyUser?.getIdToken?.();
      const r = await fetch("/api/referral/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: refCode.trim().toUpperCase() }),
      });
      const data = await r.json();
      if (!r.ok) { setRefError(data.error || "קוד לא תקין"); }
      else { setRefApplied(true); setTimeout(() => setStep(3), 1200); }
    } catch {
      setRefError("שגיאה — נסה שוב");
    } finally {
      setLoading(false);
    }
  }

  async function claimFirstReward() {
    setLoading(true);
    try {
      const token = await (window as any).__privyUser?.getIdToken?.();
      await fetch("/api/reward", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ taskId: "checkin" }),
      });
      setClaimed(true);
      setTimeout(() => router.push("/"), 1500);
    } catch {}
    finally { setLoading(false); }
  }

  const walletAddr = wallets[0]?.address;

  return (
    <div style={{
      minHeight: "100vh", background: "#080808",
      color: "#e8e8e8",
      fontFamily: "'SF Pro Display',-apple-system,sans-serif",
      display: "flex", flexDirection: "column",
      maxWidth: 420, margin: "0 auto",
      padding: "60px 24px 40px",
    }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 40, fontSize: 22, fontWeight: 700 }}>
        88<span style={{ color: "#f59e0b" }}>inf</span>
      </div>

      <Steps current={step} />

      {/* ── STEP 0: WELCOME ── */}
      {step === 0 && (
        <Slide>
          <div style={{ fontSize: 52, marginBottom: 24 }}>⬡</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, lineHeight: 1.2 }}>
            ברוך הבא ל-88INF
          </h1>
          <p style={{ color: "#555", fontSize: 16, lineHeight: 1.7, marginBottom: 40, maxWidth: 320 }}>
            מטבע שנועד לשמש כסף אמיתי.
            הרוויח על זמן תשומת הלב שלך,
            שלם בעסקים, וקבל APY פסיבי
            מכל עסקה ברשת.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
            {[
              ["⬡", "88,000,000 מטבעות בלבד — לנצח"],
              ["↻", "0.1% APY אוטומטי מכל עסקה"],
              ["▶", "הרוויח על צפייה בפרסומות"],
              ["◎", "שלם בעסקים ב-1 שנייה"],
            ].map(([icon, text]) => (
              <div key={text} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "#0e0e0e", border: "1px solid #1a1a1a",
                borderRadius: 12, padding: "12px 16px", textAlign: "right",
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(245,158,11,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{icon}</div>
                <div style={{ fontSize: 14 }}>{text}</div>
              </div>
            ))}
          </div>
        </Slide>
      )}

      {/* ── STEP 1: LOGIN ── */}
      {step === 1 && (
        <Slide>
          <div style={{ fontSize: 52, marginBottom: 24 }}>🔑</div>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>צור ארנק בחינם</h2>
          <p style={{ color: "#555", fontSize: 15, lineHeight: 1.7, marginBottom: 40 }}>
            ארנק Solana נוצר אוטומטית.
            ללא seed phrase. ללא ידע טכני.
            נכנסים עם גוגל — בדיוק כמו כל אפליקציה.
          </p>
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: "100%", padding: "16px 0",
              borderRadius: 12, border: "none",
              background: loading ? "#1a1a1a" : "#fff",
              color: "#000", fontWeight: 600, fontSize: 16,
              cursor: loading ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M47.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h13.1c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.4-10.6 7.4-17.2z"/>
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.9-6c-2.1 1.4-4.8 2.2-8 2.2-6.1 0-11.3-4.1-13.2-9.7H2.6v6.2C6.5 42.5 14.7 48 24 48z"/>
              <path fill="#FBBC05" d="M10.8 28.7c-.5-1.4-.7-2.9-.7-4.7s.3-3.3.7-4.7V13H2.6C.9 16.4 0 20.1 0 24s.9 7.6 2.6 11l8.2-6.3z"/>
              <path fill="#EA4335" d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.7-6.7C35.9 2.1 30.5 0 24 0 14.7 0 6.5 5.5 2.6 13l8.2 6.3C12.7 13.6 17.9 9.5 24 9.5z"/>
            </svg>
            {loading ? "מתחבר..." : "המשך עם Google"}
          </button>
          <p style={{ color: "#333", fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>
            בלחיצה אתה מסכים לתנאי השימוש ומדיניות הפרטיות של 88inf.
          </p>
        </Slide>
      )}

      {/* ── STEP 2: REFERRAL ── */}
      {step === 2 && (
        <Slide>
          <div style={{ fontSize: 52, marginBottom: 24 }}>🎁</div>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>יש לך קוד הפניה?</h2>
          <p style={{ color: "#555", fontSize: 15, lineHeight: 1.7, marginBottom: 32 }}>
            אם חבר שלח לך קישור,
            הכנס את הקוד שלו וקבלו שניכם בונוס.
          </p>
          {refApplied ? (
            <div style={{
              background: "rgba(74,222,128,.1)", border: "1px solid rgba(74,222,128,.3)",
              borderRadius: 12, padding: "16px 20px", color: "#4ade80",
              fontSize: 16, fontWeight: 600, marginBottom: 24,
            }}>
              ✓ קוד הוחל! קיבלת 100 88INF בונוס
            </div>
          ) : (
            <>
              <input
                type="text"
                value={refCode}
                onChange={e => { setRefCode(e.target.value.toUpperCase()); setRefError(""); }}
                placeholder="הכנס קוד (8 ספרות)"
                maxLength={8}
                style={{
                  width: "100%", padding: "14px 16px",
                  background: "#0e0e0e", border: `1px solid ${refError ? "#f87171" : "#1a1a1a"}`,
                  borderRadius: 12, color: "#e8e8e8",
                  fontSize: 18, fontFamily: "monospace",
                  textAlign: "center", letterSpacing: 4,
                  outline: "none", marginBottom: 8,
                }}
              />
              {refError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{refError}</div>}
              <button
                onClick={applyReferral}
                disabled={loading}
                style={{
                  width: "100%", padding: "14px 0",
                  borderRadius: 12, border: "none",
                  background: refCode.length === 8 ? "#f59e0b" : "#0e0e0e",
                  color: refCode.length === 8 ? "#000" : "#333",
                  fontWeight: 600, fontSize: 15,
                  cursor: "pointer", marginBottom: 12,
                }}
              >
                {loading ? "בודק..." : "החל קוד"}
              </button>
            </>
          )}
          {!refApplied && (
            <button
              onClick={() => setStep(3)}
              style={{ background: "transparent", border: "none", color: "#444", fontSize: 14, cursor: "pointer" }}
            >
              דלג (אין לי קוד)
            </button>
          )}
        </Slide>
      )}

      {/* ── STEP 3: FIRST REWARD ── */}
      {step === 3 && (
        <Slide>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "rgba(245,158,11,.1)", border: "2px solid rgba(245,158,11,.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, marginBottom: 24,
          }}>
            ☀
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>
            {claimed ? "✓ קיבלת 10 88INF!" : "קבל את הבונוס הראשון שלך"}
          </h2>
          <p style={{ color: "#555", fontSize: 15, lineHeight: 1.7, marginBottom: 32 }}>
            {claimed
              ? "המטבעות כבר בארנק שלך. נשלח לדשבורד הראשי."
              : "לחץ כדי לקבל 10 88INF בונוס כניסה ראשונה."}
          </p>
          {walletAddr && (
            <div style={{
              background: "#0e0e0e", border: "1px solid #1a1a1a",
              borderRadius: 10, padding: "10px 14px",
              fontFamily: "monospace", fontSize: 11, color: "#444",
              marginBottom: 24, wordBreak: "break-all",
            }}>
              {walletAddr.slice(0, 20)}...{walletAddr.slice(-8)}
            </div>
          )}
          {!claimed && (
            <button
              onClick={claimFirstReward}
              disabled={loading || claimed}
              style={{
                width: "100%", padding: "16px 0",
                borderRadius: 12, border: "none",
                background: "#f59e0b", color: "#000",
                fontWeight: 700, fontSize: 16, cursor: "pointer",
              }}
            >
              {loading ? "שולח..." : "קבל 10 88INF עכשיו →"}
            </button>
          )}
        </Slide>
      )}

      {/* Bottom nav button */}
      {step < 1 && (
        <div style={{ marginTop: "auto", paddingTop: 32 }}>
          <button
            onClick={() => setStep((step + 1) as Step)}
            style={{
              width: "100%", padding: "16px 0",
              borderRadius: 12, border: "none",
              background: "#f59e0b", color: "#000",
              fontWeight: 700, fontSize: 16, cursor: "pointer",
            }}
          >
            {step === 0 ? "בואו נתחיל →" : "המשך →"}
          </button>
        </div>
      )}
    </div>
  );
}
