"use client";

import React, { useState } from "react";
import {
  useVaultData,
  SUPPORTED_TOKENS,
  executeDeposit,
  executeMint,
} from "@/lib/vaultClient";
import { useWeb3 } from "@/context/Web3Context";

// --- Base Network Vector Logo (Official Blue Mark) ---
export const BaseIcon = ({
  className = "w-5.5 h-5.5",
}: {
  className?: string;
}) => (
  <div
    className={`rounded-full overflow-hidden shrink-0 flex items-center justify-center ${className}`}
    title="Base Network"
  >
    <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
      <path
        d="M32 16C32 24.8366 24.8366 32 16 32C7.16344 32 0 24.8366 0 16C0 7.16344 7.16344 0 16 0C24.8366 0 32 7.16344 32 16Z"
        fill="#0052FF"
      />
      <path
        d="M15.9771 29C23.1698 29 29 23.1802 29 16C29 8.81984 23.1698 3 15.9771 3C9.15368 3 3.5564 8.23952 3 14.907H20.213V17.093H3C3.5564 23.7605 9.15368 29 15.9771 29Z"
        fill="white"
      />
    </svg>
  </div>
);

// --- Ethereum Network Vector Logo ---
export const EthereumIcon = ({
  className = "w-5.5 h-5.5",
}: {
  className?: string;
}) => (
  <div
    className={`rounded-full overflow-hidden shrink-0 flex items-center justify-center ${className}`}
    title="Ethereum Network"
  >
    <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
      <path
        d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z"
        fill="#627EEA"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 16.2225L16.4996 4V12.8718L9 16.2225ZM16.4996 21.9707V28L9 17.6188L16.4996 21.9707Z"
        fill="white"
      />
      <path
        d="M16.5 20.5765L23.9986 16.2226L16.5 12.8739V20.5765Z"
        fill="white"
        fillOpacity="0.2"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16.4996 4V12.8718L23.9982 16.2225L16.4996 4ZM16.4996 21.9717V28L24.0032 17.6188L16.4996 21.9717ZM16.4996 20.5765L9 16.2226L16.4996 12.8739V20.5765Z"
        fill="white"
        fillOpacity="0.602"
      />
    </svg>
  </div>
);

// --- Network Badge Helper ---
export function NetworkBadge({
  network,
  className = "w-5.5 h-5.5",
}: {
  network: string;
  className?: string;
}) {
  if (network.toLowerCase() === "base") {
    return <BaseIcon className={className} />;
  }
  return <EthereumIcon className={className} />;
}

