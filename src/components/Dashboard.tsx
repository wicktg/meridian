"use client";

import React, { useState } from "react";
import Link from "next/link";
import MarketsView, { MusdcCoin, CollateralBadge, NetworkBadge } from "./MarketsView";
import LiquidationView from "./LiquidationView";
import RiskView from "./RiskView";
import CollateralDashboardView from "./CollateralDashboardView";
import {
  useVaultData,
  executeWithdraw,
  SUPPORTED_TOKENS,
} from "@/lib/vaultClient";
import { useWeb3, BASE_SEPOLIA_CHAIN_ID } from "@/context/Web3Context";

interface DashboardProps {
  onBackToLanding?: () => void;
  initialTab?: string;
}

export default function Dashboard({
  onBackToLanding,
  initialTab = "Dashboard",
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Profile dropdown withdraw state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawTokenSymbol, setWithdrawTokenSymbol] =
    useState<string>("ETH");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);
  const [withdrawTxResult, setWithdrawTxResult] = useState<{
    text: string;
    link?: string;
    isError?: boolean;
  } | null>(null);

  const {
    account,
    effectiveAddress,
    isCorrectNetwork,
    chainId,
    musdBalance,
    connect,
    disconnect,
    switchNetwork,
    getWalletProvider,
    refreshMusdBalance,
  } = useWeb3();

  const vaultState = useVaultData(effectiveAddress);

  // Unlocked collateral calculation (MCR = 150%)
  const requiredCollateralUSD = vaultState.userTotalDebtMusd * 1.5;
  const unlockedCollateralUSD = Math.max(
    0,
    vaultState.userTotalCollateralUSD - requiredCollateralUSD,
  );

  const depositedTokens = vaultState.tokens.filter(
    (t) => t.userDepositNum > 0,
  );

  const selectedWithdrawTokenData =
    vaultState.tokens.find((t) => t.config.symbol === withdrawTokenSymbol) ||
    depositedTokens[0] ||
    vaultState.tokens[0];

  const maxSafeTokenWithdraw = selectedWithdrawTokenData
    ? (
        Math.min(
          selectedWithdrawTokenData.userDepositUSD,
          unlockedCollateralUSD,
        ) / selectedWithdrawTokenData.priceUSD
      ).toFixed(selectedWithdrawTokenData.config.decimals === 18 ? 4 : 2)
    : "0.00";

  const handleConfirmWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
    setIsWithdrawing(true);
    setWithdrawTxResult(null);

    try {
      const selectedToken =
        SUPPORTED_TOKENS.find((t) => t.symbol === withdrawTokenSymbol) ||
        SUPPORTED_TOKENS[0];

      const walletProvider = await getWalletProvider();
      const res = await executeWithdraw({
        tokenAddress: selectedToken.address,
        amount: withdrawAmount,
        decimals: selectedToken.decimals,
        isBridged: selectedToken.isBridged,
        walletProvider,
        account: effectiveAddress || account,
      });

      if (res.success) {
        setWithdrawTxResult({
          text: `Successfully withdrew ${withdrawAmount} ${selectedToken.symbol}!`,
          link: res.link,
        });
        await vaultState.refresh();
        await refreshMusdBalance();
      } else {
        setWithdrawTxResult({
          text: res.error || "Withdrawal failed.",
          isError: true,
        });
      }
    } catch (e: unknown) {
      const errStr = e instanceof Error ? e.message : String(e);
      setWithdrawTxResult({ text: errStr, isError: true });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const navItems = [
    {
      id: "Dashboard",
      label: "Dashboard",
      icon: (
        <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="9" x="3" y="3" rx="1.5" />
          <rect width="7" height="5" x="14" y="3" rx="1.5" />
          <rect width="7" height="9" x="14" y="12" rx="1.5" />
          <rect width="7" height="5" x="3" y="16" rx="1.5" />
        </svg>
      ),
    },
    {
      id: "Vault",
      label: "Vault",
      icon: (
        <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="4" />
          <circle cx="12" cy="12" r="3.5" />
          <line x1="12" y1="5.5" x2="12" y2="8.5" />
          <line x1="12" y1="15.5" x2="12" y2="18.5" />
          <line x1="5.5" y1="12" x2="8.5" y2="12" />
          <line x1="15.5" y1="12" x2="18.5" y2="12" />
        </svg>
      ),
    },
    {
      id: "Markets",
      label: "Markets",
      icon: (
        <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      ),
    },
    {
      id: "Liquidation",
      label: "Liquidation",
      icon: (
        <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      ),
    },
    {
      id: "Risks",
      label: "Risks",
      icon: (
        <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
  ];

  const activeIndex = navItems.findIndex((item) => item.id === activeTab);

  return (
    <div className="min-h-screen w-full bg-white flex flex-col font-sans text-gray-900 select-none antialiased">
      {/* =========================================================
          TOP HEADER BAR (Full width, sticky, responsive desktop)
         ========================================================= */}
      <header className="h-14 px-6 lg:px-10 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-30">
        {/* Left: Meridian Logo M */}
        <div
          onClick={onBackToLanding}
          className="flex items-center cursor-pointer group py-1"
          title="Return to Landing"
        >
          <img
            src="/meridian-logo-gradient.png"
            alt="Meridian"
            className="h-4 sm:h-[18px] w-auto object-contain select-none hover:opacity-80 transition-opacity"
          />
        </div>

        {/* Right Header Navigation & Wallet Details */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Real Native mUSD Balance from Contract */}
          <div className="hidden sm:flex items-center gap-1.5" title="Detected Native mUSD Token Balance">
            <MusdcCoin size={21} />
            <span className="font-normal text-[12px] text-[#111827] leading-none tabular-nums">
              {musdBalance} mUSD
            </span>
          </div>

          {/* Docs Link */}
          <Link
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1 text-[12px] font-medium text-[#64748b] hover:text-[#111827] transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200"
            title="Protocol Documentation"
          >
            <span>Docs</span>
            <span className="text-[10px] text-slate-400">↗</span>
          </Link>

          {/* Network Switch Button if connected to wrong chain */}
          {account && !isCorrectNetwork && (
            <button
              type="button"
              onClick={() => switchNetwork(BASE_SEPOLIA_CHAIN_ID)}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer animate-pulse"
              title="Click to switch to Base Sepolia"
            >
              <span>⚠️ Switch to Base Sepolia</span>
            </button>
          )}

          {/* Connected wallet pill with interactive popover */}
          {account ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsWalletMenuOpen(!isWalletMenuOpen)}
                className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] px-3 py-1 rounded-full text-[11.5px] font-mono text-[#64748b] hover:text-[#111827] flex items-center gap-1.5 transition-colors cursor-pointer select-none"
                title="Account options"
              >
                <span>
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
                <svg
                  className={`w-3 h-3 text-[#94a3b8] transition-transform duration-200 ${
                    isWalletMenuOpen ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Wallet Dropdown Popover */}
              {isWalletMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsWalletMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-[#eaedf3] shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2 py-1.5 mb-2 border-b border-[#f1f3f7]">
                      <div className="text-[10.5px] text-[#94a3b8]">Connected Account</div>
                      <div className="font-mono text-[11.5px] text-[#111827] font-medium truncate mt-0.5" title={account}>
                        {account}
                      </div>
                    </div>

                    <div className="px-2 py-1 mb-2 text-[11px] text-[#64748b] flex items-center justify-between">
                      <span>Network:</span>
                      <span className={isCorrectNetwork ? "text-[#475569] font-medium" : "text-amber-600 font-medium"}>
                        {chainId === 11155111
                          ? "Ethereum Sepolia"
                          : chainId === 84532
                            ? "Base Sepolia"
                            : "Wrong Network"}
                      </span>
                    </div>

                    {!isCorrectNetwork && (
                      <div className="space-y-1 mb-1.5">
                        <button
                          type="button"
                          onClick={() => switchNetwork(BASE_SEPOLIA_CHAIN_ID)}
                          className="w-full text-left px-2 py-1.5 rounded-lg text-[12px] bg-amber-50 text-amber-800 hover:bg-amber-100 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <span>Switch to Base Sepolia</span>
                          <span>↗</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => switchNetwork(11155111)}
                          className="w-full text-left px-2 py-1.5 rounded-lg text-[12px] bg-amber-50 text-amber-800 hover:bg-amber-100 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <span>Switch to Ethereum Sepolia</span>
                          <span>↗</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsWalletMenuOpen(false);
                        setShowWithdrawModal(true);
                        setWithdrawTxResult(null);
                        setWithdrawAmount("");
                        if (depositedTokens.length > 0) {
                          setWithdrawTokenSymbol(
                            depositedTokens[0].config.symbol,
                          );
                        }
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[12px] text-[#475569] hover:bg-[#f8fafc] hover:text-[#111827] flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span>Withdraw</span>
                      <svg
                        className="w-3.5 h-3.5 text-[#94a3b8]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (typeof navigator !== "undefined" && navigator.clipboard) {
                          navigator.clipboard.writeText(account);
                          setCopiedAddress(true);
                          setTimeout(() => setCopiedAddress(false), 1500);
                        }
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[12px] text-[#475569] hover:bg-[#f8fafc] hover:text-[#111827] flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span>Copy Address</span>
                      {copiedAddress ? (
                        <span className="text-[10.5px] text-emerald-600 font-medium">Copied!</span>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect width="13" height="13" x="9" y="9" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        disconnect();
                        setIsWalletMenuOpen(false);
                        if (onBackToLanding) onBackToLanding();
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[12px] text-rose-600 hover:bg-rose-50 flex items-center justify-between transition-colors cursor-pointer mt-1"
                    >
                      <span>Disconnect</span>
                      <svg className="w-3.5 h-3.5 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" x2="9" y1="12" y2="12" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={connect}
              className="relative overflow-hidden px-4 py-1.5 rounded-full text-[12px] font-medium text-white transition-all duration-200 hover:brightness-105 active:scale-95 cursor-pointer shadow-none border border-white/25"
              style={{
                background: "linear-gradient(135deg, #9850df 0%, #c067c9 50%, #d87eb9 100%)",
              }}
            >
              {/* Subtle top glare */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Network Warning Banner if user connects on another chain */}
      {account && !isCorrectNetwork && (
        <div className="w-full bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-[12px] text-amber-800">
          <span>
            You are connected to an unsupported network. Meridian Vault contracts run on Base Sepolia (84532) and Ethereum Sepolia (11155111).
          </span>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              type="button"
              onClick={() => switchNetwork(BASE_SEPOLIA_CHAIN_ID)}
              className="px-2.5 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 font-medium text-amber-900 transition-colors cursor-pointer text-[11.5px]"
            >
              Base Sepolia
            </button>
            <button
              type="button"
              onClick={() => switchNetwork(11155111)}
              className="px-2.5 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 font-medium text-amber-900 transition-colors cursor-pointer text-[11.5px]"
            >
              Ethereum Sepolia
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          MAIN APP BODY: FLOATING VERTICAL SIDEBAR + CANVAS
         ========================================================= */}
      <div className="flex flex-1 min-h-[calc(100vh-56px)] bg-[#f9fafb]">
        {/* ----------------- FLOATING VERTICAL SIDEBAR (ICONS ONLY, CENTERED, MINIMALIST) ----------------- */}
        <aside className="py-6 pl-5 lg:pl-6 pr-1 shrink-0 flex flex-col justify-center items-center sticky top-14 h-[calc(100vh-56px)] z-20">
          <div className="relative bg-[#f1f4f9]/90 border border-[#e2e8f0] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] rounded-2xl p-1 flex flex-col items-center gap-1">
            {/* Sliding Active Indicator Glass Square (Tactile inner glass effect, clearly visible, zero outer shadow) */}
            <div
              className="absolute left-1 top-1 w-8 h-8 rounded-xl pointer-events-none transition-transform duration-300 ease-in-out backdrop-blur-md border border-white/95 shadow-[inset_0_1.5px_1px_0_rgba(255,255,255,1),inset_0_-1.5px_2px_0_rgba(0,0,0,0.08),inset_0_0_10px_0_rgba(255,255,255,0.85)]"
              style={{
                transform: `translateY(${Math.max(0, activeIndex) * 36}px)`,
                background:
                  "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.70) 50%, rgba(240, 244, 249, 0.90) 100%)",
              }}
            >
              {/* Top-edge specular glass glare */}
              <div className="absolute inset-x-1.5 top-0.5 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-100" />
              {/* Bottom subtle glass refraction highlight */}
              <div className="absolute inset-x-2 bottom-0.5 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
            </div>

            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-label={item.label}
                  className={`relative z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-0 focus-visible:outline-none ${
                    isActive
                      ? "text-[#8da0b6]"
                      : "text-[#b0bec5] hover:text-[#8da0b6]"
                  }`}
                >
                  {item.icon}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ----------------- MAIN ADAPTIVE CANVAS ----------------- */}
        <main className="flex-1 p-6 lg:p-7 space-y-4 overflow-y-auto">
          <div className="w-full max-w-[1200px] mx-auto space-y-4">
            {activeTab === "Vault" && <CollateralDashboardView />}
            {activeTab === "Markets" && <MarketsView />}
            {activeTab === "Liquidation" && <LiquidationView />}
            {activeTab === "Risks" && <RiskView />}

            {activeTab === "Dashboard" && (
              <>
                {/* =========================================================
                    ROW 1: TOP 3 STATS CARDS (Donut dropped, Overall APR dropped)
                   ========================================================= */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
                  {/* Card 1: Total Value Locked (Corrected spelling, Donut chart dropped) */}
                  <div className="bg-white rounded-2xl p-5 border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
                    <div className="text-[12px] text-[#64748b] font-normal">
                      Total Value Locked
                    </div>
                    <div className="text-[24px] font-normal text-[#111827] mt-3 leading-none tracking-tight">
                      ${vaultState.totalValueLockedUSD.toFixed(2)}
                    </div>
                  </div>

                  {/* Card 2: Overall Collateral Ratio (Kept) */}
                  <div className="bg-white rounded-2xl p-5 border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
                    <div className="text-[12px] text-[#64748b] font-normal">
                      Overall Collateral Ratio
                    </div>
                    <div className="text-[24px] font-normal text-[#111827] mt-3 leading-none tracking-tight">
                      {vaultState.overallCollateralRatio}
                    </div>
                  </div>

                  {/* Card 3: Total mUSD Minted (Renamed from Total GAI Issuance) */}
                  <div className="bg-white rounded-2xl p-5 border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
                    <div className="text-[12px] text-[#64748b] font-normal">
                      Total mUSD Minted
                    </div>
                    <div className="text-[24px] font-normal text-[#111827] mt-3 leading-none tracking-tight">
                      {vaultState.totalMusdMinted.toFixed(2)} mUSD
                    </div>
                  </div>
                </div>

                {/* =========================================================
                    ROW 2: MY TOTAL COLLATERAL & MY TOTAL DEBT
                    (Wired to connected wallet's real position across all 6 assets/both chains)
                   ========================================================= */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                  {/* Left Card: My Total Collateral (7 Cols) */}
                  <div className="md:col-span-7 bg-white rounded-2xl p-5 border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
                    <div>
                      <div className="text-[12px] text-[#64748b] font-normal">
                        My Total Collateral
                      </div>
                      <div className="text-[26px] font-normal text-[#111827] mt-2 mb-4 leading-none tracking-tight">
                        {vaultState.userTotalCollateralUSD.toFixed(2)}{" "}
                        <span className="font-normal text-[#64748b] text-[16px] ml-1.5">
                          USD
                        </span>
                      </div>

                      {/* Real 6-Asset Collateral Breakdown across Base & Ethereum Sepolia */}
                      <div className="grid grid-cols-2 gap-y-2.5 gap-x-8 text-[11.5px] text-[#1e293b] font-normal">
                        {vaultState.tokens.map((t) => (
                          <div key={t.config.symbol} className="flex items-center justify-between pr-2">
                            <div className="flex items-center gap-2">
                              <CollateralBadge symbol={t.config.symbol} className="w-4 h-4" />
                              <span className="font-medium text-[#111827]">
                                {t.userDepositFormatted} {t.config.symbol}
                              </span>
                            </div>
                            <span className="text-[#64748b] font-mono text-[10.5px]">
                              ${t.userDepositUSD.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Card: My Total Debt (5 Cols) */}
                  <div className="md:col-span-5 bg-white rounded-2xl p-5 border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
                    <div>
                      <div className="text-[12px] text-[#64748b] font-normal">
                        My Total Debt
                      </div>
                      <div className="text-[26px] font-normal text-[#111827] mt-2 leading-none tracking-tight">
                        {vaultState.userTotalDebtMusd.toFixed(2)}{" "}
                        <span className="font-medium text-[#111827] text-[18px] ml-1.5">
                          mUSD
                        </span>
                      </div>
                      <div className="text-[11px] text-[#94a3b8] font-normal mt-1.5">
                        ${vaultState.userTotalDebtMusd.toFixed(2)} USD
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#f1f3f7] flex items-center justify-between text-[11.5px] text-[#64748b]">
                      <span>Current CR</span>
                      <span className="font-semibold text-[#111827]">
                        {vaultState.userCurrentCR}
                      </span>
                    </div>
                  </div>
                </div>

                {/* =========================================================
                    ROW 3: ASSETS TABLE
                    (Reward APR dropped, Health Score replaced with Current CR per asset)
                   ========================================================= */}
                <div className="bg-white rounded-2xl border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-[#f1f3f7] text-[#64748b] text-[11px] font-normal">
                          <th className="py-3 px-5 font-normal">
                            Assets
                          </th>
                          <th className="py-3 px-4 font-normal">Chain</th>
                          <th className="py-3 px-4 font-normal">Price</th>
                          <th className="py-3 px-4 font-normal">My Deposit</th>
                          <th className="py-3 px-4 font-normal">My Debt</th>
                          <th className="py-3 px-5 font-normal text-right">
                            Current CR
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f8f9fb] text-[#1e293b]">
                        {vaultState.tokens.map((t) => (
                          <tr key={t.config.symbol} className="hover:bg-gray-50/60 transition-colors">
                            <td className="py-3 px-5">
                              <div className="flex items-center gap-2 font-medium text-[#111827]">
                                <CollateralBadge symbol={t.config.symbol} className="w-5 h-5" />
                                <span>{t.config.symbol}</span>
                                <span className="text-[11px] text-[#94a3b8] font-normal">
                                  {t.config.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <NetworkBadge network={t.config.network} className="w-4 h-4" />
                                <span className="text-[11.5px] text-[#475569]">
                                  {t.config.network}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-normal text-[#475569] tabular-nums">
                              ${t.priceUSD.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: t.priceUSD < 10 ? 4 : 2,
                              })}
                            </td>
                            <td className="py-3 px-4 font-normal text-[#475569] tabular-nums">
                              {t.userDepositFormatted} {t.config.symbol}{" "}
                              <span className="text-[11px] text-[#94a3b8]">
                                (${t.userDepositUSD.toFixed(2)})
                              </span>
                            </td>
                            <td className="py-3 px-4 font-normal text-[#475569] tabular-nums">
                              {t.userDebtShareUSD > 0
                                ? `${t.userDebtShareUSD.toFixed(2)} mUSD`
                                : "0.00 mUSD"}
                            </td>
                            <td className="py-3 px-5 font-normal text-right tabular-nums">
                              <span
                                className={
                                  t.currentCR !== "—"
                                    ? "font-medium text-[#475569]"
                                    : "text-[#94a3b8]"
                                }
                              >
                                {t.currentCR}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
      {/* =========================================================
          WITHDRAW COLLATERAL MODAL (Triggered from Profile Dropdown)
         ========================================================= */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/35"
            onClick={() => setShowWithdrawModal(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl border border-[#eaedf3] p-6 space-y-4 shadow-none">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CollateralBadge
                  symbol={selectedWithdrawTokenData.config.symbol}
                  className="w-6 h-6"
                />
                <h3 className="text-[16px] font-medium text-[#111827]">
                  Withdraw
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                className="text-[#94a3b8] hover:text-[#111827] text-lg font-bold cursor-pointer p-1"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Unlocked Collateral Overview Banner */}
            <div className="p-3 bg-[#f8fafc] border border-[#eaedf3] rounded-xl flex items-center justify-between text-[12px]">
              <div>
                <span className="text-[#64748b] block text-[11px]">
                  Unlocked Available
                </span>
                <span className="font-semibold text-[#111827] text-[16px] font-mono tabular-nums">
                  ${unlockedCollateralUSD.toFixed(2)}{" "}
                  <span className="text-[12px] font-normal text-[#64748b]">
                    USD
                  </span>
                </span>
              </div>
              <div className="text-right text-[11px] text-[#64748b] space-y-0.5">
                <div>
                  Total:{" "}
                  <span className="font-medium text-[#111827]">
                    ${vaultState.userTotalCollateralUSD.toFixed(2)}
                  </span>
                </div>
                <div>
                  Required for Debt:{" "}
                  <span className="font-medium text-[#111827]">
                    ${requiredCollateralUSD.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Asset Selector (Only tokens with deposits) */}
            {depositedTokens.length > 0 ? (
              <div>
                <label className="text-[11.5px] font-medium text-[#64748b] block mb-1.5">
                  Select Deposited Asset
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {depositedTokens.map((t) => (
                    <button
                      key={t.config.symbol}
                      type="button"
                      onClick={() => {
                        setWithdrawTokenSymbol(t.config.symbol);
                        setWithdrawAmount("");
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                        withdrawTokenSymbol === t.config.symbol
                          ? "border-[#c067c9] bg-[#fdf8fd] text-[#c067c9]"
                          : "border-[#e2e8f0] hover:bg-[#f8fafc] text-[#475569]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CollateralBadge
                          symbol={t.config.symbol}
                          className="w-5 h-5"
                        />
                        <div>
                          <div className="font-medium text-[12px]">
                            {t.config.symbol}
                          </div>
                          <div className="text-[10px] text-[#94a3b8]">
                            {t.config.network}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono text-[11px]">
                        <div className="font-medium">
                          {t.userDepositFormatted}
                        </div>
                        <div className="text-[10px] text-[#94a3b8]">
                          (${t.userDepositUSD.toFixed(2)})
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 text-center text-[12px] text-[#64748b] bg-gray-50 rounded-xl">
                No deposited collateral available to withdraw.
              </div>
            )}

            {/* Amount Input */}
            {depositedTokens.length > 0 && (
              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#64748b]">
                  <span>Withdraw Amount</span>
                  <span className="font-mono">
                    Max Safe: {maxSafeTokenWithdraw}{" "}
                    {selectedWithdrawTokenData.config.symbol}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={withdrawAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                        setWithdrawAmount(val);
                      }
                    }}
                    className="w-full bg-transparent text-[16px] font-normal text-[#111827] focus:outline-hidden [appearance:textfield]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(maxSafeTokenWithdraw)}
                    className="px-2 py-0.5 text-[11px] font-medium bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#334155] rounded-md transition-colors cursor-pointer"
                  >
                    MAX
                  </button>
                  <span className="text-[13px] font-medium text-[#111827]">
                    {selectedWithdrawTokenData.config.symbol}
                  </span>
                </div>
              </div>
            )}


            {/* Transaction Result Feedback */}
            {withdrawTxResult && (
              <div
                className={`p-3 rounded-xl text-[12px] border ${
                  withdrawTxResult.isError
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-[#f8fafc] border-[#e2e8f0] text-[#334155]"
                }`}
              >
                <div>{withdrawTxResult.text}</div>
                {withdrawTxResult.link && (
                  <a
                    href={withdrawTxResult.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#c067c9] hover:underline block mt-1 font-mono text-[11px]"
                  >
                    View on Basescan ↗
                  </a>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#e2e8f0] text-[13px] font-medium text-[#64748b] hover:text-[#111827] hover:bg-[#f8fafc] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  isWithdrawing ||
                  !withdrawAmount ||
                  parseFloat(withdrawAmount) <= 0 ||
                  unlockedCollateralUSD <= 0
                }
                onClick={handleConfirmWithdraw}
                className="relative overflow-hidden flex-1 py-2.5 rounded-xl font-medium text-[13px] text-white transition-all duration-200 hover:brightness-105 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-none border border-white/20 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #9850df 0%, #c067c9 50%, #d87eb9 100%)",
                }}
              >
                {/* Subtle top glare */}
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                {isWithdrawing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Broadcasting...</span>
                  </>
                ) : (
                  <span>Confirm</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
  );
}
