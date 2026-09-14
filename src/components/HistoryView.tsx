"use client";

import React from "react";
import { useWeb3 } from "@/context/Web3Context";
import { useVaultData } from "@/lib/vaultClient";

interface HistoryEvent {
  id: string;
  date: string;
  timeRelative: string;
  action: string;
  category: "mint" | "repay" | "deposit" | "withdraw" | "protocol";
  detail: string;
  txHashFull?: string;
}

const HISTORY_EVENTS: HistoryEvent[] = [
  {
    id: "h-1",
    date: "Sep 11, 2026, 15:42 UTC",
    timeRelative: "18 mins ago",
    action: "Deposit Collateral",
    category: "deposit",
    detail: "Deposited 12.00 ETH into Meridian Vault (Vault #104)",
  },
  {
    id: "h-2",
    date: "Sep 11, 2026, 14:15 UTC",
    timeRelative: "2 hours ago",
    action: "Mint mUSDC",
    category: "mint",
    detail:
      "Minted 18,500.00 mUSDC against 12.00 ETH collateral at 135% required ratio",
  },
  {
    id: "h-3",
    date: "Sep 11, 2026, 12:10 UTC",
    timeRelative: "4 hours ago",
    action: "Protocol Risk Adjustment",
    category: "protocol",
    detail:
      "ETH required collateral ratio increased from 130% to 135% due to reduced DEX market liquidity",
  },
  {
    id: "h-4",
    date: "Sep 10, 2026, 18:45 UTC",
    timeRelative: "Yesterday",
    action: "Protocol Risk Adjustment",
    category: "protocol",
    detail:
      "wstETH required collateral ratio adjusted from 127% to 130% following Lido validator queue volatility",
  },
  {
    id: "h-5",
    date: "Sep 10, 2026, 09:20 UTC",
    timeRelative: "Yesterday",
    action: "Repay Loan",
    category: "repay",
    detail: "Repaid 7,500.00 mUSDC principal balance on Vault #089",
  },
  {
    id: "h-6",
    date: "Sep 09, 2026, 14:15 UTC",
    timeRelative: "2 days ago",
    action: "Protocol Risk Adjustment",
    category: "protocol",
    detail:
      "LINK collateral requirement reduced from 148% to 145% after sustained 30-day liquidity deepening",
  },
  {
    id: "h-7",
    date: "Sep 08, 2026, 16:30 UTC",
    timeRelative: "3 days ago",
    action: "Deposit Collateral",
    category: "deposit",
    detail: "Deposited 2.50 WBTC into Meridian Vault (Vault #092)",
  },
  {
    id: "h-8",
    date: "Sep 08, 2026, 11:05 UTC",
    timeRelative: "3 days ago",
    action: "Mint mUSDC",
    category: "mint",
    detail: "Minted 45,000.00 mUSDC against 2.50 WBTC collateral",
  },
  {
    id: "h-9",
    date: "Sep 06, 2026, 10:00 UTC",
    timeRelative: "5 days ago",
    action: "Oracle Heartbeat",
    category: "protocol",
    detail:
      "Decentralized oracle feed verified across 32 GenLayer consensus validator nodes",
  },
  {
    id: "h-10",
    date: "Sep 04, 2026, 13:14 UTC",
    timeRelative: "7 days ago",
    action: "Repay Loan",
    category: "repay",
    detail: "Repaid 12,000.00 mUSDC loan balance on Vault #076",
  },
  {
    id: "h-11",
    date: "Sep 02, 2026, 08:30 UTC",
    timeRelative: "9 days ago",
    action: "Withdraw Collateral",
    category: "withdraw",
    detail: "Withdrew 5.00 ETH surplus collateral to connected wallet",
  },
];

