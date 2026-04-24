"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pickaxe, Wallet, QrCode, PlayCircle,
  CheckCircle, ClipboardList, UserPlus,
  Info, X, ChevronRight, Zap, ArrowRight,
  Activity, Shield, Copy, ExternalLink,
  TrendingUp, Users, Clock, Star,
} from "lucide-react";
import { useWallet } from "@/lib/wallet";
import { claimReward } from "@/lib/api";

// ─── TOKEN ECONOMICS ─────────────────────────────────────────────────────────
// Pi Network model: slow accumulation, real scarcity
// Base rate: 0.08 INF/hr (Pi started at 0.8π/hr, halved over time)

const MINING_RATE_PER_HOUR = 0.08;
const MINING_RATE_PER_SEC = MINING_RATE_PER_HOUR / 3600;
const WITHDRAW_MINIMUM = 500;
const MINT_ADDRESS = process.env.NEXT_PUBLIC_MINT_ADDRESS || "";

// Rewards calibrated to ad-revenue model:
// Ad view @ $0.02 revenue → user earns 0.08 INF (token value follows market)
// Survey @ $0.75 revenue → user earns 2 INF
// These amounts are sustainable from the 26.4M app-rewards pool
const TASKS: Task[] = [
  {
    id: "checkin",
    type: "checkin",
    label: "Daily Check-in",
    reward: 0.5,
    cooldown: 86400,
    icon: CheckCircle,
    desc: "Bonus for opening the app daily",
  },
  {
    id: "ad_short",
    type: "ad",
    label: "Watch Short Ad",
    reward: 0.08,
    cooldown: 1800,
    icon: PlayCircle,
    desc: "30-second sponsor ad · available every 30m",
  },
  {
    id: "survey",
    type: "survey",
    label: "Complete Survey",
    reward: 2.0,
    cooldown: 3600,
    icon: ClipboardList,
    desc: "Partner survey · highest reward",
  },
  {
    id: "referral",
    type: "referral",
    label: "Invite Friends",
    reward: 5.0,
    cooldown: 0,
    icon: UserPlus,
    desc: "5 INF when your friend joins",
  },
];

// ─── TYPES ───────────────────────────────────────────────────────────────────

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
  balance: 0,
  totalEarned: 0,
  level: 1,
  xp: 0,
  streak: 0,
  lastCheckin: 0,
  referralCount: 0,
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function levelFromXp(xp: number) {
  // Level up every 200 XP (Pi-style slow progression)
  return Math.floor(xp / 200) + 1;
}

function streakMultiplier(streak: number) {
  // Max 1.5× at 7+ day streak
  return Math.min(1 + streak * 0.07, 1.5);
}

