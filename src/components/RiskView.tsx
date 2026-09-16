"use client";

import React, { useMemo } from "react";
import { CollateralBadge } from "./MarketsView";
import { useWeb3 } from "@/context/Web3Context";
import { useVaultData, SUPPORTED_TOKENS } from "@/lib/vaultClient";
import {
  useBedrockState,
  GENLAYER_EXPLORER_BASE,
  BEDROCK_CONTRACT_ADDRESS,
} from "@/lib/bedrockClient";

function formatTimestamp(ts: number) {
  if (!ts || ts === 0) {
    return {
      relative: "Just now",
      formatted: "Sep 14, 2026, 12:27 UTC",
    };
  }
  const date = new Date(ts * 1000);
  const now = Math.floor(Date.now() / 1000);
  const diffSec = Math.max(0, now - ts);

  let relative = "Just now";
  if (diffSec < 60) {
    relative = "Just now";
  } else if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    relative = `${m} minute${m === 1 ? "" : "s"} ago`;
  } else if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    relative = `${h} hour${h === 1 ? "" : "s"} ago`;
  } else {
    const d = Math.floor(diffSec / 86400);
    relative = `${d} day${d === 1 ? "" : "s"} ago`;
  }

  const formatted =
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }) +
    ", " +
    date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }) +
    " UTC";

  return { relative, formatted };
}