export default function HistoryView() {
  const { effectiveAddress } = useWeb3();
  const vaultState = useVaultData(effectiveAddress);

  const realLogs = vaultState.activityLogs || [];

  const historyItems: HistoryEvent[] =
    realLogs.length > 0
      ? realLogs.map((log) => {
          let category: HistoryEvent["category"] = "deposit";
          let action = "Deposit Collateral";
          let detail = `Deposited ${log.amount} into Meridian Vault (Resulting CR: ${log.ratio})`;

          if (log.type === "Mint") {
            category = "mint";
            action = "Mint mUSD";
            detail = `Minted ${log.amount} against ${log.asset} (Resulting CR: ${log.ratio})`;
          } else if (log.type === "Repay") {
            category = "repay";
            action = "Repay Loan";
            detail = `Repaid ${log.amount} on active vault debt (Resulting CR: ${log.ratio})`;
          } else if (log.type === "Withdraw") {
            category = "withdraw";
            action = "Withdraw Collateral";
            detail = `Withdrew ${log.amount} from collateral deposit (Resulting CR: ${log.ratio})`;
          } else if (log.type === "Liquidate") {
            category = "withdraw";
            action = "Liquidation Event";
            detail = `Liquidated ${log.amount} undercollateralized debt position`;
          } else if (log.type === "Regime Change") {
            category = "protocol";
            action = "Protocol Risk Adjustment";
            detail = `Risk regime updated: ${log.amount} (Required CR: ${log.ratio})`;
          }

          return {
            id: log.id,
            date: log.time,
            timeRelative: log.chain,
            action,
            category,
            detail,
            txHashFull: log.txHashFull,
          };
        })
      : HISTORY_EVENTS;

  return (
    <div className="w-full space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-6 sm:p-7">
        <h2 className="text-[17px] font-medium text-[#111827] tracking-tight">
          Activity & Audit Log
        </h2>
        <p className="text-[13px] font-normal text-[#475569] leading-relaxed mt-2 max-w-4xl">
          Single unified reverse-chronological record of your mints, repays, and
          deposits interleaved with protocol-wide risk and parameter
          adjustments.
        </p>
      </div>

      {/* Main Single Reverse-Chronological Table Card */}
      <div className="bg-white rounded-2xl border border-[#eaedf3] shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="w-full overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#f1f3f7] bg-white text-[12.5px] text-[#64748b] font-medium">
                <th className="py-4 px-6 min-w-[200px] font-medium">
                  Date & Time
                </th>
                <th className="py-4 px-4 min-w-[190px] font-medium">Action</th>
                <th className="py-4 px-6 min-w-[420px] font-medium">
                  One-Line Detail
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f7] text-[13px] text-[#1e293b]">
              {historyItems.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-[#fbfcfd] transition-colors"
                >
                  {/* Date & Time */}
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="font-normal text-[#111827] text-[13px]">
                      {item.date}
                    </div>
                    <div className="text-[11px] text-[#94a3b8] font-normal mt-0.5">
                      {item.timeRelative}
                    </div>
                  </td>

                  {/* Action Badge */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    {item.category === "protocol" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-[#faf5ff] text-[#9850df] border border-[#f3e8ff]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#9850df]" />
                        {item.action}
                      </span>
                    ) : item.category === "mint" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-[#f0fdf4] text-[#16a34a] border border-[#dcfce7]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                        {item.action}
                      </span>
                    ) : item.category === "repay" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />
                        {item.action}
                      </span>
                    ) : item.category === "deposit" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-[#f8fafc] text-[#475569] border border-[#e2e8f0]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#475569]" />
                        {item.action}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-[#fff7ed] text-[#ea580c] border border-[#ffedd5]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ea580c]" />
                        {item.action}
                      </span>
                    )}
                  </td>

                  {/* One-Line Detail */}
                  <td className="py-4 px-6 text-[13px] text-[#334155] leading-relaxed font-normal">
                    <div className="flex items-center justify-between gap-4">
                      <span>{item.detail}</span>
                      {item.txHashFull && (
                        <a
                          href={`https://sepolia.basescan.org/tx/${item.txHashFull}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 font-mono text-[11.5px] text-[#9850df] hover:underline"
                        >
                          View ↗
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
