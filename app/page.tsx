"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pickaxe, Wallet, QrCode, PlayCircle,
  CheckCircle, ClipboardList, UserPlus,
  X, ChevronRight, Zap, ArrowRight,
  Shield, Copy, ExternalLink,
  TrendingUp, Users, Clock, Star, Info,
} from "lucide-react";
import { useWallet } from "@/lib/wallet";
import { claimReward } from "@/lib/api";

// ─── TOKEN ECONOMICS ──────────────────────────────────────────────────────────
const MINING_RATE_PER_HOUR = 0.08;
const MINING_RATE_PER_SEC  = MINING_RATE_PER_HOUR / 3600;
const WITHDRAW_MINIMUM     = 500;
const MINT_ADDRESS         = process.env.NEXT_PUBLIC_MINT_ADDRESS || "";

const TASKS: Task[] = [
  {
    id: "checkin", type: "checkin",
    label: "Daily Check-in", reward: 0.5, cooldown: 86400,
    icon: CheckCircle, desc: "Daily bonus for opening the app",
  },
  {
    id: "ad_short", type: "ad",
    label: "Watch Short Ad", reward: 0.08, cooldown: 1800,
    icon: PlayCircle, desc: "15-second sponsored ad · every 30 min",
  },
  {
    id: "survey", type: "survey",
    label: "Complete Survey", reward: 2.0, cooldown: 3600,
    icon: ClipboardList, desc: "Partner survey · highest reward",
  },
  {
    id: "referral", type: "referral",
    label: "Invite Friends", reward: 5.0, cooldown: 0,
    icon: UserPlus, desc: "5 INF when your friend joins",
  },
];

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Task {
  id: string;
  type: "ad" | "survey" | "checkin" | "referral";
  label: string;
  reward: number;
  cooldown: number;
  icon: React.ElementType;
  desc: string;
}

interface LocalState {
  balance: number;
  totalEarned: number;
  level: number;
  xp: number;
  streak: number;
  lastCheckin: number;
  referralCount: number;
}