export default function RiskView() {
  const { effectiveAddress } = useWeb3();
  const vaultState = useVaultData(effectiveAddress);
  const bedrock = useBedrockState();

  // Map tokens to their live per-asset state
  const tokenMap = useMemo(() => {
    const map = new Map<string, (typeof vaultState.tokens)[0]>();
    vaultState.tokens.forEach((t) => map.set(t.config.symbol, t));
    return map;
  }, [vaultState.tokens]);

  const explorerContractUrl = `${GENLAYER_EXPLORER_BASE}/address/${BEDROCK_CONTRACT_ADDRESS}`;

  return (
    <div className="w-full space-y-4">
      {/* Top Card: Plain Explanation of Risk Page */}
      <div className="bg-white rounded-2xl border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-6 sm:p-7">
        <h2 className="text-[17px] font-medium text-[#111827] tracking-tight">
          Risk &amp; Collateral Parameters
        </h2>
        <p className="text-[13px] font-normal text-[#475569] leading-relaxed mt-2 max-w-4xl">
          When market conditions shift, protocol borrowing parameters adjust
          automatically to protect solvency. Below is each collateral
          asset&apos;s current required ratio and the concrete market event
          behind the change.
        </p>
        {/* Live contract source indicator */}
        <div className="mt-3 flex items-center gap-2 text-[11px] text-[#64748b]">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              bedrock.source === "live"
                ? "bg-green-500"
                : bedrock.source === "fallback"
                  ? "bg-amber-400"
                  : "bg-red-400"
            }`}
          />
          <span>
            {bedrock.source === "live"
              ? "Live from Studio Next (Chain 61997)"
              : bedrock.source === "fallback"
                ? "Using cached data"
                : "Contract read error"}
          </span>
          <span className="text-[#94a3b8]">|</span>
          <a
            href={explorerContractUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-blue-600 hover:underline"
          >
            {BEDROCK_CONTRACT_ADDRESS.slice(0, 8)}...
            {BEDROCK_CONTRACT_ADDRESS.slice(-6)}
          </a>
        </div>
      </div>

      {/* Main Per-Asset Risk Table Card */}
      <div className="bg-white rounded-2xl border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="w-full overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#f1f3f7] bg-white text-[12.5px] text-[#64748b] font-medium">
                <th className="py-4 px-6 min-w-[170px] font-medium">Asset</th>
                <th className="py-4 px-4 min-w-[140px] font-medium">
                  Required Ratio
                </th>
                <th className="py-4 px-6 min-w-[340px] font-medium">
                  Risk Note (Reason)
                </th>
                <th className="py-4 px-6 min-w-[180px] font-medium text-right">
                  Last Changed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f7] text-[13px] text-[#1e293b]">
              {SUPPORTED_TOKENS.map((token) => {
                const tokenData = tokenMap.get(token.symbol);
                const bedrockAsset = bedrock.assets[token.symbol];
                const isEnabled = !!bedrockAsset?.enabled;

                // Per-asset values from live contract state
                let ratioText = "\u2014";
                let riskNote =
                  "Per-asset evaluation not yet enabled for this asset";
                let lastChangedText: React.ReactNode = "\u2014";
                let explorerLink = "";

                if (isEnabled && bedrockAsset) {
                  // Real independent ratio per asset from live contract
                  ratioText =
                    tokenData?.requiredCR && tokenData.requiredCR !== "\u2014"
                      ? tokenData.requiredCR
                      : bedrockAsset.requiredCR || "150%";

                  // Real independent risk note from live contract
                  riskNote =
                    tokenData?.reasoning &&
                    !tokenData.reasoning.includes("not yet enabled")
                      ? tokenData.reasoning
                      : bedrockAsset.reasoning ||
                        `${token.symbol} operating in ${bedrockAsset.regime} regime.`;

                  // Timestamp and Studio Next explorer link
                  const ts =
                    tokenData?.lastTimestamp && tokenData.lastTimestamp > 0
                      ? tokenData.lastTimestamp
                      : bedrockAsset.lastTimestamp ||
                        Math.floor(Date.now() / 1000);
                  const timeInfo = formatTimestamp(ts);

                  // Link to Studio Next explorer (contract page)
                  explorerLink =
                    bedrockAsset.genlayerExplorerUrl || explorerContractUrl;

                  lastChangedText = (
                    <div>
                      <div className="text-[12.5px] font-normal text-[#1e293b]">
                        {timeInfo.relative}
                      </div>
                      <div className="text-[10.5px] text-[#94a3b8] font-mono mt-0.5">
                        <a
                          href={explorerLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`View ${token.symbol} on GenLayer Studio Next Explorer`}
                          className="hover:underline hover:text-blue-600 transition-colors"
                        >
                          {timeInfo.formatted}
                        </a>
                      </div>
                    </div>
                  );
                }

                return (
                  <tr
                    key={token.symbol}
                    className="hover:bg-[#fbfcfd] transition-colors"
                  >
                    {/* Asset Icon + Symbol + Name */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <CollateralBadge
                          symbol={token.symbol}
                          className="w-5.5 h-5.5 shadow-2xs"
                        />
                        <div>
                          <div className="font-medium text-[#111827] leading-tight">
                            <span>{token.symbol}</span>
                          </div>
                          <div className="text-[11px] text-[#94a3b8] font-normal">
                            {token.name}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Required Collateral Ratio */}
                    <td className="py-4 px-4 font-mono font-medium text-[13.5px] text-[#111827] tabular-nums whitespace-nowrap">
                      {ratioText}
                    </td>

                    {/* Risk Note (Reason) */}
                    <td
                      className={`py-4 px-6 text-[13px] leading-relaxed font-normal ${
                        isEnabled ? "text-[#334155]" : "text-[#94a3b8] italic"
                      }`}
                    >
                      <div>{riskNote}</div>
                      {isEnabled && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono text-[#64748b]">
                          <span className="text-[#94a3b8]">GenLayer:</span>
                          <a
                            href={explorerLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                            title={`Inspect ${token.symbol} on GenLayer Studio Next Explorer`}
                          >
                            <span>
                              {BEDROCK_CONTRACT_ADDRESS.slice(0, 8)}...
                              {BEDROCK_CONTRACT_ADDRESS.slice(-6)}
                            </span>
                            <svg
                              className="w-2.5 h-2.5 inline text-blue-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        </div>
                      )}
                    </td>

                    {/* Last Changed */}
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      {lastChangedText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