function formatAddress(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatINF(n: number) {
  if (n >= 1000) return n.toFixed(1);
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(4);
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function Toast({ msg, positive }: { msg: string; positive: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className={`fixed top-5 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full font-semibold text-sm shadow-2xl z-[200] flex items-center gap-2 border backdrop-blur-xl whitespace-nowrap ${
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

// Full-screen AdPlayer — used only for mining startup (5s) and interstitials
function AdPlayer({
  onComplete,
  onCancel,
  title,
  duration,
}: {
  onComplete: () => void;
  onCancel: () => void;
  title: string;
  duration: number;
}) {
  const [t, setT] = useState(duration);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const end = Date.now() + duration * 1000;
    const iv = setInterval(() => {
      const rem = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setT(rem);
      if (rem <= 0) { clearInterval(iv); setTimeout(() => onCompleteRef.current(), 300); }
    }, 100);
    return () => clearInterval(iv);
  }, [duration]);

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center z-[150] px-4">
      <button
        onClick={onCancel}
        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
      >
        <X size={22} />
      </button>
      <p className="text-zinc-500 text-xs tracking-[0.2em] uppercase mb-8">{title}</p>
      <div className="flex items-center gap-3 mt-8">
        <div className="w-11 h-11 rounded-full border-2 border-amber-500 flex items-center justify-center text-amber-400 font-bold text-base">
          {t}
        </div>
        <span className="text-zinc-400 text-sm">{t > 0 ? "Please wait…" : "Done!"}</span>
      </div>
    </div>
  );
}

// Full-screen ad countdown — opens ad in popup, shows countdown overlay here
function AdIframePlayer({ onComplete, onCancel, duration = 30 }: { onComplete: () => void; onCancel: () => void; duration?: number }) {
  const [t, setT] = useState(duration);
  const [popupOpened, setPopupOpened] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // Open the ad in a new window (not iframe — ad networks block iframe embedding)
    const popup = window.open("https://omg10.com/4/10919808", "_blank", "width=480,height=700,scrollbars=yes,noopener");
    setPopupOpened(!!popup);
  }, []);

  useEffect(() => {
    const end = Date.now() + duration * 1000;
    const iv = setInterval(() => {
      const rem = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setT(rem);
      if (rem <= 0) { clearInterval(iv); setTimeout(() => onCompleteRef.current(), 300); }
    }, 100);
    return () => clearInterval(iv);
  }, [duration]);

  const pct = Math.round(((duration - t) / duration) * 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center px-6"
    >
      {/* Big countdown ring */}
      <div className="relative w-32 h-32 mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#27272a" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="52" fill="none"
            stroke="#f59e0b" strokeWidth="8"
            strokeDasharray={`${2 * Math.PI * 52}`}
            strokeDashoffset={`${2 * Math.PI * 52 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.9s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-black text-amber-400 font-mono">{t}</span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest">sec</span>
        </div>
      </div>

      <p className="text-zinc-200 text-lg font-bold mb-2">Watch the Ad</p>
      <p className="text-zinc-500 text-sm text-center leading-relaxed mb-8">
        {popupOpened
          ? "Ad opened in a new window.\nWatch it to earn your reward."
          : "Allow popups to watch the ad."}
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-xs h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-8">
        <motion.div
          className="h-full bg-amber-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: "linear" }}
        />
      </div>

      {t > 0 ? (
        <p className="text-zinc-700 text-xs">Cannot skip · {t}s remaining</p>
      ) : (
        <button
          onClick={() => onCompleteRef.current()}
          className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-8 py-3 rounded-2xl transition-all"
        >
          Collect Reward
        </button>
      )}

      {/* Cancel (only before countdown) */}
      <button
        onClick={onCancel}
        className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        <X size={20} />
      </button>
    </motion.div>
  );
}

function MiningButton({ active, rate, multiplier, onClick }: {
  active: boolean;
  rate: number;
  multiplier: number;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      {/* Coin button */}
      <div className="relative flex items-center justify-center w-52 h-52">
        <AnimatePresence>
          {active && (
            <>
              {[0, 0.6, 1.2].map((delay, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0.9, opacity: 0.6 }}
                  animate={{ scale: 1.6, opacity: 0 }}
                  transition={{ duration: 2.4, repeat: Infinity, delay, ease: "easeOut" }}
                  className="absolute w-40 h-40 rounded-full border border-amber-500/40"
                />
              ))}
            </>
          )}
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
          {/* Coin image */}
          <img
            src="/coin.jpg"
            alt="88INF Coin"
            className="w-full h-full object-cover"
            draggable={false}
          />
          {/* Overlay */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-end pb-4 transition-all duration-300 ${
              active ? "bg-black/20" : "bg-black/50"
            }`}
          >
            <span className={`text-xs font-bold tracking-widest uppercase ${active ? "text-amber-300" : "text-zinc-300"}`}>
              {active ? "● Mining" : "Tap to Mine"}
            </span>
          </div>
        </motion.button>
      </div>

      {/* Mining stats row */}
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
          <Info size={13} className="text-zinc-600 cursor-help" />
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Streak bonus</div>
        </div>
      </div>

      {active ? (
        <p className="text-xs text-zinc-500">Mining active · tap again to pause</p>
      ) : (
        <p className="text-xs text-zinc-600">Watch a short ad to activate miner</p>
      )}
    </div>
  );
}

// ─── WALLET TAB ───────────────────────────────────────────────────────────────

function WalletTab({
  virtualBalance,
  onWithdrawSuccess,
}: {
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
        setWithdrawMsg(`✓ ${res.netAmount} $INF88$ בדרך לארנק שלך (עד 6 שעות)`);
        onWithdrawSuccess(Math.floor(virtualBalance));
        setTimeout(() => refetchBalance(), 10000);
      } else if (res.error === "offline") {
        setWithdrawMsg("Backend לא מחובר עדיין — הגדר Firebase + Railway");
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
      {/* Wallet connection card */}
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
                <p className="text-zinc-200 font-mono text-sm">
                  {walletAddress ? formatAddress(walletAddress) : "—"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyAddress}
                  className="p-2 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-zinc-300 transition-colors"
                  title="Copy address"
                >
                  {copied ? <CheckCircle size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
                {walletAddress && (
                  <a
                    href={`https://solscan.io/account/${walletAddress}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-zinc-300 transition-colors"
                    title="View on Solscan"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>

            {/* On-chain balance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800/60 rounded-2xl p-4">
                <p className="text-[10px] text-zinc-500 mb-1">On-chain</p>
                <p className="text-xl font-mono font-bold text-amber-400">{onchainBalance.toFixed(2)}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">$INF88$ confirmed</p>
              </div>
              <div className="bg-zinc-800/60 rounded-2xl p-4">
                <p className="text-[10px] text-zinc-500 mb-1">Pending</p>
                <p className="text-xl font-mono font-bold text-zinc-300">{formatINF(virtualBalance)}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">awaiting withdrawal</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="w-full text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Withdrawal progress */}
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
          {withdrawing
            ? "שולח…"
            : !authenticated
            ? "Connect wallet first"
            : withdrawReady
            ? <><ArrowRight size={16} /> Withdraw {formatINF(virtualBalance)} $INF88$</>
            : `Need ${WITHDRAW_MINIMUM - Math.floor(virtualBalance)} more`}
        </button>
        {withdrawMsg && (
          <p className={`text-center text-xs mt-3 ${withdrawMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
            {withdrawMsg}
          </p>
        )}
        {!withdrawMsg && (
          <p className="text-center text-[10px] text-zinc-600 mt-3">
            Tokens sent to your Solana wallet · processed within 6 hours
          </p>
        )}
      </div>

      {/* Market info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
        <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-3">Market</p>
        <div className="flex items-center gap-3">
          <TrendingUp size={20} className="text-amber-500" />
          <div>
            <p className="text-zinc-300 text-sm font-semibold">Price: TBA at listing</p>
            <p className="text-zinc-600 text-xs">Listed on Raydium after mainnet launch</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
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
  const [miningStartedAt, setMiningStartedAt] = useState<number | null>(null);
  const [sessionEarned, setSessionEarned] = useState(0);
  const [adState, setAdState] = useState<{ visible: boolean; reason: string | null }>({ visible: false, reason: null });
  const [taskCooldowns, setTaskCooldowns] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{ msg: string; positive: boolean } | null>(null);
  const [tab, setTab] = useState<"earn" | "wallet" | "pay">("earn");

  const multiplier = streakMultiplier(local.streak);
  const effectiveRate = MINING_RATE_PER_HOUR * multiplier;
  const effectiveRatePerSec = effectiveRate / 3600;

  // Load persisted state
  useEffect(() => {
    try {
      const raw = localStorage.getItem("88inf_v2");
      if (raw) setLocal(JSON.parse(raw));
      const cd = localStorage.getItem("88inf_cooldowns");
      if (cd) setTaskCooldowns(JSON.parse(cd));
    } catch {}
  }, []);

  // Live mining counter
  useEffect(() => {
    if (!miningActive) return;
    setSessionEarned(0);
    const iv = setInterval(() => {
      const earned = effectiveRatePerSec;
      setSessionEarned((s) => s + earned);
      setLocal((prev) => {
        const next = {
          ...prev,
          balance: prev.balance + earned,
          totalEarned: prev.totalEarned + earned,
          xp: prev.xp + earned,
          level: levelFromXp(prev.xp + earned),
        };
        localStorage.setItem("88inf_v2", JSON.stringify(next));
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [miningActive, effectiveRatePerSec]);

  // Interstitial ads every ~5 min while mining
  useEffect(() => {
    if (!miningActive || adState.visible) return;
    const iv = setInterval(() => {
      if (Math.random() < 0.25) setAdState({ visible: true, reason: "interstitial" });
    }, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [miningActive, adState.visible]);

  const showToast = useCallback((msg: string, positive = true) => {
    setToast({ msg, positive });
    setTimeout(() => setToast(null), 2800);
  }, []);

  function credit(amount: number) {
    setLocal((prev) => {
      const next = {
        ...prev,
        balance: prev.balance + amount,
        totalEarned: prev.totalEarned + amount,
        xp: prev.xp + amount * 10,
        level: levelFromXp(prev.xp + amount * 10),
      };
      localStorage.setItem("88inf_v2", JSON.stringify(next));
      return next;
    });
  }

  function getPollFishUuid(): string {
    let uuid = localStorage.getItem("88inf_pf_uuid");
    if (!uuid) {
      uuid = crypto.randomUUID();
      localStorage.setItem("88inf_pf_uuid", uuid);
    }
    return uuid;
  }

  function openBitlabs(uuid: string, onDone: (completed: boolean) => void) {
    const apiKey = process.env.NEXT_PUBLIC_SURVEY_API_KEY;
    if (!apiKey) { onDone(false); return; }

    // Open BitLabs offerwall in a popup
    const url = `https://web.bitlabs.ai?token=${apiKey}&uid=${encodeURIComponent(uuid)}`;
    const popup = window.open(url, "bitlabs_survey", "width=420,height=700,scrollbars=yes");

    if (!popup) {
      showToast("Allow popups for surveys", false);
      onDone(false);
      return;
    }

    // Poll until popup closes
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        // S2S callback from BitLabs will credit balance server-side
        // Optimistically credit locally too (backend will validate)
        onDone(true);
      }
    }, 1000);
  }

  function triggerMonetagAd() {
    try {
      window.open("https://omg10.com/4/10919808", "_blank", "width=480,height=700,scrollbars=yes,noopener");
    } catch {}
  }

  function handleTask(task: Task) {
    const now = Date.now();
    if (task.type === "ad") {
      triggerMonetagAd();
      setAdState({ visible: true, reason: "task" });
      return;
    }
    if (task.type === "referral") {
      const url = window.location.origin;
      if (navigator.share) {
        navigator.share({ title: "Join 88inf", text: "Earn $INF88$ tokens!", url }).catch(() => {});
      } else {
        navigator.clipboard.writeText(url);
        showToast("Referral link copied!", true);
      }
      return;
    }
    if (task.type === "survey") {
      showToast("Loading survey…", false);
      openBitlabs(getPollFishUuid(), (completed) => {
        if (completed) {
          saveCooldown(task.id, Date.now());
          credit(task.reward);
          showToast(`+${task.reward} $INF88$ from survey!`);
          claimReward("survey").catch(() => {});
        } else {
          showToast("No survey available right now", false);
        }
      });
      return;
    }
    // checkin
    saveCooldown(task.id, now);
    // Update streak
    setLocal((prev) => {
      const lastMidnight = new Date(prev.lastCheckin).setHours(0, 0, 0, 0);
      const todayMidnight = new Date().setHours(0, 0, 0, 0);
      const newStreak = prev.lastCheckin && lastMidnight === todayMidnight - 86400000
        ? prev.streak + 1
        : 1;
      const next = {
        ...prev,
        balance: prev.balance + task.reward,
        totalEarned: prev.totalEarned + task.reward,
        xp: prev.xp + task.reward * 10,
        level: levelFromXp(prev.xp + task.reward * 10),
        streak: newStreak,
        lastCheckin: now,
      };
      localStorage.setItem("88inf_v2", JSON.stringify(next));
      return next;
    });
    claimReward("checkin").catch(() => {});
    showToast(`+${task.reward} $INF88$ · Day ${local.streak + 1} streak!`);
  }

  function saveCooldown(id: string, ts: number) {
    setTaskCooldowns((prev) => {
      const next = { ...prev, [id]: ts };
      localStorage.setItem("88inf_cooldowns", JSON.stringify(next));
      return next;
    });
  }

  function handleAdComplete() {
    const reason = adState.reason;
    setAdState({ visible: false, reason: null });
    if (reason === "task") {
      const now = Date.now();
      saveCooldown("ad_short", now);
      credit(TASKS.find((t) => t.id === "ad_short")!.reward);
      showToast(`+${TASKS.find((t) => t.id === "ad_short")!.reward} $INF88$`);
      claimReward("ad_short", 0.02).catch(() => {});
    } else if (reason === "mining") {
      setMiningActive(true);
      setMiningStartedAt(Date.now());
      showToast("Miner activated!", true);
    }
  }

  function handleAdCancel() {
    const reason = adState.reason;
    setAdState({ visible: false, reason: null });
    if (reason === "mining") showToast("Ad closed — miner not started", false);
  }

  function toggleMining() {
    if (miningActive) {
      setMiningActive(false);
      setMiningStartedAt(null);
    } else {
      setAdState({ visible: true, reason: "mining" });
    }
  }

  const progressToWithdraw = Math.min((local.balance / WITHDRAW_MINIMUM) * 100, 100);
  const checkinDone = (() => {
    const last = taskCooldowns["checkin"] || 0;
    const lastMidnight = new Date(last).setHours(0, 0, 0, 0);
    const todayMidnight = new Date().setHours(0, 0, 0, 0);
    return lastMidnight === todayMidnight;
  })();

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-100 pb-28 max-w-md mx-auto relative overflow-x-hidden">

      {/* Ad overlay */}
      <AnimatePresence>
        {adState.visible && adState.reason === "task" && (
          <AdIframePlayer key="ad-task" onComplete={handleAdComplete} onCancel={handleAdCancel} duration={30} />
        )}
        {adState.visible && adState.reason === "mining" && (
          <AdIframePlayer key="ad-mining" onComplete={handleAdComplete} onCancel={handleAdCancel} duration={10} />
        )}
        {adState.visible && adState.reason === "interstitial" && (
          <AdIframePlayer key="ad-interstitial" onComplete={handleAdComplete} onCancel={handleAdCancel} duration={15} />
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
            <img src="/coin.jpg" alt="88INF" className="w-full h-full rounded-full object-cover ring-2 ring-amber-500/50" />
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
          <p className="text-[10px] text-zinc-500 mt-0.5">
            $INF88$ · price at listing
          </p>
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
              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-3xl p-6 mb-5 backdrop-blur-sm">
                <MiningButton
                  active={miningActive}
                  rate={MINING_RATE_PER_HOUR}
                  multiplier={multiplier}
                  onClick={toggleMining}
                />
                {miningActive && sessionEarned > 0 && (
                  <p className="text-center text-xs text-emerald-500 mt-3 font-mono">
                    +{sessionEarned.toFixed(4)} $INF88$ this session
                  </p>
                )}
              </div>

              {/* Withdrawal mini-progress */}
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
                <button
                  onClick={() => setTab("wallet")}
                  className="text-zinc-500 hover:text-amber-400 transition-colors"
                >
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
                  const now = Date.now();
                  const last = taskCooldowns[task.id] || 0;
                  const onCooldown = task.cooldown > 0 && now - last < task.cooldown * 1000;
                  const secsLeft = onCooldown ? Math.ceil((task.cooldown * 1000 - (now - last)) / 1000) : 0;
                  const timeLeft = secsLeft >= 3600
                    ? `${Math.ceil(secsLeft / 3600)}h`
                    : secsLeft >= 60
                    ? `${Math.ceil(secsLeft / 60)}m`
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
                          ? "bg-zinc-900/30 border-zinc-800/40 opacity-55 cursor-not-allowed"
                          : "bg-zinc-900/80 border-zinc-800 hover:border-amber-500/30 hover:bg-zinc-800/80 cursor-pointer"
                      }`}
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        done ? "bg-zinc-800 text-zinc-600" : "bg-amber-500/10 text-amber-400"
                      }`}>
                        <Icon size={21} strokeWidth={2} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${done ? "text-zinc-500" : "text-zinc-200"}`}>
                          {task.label}
                        </p>
                        <p className="text-[11px] text-zinc-600 mt-0.5 truncate">
                          {task.id === "checkin" && done
                            ? "Come back tomorrow"
                            : done && task.cooldown > 0
                            ? `Available in ${timeLeft}`
                            : task.desc}
                        </p>
                      </div>

                      <div className={`font-mono font-bold text-sm shrink-0 ${done ? "text-zinc-600" : "text-amber-400"}`}>
                        {done
                          ? <CheckCircle size={17} className="text-zinc-700" />
                          : task.type === "referral"
                          ? <span className="text-xs text-center leading-tight">+{task.reward}<br /><span className="text-[9px] text-zinc-500">/ friend</span></span>
                          : `+${task.reward}`
                        }
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mt-5">
                {[
                  { label: "Total Earned", value: formatINF(local.totalEarned), icon: Star },
                  { label: "Referrals", value: local.referralCount.toString(), icon: Users },
                  { label: "Level", value: `Lv ${local.level}`, icon: Zap },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-3 text-center">
                    <Icon size={16} className="text-zinc-600 mx-auto mb-1.5" />
                    <p className="text-zinc-200 font-bold text-sm">{value}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Disclaimer */}
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
                setLocal((prev) => {
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
                  {["top-2 left-2 border-t-2 border-l-2", "top-2 right-2 border-t-2 border-r-2",
                    "bottom-2 left-2 border-b-2 border-l-2", "bottom-2 right-2 border-b-2 border-r-2"]
                    .map((cls) => (
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
            { id: "earn", label: "Earn", icon: Pickaxe },
            { id: "wallet", label: "Wallet", icon: Wallet },
            { id: "pay", label: "Pay", icon: QrCode },
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
