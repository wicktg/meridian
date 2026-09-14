"use client";

import React, { useState } from "react";
import { useWeb3 } from "@/context/Web3Context";
import {
  useVaultData,
  executeDeposit,
  SUPPORTED_TOKENS,
} from "@/lib/vaultClient";

export default function LiquidationView() {
  const { effectiveAddress, account, getWalletProvider } = useWeb3();
  const vaultState = useVaultData(effectiveAddress);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addAmount, setAddAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [txNotice, setTxNotice] = useState<{
    text: string;
    link?: string;
    isError?: boolean;
  } | null>(null);

  const copyToClipboard = (id: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  // Real calculations based on on-chain data
  const crNum =
    parseFloat(vaultState.userCurrentCR.replace("%", "")) ||
    (vaultState.userCurrentCR === "∞" ? 99999 : 0);
  const reqNum = parseFloat(vaultState.requiredCR.replace("%", "")) || 150;

  const isLiquidatable =
    vaultState.userTotalDebtMusd > 0 && crNum > 0 && crNum < reqNum;
  const isAtRisk =
    vaultState.userTotalDebtMusd > 0 &&
    crNum >= reqNum &&
    crNum < reqNum * 1.15;
  const stateLabel: "Healthy" | "At Risk" | "Liquidatable" = isLiquidatable
    ? "Liquidatable"
    : isAtRisk
      ? "At Risk"
      : "Healthy";

  const handleDepositCollateral = async () => {
    if (!addAmount || parseFloat(addAmount) <= 0) return;
    setIsProcessing(true);
    setTxNotice(null);

    try {
      const selectedToken = SUPPORTED_TOKENS[0]; // ETH collateral
      const walletProvider = await getWalletProvider();
      const res = await executeDeposit({
        tokenAddress: selectedToken.address,
        amount: addAmount,
        decimals: selectedToken.decimals,
        isBridged: selectedToken.isBridged,
        walletProvider,
        account: effectiveAddress || account,
      });

      if (res.success) {
        setTxNotice({
          text: `Successfully deposited ${addAmount} ${selectedToken.symbol} collateral.`,
          link: res.link,
        });
        await vaultState.refresh();
        setTimeout(() => {
          setShowAddModal(false);
          setAddAmount("");
          setTxNotice(null);
        }, 1800);
      } else {
        setTxNotice({
          text: res.error || "Deposit failed.",
          isError: true,
        });
      }
    } catch (e: unknown) {
      const errStr = e instanceof Error ? e.message : String(e);
      setTxNotice({ text: errStr, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full flex flex-col lg:flex-row gap-5 items-start">
      {/* =========================================================
          LEFT MAIN COLUMN: Bot Functionality Card + Real Vaults Table Card
         ========================================================= */}
      <div className="flex-1 min-w-0 space-y-4 w-full">
        {/* --- Top Card: Bot Functionality --- */}
        <div className="bg-white rounded-2xl border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-6 sm:p-7">
          <h2 className="text-[17px] font-medium text-[#111827] tracking-tight">
            Bot Functionality
          </h2>
          <p className="text-[13px] font-medium text-[#475569] leading-relaxed mt-6">
            Liquidation is expected to be carried out by bots.Early on you may be able to manually liquidate Vaults,but as the system matures this will become less likely.
          </p>
        </div>

        {/* --- Bottom Card: Real Vaults Table --- */}
        <div className="bg-white rounded-2xl border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="w-full overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#f1f3f7] bg-white text-[13px] text-[#111827] font-normal">
                  <th className="py-4 px-6 min-w-[170px] font-normal">
                    Owner
                  </th>
                  <th className="py-4 px-4 min-w-[150px] font-normal">
                    Collateral Value
                  </th>
                  <th className="py-4 px-4 min-w-[140px] font-normal">
                    Collateral Ratio
                  </th>
                  <th className="py-4 px-6 min-w-[110px] font-normal text-left">
                    State
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f7] text-[13px] text-[#111827]">
                <tr className="hover:bg-[#fbfcfd] transition-colors">
                  {/* Owner + You label in grey + copy icon */}
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-normal text-[#111827]">
                        {effectiveAddress.slice(0, 6)}......{effectiveAddress.slice(-4)}
                      </span>
                      <span className="text-[11px] font-normal text-[#64748b] bg-[#f1f5f9] px-1.5 py-0.5 rounded">
                        You
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard("user-vault", effectiveAddress)
                        }
                        className="text-[#94a3b8] hover:text-[#111827] transition-colors p-0.5 rounded cursor-pointer ml-0.5"
                        title="Copy address"
                      >
                        {copiedId === "user-vault" ? (
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

                  {/* Collateral Value (Real on-chain total) */}
                  <td className="py-4 px-4 tabular-nums font-normal text-[#111827] whitespace-nowrap">
                    ${vaultState.userTotalCollateralUSD.toFixed(2)}
                  </td>

                  {/* Collateral Ratio (Real on-chain CR) */}
                  <td className="py-4 px-4 tabular-nums font-normal text-[#64748b] whitespace-nowrap">
                    {vaultState.userCurrentCR}
                  </td>

                  {/* State (Grey Text) */}
                  <td className="py-4 px-6 font-normal text-[#64748b] whitespace-nowrap">
                    {stateLabel}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =========================================================
          RIGHT COLUMN: "Your Vault Health" Card (Real Data)
         ========================================================= */}
      <div className="w-full lg:w-[320px] xl:w-[340px] shrink-0">
        <div className="bg-white rounded-2xl border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-6 space-y-4">
          {/* Card Header */}
          <div>
            <h2 className="text-[16px] font-semibold text-[#111827] tracking-tight">
              Your Vault Health
            </h2>
          </div>

          {/* Real Metrics Display */}
          <div className="space-y-3 pt-1">
            <div className="bg-[#fbfcfd] border border-[#f1f3f7] rounded-xl p-3.5 space-y-2.5 text-[12.5px]">
              <div className="flex items-center justify-between text-[#64748b]">
                <span>Collateral Ratio</span>
                <span className="font-mono font-medium text-[#111827] tabular-nums text-[13px]">
                  {vaultState.userCurrentCR}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#64748b]">
                <span>Liquidation Threshold</span>
                <span className="font-mono font-medium text-[#111827] tabular-nums text-[13px]">
                  {vaultState.requiredCR}
                </span>
              </div>
              {vaultState.userTotalDebtMusd > 0 && (
                <div className="flex items-center justify-between text-[#64748b] pt-1 border-t border-[#f1f3f7]">
                  <span>Total Debt</span>
                  <span className="font-mono font-medium text-[#111827] tabular-nums text-[12px]">
                    {vaultState.userTotalDebtMusd.toFixed(2)} mUSD
                  </span>
                </div>
              )}
            </div>

            {/* Status text below metrics */}
            <div className="text-[12.5px] font-normal text-[#64748b] text-center pt-1">
              {isLiquidatable
                ? "Vault is below threshold and liquidatable. Add collateral immediately."
                : isAtRisk
                  ? "Approaching liquidation threshold, add collateral to protect your position."
                  : "No risk, your vault is healthy."}
            </div>

            {/* Action Button: Add Collateral */}
            <button
              type="button"
              onClick={() => {
                setShowAddModal(true);
                setTxNotice(null);
              }}
              className="relative overflow-hidden w-full py-2.5 rounded-xl font-medium text-[13.5px] text-white transition-all duration-200 hover:brightness-105 active:scale-[0.99] cursor-pointer shadow-none border border-white/25"
              style={{
                background:
                  "linear-gradient(135deg, #9850df 0%, #c067c9 50%, #d87eb9 100%)",
              }}
            >
              {/* Subtle top glare */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              Add Collateral
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================
          ADD COLLATERAL MODAL
         ========================================================= */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-[#eaedf3] shadow-none w-full max-w-md p-6 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#f1f3f7]">
              <div>
                <h3 className="text-[15.5px] font-semibold text-[#111827] leading-tight">
                  Add Collateral
                </h3>
                <p className="text-[12px] text-[#64748b] mt-0.5">
                  Increase your collateral ratio to safeguard your position.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Input Field */}
            <div className="mt-4">
              <label className="text-[11.5px] font-medium text-[#64748b] block mb-1.5">
                Collateral Amount (ETH)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="0.00"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e2e8f0] focus:border-[#c067c9] focus:ring-1 focus:ring-[#c067c9] outline-none text-[14px] text-[#111827] placeholder:text-[#cbd5e1] tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => setAddAmount("0.005")}
                  className="absolute right-2.5 top-2.5 px-2 py-1 rounded-md text-[11px] font-medium bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] transition-colors cursor-pointer"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Feedback notice if submitted */}
            {txNotice && (
              <div
                className={`mt-3 p-2.5 rounded-xl text-[12px] border ${
                  txNotice.isError
                    ? "bg-rose-50 border-rose-200 text-rose-800"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}
              >
                <div>{txNotice.text}</div>
                {txNotice.link && (
                  <a
                    href={txNotice.link}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-[11px] font-mono block mt-1"
                  >
                    View on BaseScan ↗
                  </a>
                )}
              </div>
            )}

            {/* Action CTA */}
            <button
              type="button"
              onClick={handleDepositCollateral}
              disabled={isProcessing || !addAmount || parseFloat(addAmount) <= 0}
              className="relative overflow-hidden w-full mt-5 h-11 rounded-xl font-medium text-[13px] text-white transition-all duration-200 hover:brightness-105 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-none border border-white/20 flex items-center justify-center gap-2"
              style={{
                background:
                  "linear-gradient(135deg, #9850df 0%, #c067c9 50%, #d87eb9 100%)",
              }}
            >
              {/* Subtle top glare */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              {isProcessing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Transaction...</span>
                </>
              ) : (
                <span>Confirm</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