const DEFAULT_STATE: LocalState = {
  balance: 0, totalEarned: 0, level: 1,
  xp: 0, streak: 0, lastCheckin: 0, referralCount: 0,
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function levelFromXp(xp: number)        { return Math.floor(xp / 200) + 1; }
function streakMultiplier(streak: number){ return Math.min(1 + streak * 0.07, 1.5); }
function formatAddress(a: string)        { return `${a.slice(0,4)}...${a.slice(-4)}`; }
function formatINF(n: number) {
  if (n >= 1000) return n.toFixed(1);
  if (n >= 10)   return n.toFixed(2);
  return n.toFixed(4);
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function Toast({ msg, positive }: { msg: string; positive: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className={`fixed top-5 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full font-semibold text-sm shadow-2xl z-[300] flex items-center gap-2 border backdrop-blur-xl whitespace-nowrap ${
        positive
          ? "bg-amber-500/90 text-amber-950 border-amber-400"
          : "bg-zinc-800/90 text-zinc-200 border-zinc-700"
      }`}
    >
      {positive && <CheckCircle size={15} />}
      {msg}
    </motion.div>
  );
}

// ─── AD BREAK OVERLAY ────────────────────────────────────────────────────────
// Used only for "Watch Short Ad" task.
// Injects Monetag Vignette so a real ad fires on page.
// Countdown is independent — reward credited after timer regardless.
function AdBreakOverlay({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const DURATION = 15;
  const [t, setT] = useState(DURATION);
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Inject Vignette so real ad fires on the page
  useEffect(() => {
    const s = document.createElement("script");
    s.dataset.zone = "10919687";
    s.src = "https://n6wxm.com/vignette.min.js?t=" + Date.now();
    s.async = true;
    document.body.appendChild(s);
    return () => { try { document.body.removeChild(s); } catch {} };
  }, []);

  // Countdown
  useEffect(() => {
    const end = Date.now() + DURATION * 1000;
    const iv = setInterval(() => {
      const rem = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setT(rem);
      if (rem <= 0) { clearInterval(iv); setTimeout(() => onCompleteRef.current(), 400); }
    }, 100);
    return () => clearInterval(iv);
  }, []);

  // Global link interceptor — warn before external navigation
  useEffect(() => {
    function guard(e: MouseEvent) {
      const a = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.href;
      if (!href || href.startsWith("javascript") || href === "#") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setExternalUrl(href);
    }
    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, []);

  const pct = Math.round(((DURATION - t) / DURATION) * 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe pt-10 pb-4 shrink-0">
        <span className="text-zinc-600 text-[11px] tracking-[0.22em] uppercase font-medium">Sponsored</span>
        <button
          onClick={onCancel}
          className="w-9 h-9 bg-zinc-800/80 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X size={17} />
        </button>
      </div>

      {/* Ad area — Vignette fires above this; banner ad will go here when approved */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
        {/* Coin pulse animation */}
        <div className="relative flex items-center justify-center">
          {[0, 0.5, 1].map((delay, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0.8, opacity: 0.4 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 2.5, repeat: Infinity, delay, ease: "easeOut" }}
              className="absolute w-24 h-24 rounded-full border border-amber-500/20"
            />
          ))}
          <img src="/coin.jpg" alt="" className="w-24 h-24 rounded-full object-cover opacity-50 relative z-10" />
        </div>

        <div className="text-center">
          <p className="text-zinc-400 text-base font-semibold mb-1">Watching ad…</p>
          <p className="text-zinc-600 text-sm">Sponsored content is loading</p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-5 pb-safe pb-10 pt-4 shrink-0 space-y-3">
        {/* Progress bar */}
        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full"
            style={{ width: `${pct}%`, transition: "width 0.95s linear" }}
          />
        </div>

        {/* Countdown row */}
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#27272a" strokeWidth="3.5" />
              <circle
                cx="24" cy="24" r="20" fill="none" stroke="#f59e0b" strokeWidth="3.5"
                strokeDasharray={2 * Math.PI * 20}
                strokeDashoffset={2 * Math.PI * 20 * (1 - pct / 100)}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.95s linear" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-amber-400 font-black text-sm">{t}</span>
          </div>
          <div className="flex-1">
            <p className="text-zinc-200 font-semibold text-sm">{t > 0 ? `${t}s remaining` : "Ad complete!"}</p>
            <p className="text-zinc-600 text-xs">+0.08 $INF88$ reward</p>
          </div>
        </div>

        {/* Action button */}
        {t <= 0 ? (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onCompleteRef.current()}
            className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-base transition-all"
          >
            <CheckCircle size={19} /> Collect +0.08 $INF88$
          </motion.button>
        ) : (
          <div className="w-full py-4 rounded-2xl bg-zinc-800/40 border border-zinc-800 flex items-center justify-center text-zinc-600 text-sm">
            Cannot skip · {t}s
          </div>
        )}
      </div>

      {/* External link warning */}
      <AnimatePresence>
        {externalUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-end justify-center pb-10 px-5 z-10"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 w-full max-w-sm"
            >
              <div className="w-11 h-11 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4">
                <ExternalLink size={20} className="text-amber-400" />
              </div>
              <p className="text-zinc-100 font-bold mb-1">יציאה לאתר חיצוני</p>
              <p className="text-zinc-500 text-sm leading-relaxed mb-5">
                הקישור מוביל לאתר שאינו קשור לאפליקציה שלנו.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setExternalUrl(null)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-2xl transition-colors"
                >
                  ביטול
                </button>
                <button
                  onClick={() => { window.open(externalUrl, "_blank", "noopener,noreferrer"); setExternalUrl(null); }}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-2xl transition-colors"
                >
                  פתח
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── MINING BUTTON ───────────────────────────────────────────────────────────
function MiningButton({ active, rate, multiplier, onClick }: {
  active: boolean; rate: number; multiplier: number; onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative flex items-center justify-center w-52 h-52">
        <AnimatePresence>
          {active && [0, 0.6, 1.2].map((delay, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0.9, opacity: 0.6 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 2.4, repeat: Infinity, delay, ease: "easeOut" }}
              className="absolute w-40 h-40 rounded-full border border-amber-500/40"
            />
          ))}
        </AnimatePresence>

        <motion.button
          onClick={onClick}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: 1.03 }}
          className="relative z-10 w-40 h-40 rounded-full overflow-hidden focus:outline-none focus:ring-4 focus:ring-amber-500/30"
          style={{
            boxShadow: active
              ? "0 0 40px rgba(245,158,11,0.5), 0 0 80px rgba(245,158,11,0.2)"
              : "0 0 0 4px #27272a",
          }}
          aria-label={active ? "Stop Mining" : "Start Mining"}
        >
          <img src="/coin.jpg" alt="$INF88$" className="w-full h-full object-cover" draggable={false} />
          <div className={`absolute inset-0 flex flex-col items-center justify-end pb-4 transition-all duration-300 ${active ? "bg-black/20" : "bg-black/50"}`}>
            <span className={`text-xs font-bold tracking-widest uppercase ${active ? "text-amber-300" : "text-zinc-300"}`}>
              {active ? "● Mining" : "Tap to Mine"}
            </span>
          </div>
        </motion.button>
      </div>

      <div className="flex items-center gap-6 text-center">
        <div>
          <div className={`text-lg font-mono font-bold ${active ? "text-amber-400" : "text-zinc-600"}`}>
            {(rate * multiplier).toFixed(3)}
          </div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">INF/hr</div>
        </div>
        <div className="w-px h-8 bg-zinc-800" />
        <div>
          <div className={`text-lg font-mono font-bold ${multiplier > 1 ? "text-emerald-400" : "text-zinc-600"}`}>
            {multiplier.toFixed(2)}×
          </div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Boost</div>
        </div>
        <div className="w-px h-8 bg-zinc-800" />
        <div className="flex items-center gap-1">
          <Info size={13} className="text-zinc-600" />
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Streak</div>
        </div>
      </div>

      <p className="text-xs text-zinc-600">
        {active ? "Mining active · tap to pause" : "Tap to start accumulating $INF88$"}
      </p>
    </div>
  );
}

// ─── WALLET TAB ───────────────────────────────────────────────────────────────
function WalletTab({ virtualBalance, onWithdrawSuccess }: {
  virtualBalance: number;
  onWithdrawSuccess: (amount: number) => void;
}) {
  const { ready, authenticated, login, logout, walletAddress, onchainBalance, loading, refetchBalance } = useWallet();
  const [copied, setCopied] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState<string | null>(null);
  const withdrawReady = virtualBalance >= WITHDRAW_MINIMUM;
  const progress = Math.min((virtualBalance / WITHDRAW_MINIMUM) * 100, 100);

  function copyAddress() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleWithdraw() {
    if (!walletAddress || !withdrawReady || withdrawing) return;
    setWithdrawing(true);
    setWithdrawMsg(null);
    try {
      const { requestWithdrawal } = await import("@/lib/api");
      const res = await requestWithdrawal(Math.floor(virtualBalance), walletAddress);
      if (res.success) {
        setWithdrawMsg(`✓ ${res.netAmount} $INF88$ בדרך לארנק שלך`);
        onWithdrawSuccess(Math.floor(virtualBalance));
        setTimeout(() => refetchBalance(), 10000);
      } else {
        setWithdrawMsg(res.error || "שגיאה");
      }
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <motion.div
      key="wallet"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Wallet card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
        <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-3">Solana Wallet</p>
        {!ready || loading ? (
          <div className="h-10 bg-zinc-800 rounded-xl animate-pulse" />
        ) : !authenticated ? (
          <button
            onClick={login}
            className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all"
          >
            <Shield size={18} /> Connect Wallet
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-zinc-800/60 rounded-2xl px-4 py-3">
              <div>
                <p className="text-[10px] text-zinc-500 mb-0.5">Your address</p>
                <p className="text-zinc-200 font-mono text-sm">{walletAddress ? formatAddress(walletAddress) : "—"}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={copyAddress} className="p-2 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-zinc-300 transition-colors">
                  {copied ? <CheckCircle size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
                {walletAddress && (
                  <a
                    href={`https://solscan.io/account/${walletAddress}`}
                    target="_blank" rel="noopener noreferrer"
                    className="p-2 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-zinc-300 transition-colors"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800/60 rounded-2xl p-4">
                <p className="text-[10px] text-zinc-500 mb-1">On-chain</p>
                <p className="text-xl font-mono font-bold text-amber-400">{onchainBalance.toFixed(2)}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">confirmed</p>
              </div>
              <div className="bg-zinc-800/60 rounded-2xl p-4">
                <p className="text-[10px] text-zinc-500 mb-1">Pending</p>
                <p className="text-xl font-mono font-bold text-zinc-300">{formatINF(virtualBalance)}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">awaiting withdrawal</p>
              </div>
            </div>

            <button onClick={logout} className="w-full text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1">
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Withdrawal */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
        <div className="flex justify-between items-center mb-3">
          <p className="text-zinc-400 text-sm font-semibold">Withdrawal Progress</p>
          <p className="text-zinc-500 text-xs font-mono">{formatINF(virtualBalance)} / {WITHDRAW_MINIMUM}</p>
        </div>
        <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden mb-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full"
          />
        </div>
        <button
          onClick={handleWithdraw}
          disabled={!withdrawReady || !authenticated || withdrawing}
          className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            withdrawReady && authenticated && !withdrawing
              ? "bg-amber-500 text-amber-950 hover:bg-amber-400"
              : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
          }`}
        >
          {withdrawing ? "שולח…"
            : !authenticated ? "Connect wallet first"
            : withdrawReady ? <><ArrowRight size={16} /> Withdraw {formatINF(virtualBalance)} $INF88$</>
            : `Need ${formatINF(WITHDRAW_MINIMUM - virtualBalance)} more`}
        </button>
        {withdrawMsg && (
          <p className={`text-center text-xs mt-3 ${withdrawMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
            {withdrawMsg}
          </p>
        )}
        {!withdrawMsg && (
          <p className="text-center text-[10px] text-zinc-600 mt-3">
            Sent to your Solana wallet · processed within 6 hours
          </p>
        )}
      </div>

      {/* Market */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
        <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-3">Market</p>
        <div className="flex items-center gap-3 mb-3">
          <TrendingUp size={20} className="text-amber-500" />
          <div>
            <p className="text-zinc-300 text-sm font-semibold">Price: TBA at listing</p>
            <p className="text-zinc-600 text-xs">Listed on Raydium after mainnet launch</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <img src="/coin.jpg" alt="" className="w-5 h-5 rounded-full object-cover" />
          <p className="text-zinc-500 text-xs font-mono break-all">
            {MINT_ADDRESS ? `${MINT_ADDRESS.slice(0, 20)}…` : "Token address TBA"}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function EarnPage() {
  const [local, setLocal] = useState<LocalState>(DEFAULT_STATE);
  const [miningActive, setMiningActive] = useState(false);
  const [sessionEarned, setSessionEarned] = useState(0);
  const [showAdBreak, setShowAdBreak] = useState(false);
  const [taskCooldowns, setTaskCooldowns] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{ msg: string; positive: boolean } | null>(null);
  const [tab, setTab] = useState<"earn" | "wallet" | "pay">("earn");

  const multiplier        = streakMultiplier(local.streak);
  const effectiveRate     = MINING_RATE_PER_HOUR * multiplier;
  const effectiveRatePerSec = effectiveRate / 3600;

  // Persist & restore
  useEffect(() => {
    try {
      const raw = localStorage.getItem("88inf_v2");
      if (raw) setLocal(JSON.parse(raw));
      const cd  = localStorage.getItem("88inf_cooldowns");
      if (cd)  setTaskCooldowns(JSON.parse(cd));
    } catch {}
  }, []);

  // Mining ticker
  useEffect(() => {
    if (!miningActive) return;
    setSessionEarned(0);
    const iv = setInterval(() => {
      const earned = effectiveRatePerSec;
      setSessionEarned(s => s + earned);
      setLocal(prev => {
        const next = {
          ...prev,
          balance:     prev.balance + earned,
          totalEarned: prev.totalEarned + earned,
          xp:          prev.xp + earned,
          level:       levelFromXp(prev.xp + earned),
        };
        localStorage.setItem("88inf_v2", JSON.stringify(next));
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [miningActive, effectiveRatePerSec]);

  const showToast = useCallback((msg: string, positive = true) => {
    setToast({ msg, positive });
    setTimeout(() => setToast(null), 2800);
  }, []);

  function credit(amount: number) {
    setLocal(prev => {
      const next = {
        ...prev,
        balance:     prev.balance + amount,
        totalEarned: prev.totalEarned + amount,
        xp:          prev.xp + amount * 10,
        level:       levelFromXp(prev.xp + amount * 10),
      };
      localStorage.setItem("88inf_v2", JSON.stringify(next));
      return next;
    });
  }

  function saveCooldown(id: string, ts: number) {
    setTaskCooldowns(prev => {
      const next = { ...prev, [id]: ts };
      localStorage.setItem("88inf_cooldowns", JSON.stringify(next));
      return next;
    });
  }

  // Mining — starts immediately, no ad gate
  function toggleMining() {
    if (miningActive) {
      setMiningActive(false);
      showToast("Mining paused", false);
    } else {
      setMiningActive(true);
      showToast("Mining activated!", true);
    }
  }

  // Tasks
  function handleTask(task: Task) {
    const now = Date.now();

    if (task.type === "ad") {
      setShowAdBreak(true);
      return;
    }

    if (task.type === "referral") {
      const url = window.location.origin;
      if (navigator.share) {
        navigator.share({ title: "Join $INF88$", text: "Earn $INF88$ tokens — mine for free!", url }).catch(() => {});
      } else {
        navigator.clipboard.writeText(url);
        showToast("Referral link copied!", true);
      }
      return;
    }

    if (task.type === "survey") {
      const apiKey = process.env.NEXT_PUBLIC_SURVEY_API_KEY;
      if (!apiKey) { showToast("Surveys coming soon", false); return; }
      let uuid = localStorage.getItem("88inf_pf_uuid");
      if (!uuid) { uuid = crypto.randomUUID(); localStorage.setItem("88inf_pf_uuid", uuid); }
      const url = `https://web.bitlabs.ai?token=${apiKey}&uid=${encodeURIComponent(uuid)}`;
      const popup = window.open(url, "bitlabs_survey", "width=420,height=700,scrollbars=yes");
      if (!popup) { showToast("Allow popups for surveys", false); return; }
      showToast("Loading survey…", false);
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          saveCooldown(task.id, Date.now());
          credit(task.reward);
          showToast(`+${task.reward} $INF88$ from survey!`);
          claimReward("survey").catch(() => {});
        }
      }, 1000);
      return;
    }

    // Daily check-in
    saveCooldown(task.id, now);
    setLocal(prev => {
      const lastMidnight  = new Date(prev.lastCheckin).setHours(0, 0, 0, 0);
      const todayMidnight = new Date().setHours(0, 0, 0, 0);
      const newStreak = prev.lastCheckin && lastMidnight === todayMidnight - 86400000 ? prev.streak + 1 : 1;
      const next = {
        ...prev,
        balance:     prev.balance + task.reward,
        totalEarned: prev.totalEarned + task.reward,
        xp:          prev.xp + task.reward * 10,
        level:       levelFromXp(prev.xp + task.reward * 10),
        streak:      newStreak,
        lastCheckin: now,
      };
      localStorage.setItem("88inf_v2", JSON.stringify(next));
      return next;
    });
    claimReward("checkin").catch(() => {});
    showToast(`+${task.reward} $INF88$ · Day ${local.streak + 1} streak!`);
  }

  function handleAdComplete() {
    setShowAdBreak(false);
    const adTask = TASKS.find(t => t.id === "ad_short")!;
    saveCooldown("ad_short", Date.now());
    credit(adTask.reward);
    showToast(`+${adTask.reward} $INF88$`);
    claimReward("ad_short", 0.02).catch(() => {});
  }

  const progressToWithdraw = Math.min((local.balance / WITHDRAW_MINIMUM) * 100, 100);
  const checkinDone = (() => {
    const last = taskCooldowns["checkin"] || 0;
    return new Date(last).setHours(0,0,0,0) === new Date().setHours(0,0,0,0);
  })();

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-100 pb-28 max-w-md mx-auto relative overflow-x-hidden">

      {/* Ad break overlay — only for Watch Short Ad */}
      <AnimatePresence>
        {showAdBreak && (
          <AdBreakOverlay
            onComplete={handleAdComplete}
            onCancel={() => setShowAdBreak(false)}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast msg={toast.msg} positive={toast.positive} />}
      </AnimatePresence>

      {/* ── HEADER ── */}
      <header className="px-5 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11">
            <img src="/coin.jpg" alt="$INF88$" className="w-full h-full rounded-full object-cover ring-2 ring-amber-500/50" />
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-zinc-950 rounded-full flex items-center justify-center">
              <span className="text-[9px] font-black text-amber-400">{local.level}</span>
            </div>
          </div>
          <div>
            <p className="font-bold text-base leading-tight">$INF88$</p>
            <p className="text-xs text-amber-500/80 font-medium">
              {local.streak > 0 ? `🔥 ${local.streak} day streak` : "Start your streak"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono font-black tracking-tight">{formatINF(local.balance)}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">$INF88$ · price at listing</p>
        </div>
      </header>

      {/* ── CONTENT ── */}
      <main className="px-4">
        <AnimatePresence mode="wait">

          {/* ── EARN TAB ── */}
          {tab === "earn" && (
            <motion.div
              key="earn"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.18 }}
            >
              {/* Mining card */}
              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-3xl p-6 mb-4 backdrop-blur-sm">
                <MiningButton
                  active={miningActive}
                  rate={MINING_RATE_PER_HOUR}
                  multiplier={multiplier}
                  onClick={toggleMining}
                />
                {miningActive && sessionEarned > 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-xs text-emerald-500 mt-3 font-mono"
                  >
                    +{sessionEarned.toFixed(4)} $INF88$ this session
                  </motion.p>
                )}
              </div>

              {/* Ad banner slot — 300×250 will go here when Banner approved */}
              <div id="inf88-ad-slot" className="w-full mb-4" />

              {/* Withdrawal progress */}
              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-zinc-500">To withdrawal</span>
                    <span className="text-zinc-400 font-mono">{formatINF(local.balance)} / {WITHDRAW_MINIMUM}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-700 to-amber-400 rounded-full transition-all duration-1000"
                      style={{ width: `${progressToWithdraw}%` }}
                    />
                  </div>
                </div>
                <button onClick={() => setTab("wallet")} className="text-zinc-500 hover:text-amber-400 transition-colors">
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Tasks */}
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Daily Boosts</p>
                <p className="text-xs text-zinc-600">{TASKS.length} tasks</p>
              </div>

              <div className="flex flex-col gap-2.5">
                {TASKS.map((task) => {
                  const now        = Date.now();
                  const last       = taskCooldowns[task.id] || 0;
                  const onCooldown = task.cooldown > 0 && now - last < task.cooldown * 1000;
                  const secsLeft   = onCooldown ? Math.ceil((task.cooldown * 1000 - (now - last)) / 1000) : 0;
                  const timeLeft   = secsLeft >= 3600 ? `${Math.ceil(secsLeft/3600)}h`
                                   : secsLeft >= 60   ? `${Math.ceil(secsLeft/60)}m`
                                   : `${secsLeft}s`;
                  const done = task.id === "checkin" ? checkinDone : onCooldown;
                  const Icon = task.icon;

                  return (
                    <motion.button
                      key={task.id}
                      whileTap={!done ? { scale: 0.985 } : {}}
                      onClick={() => !done && handleTask(task)}
                      disabled={done}
                      className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                        done
                          ? "bg-zinc-900/30 border-zinc-800/40 opacity-50 cursor-not-allowed"
                          : "bg-zinc-900/80 border-zinc-800 hover:border-amber-500/30 hover:bg-zinc-800/80 cursor-pointer"
                      }`}
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        done ? "bg-zinc-800 text-zinc-600" : "bg-amber-500/10 text-amber-400"
                      }`}>
                        <Icon size={21} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${done ? "text-zinc-500" : "text-zinc-200"}`}>{task.label}</p>
                        <p className="text-[11px] text-zinc-600 mt-0.5 truncate">
                          {task.id === "checkin" && done ? "Come back tomorrow"
                            : done && task.cooldown > 0 ? `Available in ${timeLeft}`
                            : task.desc}
                        </p>
                      </div>
                      <div className={`font-mono font-bold text-sm shrink-0 ${done ? "text-zinc-600" : "text-amber-400"}`}>
                        {done
                          ? <CheckCircle size={17} className="text-zinc-700" />
                          : task.type === "referral"
                          ? <span className="text-xs text-center leading-tight">+{task.reward}<br /><span className="text-[9px] text-zinc-500">/ friend</span></span>
                          : `+${task.reward}`}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mt-5">
                {[
                  { label: "Total Earned", value: formatINF(local.totalEarned), icon: Star },
                  { label: "Referrals",    value: local.referralCount.toString(), icon: Users },
                  { label: "Level",        value: `Lv ${local.level}`, icon: Zap },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-3 text-center">
                    <Icon size={16} className="text-zinc-600 mx-auto mb-1.5" />
                    <p className="text-zinc-200 font-bold text-sm">{value}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <p className="text-center text-[10px] text-zinc-700 mt-5 px-4">
                Not real mining · Rewards distributed from 26.4M app-rewards pool funded by ad revenue
              </p>
            </motion.div>
          )}

          {/* ── WALLET TAB ── */}
          {tab === "wallet" && (
            <WalletTab
              virtualBalance={local.balance}
              onWithdrawSuccess={(amount) => {
                setLocal(prev => {
                  const next = { ...prev, balance: Math.max(0, prev.balance - amount) };
                  localStorage.setItem("88inf_v2", JSON.stringify(next));
                  return next;
                });
                showToast(`${amount} $INF88$ נשלח לארנק!`);
              }}
            />
          )}

          {/* ── PAY TAB ── */}
          {tab === "pay" && (
            <motion.div
              key="pay"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-3xl p-8 text-center">
                <div className="w-20 h-20 mx-auto bg-zinc-950 rounded-2xl border-2 border-zinc-800 flex items-center justify-center mb-6 relative">
                  <QrCode size={36} className="text-amber-400" />
                  {["top-2 left-2 border-t-2 border-l-2","top-2 right-2 border-t-2 border-r-2",
                    "bottom-2 left-2 border-b-2 border-l-2","bottom-2 right-2 border-b-2 border-r-2"].map(cls => (
                    <div key={cls} className={`absolute w-3 h-3 border-amber-500 ${cls}`} />
                  ))}
                </div>
                <h3 className="text-xl font-bold mb-2">Pay with $INF88$</h3>
                <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                  Scan a merchant QR code to pay instantly from your on-chain wallet.
                </p>
                <button
                  onClick={() => showToast("QR scanner coming soon — mainnet launch", false)}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all"
                >
                  <QrCode size={18} /> Open Scanner
                </button>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-3xl p-5">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Recent Transactions</p>
                <div className="flex flex-col items-center py-8 text-zinc-600 gap-2">
                  <Clock size={28} strokeWidth={1.5} />
                  <p className="text-sm">No transactions yet</p>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ── BOTTOM NAV ── */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/80 z-40 pb-safe">
        <div className="flex justify-around px-2 py-2">
          {([
            { id: "earn",   label: "Earn",   icon: Pickaxe },
            { id: "wallet", label: "Wallet", icon: Wallet },
            { id: "pay",    label: "Pay",    icon: QrCode },
          ] as const).map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex flex-col items-center w-full py-1 focus:outline-none"
              >
                <div className={`relative p-2.5 rounded-2xl transition-colors ${active ? "bg-amber-500/15 text-amber-400" : "text-zinc-600 hover:text-zinc-400"}`}>
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                  {active && (
                    <motion.div
                      layoutId="nav-bg"
                      className="absolute inset-0 rounded-2xl bg-amber-500/10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                </div>
                <span className={`text-[10px] font-semibold mt-0.5 transition-colors ${active ? "text-amber-400" : "text-zinc-600"}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
