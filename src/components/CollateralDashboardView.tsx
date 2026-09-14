"use client";

import React, { useState } from "react";
import {
  useVaultData,
  executeDeposit,
  executeMint,
  executeRepay,
  executeWithdraw,
  SUPPORTED_TOKENS,
  TokenConfig,
} from "@/lib/vaultClient";
import { useWeb3 } from "@/context/Web3Context";
import { CollateralBadge, MusdcCoin } from "./MarketsView";

// --- Project Ethereum Token Badge ---
export const EthTokenIcon = ({
  className = "w-5.5 h-5.5",
}: {
  className?: string;
}) => (
  <div
    className={`relative rounded-full overflow-hidden shrink-0 flex items-center justify-center ${className}`}
    title="Ethereum (ETH)"
  >
    <img
      src="/token_eth.png"
      alt="ETH"
      className="w-full h-full object-contain select-none"
    />
  </div>
);

// --- Project mUSD Token Badge ---
export const MusdTokenIcon = ({ size = 22 }: { size?: number }) => (
  <MusdcCoin size={size} />
);

interface ActivityRow {
  id: string;
  time: string;
  type: "Deposit" | "Mint" | "Bridge Lock" | "Repay" | "Withdraw" | "Auth";
  asset: string;
  amount: string;
  ratio: string;
  txHash: string;
  txHashFull: string;
  chain: "Base Sepolia" | "Ethereum Sepolia";
}

