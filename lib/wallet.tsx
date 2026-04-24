"use client";

import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import { signInWithCustomToken } from "firebase/auth";
import { auth, saveWalletAddress } from "./firebase";

// ── WalletProvider ────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        // Google + SMS only — email is too easy to bot
        loginMethods: ["google", "sms"],

        appearance: {
          theme: "dark",
          accentColor: "#f59e0b",
          logo: "/logo.png",
          showWalletLoginFirst: false,
        },

        embeddedWallets: {
          solana: {
            createOnLogin: "users-without-wallets",
          },
          showWalletUIs: false,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

// ── useWallet hook ────────────────────────────────────────────────────────────

const MINT = new PublicKey(process.env.NEXT_PUBLIC_MINT_ADDRESS || "11111111111111111111111111111111");
const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com",
  "confirmed"
);
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

export function useWallet() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { wallets } = useWallets();

  const [onchainBalance, setOnchainBalance] = useState(0);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseReady, setFirebaseReady] = useState(false);

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy") || wallets[0];

  // ── Sync Privy login → Firebase custom token ──────────────────────────────
  useEffect(() => {
    if (!authenticated || !user) {
      setFirebaseReady(false);
      return;
    }

    async function syncFirebaseAuth() {
      try {
        const accessToken = await getAccessToken();
        const res = await fetch(`${BASE}/api/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
        if (!res.ok) return;
        const { customToken } = await res.json();
        if (customToken) {
          await signInWithCustomToken(auth, customToken);
          setFirebaseReady(true);
        }
      } catch {
        // Backend not available — app still works locally
      }
    }

    syncFirebaseAuth();
  }, [authenticated, user]);

  // ── Wallet address + on-chain balance ─────────────────────────────────────
  useEffect(() => {
    if (!embeddedWallet) {
      setLoading(false);
      return;
    }

    const address = embeddedWallet.address;
    setWalletAddress(address);

    // Save address to Firebase when auth is ready
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      saveWalletAddress(firebaseUser.uid, address);
    }

    fetchOnchainBalance(address);
  }, [embeddedWallet, firebaseReady]);

  async function fetchOnchainBalance(address: string) {
    try {
      const pubkey = new PublicKey(address);
      const ata = getAssociatedTokenAddressSync(MINT, pubkey, false, TOKEN_2022_PROGRAM_ID);
      const account = await getAccount(connection, ata, "confirmed", TOKEN_2022_PROGRAM_ID);
      setOnchainBalance(Number(account.amount) / 1e6);
    } catch {
      setOnchainBalance(0);
    } finally {
      setLoading(false);
    }
  }

  return {
    ready,
    authenticated,
    user,
    login,
    logout,
    walletAddress,
    onchainBalance,
    loading,
    firebaseReady,
    embeddedWallet,
    refetchBalance: () => walletAddress && fetchOnchainBalance(walletAddress),
  };
}