// --- mUSDC Coin Logo (The 3D Meridian-Branded Coin) ---
export function MusdcCoin({
  size = 22,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative select-none shrink-0 flex items-center justify-center ${className}`}
      title="mUSD"
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className="overflow-visible w-full h-full"
      >
        <defs>
          <linearGradient
            id="musdc-face-grad"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#a45ae6" />
            <stop offset="45%" stopColor="#d377bf" />
            <stop offset="85%" stopColor="#f3b89e" />
            <stop offset="100%" stopColor="#fadcb7" />
          </linearGradient>
          <linearGradient
            id="musdc-edge-grad"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#5d3eb5" />
            <stop offset="50%" stopColor="#8d56c4" />
            <stop offset="100%" stopColor="#c382bf" />
          </linearGradient>
        </defs>

        {/* 3D Rim / Reeding Edge */}
        <ellipse cx="36" cy="32" rx="24" ry="24" fill="url(#musdc-edge-grad)" />

        {/* Front Coin Face */}
        <circle
          cx="30"
          cy="32"
          r="24"
          fill="url(#musdc-face-grad)"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="0.8"
        />

        {/* Center Meridian M Logo on Coin */}
        <image
          href="/meridian-logo.png"
          x="18"
          y="27"
          width="24"
          height="10"
          preserveAspectRatio="xMidYMid meet"
        />
      </svg>
    </div>
  );
}

// --- Collateral Token Icon Badge ---
export function CollateralBadge({
  symbol,
  className = "w-5 h-5",
}: {
  symbol: string;
  className?: string;
}) {
  const tokenImgMap: Record<string, string> = {
    ETH: "/token_eth.png",
    wstETH: "/token_wsteth.png",
    WBTC: "/token_wbtc.png",
    LINK: "/token_link.png",
    DAI: "/token_dai.png",
    USDC: "/token_usdc.png",
  };

  const src = tokenImgMap[symbol] || "/token_eth.png";

  return (
    <div
      className={`relative rounded-full overflow-hidden shrink-0 flex items-center justify-center ${className}`}
    >
      <img
        src={src}
        alt={symbol}
        className="w-full h-full object-contain select-none"
      />
    </div>
  );
}

export interface MarketRowData {
  id: string;
  network: "Base" | "Ethereum";
  loanSymbol: string;
  collateralSymbol: string;
  collateralName: string;
  tokenAddress: `0x${string}`;
  decimals: number;
  userDepositNum?: number;
  userDepositUSD?: number;
  requiredCR: string;
  oracle: string;
  oracleFull: string;
  totalMusd: string;
  stabilityFee: string;
  isPerAssetEnabled: boolean;
  isMintHalted?: boolean;
  reasoning?: string;
}

export default function MarketsView() {
  const { effectiveAddress, account, refreshMusdBalance, getWalletProvider } =
    useWeb3();
  const vaultState = useVaultData(effectiveAddress);
  const [copiedOracle, setCopiedOracle] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<MarketRowData | null>(
    null,
  );
  const [actionTab, setActionTab] = useState<"borrow" | "deposit">("deposit");
  const [inputAmount, setInputAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(
    null,
  );
  const [txMessage, setTxMessage] = useState<{
    text: string;
    link?: string;
    isError?: boolean;
  } | null>(null);

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedOracle(text);
      setTimeout(() => setCopiedOracle(null), 1800);
    }
  };

  // Build live table rows using real contract reads from useVaultData
  const markets: MarketRowData[] = vaultState.tokens.map((tokenData, index) => {
    const isEnabled =
      tokenData.config.symbol === "ETH" ||
      tokenData.config.symbol === "DAI" ||
      tokenData.config.symbol === "USDC";

    const assetDebtMusd =
      tokenData.totalDepositUSD > 0 && vaultState.totalValueLockedUSD > 0
        ? (tokenData.totalDepositUSD / vaultState.totalValueLockedUSD) *
          vaultState.totalMusdMinted
        : 0;

    const totalMusdStr =
      assetDebtMusd > 0 ? `${assetDebtMusd.toFixed(2)} mUSD` : "0.00 mUSD";

    const reqCR = isEnabled
      ? tokenData.requiredCR && tokenData.requiredCR !== "—"
        ? tokenData.requiredCR
        : "150%"
      : "—";

    const fee = isEnabled
      ? tokenData.stabilityFee && tokenData.stabilityFee !== "—"
        ? tokenData.stabilityFee
        : "2.00%"
      : "—";

    return {
      id: `m-${index + 1}`,
      network: tokenData.config.network,
      loanSymbol: "mUSD",
      collateralSymbol: tokenData.config.symbol,
      collateralName: tokenData.config.name,
      tokenAddress: tokenData.config.address,
      decimals: tokenData.config.decimals,
      userDepositNum: tokenData.userDepositNum,
      userDepositUSD: tokenData.userDepositUSD,
      requiredCR: reqCR,
      oracle: tokenData.config.oracleShort,
      oracleFull: tokenData.config.oracleFeed,
      totalMusd: totalMusdStr,
      stabilityFee: fee,
      isPerAssetEnabled: isEnabled,
      isMintHalted: tokenData.isMintHalted ?? !isEnabled,
      reasoning: tokenData.reasoning,
    };
  });

  const handleAction = async () => {
    if (!selectedMarket) return;

    if (!selectedMarket.isPerAssetEnabled) {
      setTxMessage({
        text: "Per-asset evaluation not yet enabled for this asset",
        isError: true,
      });
      return;
    }

    if (actionTab === "borrow" && selectedMarket.isMintHalted) {
      setTxMessage({
        text: `Minting is currently halted for ${selectedMarket.collateralSymbol}: Protocol risk defense active.`,
        isError: true,
      });
      return;
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) return;
    if (actionTab === "borrow" && (selectedMarket.userDepositNum || 0) <= 0) {
      setTxMessage({
        text: `You hold 0 ${selectedMarket.collateralSymbol} deposited. The protocol requires an active deposit before borrowing.`,
        isError: true,
      });
      return;
    }
    setIsProcessing(true);
    setTxMessage(null);
    setStatusNotification(null);

    try {
      const walletProvider = await getWalletProvider();
      const execOpts = {
        walletProvider,
        account: effectiveAddress || account,
        onNotify: (msg: string) => setStatusNotification(msg),
      };

      if (actionTab === "deposit") {
        const res = await executeDeposit({
          tokenAddress: selectedMarket.tokenAddress,
          amount: inputAmount,
          decimals: selectedMarket.decimals,
          isBridged: selectedMarket.network === "Ethereum",
          ...execOpts,
        });

        if (res.success) {
          setTxMessage({
            text: `Deposit successful!`,
            link: res.link,
          });
          await vaultState.refresh();
          await refreshMusdBalance();
        } else {
          setTxMessage({
            text: res.error || "Transaction failed",
            isError: true,
          });
        }
      } else {
        const res = await executeMint({
          tokenAddress: selectedMarket.tokenAddress,
          amountMusd: inputAmount,
          ...execOpts,
        });

        if (res.success) {
          setTxMessage({
            text: `Minted ${inputAmount} mUSD successfully!`,
            link: res.link,
          });
          await vaultState.refresh();
          await refreshMusdBalance();
        } else {
          setTxMessage({
            text: res.error || "Mint transaction failed",
            isError: true,
          });
        }
      }
    } catch (e: unknown) {
      const errStr = e instanceof Error ? e.message : String(e);
      setTxMessage({ text: errStr, isError: true });
    } finally {
      setIsProcessing(false);
      setStatusNotification(null);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* =========================================================
          MAIN MARKETS CARD CONTAINER (Meridian Light Branding)
         ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden">
        {/* --- Top Header Row with Title & Stat Pills --- */}
        <div className="p-5 sm:px-6 border-b border-[#f1f3f7] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[15.5px] sm:text-[16px] font-medium text-[#111827] tracking-tight">
              Collateral Markets
            </h2>
          </div>

          {/* Right Stat Pills: Total Value Locked, Total mUSD Minted, Required CR */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Total deposits */}
            <div className="bg-[#f8f9fb] border border-[#e5e7eb] rounded-xl px-3.5 py-1.5 flex items-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <span className="text-[11.5px] font-normal text-[#64748b]">
                Total deposits
              </span>
              <span className="text-[12.5px] font-medium text-[#64748b] tabular-nums tracking-tight">
                ${vaultState.totalValueLockedUSD.toFixed(2)}
              </span>
            </div>

            {/* Total mUSD */}
            <div className="bg-[#f8f9fb] border border-[#e5e7eb] rounded-xl px-3.5 py-1.5 flex items-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <span className="text-[11.5px] font-normal text-[#64748b]">
                Total mUSD Minted
              </span>
              <span className="text-[12.5px] font-medium text-[#64748b] tabular-nums tracking-tight">
                {vaultState.totalMusdMinted.toFixed(2)} mUSD
              </span>
            </div>

            {/* Required CR */}
            <div className="bg-[#f8f9fb] border border-[#e5e7eb] rounded-xl px-3.5 py-1.5 flex items-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <span className="text-[11.5px] font-normal text-[#64748b]">
                Required CR
              </span>
              <span className="text-[12.5px] font-medium text-[#64748b] tabular-nums tracking-tight">
                {vaultState.requiredCR}
              </span>
            </div>
          </div>
        </div>

        {/* --- Collateral Markets Table --- */}
        <div className="w-full overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#f1f3f7] bg-[#fbfcfd] text-[11px] uppercase tracking-wider text-[#64748b] font-medium">
                <th className="py-3.5 px-3 pl-5 sm:pl-6 min-w-[95px]">
                  Network
                </th>
                <th className="py-3.5 px-3 min-w-[105px]">Loan</th>
                <th className="py-3.5 px-3 min-w-[115px]">Collateral</th>
                <th className="py-3.5 px-3 min-w-[110px]">Required CR</th>
                <th className="py-3.5 px-3 min-w-[120px]">Oracle</th>
                <th className="py-3.5 px-3 min-w-[140px]">Total mUSD</th>
                <th className="py-3.5 px-3 pr-5 sm:pr-6 min-w-[120px] text-right">
                  Stability Fee
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f7] text-[12.5px] text-[#334155]">
              {markets.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => {
                    setSelectedMarket(m);
                    setTxMessage(null);
                    setInputAmount("");
                  }}
                  className="hover:bg-[#f8fafc]/90 transition-colors group cursor-pointer"
                >
                  {/* Network Icon: Base logo for Base tokens, Ethereum logo for Ethereum tokens */}
                  <td className="py-3.5 px-3 pl-5 sm:pl-6">
                    <div className="flex items-center">
                      <NetworkBadge
                        network={m.network}
                        className="w-5.5 h-5.5"
                      />
                    </div>
                  </td>

                  {/* Loan Token: Meridian mUSD with MusdcCoin */}
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2">
                      <MusdcCoin size={21} />
                      <span className="font-medium text-[#111827]">
                        {m.loanSymbol}
                      </span>
                    </div>
                  </td>

                  {/* Collateral Token */}
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2">
                      <CollateralBadge
                        symbol={m.collateralSymbol}
                        className="w-5 h-5"
                      />
                      <span className="font-medium text-[#111827]">
                        {m.collateralSymbol}
                      </span>
                    </div>
                  </td>

                  {/* Required CR (Replaced LLTV) */}
                  <td className="py-3.5 px-3 font-normal text-[#475569] tabular-nums">
                    {m.requiredCR}
                  </td>

                  {/* Oracle */}
                  <td className="py-3.5 px-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(m.oracleFull);
                      }}
                      className="font-mono text-[11px] text-[#64748b] hover:text-[#9850df] px-1.5 py-0.5 rounded bg-[#f8fafc] border border-[#e2e8f0] transition-colors cursor-pointer flex items-center gap-1"
                      title="Click to copy oracle address"
                    >
                      <span>{m.oracle}</span>
                      {copiedOracle === m.oracleFull ? (
                        <span className="text-[10px] text-emerald-600 font-sans">
                          Copied!
                        </span>
                      ) : null}
                    </button>
                  </td>

                  {/* Total mUSD (Minted per asset, pulled from real Vault state) */}
                  <td className="py-3.5 px-3 font-normal text-[#1e293b] tabular-nums whitespace-nowrap">
                    {m.totalMusd.split(" ")[0]}{" "}
                    <span className="text-[#94a3b8] text-[11px] font-normal">
                      mUSD
                    </span>
                  </td>

                  {/* Stability Fee (Replaced Best Rate) */}
                  <td className="py-3.5 px-3 pr-5 sm:pr-6 text-right tabular-nums whitespace-nowrap">
                    <span className="font-medium text-[#475569]">
                      {m.stabilityFee}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================
          INTERACTIVE MARKET ACTION MODAL (Deposit / Mint)
         ========================================================= */}
      {selectedMarket && (
        <div
          className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedMarket(null)}
        >
          <div
            className="bg-white rounded-2xl border border-[#eaedf3] shadow-none w-full max-w-md p-6 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#f1f3f7]">
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-1.5 items-center">
                  <MusdcCoin size={24} className="z-10" />
                  <CollateralBadge
                    symbol={selectedMarket.collateralSymbol}
                    className="w-6 h-6"
                  />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#111827] leading-tight">
                    {selectedMarket.loanSymbol} /{" "}
                    {selectedMarket.collateralSymbol}
                  </h3>
                  <div className="text-[11.5px] text-[#64748b] flex items-center gap-1.5 mt-0.5">
                    <NetworkBadge
                      network={selectedMarket.network}
                      className="w-3.5 h-3.5"
                    />
                    <span>{selectedMarket.network} Network</span>
                    {selectedMarket.isPerAssetEnabled && (
                      <>
                        <span>•</span>
                        <span>Required CR {selectedMarket.requiredCR}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMarket(null)}
                className="w-8 h-8 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {!selectedMarket.isPerAssetEnabled ? (
              <div className="my-5 p-6 rounded-2xl bg-slate-50/80 border border-slate-200/90 text-center flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-slate-200/80 text-slate-500 mx-auto flex items-center justify-center font-bold text-lg">
                  —
                </div>
              </div>
            ) : (
              <>
                {/* Action Tabs: Deposit / Borrow */}
                <div className="relative flex items-center bg-[#f8fafc] p-1 rounded-xl my-4 border border-[#eaedf3] select-none">
                  <div
                    className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white border border-[#e2e8f0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] pointer-events-none transition-transform duration-300 ease-in-out"
                    style={{
                      transform:
                        actionTab === "deposit"
                          ? "translateX(0%)"
                          : "translateX(100%)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setActionTab("deposit")}
                    className={`relative z-10 flex-1 py-2 text-[12.5px] font-medium text-center rounded-lg transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-0 focus-visible:outline-none ${
                      actionTab === "deposit"
                        ? "text-[#111827]"
                        : "text-[#64748b] hover:text-[#111827]"
                    }`}
                  >
                    Deposit {selectedMarket.collateralSymbol}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionTab("borrow")}
                    className={`relative z-10 flex-1 py-2 text-[12.5px] font-medium text-center rounded-lg transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-0 focus-visible:outline-none ${
                      actionTab === "borrow"
                        ? "text-[#111827]"
                        : "text-[#64748b] hover:text-[#111827]"
                    }`}
                  >
                    Borrow mUSD
                  </button>
                </div>

                {/* Market Details Grid */}
                <div className="bg-[#fbfcfd] border border-[#f1f3f7] rounded-xl p-3.5 space-y-2 text-[12px]">
                  <div className="flex items-center justify-between text-[#64748b]">
                    <span>Required CR</span>
                    <span className="text-[#111827] font-medium">
                      {selectedMarket.requiredCR}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#64748b]">
                    <span>Total mUSD Minted</span>
                    <span className="text-[#111827] font-medium">
                      {selectedMarket.totalMusd}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#64748b]">
                    <span>Stability Fee</span>
                    <span className="text-emerald-600 font-medium">
                      {selectedMarket.stabilityFee}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#64748b]">
                    <span>Oracle</span>
                    <span className="font-mono text-[11px] text-[#64748b]">
                      {selectedMarket.oracle}
                    </span>
                  </div>
                </div>

                {/* Mint Halted Notice if Borrowing against a halted asset */}
                {actionTab === "borrow" && selectedMarket.isMintHalted && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-[12px] text-rose-700 leading-snug">
                    <div className="font-semibold flex items-center gap-1.5">
                      <span>
                        ⚠️ Minting Halted for {selectedMarket.collateralSymbol}
                      </span>
                    </div>
                    <p className="mt-0.5 text-rose-600">
                      {selectedMarket.reasoning ||
                        "Protocol risk defense is active. Fresh borrowing against this asset is strictly paused."}
                    </p>
                  </div>
                )}

                {/* Input Amount Field */}
                <div className="mt-4">
                  <label className="text-[11.5px] font-medium text-[#64748b] block mb-1.5">
                    Amount (
                    {actionTab === "deposit"
                      ? selectedMarket.collateralSymbol
                      : "mUSD"}
                    )
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={
                        actionTab === "borrow" && selectedMarket.isMintHalted
                          ? `Minting halted for ${selectedMarket.collateralSymbol}`
                          : actionTab === "borrow" &&
                              (selectedMarket.userDepositNum || 0) <= 0
                            ? "Deposit collateral first"
                            : "0.00"
                      }
                      value={
                        actionTab === "borrow" &&
                        (selectedMarket.isMintHalted ||
                          (selectedMarket.userDepositNum || 0) <= 0)
                          ? ""
                          : inputAmount
                      }
                      disabled={
                        isProcessing ||
                        (actionTab === "borrow" &&
                          (selectedMarket.isMintHalted ||
                            (selectedMarket.userDepositNum || 0) <= 0))
                      }
                      onChange={(e) => setInputAmount(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-[#e2e8f0] focus:border-[#c067c9] focus:ring-1 focus:ring-[#c067c9] outline-none text-[14px] text-[#111827] placeholder:text-[#cbd5e1] tabular-nums disabled:bg-[#f8fafc] disabled:text-[#94a3b8] disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled={
                        isProcessing ||
                        (actionTab === "borrow" &&
                          (selectedMarket.collateralSymbol === "DAI" ||
                            (selectedMarket.userDepositNum || 0) <= 0))
                      }
                      onClick={() => {
                        if (actionTab === "deposit") {
                          setInputAmount("0.005");
                        } else {
                          if (selectedMarket.collateralSymbol === "DAI") return;
                          if ((selectedMarket.userDepositNum || 0) <= 0) return;
                          const activeReqBps =
                            parseFloat(
                              selectedMarket.requiredCR.replace("%", ""),
                            ) * 100 || 15000;
                          const maxDebtAllowed =
                            (vaultState.userTotalCollateralUSD * 10000) /
                            activeReqBps;
                          const maxMint = Math.max(
                            0,
                            maxDebtAllowed - vaultState.userTotalDebtMusd,
                          );
                          setInputAmount(
                            maxMint > 0 ? maxMint.toFixed(2) : "0.00",
                          );
                        }
                      }}
                      className="absolute right-2.5 top-2.5 px-2 py-1 rounded-md text-[11px] font-medium bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                {/* Status Message if any */}
                {txMessage && (
                  <div
                    className={`mt-3 p-2.5 rounded-xl text-[12px] border ${
                      txMessage.isError
                        ? "bg-rose-50 border-rose-200 text-rose-700"
                        : "bg-[#f8fafc] border-[#e2e8f0] text-[#334155]"
                    }`}
                  >
                    <div>{txMessage.text}</div>
                    {txMessage.link && (
                      <a
                        href={txMessage.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#c067c9] underline font-mono text-[11px] block mt-1"
                      >
                        View on Explorer ↗
                      </a>
                    )}
                  </div>
                )}

                {/* Action CTA Button */}
                <button
                  type="button"
                  onClick={handleAction}
                  disabled={
                    isProcessing ||
                    !inputAmount ||
                    parseFloat(inputAmount) <= 0 ||
                    (actionTab === "borrow" &&
                      (selectedMarket.collateralSymbol === "DAI" ||
                        (selectedMarket.userDepositNum || 0) <= 0))
                  }
                  className="relative overflow-hidden w-full mt-4 h-11 rounded-xl font-medium text-[13px] text-white transition-all duration-200 hover:brightness-105 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border border-white/20 flex items-center justify-center gap-2"
                  style={{
                    background:
                      actionTab === "borrow" &&
                      selectedMarket.collateralSymbol === "DAI"
                        ? "#e2e8f0"
                        : "linear-gradient(135deg, #9850df 0%, #c067c9 50%, #d87eb9 100%)",
                  }}
                >
                  {/* Subtle top glare */}
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                  {isProcessing
                    ? "Submitting Transaction..."
                    : actionTab === "borrow" && selectedMarket.isMintHalted
                      ? `Mint Halted for ${selectedMarket.collateralSymbol}`
                      : actionTab === "borrow" &&
                          (selectedMarket.userDepositNum || 0) <= 0
                        ? "Deposit Required to Borrow"
                        : `Confirm ${actionTab === "deposit" ? `Deposit ${selectedMarket.collateralSymbol}` : "Borrow mUSD"}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