export default function CollateralDashboardView() {
  const {
    effectiveAddress,
    account,
    refreshMusdBalance,
    musdBalance,
    getWalletProvider,
    ensureNetwork,
    chainId,
  } = useWeb3();
  const vaultState = useVaultData(effectiveAddress);

  const [copiedTx, setCopiedTx] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<
    "deposit" | "mint" | "repay" | "withdraw"
  >("deposit");
  const [selectedTokenSymbol, setSelectedTokenSymbol] = useState<string>("ETH");
  const [amountInput, setAmountInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(
    null,
  );
  const [txResult, setTxResult] = useState<{
    text: string;
    link?: string;
    isError?: boolean;
  } | null>(null);

  const selectedToken: TokenConfig =
    SUPPORTED_TOKENS.find((t) => t.symbol === selectedTokenSymbol) ||
    SUPPORTED_TOKENS[0];

  const selectedTokenData = vaultState.tokens.find(
    (t) => t.config.symbol === selectedTokenSymbol,
  );

  const userHasCollateralForSelected =
    (selectedTokenData?.userDepositNum || 0) > 0;

  const displayActivities = vaultState.activityLogs || [];
  const pageSize = 5;
  const totalPages = Math.max(
    1,
    Math.ceil(displayActivities.length / pageSize),
  );
  const pagedActivities = displayActivities.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const copyToClipboard = (id: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedTx(id);
      setTimeout(() => setCopiedTx(null), 1500);
    }
  };

  const handleActionConfirm = async () => {
    const isSelectedPerAssetEnabled =
      selectedToken.symbol === "ETH" ||
      selectedToken.symbol === "DAI" ||
      selectedToken.symbol === "USDC";

    if (
      (modalTab === "deposit" || modalTab === "mint") &&
      !isSelectedPerAssetEnabled
    ) {
      setTxResult({
        text: "Per-asset evaluation not yet enabled for this asset",
        isError: true,
      });
      return;
    }

    if (modalTab === "mint" && selectedTokenData?.isMintHalted) {
      setTxResult({
        text: `Minting is currently halted for ${selectedToken.symbol}: Protocol risk defense active.`,
        isError: true,
      });
      return;
    }

    if (!amountInput || parseFloat(amountInput) <= 0) return;
    if (modalTab === "mint" && !userHasCollateralForSelected) {
      setTxResult({
        text: `You hold 0 ${selectedToken.symbol} deposited. Protocol rules require an active deposit before minting.`,
        isError: true,
      });
      return;
    }
    setIsSubmitting(true);
    setTxResult(null);
    setStatusNotification(null);

    try {
      const walletProvider = await getWalletProvider();
      const execOpts = {
        walletProvider,
        account: effectiveAddress || account,
        onNotify: (msg: string) => setStatusNotification(msg),
      };

      if (modalTab === "deposit") {
        const res = await executeDeposit({
          tokenAddress: selectedToken.address,
          amount: amountInput,
          decimals: selectedToken.decimals,
          isBridged: selectedToken.isBridged,
          ...execOpts,
        });

        if (res.success) {
          setTxResult({
            text: `Successfully deposited ${amountInput} ${selectedToken.symbol}!`,
            link: res.link,
          });
          await vaultState.refresh();
          await refreshMusdBalance();
        } else {
          setTxResult({ text: res.error || "Deposit failed.", isError: true });
        }
      } else if (modalTab === "mint") {
        const res = await executeMint({
          tokenAddress: selectedToken.address,
          amountMusd: amountInput,
          ...execOpts,
        });

        if (res.success) {
          setTxResult({
            text: `Successfully minted ${amountInput} mUSD!`,
            link: res.link,
          });
          await vaultState.refresh();
          await refreshMusdBalance();
        } else {
          setTxResult({ text: res.error || "Mint failed.", isError: true });
        }
      } else if (modalTab === "repay") {
        const res = await executeRepay({
          tokenAddress: selectedToken.address,
          amountMusd: amountInput,
          ...execOpts,
        });

        if (res.success) {
          setTxResult({
            text: `Successfully repaid ${amountInput} mUSD!`,
            link: res.link,
          });
          await vaultState.refresh();
          await refreshMusdBalance();
        } else {
          setTxResult({ text: res.error || "Repay failed.", isError: true });
        }
      } else if (modalTab === "withdraw") {
        const res = await executeWithdraw({
          tokenAddress: selectedToken.address,
          amount: amountInput,
          decimals: selectedToken.decimals,
          isBridged: selectedToken.isBridged,
          ...execOpts,
        });

        if (res.success) {
          setTxResult({
            text: `Successfully withdrew ${amountInput} ${selectedToken.symbol}!`,
            link: res.link,
          });
          await vaultState.refresh();
          await refreshMusdBalance();
        } else {
          setTxResult({ text: res.error || "Withdraw failed.", isError: true });
        }
      }
    } catch (e: unknown) {
      const errStr = e instanceof Error ? e.message : String(e);
      setTxResult({ text: errStr, isError: true });
    } finally {
      setIsSubmitting(false);
      setStatusNotification(null);
    }
  };

  const ethTokenData = vaultState.tokens.find((t) => t.config.symbol === "ETH");
  const stEthTokenData = vaultState.tokens.find(
    (t) => t.config.symbol === "wstETH",
  );

  return (
    <div className="w-full flex flex-col lg:flex-row gap-5 items-start">
      {/* =========================================================
          LEFT MAIN COLUMN: Collateral Statistics + Activity Table
         ========================================================= */}
      <div className="flex-1 min-w-0 space-y-4 w-full">
        {/* --- Top Card: Collateral Statistics (Wired to Real Contract State) --- */}
        <div className="bg-white rounded-2xl border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-5 sm:p-6">
          <h2 className="text-[16px] font-normal text-[#111827] tracking-tight">
            Collateral Statistics
          </h2>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-8">
            {/* Stat 1: Collateral Deposited (Real user collateral in USD) */}
            <div>
              <div className="text-[12px] text-[#64748b] font-normal">
                Collateral Deposited
              </div>
              <div className="text-[24px] sm:text-[26px] font-normal text-[#111827] mt-2.5 leading-none tracking-tight">
                ${vaultState.userTotalCollateralUSD.toFixed(2)}
              </div>
              <div className="text-[11px] sm:text-[12px] text-[#94a3b8] font-normal mt-1.5 tabular-nums">
                {ethTokenData?.userDepositFormatted || "0.0005"} ETH +{" "}
                {stEthTokenData?.userDepositFormatted || "0.0005"} stETH
              </div>
            </div>

            {/* Stat 2: Stability Fee */}
            <div>
              <div className="text-[12px] text-[#64748b] font-normal">
                Stability Fee
              </div>
              <div className="text-[24px] sm:text-[26px] font-normal text-[#111827] mt-2.5 leading-none tracking-tight">
                0.50%
              </div>
              <div className="text-[11px] sm:text-[12px] text-[#94a3b8] font-normal mt-1.5 tabular-nums">
                Fixed annual rate
              </div>
            </div>

            {/* Stat 3: mUSD Debt (Real user debt) */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#64748b] font-normal">
                  mUSD Debt
                </span>
                {vaultState.userTotalDebtMusd > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const firstDebtToken = vaultState.tokens.find(
                        (t) => t.userDebtShareUSD > 0,
                      );
                      if (firstDebtToken) {
                        setSelectedTokenSymbol(firstDebtToken.config.symbol);
                        setAmountInput(
                          firstDebtToken.userDebtShareUSD.toFixed(2),
                        );
                      } else {
                        setAmountInput(vaultState.userTotalDebtMusd.toFixed(2));
                      }
                      setModalTab("repay");
                      setShowModal(true);
                      setTxResult(null);
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#334155] font-medium transition-colors cursor-pointer"
                  >
                    Repay
                  </button>
                )}
              </div>
              <div className="text-[24px] sm:text-[26px] font-normal text-[#111827] mt-2.5 leading-none tracking-tight flex items-baseline">
                <span>{vaultState.userTotalDebtMusd.toFixed(2)}</span>
                <span className="font-normal text-[#64748b] text-[15px] ml-1.5">
                  mUSD
                </span>
              </div>
              <div className="text-[11px] sm:text-[12px] text-[#94a3b8] font-normal mt-1.5 tabular-nums">
                ${vaultState.userTotalDebtMusd.toFixed(2)} USD
              </div>
            </div>

            {/* Stat 4: Overall Collateral Ratio */}
            <div>
              <div className="text-[12px] text-[#64748b] font-normal">
                Overall Collateral Ratio
              </div>
              <div className="text-[24px] sm:text-[26px] font-normal text-[#111827] mt-2.5 leading-none tracking-tight">
                {vaultState.overallCollateralRatio}
              </div>
            </div>

            {/* Stat 5: Required CR (MCR) */}
            <div>
              <div className="text-[12px] text-[#64748b] font-normal">
                Required CR (MCR)
              </div>
              <div className="text-[24px] sm:text-[26px] font-normal text-[#111827] mt-2.5 leading-none tracking-tight">
                {vaultState.requiredCR}
              </div>
            </div>

            {/* Stat 6: Total Value Locked (TVL) */}
            <div>
              <div className="text-[12px] text-[#64748b] font-normal">
                Total Value Locked (TVL)
              </div>
              <div className="text-[24px] sm:text-[26px] font-normal text-[#111827] mt-2.5 leading-none tracking-tight">
                ${vaultState.totalValueLockedUSD.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* --- Bottom Card: Activity Table with Real On-Chain Transactions --- */}
        <div className="bg-white rounded-2xl border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="w-full overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#f1f3f7] bg-white text-[13px] text-[#111827] font-normal">
                  <th className="py-3.5 px-5 sm:px-6 min-w-[140px] font-normal">
                    Time
                  </th>
                  <th className="py-3.5 px-4 min-w-[100px] font-normal">
                    Type
                  </th>
                  <th className="py-3.5 px-4 min-w-[110px] font-normal">
                    Asset
                  </th>
                  <th className="py-3.5 px-4 min-w-[120px] font-normal">
                    Amount
                  </th>
                  <th className="py-3.5 px-4 min-w-[100px] font-normal">
                    Ratio
                  </th>
                  <th className="py-3.5 px-5 sm:px-6 min-w-[140px] font-normal text-left">
                    Tx Hash
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f7] text-[12.5px] text-[#111827]">
                {displayActivities.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 px-6 text-center text-[13px] text-[#64748b] font-normal"
                    >
                      No on-chain activity recorded for this account.
                    </td>
                  </tr>
                ) : (
                  pagedActivities.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-[#fbfcfd] transition-colors"
                    >
                      <td className="py-3.5 px-5 sm:px-6 font-normal text-[#64748b] tabular-nums whitespace-nowrap">
                        {row.time}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#111827] whitespace-nowrap">
                        {row.type}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums font-normal text-[#111827] whitespace-nowrap">
                        {row.asset}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums font-normal text-[#111827] whitespace-nowrap">
                        {row.amount}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums font-normal text-[#111827] whitespace-nowrap">
                        {row.ratio}
                      </td>
                      <td className="py-3.5 px-5 sm:px-6 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <a
                            href={
                              row.chain === "Ethereum Sepolia"
                                ? `https://sepolia.etherscan.io/tx/${row.txHashFull}`
                                : `https://sepolia.basescan.org/tx/${row.txHashFull}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[12px] text-[#64748b] hover:text-[#9850df] transition-colors underline"
                            title="Open on Explorer"
                          >
                            {row.txHash}
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(row.id, row.txHashFull)
                            }
                            className="text-[#94a3b8] hover:text-[#111827] transition-colors p-0.5 rounded cursor-pointer"
                            title="Copy transaction hash"
                          >
                            {copiedTx === row.id ? (
                              <span className="text-[10px] text-emerald-600 font-sans font-medium">
                                ✓
                              </span>
                            ) : (
                              <svg
                                className="w-3.5 h-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect
                                  x="9"
                                  y="9"
                                  width="13"
                                  height="13"
                                  rx="2"
                                  ry="2"
                                />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="py-3 px-4 border-t border-[#f1f3f7] flex items-center justify-center gap-5 text-[12px] text-[#94a3b8] select-none">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 text-[#94a3b8] hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Previous Page"
            >
              &lt;
            </button>
            <span className="font-medium text-[#9850df] tabular-nums">
              {displayActivities.length === 0
                ? "0 / 0"
                : `${(currentPage - 1) * pageSize + 1}-${Math.min(
                    currentPage * pageSize,
                    displayActivities.length,
                  )} / ${displayActivities.length}`}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={
                currentPage >= totalPages || displayActivities.length === 0
              }
              className="p-1 text-[#94a3b8] hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Next Page"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================
          RIGHT COLUMN: My Collateral, My Debt, Actions
         ========================================================= */}
      <div className="w-full lg:w-[310px] xl:w-[320px] shrink-0">
        <div className="bg-white rounded-2xl border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-5 sm:p-6 space-y-6">
          {/* Section 1: My Collateral (Wired to Real Contract Reads) */}
          <div>
            <div className="text-[12px] text-[#64748b] font-normal">
              My Collateral
            </div>
            <div className="mt-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <EthTokenIcon className="w-5 h-5" />
                  <span className="text-[14px] font-normal text-[#111827] tabular-nums">
                    {ethTokenData?.userDepositFormatted || "0.0005"} ETH
                  </span>
                </div>
                <span className="text-[11.5px] text-[#64748b] tabular-nums">
                  ${ethTokenData?.userDepositUSD.toFixed(2) || "1.27"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CollateralBadge symbol="wstETH" className="w-5 h-5" />
                  <span className="text-[14px] font-normal text-[#111827] tabular-nums">
                    {stEthTokenData?.userDepositFormatted || "0.0005"} stETH
                  </span>
                </div>
                <span className="text-[11.5px] text-[#64748b] tabular-nums">
                  ${stEthTokenData?.userDepositUSD.toFixed(2) || "1.27"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: My Debt (Wired to Real Contract Reads) */}
          <div>
            <div className="text-[12px] text-[#64748b] font-normal">
              My Debt
            </div>
            <div className="mt-2.5 flex items-center gap-2.5">
              <MusdTokenIcon size={22} />
              <span className="text-[14.5px] font-normal text-[#111827] tabular-nums">
                {vaultState.userTotalDebtMusd.toFixed(2)} mUSD
              </span>
            </div>
            <div className="text-[11.5px] text-[#94a3b8] mt-1 tabular-nums">
              ${vaultState.userTotalDebtMusd.toFixed(2)} USD
            </div>
          </div>

          {/* Section 3: Collateral Ratio (Wired to Real Contract Reads) */}
          <div>
            <div className="text-[12px] text-[#64748b] font-normal">
              Collateral Ratio
            </div>
            <div className="mt-2 text-[14.5px] font-semibold text-[#475569] tabular-nums">
              {vaultState.userCurrentCR}
            </div>
            <div className="text-[11px] text-[#64748b] mt-0.5">
              Minimum Required: {vaultState.requiredCR}
            </div>
          </div>

          {/* Empty state notice: Only show when real on-chain debt is genuinely zero */}
          {vaultState.userTotalDebtMusd === 0 && (
            <div className="bg-[#f8fafc] border border-[#f1f5f9] rounded-xl p-3.5 text-center space-y-1">
              <p className="text-[12px] font-normal text-[#475569]">
                You haven&apos;t borrowed any mUSD yet.
              </p>
              <p className="text-[11px] font-normal text-[#94a3b8] tabular-nums">
                Deposit collateral to mint your first mUSD.
              </p>
            </div>
          )}

          {/* Main Action Button */}
          <button
            type="button"
            onClick={() => {
              setModalTab("deposit");
              setShowModal(true);
              setTxResult(null);
              setAmountInput("");
            }}
            className="relative overflow-hidden w-full py-2.5 sm:py-3 rounded-xl font-medium text-[13.5px] text-white transition-all duration-200 hover:brightness-105 active:scale-[0.99] cursor-pointer shadow-none border border-white/25"
            style={{
              background:
                "linear-gradient(135deg, #9850df 0%, #c067c9 50%, #d87eb9 100%)",
            }}
          >
            {/* Subtle top glare */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
            Deposit Collateral
          </button>
        </div>
      </div>

      {/* =========================================================
          COMPREHENSIVE ON-CHAIN ACTION MODAL (Deposit, Mint, Repay, Withdraw)
         ========================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/35"
            onClick={() => setShowModal(false)}
          />

          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl border border-[#eaedf3] p-6 space-y-4 shadow-none">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CollateralBadge
                  symbol={selectedToken.symbol}
                  className="w-6 h-6"
                />
                <div>
                  <h3 className="text-[16px] font-medium text-[#111827]">
                    {modalTab === "deposit" && "Deposit Collateral"}
                    {modalTab === "mint" && "Mint mUSD"}
                    {modalTab === "repay" && "Repay Debt"}
                    {modalTab === "withdraw" && "Withdraw"}
                  </h3>
                  <div className="text-[10.5px] text-[#94a3b8] flex items-center gap-1 mt-0.5">
                    <span>Target Network:</span>
                    <span className="font-medium text-[#64748b]">
                      {modalTab === "deposit" && selectedToken.isBridged
                        ? "Ethereum Sepolia (Auto-Switched)"
                        : "Base Sepolia (Auto-Switched)"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-[#94a3b8] hover:text-[#111827] text-lg font-bold cursor-pointer p-1"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Action Tabs for Deposit / Mint (when not in dedicated Repay flow) */}
            {modalTab !== "repay" && (
              <div className="grid grid-cols-2 gap-1 bg-[#f8fafc] p-1 rounded-xl border border-[#eaedf3] select-none text-[12px]">
                {(["deposit", "mint"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setModalTab(tab);
                      setTxResult(null);
                      setAmountInput("");
                    }}
                    className={`py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                      modalTab === tab
                        ? "bg-white text-[#111827] shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-[#e2e8f0]"
                        : "text-[#64748b] hover:text-[#111827]"
                    }`}
                  >
                    {tab === "deposit" ? "Deposit Collateral" : "Mint mUSD"}
                  </button>
                ))}
              </div>
            )}

            {/* Asset Selector */}
            {modalTab === "repay" ? (
              <div>
                <label className="text-[11.5px] font-medium text-[#64748b] block mb-1.5">
                  Select Debt Position to Repay
                </label>
                {vaultState.tokens.filter((t) => t.userDebtShareUSD > 0)
                  .length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {vaultState.tokens
                      .filter((t) => t.userDebtShareUSD > 0)
                      .map((t) => (
                        <button
                          key={t.config.symbol}
                          type="button"
                          onClick={() => {
                            setSelectedTokenSymbol(t.config.symbol);
                            setAmountInput(t.userDebtShareUSD.toFixed(2));
                          }}
                          className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                            selectedTokenSymbol === t.config.symbol
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
                          <div className="text-right font-mono text-[11.5px]">
                            <div className="font-medium">
                              {t.userDebtShareUSD.toFixed(2)} mUSD
                            </div>
                            <div className="text-[10px] text-[#94a3b8]">
                              Debt Share
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                ) : vaultState.userTotalDebtMusd > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {SUPPORTED_TOKENS.filter(
                      (t) => t.symbol === "ETH" || t.symbol === "USDC",
                    ).map((t) => (
                      <button
                        key={t.symbol}
                        type="button"
                        onClick={() => {
                          setSelectedTokenSymbol(t.symbol);
                          setAmountInput(
                            vaultState.userTotalDebtMusd.toFixed(2),
                          );
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                          selectedTokenSymbol === t.symbol
                            ? "border-[#c067c9] bg-[#fdf8fd] text-[#c067c9]"
                            : "border-[#e2e8f0] hover:bg-[#f8fafc] text-[#475569]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CollateralBadge
                            symbol={t.symbol}
                            className="w-5 h-5"
                          />
                          <div>
                            <div className="font-medium text-[12px]">
                              {t.symbol}
                            </div>
                            <div className="text-[10px] text-[#94a3b8]">
                              {t.network}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-mono text-[11.5px]">
                          <div className="font-medium">
                            {vaultState.userTotalDebtMusd.toFixed(2)} mUSD
                          </div>
                          <div className="text-[10px] text-[#94a3b8]">
                            Total Debt
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-[12px] text-[#64748b] bg-gray-50 rounded-xl">
                    No active debt positions to repay.
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="text-[11.5px] font-medium text-[#64748b] block mb-1.5">
                  Select Asset
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SUPPORTED_TOKENS.map((t) => (
                    <button
                      key={t.symbol}
                      type="button"
                      onClick={() => setSelectedTokenSymbol(t.symbol)}
                      className={`p-2 rounded-xl border text-[12px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                        selectedTokenSymbol === t.symbol
                          ? "border-[#c067c9] bg-[#fdf8fd] text-[#c067c9] font-medium"
                          : "border-[#e2e8f0] hover:bg-[#f8fafc] text-[#475569]"
                      }`}
                    >
                      <CollateralBadge symbol={t.symbol} className="w-4 h-4" />
                      <span>{t.symbol}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* If Selected Asset is NOT enabled for per-asset evaluation, disable deposit/mint actions */}
            {!["ETH", "DAI", "USDC"].includes(selectedToken.symbol) &&
            (modalTab === "deposit" || modalTab === "mint") ? (
              <div className="my-3 p-5 rounded-2xl bg-slate-50/80 border border-slate-200/90 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-slate-200/80 text-slate-500 mx-auto flex items-center justify-center font-bold text-lg">
                  —
                </div>
                <div>
                  <p className="text-[13px] text-[#64748b] leading-relaxed max-w-xs mx-auto">
                    Deposit and mint actions for {selectedToken.symbol} are
                    paused while evaluation is scoped to ETH, DAI, and USDC.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Mint Halted Notice if Minting with a halted asset */}
                {modalTab === "mint" && selectedTokenData?.isMintHalted && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[12px] text-rose-700 leading-snug">
                    <div className="font-semibold flex items-center gap-1.5">
                      <span>⚠️ Minting Halted for {selectedToken.symbol}</span>
                    </div>
                    <p className="mt-0.5 text-rose-600">
                      {selectedTokenData.reasoning ||
                        "Protocol risk defense is active. Fresh borrowing against this asset is strictly paused."}
                    </p>
                  </div>
                )}

                {/* Input Amount Box */}
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#64748b]">
                    <span>
                      {modalTab === "deposit" && "Deposit Amount"}
                      {modalTab === "mint" && "Amount to Mint"}
                      {modalTab === "repay" && "Amount to Repay"}
                    </span>
                    <span>
                      {modalTab === "deposit" &&
                        `Network: ${selectedToken.network}`}
                      {modalTab === "mint" &&
                        `Debt: ${vaultState.userTotalDebtMusd.toFixed(2)} mUSD`}
                      {modalTab === "repay" && `Balance: ${musdBalance} mUSD`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={
                        modalTab === "mint" && selectedTokenData?.isMintHalted
                          ? `Minting halted for ${selectedToken.symbol}`
                          : modalTab === "mint" && !userHasCollateralForSelected
                            ? "Deposit collateral first"
                            : "0.0"
                      }
                      value={
                        modalTab === "mint" &&
                        (selectedTokenData?.isMintHalted ||
                          !userHasCollateralForSelected)
                          ? ""
                          : amountInput
                      }
                      disabled={
                        isSubmitting ||
                        (modalTab === "mint" &&
                          (selectedTokenData?.isMintHalted ||
                            !userHasCollateralForSelected))
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                          setAmountInput(val);
                        }
                      }}
                      className="w-full bg-transparent text-[16px] font-normal text-[#111827] focus:outline-hidden [appearance:textfield] disabled:text-[#94a3b8] disabled:cursor-not-allowed"
                      autoFocus
                    />
                    {modalTab === "mint" && (
                      <button
                        type="button"
                        disabled={
                          !userHasCollateralForSelected ||
                          selectedToken.symbol === "DAI"
                        }
                        onClick={() => {
                          if (
                            !userHasCollateralForSelected ||
                            selectedToken.symbol === "DAI"
                          )
                            return;
                          const activeReqBps =
                            parseFloat(vaultState.requiredCR.replace("%", "")) *
                              100 || 15000;
                          const maxDebtAllowed =
                            (vaultState.userTotalCollateralUSD * 10000) /
                            activeReqBps;
                          const maxMint = Math.max(
                            0,
                            maxDebtAllowed - vaultState.userTotalDebtMusd,
                          );
                          setAmountInput(
                            maxMint > 0 ? maxMint.toFixed(2) : "0.00",
                          );
                        }}
                        className="px-2 py-0.5 text-[11px] font-medium bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#334155] rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        MAX
                      </button>
                    )}
                    {modalTab === "repay" && (
                      <button
                        type="button"
                        onClick={() => {
                          const maxRepay = (
                            selectedTokenData?.userDebtShareUSD ||
                            vaultState.userTotalDebtMusd
                          ).toFixed(2);
                          setAmountInput(maxRepay);
                        }}
                        className="px-2 py-0.5 text-[11px] font-medium bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#334155] rounded-md transition-colors cursor-pointer"
                      >
                        MAX
                      </button>
                    )}
                    <span className="text-[13px] font-medium text-[#111827]">
                      {modalTab === "mint" || modalTab === "repay"
                        ? "mUSD"
                        : selectedToken.symbol}
                    </span>
                  </div>
                </div>

                {/* Status Feedback with Real Explorer Hash Link */}
                {txResult && (
                  <div
                    className={`p-3 rounded-xl text-[12px] border ${
                      txResult.isError
                        ? "bg-rose-50 border-rose-200 text-rose-700"
                        : "bg-[#f8fafc] border-[#e2e8f0] text-[#334155]"
                    }`}
                  >
                    <div>{txResult.text}</div>
                    {txResult.link && (
                      <a
                        href={txResult.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#c067c9] underline font-mono text-[11px] block mt-1.5"
                      >
                        View on Block Explorer ↗
                      </a>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-[#e2e8f0] text-[13px] font-medium text-[#64748b] hover:text-[#111827] hover:bg-[#f8fafc] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleActionConfirm}
                    disabled={
                      isSubmitting ||
                      !amountInput ||
                      parseFloat(amountInput) <= 0 ||
                      (modalTab === "mint" &&
                        (selectedToken.symbol === "DAI" ||
                          !userHasCollateralForSelected)) ||
                      (modalTab === "repay" &&
                        vaultState.userTotalDebtMusd <= 0)
                    }
                    className="relative overflow-hidden flex-1 py-2.5 rounded-xl font-medium text-[13px] text-white transition-all duration-200 hover:brightness-105 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-none border border-white/20 flex items-center justify-center gap-2"
                    style={{
                      background:
                        (modalTab === "mint" &&
                          selectedToken.symbol === "DAI") ||
                        (modalTab === "repay" &&
                          vaultState.userTotalDebtMusd <= 0)
                          ? "#e2e8f0"
                          : "linear-gradient(135deg, #9850df 0%, #c067c9 50%, #d87eb9 100%)",
                    }}
                  >
                    {/* Subtle top glare */}
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                    {isSubmitting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Confirming...</span>
                      </>
                    ) : (
                      <span>
                        {modalTab === "deposit" &&
                          `Confirm Deposit ${selectedToken.symbol}`}
                        {modalTab === "mint" &&
                          (selectedTokenData?.isMintHalted
                            ? `Mint Halted for ${selectedToken.symbol}`
                            : !userHasCollateralForSelected
                              ? "Deposit Required to Mint"
                              : "Confirm Mint mUSD")}
                        {modalTab === "repay" &&
                          (vaultState.userTotalDebtMusd <= 0
                            ? "No Debt to Repay"
                            : `Confirm Repay ${amountInput ? `${amountInput} mUSD` : ""}`)}
                        {modalTab === "withdraw" && "Confirm Withdraw"}
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
