"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface DocArticle {
  id: string;
  category: string;
  title: string;
}

const ARTICLES: DocArticle[] = [
  { id: "overview", category: "GETTING STARTED", title: "What Meridian Is" },
  {
    id: "architecture",
    category: "GETTING STARTED",
    title: "System Architecture",
  },
  {
    id: "assets",
    category: "PROTOCOL MECHANICS",
    title: "The Six Collateral Assets",
  },
  {
    id: "regime-system",
    category: "PROTOCOL MECHANICS",
    title: "Risk Regime Engine",
  },
  {
    id: "stability-fees",
    category: "PROTOCOL MECHANICS",
    title: "Dynamic Stability Fees",
  },
  {
    id: "liquidation",
    category: "PROTOCOL MECHANICS",
    title: "Liquidation Engine",
  },
  {
    id: "cross-chain",
    category: "INFRASTRUCTURE",
    title: "Cross-Chain Architecture",
  },
  {
    id: "proof-of-execution",
    category: "VERIFICATION",
    title: "Verified Proof of Execution",
  },
  {
    id: "contract-directory",
    category: "VERIFICATION",
    title: "Contract Addresses",
  },
];

export default function DocsPage() {
  const [activeId, setActiveId] = useState<string>("overview");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync with URL hash if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "");
      if (hash && ARTICLES.some((a) => a.id === hash)) {
        setActiveId(hash);
      }
    }
  }, []);

  const handleSelectArticle = (id: string) => {
    setActiveId(id);
    if (typeof window !== "undefined") {
      window.location.hash = id;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const copyToClipboard = (key: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const currentArticle = ARTICLES.find((a) => a.id === activeId) || ARTICLES[0];
  const currentIndex = ARTICLES.findIndex((a) => a.id === activeId);
  const prevArticle = currentIndex > 0 ? ARTICLES[currentIndex - 1] : null;
  const nextArticle =
    currentIndex < ARTICLES.length - 1 ? ARTICLES[currentIndex + 1] : null;

  const categories = Array.from(new Set(ARTICLES.map((a) => a.category)));

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased">
      {/* Top Header: Pure Minimalist White without App elements */}
      <header className="sticky top-0 z-30 h-20 w-full bg-white border-b border-gray-100 px-6 sm:px-10 flex items-center justify-between">
        <div />

        <div className="flex items-center gap-5 text-[13px] text-gray-500">
          <a
            href="https://sepolia.basescan.org/address/0xa969668F2dba4995a4F9078e335D09a0CA7F0Ea7"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900 transition-colors hidden sm:inline"
          >
            BaseScan ↗
          </a>
          <a
            href="https://explorer-studio-dev.genlayer.com/address/0x4423BC844C77437Ca5BE285f712E5c6369f2E351"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900 transition-colors hidden sm:inline"
          >
            GenLayer Studio Next ↗
          </a>
        </div>
      </header>

      {/* Main Symmetrical Layout Container */}
      <div className="w-full flex min-h-[calc(100vh-5rem)]">
        {/* Left Sidebar (Minimalist replica of reference screenshot) */}
        <aside className="w-64 sm:w-72 shrink-0 border-r border-gray-100 p-6 bg-white overflow-y-auto sticky top-20 h-[calc(100vh-5rem)]">
          <nav className="space-y-6 select-none">
            {categories.map((cat) => (
              <div key={cat}>
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5 px-3">
                  {cat}
                </div>
                <div className="space-y-0.5">
                  {ARTICLES.filter((a) => a.category === cat).map((item) => {
                    const isActive = activeId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectArticle(item.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[13.5px] transition-all cursor-pointer block ${
                          isActive
                            ? "bg-gray-100/70 text-gray-950 font-medium"
                            : "text-gray-600 hover:text-gray-950 hover:bg-gray-50/80 font-normal"
                        }`}
                      >
                        {item.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Reading Column: Symmetrically Centered in the Content Viewport */}
        <main className="flex-1 min-w-0 flex justify-center py-12 px-6 sm:px-12 lg:px-16 overflow-y-auto">
          <div className="w-full max-w-[760px]">
            {/* Category Eyebrow */}
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 select-none">
              {currentArticle.category}
            </div>

            {/* Document Title */}
            <h1 className="text-3xl sm:text-[34px] font-bold text-gray-950 tracking-tight mb-6">
              {currentArticle.title}
            </h1>

            {/* Article 1: What Meridian Is */}
            {activeId === "overview" && (
              <div className="space-y-5 text-[15px] leading-relaxed text-gray-600">
                <p>
                  Meridian is a decentralized collateralized debt position
                  protocol built around one requirement: every risk metric that
                  governs borrowing power and protocol stability must be
                  verifiable directly on-chain without relying on subjective
                  committee votes or delayed multisig transactions.
                </p>
                <p>
                  Users deposit verified collateral assets into the Meridian
                  Vault to mint mUSD, an ERC-20 stablecoin designed to maintain
                  parity with 1.00 USD. Rather than enforcing fixed, static risk
                  boundaries across all market conditions, Meridian pairs EVM
                  debt accounting with GenLayer autonomous intelligent contracts
                  to continuously evaluate market volatility, oracle health, and
                  peg integrity.
                </p>
                <p>
                  When market turbulence or depeg events emerge, the protocol
                  transitions through discrete risk regimes. These regimes
                  dynamically raise minimum collateralization ratios, scale
                  stability fee rates, and if necessary, immediately pause new
                  minting while keeping loan repayment and liquidation fully
                  operational.
                </p>

                {/* Minimalist Info Callout Box */}
                <div className="my-6 border-l-2 border-[#c067c9] pl-4 py-1 bg-white text-[13.5px] text-gray-600 leading-relaxed flex items-start gap-2.5">
                  <span className="text-[#c067c9] font-bold text-[15px] leading-none shrink-0 mt-0.5">
                    ⓘ
                  </span>
                  <div>
                    Every contract referenced in these docs is linked with its
                    real deployed address on Base Sepolia, Ethereum Sepolia, and
                    GenLayer Studio Next. See{" "}
                    <button
                      type="button"
                      onClick={() => handleSelectArticle("contract-directory")}
                      className="font-medium text-gray-900 underline hover:text-[#c067c9] cursor-pointer"
                    >
                      Contract Addresses
                    </button>
                    . Nothing here is a claim you have to take on faith.
                  </div>
                </div>

                <div className="pt-2">
                  <h3 className="text-[16px] font-semibold text-gray-900 mb-3">
                    Core Parameters at a Glance
                  </h3>
                  <div className="border border-gray-100 rounded-xl overflow-hidden text-[13px]">
                    <table className="w-full text-left border-collapse">
                      <tbody className="divide-y divide-gray-100">
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-gray-700 bg-gray-50/50 w-1/3">
                            Debt Asset
                          </td>
                          <td className="py-2.5 px-4 font-mono text-gray-900">
                            mUSD (18 decimals)
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-gray-700 bg-gray-50/50">
                            Standard MCR
                          </td>
                          <td className="py-2.5 px-4 text-gray-900">
                            150.0% (Stable regime)
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-gray-700 bg-gray-50/50">
                            Base Stability Fee
                          </td>
                          <td className="py-2.5 px-4 text-gray-900">
                            2.00% Annualized
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-gray-700 bg-gray-50/50">
                            Liquidation Bonus
                          </td>
                          <td className="py-2.5 px-4 text-gray-900">
                            10.0% to liquidator
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-gray-700 bg-gray-50/50">
                            Risk Engine Host
                          </td>
                          <td className="py-2.5 px-4 text-gray-900">
                            GenLayer Studio Next
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Article 2: System Architecture */}
            {activeId === "architecture" && (
              <div className="space-y-5 text-[15px] leading-relaxed text-gray-600">
                <p>
                  Meridian separates responsibilities across three distinct
                  on-chain networks: GenLayer Studio Next, Base Sepolia, and
                  Ethereum Sepolia.
                </p>

                <h3 className="text-[16px] font-semibold text-gray-900 pt-2">
                  1. GenLayer Studio Next (Risk Consensus)
                </h3>
                <p>
                  GenLayer hosts the BedrockCore contract
                  (0x4423BC844C77437Ca5BE285f712E5c6369f2E351). Validators run
                  nondeterministic Python executions backed by LLMs to evaluate
                  market data, oracle latencies, and price breaks. Consensus
                  produces a verified regime index and plain-text reasoning for
                  each asset.
                </p>

                <h3 className="text-[16px] font-semibold text-gray-900 pt-2">
                  2. Base Sepolia (Execution &amp; Accounting)
                </h3>
                <p>
                  Base Sepolia hosts the core Vault contract
                  (0xa969668F2dba4995a4F9078e335D09a0CA7F0Ea7) and the mUSD debt
                  token (0x22c7832ae38ebeb7003fa66b5184fc3361f3c2d1). All native
                  collateral deposits, borrowing limits, interest accruals,
                  repayments, and liquidations occur on this contract.
                </p>

                <h3 className="text-[16px] font-semibold text-gray-900 pt-2">
                  3. Ethereum Sepolia (L1 Escrow Custody)
                </h3>
                <p>
                  Ethereum Sepolia hosts the CollateralLock contract
                  (0xb171b11983f2cd5f9831184353db68f8a8a5c7a6). Users deposit
                  Layer 1 assets like DAI and wstETH into escrow. Lock events
                  dispatch cross-chain messages via LayerZero V2 to Base
                  Sepolia, crediting user collateral on the Vault.
                </p>

                {/* Info Callout */}
                <div className="my-6 border-l-2 border-[#c067c9] pl-4 py-1 bg-white text-[13.5px] text-gray-600 leading-relaxed flex items-start gap-2.5">
                  <span className="text-[#c067c9] font-bold text-[15px] leading-none shrink-0 mt-0.5">
                    ⓘ
                  </span>
                  <div>
                    Separating the risk engine on GenLayer from EVM accounting
                    on Base ensures the execution layer never depends on
                    off-chain cron bots or centralized multisig signers to
                    enforce protocol safety rules.
                  </div>
                </div>
              </div>
            )}

            {/* Article 3: The Six Collateral Assets */}
            {activeId === "assets" && (
              <div className="space-y-5 text-[15px] leading-relaxed text-gray-600">
                <p>
                  Meridian supports six collateral assets split across Base
                  Sepolia native tokens and Ethereum Sepolia bridged tokens.
                </p>

                <div className="border border-gray-100 rounded-xl overflow-hidden text-[13px] my-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-500 font-medium text-[11.5px] uppercase">
                        <th className="py-2.5 px-3">Asset</th>
                        <th className="py-2.5 px-3">Network</th>
                        <th className="py-2.5 px-3">Decimals</th>
                        <th className="py-2.5 px-3">Oracle Source</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-800">
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-gray-950">
                          WETH
                        </td>
                        <td className="py-2.5 px-3">Base Sepolia</td>
                        <td className="py-2.5 px-3 font-mono">18</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          0x4aDC...7cb1
                        </td>
                        <td className="py-2.5 px-3 text-emerald-700 font-medium">
                          Active
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-gray-950">
                          USDC
                        </td>
                        <td className="py-2.5 px-3">Base Sepolia</td>
                        <td className="py-2.5 px-3 font-mono">6</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          0xd30e...5165
                        </td>
                        <td className="py-2.5 px-3 text-emerald-700 font-medium">
                          Active
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-gray-950">
                          DAI
                        </td>
                        <td className="py-2.5 px-3">Ethereum Sepolia</td>
                        <td className="py-2.5 px-3 font-mono">18</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          0x1486...4C19
                        </td>
                        <td className="py-2.5 px-3 text-emerald-700 font-medium">
                          Active
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-gray-950">
                          WBTC
                        </td>
                        <td className="py-2.5 px-3">Base Sepolia</td>
                        <td className="py-2.5 px-3 font-mono">8</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          0x0FB9...4298
                        </td>
                        <td className="py-2.5 px-3 text-gray-400">Phase 2</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-gray-950">
                          LINK
                        </td>
                        <td className="py-2.5 px-3">Base Sepolia</td>
                        <td className="py-2.5 px-3 font-mono">18</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          0xb113...5A61
                        </td>
                        <td className="py-2.5 px-3 text-gray-400">Phase 2</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-gray-950">
                          wstETH
                        </td>
                        <td className="py-2.5 px-3">Ethereum Sepolia</td>
                        <td className="py-2.5 px-3 font-mono">18</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          0x694A...5306
                        </td>
                        <td className="py-2.5 px-3 text-gray-400">Phase 2</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="my-6 border-l-2 border-[#c067c9] pl-4 py-1 bg-white text-[13.5px] text-gray-600 leading-relaxed flex items-start gap-2.5">
                  <span className="text-[#c067c9] font-bold text-[15px] leading-none shrink-0 mt-0.5">
                    ⓘ
                  </span>
                  <div>
                    Per-asset evaluation is actively wired for ETH, DAI, and
                    USDC. Borrowing against WBTC, LINK, and wstETH is
                    temporarily paused while their secondary oracle telemetry is
                    calibrated in Phase 2.
                  </div>
                </div>
              </div>
            )}

            {/* Article 4: Risk Regime Engine */}
            {activeId === "regime-system" && (
              <div className="space-y-5 text-[15px] leading-relaxed text-gray-600">
                <p>
                  Bedrock classifies incoming telemetry into three deterministic
                  risk regimes. Each regime applies a specific minimum
                  collateralization ratio, sets stability fee rates, and
                  controls minting permissions.
                </p>

                <div className="space-y-3 my-4">
                  <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/40 space-y-1.5">
                    <div className="font-semibold text-gray-900 text-[14px]">
                      Regime 0: Stable
                    </div>
                    <p className="text-[13px] text-gray-600">
                      Applies a standard minimum collateralization ratio of
                      150.0% and an annualized stability fee of 2.00%. Triggered
                      when collateral peg deviation remains below 1.0%, oracle
                      heartbeats stay under 1200 seconds, and asset volatility
                      is within standard parameters. Borrowing and minting are
                      fully authorized.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/40 space-y-1.5">
                    <div className="font-semibold text-gray-900 text-[14px]">
                      Regime 1: Unsettled
                    </div>
                    <p className="text-[13px] text-gray-600">
                      Elevates the minimum collateralization ratio to 180.0% and
                      increases the annualized stability fee to 5.00%. Triggered
                      when collateral peg deviation ranges between 1.0% and
                      3.0%, volatility exceeds 5.0%, or oracle update latencies
                      rise. Minting remains active with this increased safety
                      buffer.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/40 space-y-1.5">
                    <div className="font-semibold text-gray-900 text-[14px]">
                      Regime 2: Undertow
                    </div>
                    <p className="text-[13px] text-gray-600">
                      Imposes a high stress minimum collateralization ratio of
                      250.0% and an annualized stability fee of 15.00%. New
                      minting is halted immediately to protect vault solvency.
                      Triggered by severe depeg breaking 3.0% from parity,
                      extreme spot price drops, or offline feeds. Loan
                      repayments and liquidations remain fully operational.
                    </p>
                  </div>
                </div>

                <div className="my-6 border-l-2 border-[#c067c9] pl-4 py-1 bg-white text-[13.5px] text-gray-600 leading-relaxed flex items-start gap-2.5">
                  <span className="text-[#c067c9] font-bold text-[15px] leading-none shrink-0 mt-0.5">
                    ⓘ
                  </span>
                  <div>
                    Evidence is strictly isolated inside bedrock_core.py. DAI
                    metrics only reference DAI peg data. ETH metrics only
                    reference ETH spot and volatility. USDC metrics only
                    reference USDC backing. Data is never cross-contaminated.
                  </div>
                </div>
              </div>
            )}

            {/* Article 5: Dynamic Stability Fees (Code Snippet 1 of 3) */}
            {activeId === "stability-fees" && (
              <div className="space-y-5 text-[15px] leading-relaxed text-gray-600">
                <p>
                  Stability fees accrue continuously on a per-second linear
                  basis directly to each open debt position. Whenever an account
                  executes a deposit, mint, repayment, or withdrawal, the
                  contract invokes internal accrual before mutating balances.
                </p>

                <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                  <div className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Linear Accrual Formula
                  </div>
                  <div className="font-mono text-[13px] text-gray-900 bg-white p-3 rounded-lg border border-gray-100">
                    fee = (userDebt * currentStabilityFeeBps * timeElapsed) /
                    (SECONDS_PER_YEAR * BPS_BASE)
                  </div>
                  <div className="text-[12px] text-gray-500 mt-2">
                    Where SECONDS_PER_YEAR = 31,536,000 (365 days) and BPS_BASE
                    = 10,000.
                  </div>
                </div>

                <h4 className="text-[14px] font-semibold text-gray-900 pt-2">
                  Contract Implementation Snippet (1 of 3)
                </h4>
                <div className="relative rounded-xl bg-gray-900 text-gray-200 p-4 font-mono text-[12px] leading-relaxed overflow-x-auto">
                  <pre>{`function _accrueInterest(address user) internal returns (uint256 fee) {
    uint256 userDebt = debt[user];
    if (userDebt == 0) {
        lastAccrualTimestamp[user] = block.timestamp;
        return 0;
    }
    uint256 lastTime = lastAccrualTimestamp[user];
    if (lastTime == 0 || block.timestamp <= lastTime) {
        lastAccrualTimestamp[user] = block.timestamp;
        return 0;
    }
    uint256 timeElapsed = block.timestamp - lastTime;
    fee = (userDebt * currentStabilityFeeBps * timeElapsed) / (SECONDS_PER_YEAR * BPS_BASE);
    if (fee > 0) {
        debt[user] = userDebt + fee;
        totalDebt += fee;
        emit StabilityFeeAccrued(user, fee, debt[user], timeElapsed);
    }
    lastAccrualTimestamp[user] = block.timestamp;
}`}</pre>
                </div>
              </div>
            )}

            {/* Article 6: Liquidation Engine (Code Snippet 2 of 3) */}
            {activeId === "liquidation" && (
              <div className="space-y-5 text-[15px] leading-relaxed text-gray-600">
                <p>
                  Liquidation on Meridian is entirely permissionless. Any
                  external actor or liquidator bot can scan accounts on Base
                  Sepolia. If an account collateral ratio drops below the active
                  required threshold, the position can be liquidated up to the
                  full debt balance.
                </p>

                <div className="my-6 border-l-2 border-[#c067c9] pl-4 py-1 bg-white text-[13.5px] text-gray-600 leading-relaxed flex items-start gap-2.5">
                  <span className="text-[#c067c9] font-bold text-[15px] leading-none shrink-0 mt-0.5">
                    ⓘ
                  </span>
                  <div>
                    Liquidators receive the equivalent market value of
                    collateral plus a 10% bonus (LIQUIDATION_PENALTY_BPS =
                    1000). The repaid mUSD is burned, permanently retiring bad
                    debt from the system.
                  </div>
                </div>

                <h4 className="text-[14px] font-semibold text-gray-900 pt-2">
                  Solidity Liquidation Method (2 of 3)
                </h4>
                <div className="rounded-xl bg-gray-900 text-gray-200 p-4 font-mono text-[12px] leading-relaxed overflow-x-auto">
                  <pre>{`function liquidate(
    address borrower,
    address collateralToken,
    uint256 debtToCover
) external nonReentrant onlySupportedToken(collateralToken) {
    _accrueInterest(borrower);
    (, , bool isLiquidatable) = getHealthScore(borrower);
    if (!isLiquidatable) revert PositionNotLiquidatable();
    if (debtToCover == 0) revert ZeroAmount();

    uint256 borrowerDebt = debt[borrower];
    if (debtToCover > borrowerDebt) debtToCover = borrowerDebt;

    uint256 tokenPriceUSD = getLatestPrice(collateralToken);
    uint256 rewardValueUSD = (debtToCover * (BPS_BASE + LIQUIDATION_PENALTY_BPS)) / BPS_BASE;
    uint256 collateralReward = (rewardValueUSD * PRICE_PRECISION) / tokenPriceUSD;

    debt[borrower] = borrowerDebt - debtToCover;
    totalDebt -= debtToCover;
    collateral[collateralToken][borrower] -= collateralReward;

    musdToken.burn(msg.sender, debtToCover);
    IERC20(collateralToken).transfer(msg.sender, collateralReward);
}`}</pre>
                </div>
              </div>
            )}

            {/* Article 7: Cross-Chain Architecture (Code Snippet 3 of 3) */}
            {activeId === "cross-chain" && (
              <div className="space-y-5 text-[15px] leading-relaxed text-gray-600">
                <p>
                  Meridian uses LayerZero V2 messaging to accept collateral
                  escrowed on Ethereum Sepolia while consolidating CDP debt
                  management on Base Sepolia.
                </p>

                <div className="space-y-3 my-4">
                  <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                    <div className="font-semibold text-gray-900 text-[13.5px] mb-1">
                      1. Lock on Ethereum Sepolia
                    </div>
                    <p className="text-[13px] text-gray-600">
                      The user calls lock(token, amount) on
                      EthereumSepoliaCollateralLock
                      (0xb171b11983f2cd5f9831184353db68f8a8a5c7a6). Tokens
                      remain securely held in the L1 contract.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                    <div className="font-semibold text-gray-900 text-[13.5px] mb-1">
                      2. LayerZero V2 Dispatch
                    </div>
                    <p className="text-[13px] text-gray-600">
                      The lock contract dispatches an encrypted payload via
                      Endpoint 0x6EDCE65403992e310A62460808c4b910D972f10f
                      targeting destination Endpoint ID 40245 (Base Sepolia).
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                    <div className="font-semibold text-gray-900 text-[13.5px] mb-1">
                      3. Crediting on Base Sepolia
                    </div>
                    <p className="text-[13px] text-gray-600">
                      BaseSepoliaBridgeReceiver
                      (0x1ac0eba066459c31fac2e4bba234193bbc52f21b) verifies the
                      message guid and calls Vault.creditBridgedCollateral. The
                      user can immediately mint mUSD against this credit.
                    </p>
                  </div>
                </div>

                <h4 className="text-[14px] font-semibold text-gray-900 pt-2">
                  Bridge Receiver Handler Snippet (3 of 3)
                </h4>
                <div className="rounded-xl bg-gray-900 text-gray-200 p-4 font-mono text-[12px] leading-relaxed overflow-x-auto">
                  <pre>{`function _lzReceive(
    Origin calldata origin,
    bytes32 guid,
    bytes calldata message,
    address executor,
    bytes calldata extraData
) internal override {
    (address user, address token, uint256 amount) = abi.decode(
        message,
        (address, address, uint256)
    );
    vault.creditBridgedCollateral(user, token, amount);
    emit BridgedCollateralCredited(user, token, amount, guid);
}`}</pre>
                </div>
              </div>
            )}

            {/* Article 8: Verified Proof of Execution */}
            {activeId === "proof-of-execution" && (
              <div className="space-y-5 text-[15px] leading-relaxed text-gray-600">
                <p>
                  Every transaction listed below was submitted to live testnet
                  chains, confirmed by validators, and finalized on-chain.
                </p>

                <div className="border border-gray-100 rounded-xl overflow-hidden text-[12.5px] my-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-500 font-medium text-[11px] uppercase">
                        <th className="py-2.5 px-3">Network</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Block</th>
                        <th className="py-2.5 px-3">Transaction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-800 font-mono text-[11px]">
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-purple-700">
                          GenLayer
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          ETH Consensus Scan
                        </td>
                        <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                          ACCEPTED
                        </td>
                        <td className="py-2.5 px-3">Consensus</td>
                        <td className="py-2.5 px-3">
                          <a
                            href="https://explorer-studio-dev.genlayer.com/tx/0x5b518b0f4067696f17418144b38d1b2f44ed766d12c9981b8ed47263922e4aca"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#c067c9] underline hover:text-gray-900"
                          >
                            0x5b51...4aca ↗
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-purple-700">
                          GenLayer
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          DAI Consensus Scan
                        </td>
                        <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                          ACCEPTED
                        </td>
                        <td className="py-2.5 px-3">Consensus</td>
                        <td className="py-2.5 px-3">
                          <a
                            href="https://explorer-studio-dev.genlayer.com/tx/0xdb30d81111e7838985d7437a436723d0a2a34f1f58025eb305df2628321a934b"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#c067c9] underline hover:text-gray-900"
                          >
                            0xdb30...934b ↗
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-purple-700">
                          GenLayer
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          USDC Consensus Scan
                        </td>
                        <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                          ACCEPTED
                        </td>
                        <td className="py-2.5 px-3">Consensus</td>
                        <td className="py-2.5 px-3">
                          <a
                            href="https://explorer-studio-dev.genlayer.com/tx/0x7d1714111dcf3d12ef319a33c45aade89f97b8c64ee94b5e9f55334aab78d401"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#c067c9] underline hover:text-gray-900"
                          >
                            0x7d17...d401 ↗
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-blue-700">
                          Base Sepolia
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          WETH Deposit (0.0005 WETH)
                        </td>
                        <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                          SUCCESS
                        </td>
                        <td className="py-2.5 px-3">46813363</td>
                        <td className="py-2.5 px-3">
                          <a
                            href="https://sepolia.basescan.org/tx/0x16bf7f317c79fb5550e8a8e4a23295506d8e4085bd21493f053e0e80c2f27a9a"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#c067c9] underline hover:text-gray-900"
                          >
                            0x16bf...7a9a ↗
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-blue-700">
                          Base Sepolia
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          mUSD Mint (0.05 mUSD)
                        </td>
                        <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                          SUCCESS
                        </td>
                        <td className="py-2.5 px-3">46813364</td>
                        <td className="py-2.5 px-3">
                          <a
                            href="https://sepolia.basescan.org/tx/0x6d651932ac41a9ca907bd0f6edf899cb5fce855837202db90bcd92a7935ddc81"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#c067c9] underline hover:text-gray-900"
                          >
                            0x6d65...dc81 ↗
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-blue-700">
                          Base Sepolia
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          mUSD Repay (0.05 mUSD)
                        </td>
                        <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                          SUCCESS
                        </td>
                        <td className="py-2.5 px-3">46813365</td>
                        <td className="py-2.5 px-3">
                          <a
                            href="https://sepolia.basescan.org/tx/0x878f4cab7174af0590d0747471ebd19ae5d4db618875ae1658c063f6cc50f41b"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#c067c9] underline hover:text-gray-900"
                          >
                            0x878f...f41b ↗
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-700">
                          Eth Sepolia
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          CollateralLock Deploy
                        </td>
                        <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                          SUCCESS
                        </td>
                        <td className="py-2.5 px-3">11687323</td>
                        <td className="py-2.5 px-3">
                          <a
                            href="https://sepolia.etherscan.io/tx/0x389f28c2c6f90cce46465bf8cc756f0976d7aed1859a03b2654a68e4dbaf3ca8"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#c067c9] underline hover:text-gray-900"
                          >
                            0x389f...3ca8 ↗
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Article 9: Contract Addresses */}
            {activeId === "contract-directory" && (
              <div className="space-y-5 text-[15px] leading-relaxed text-gray-600">
                <p>
                  Verified contract addresses across Base Sepolia, Ethereum
                  Sepolia, and GenLayer Studio Next:
                </p>

                <div className="space-y-2.5 my-4">
                  <div className="p-3.5 rounded-xl border border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[13.5px] text-gray-900">
                        MultiCollateral Vault
                      </div>
                      <div className="text-[11.5px] text-gray-500">
                        Base Sepolia (Chain ID 84532)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11.5px] text-gray-800 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                        0xa969668F2dba4995a4F9078e335D09a0CA7F0Ea7
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            "vault",
                            "0xa969668F2dba4995a4F9078e335D09a0CA7F0Ea7",
                          )
                        }
                        className="text-[11.5px] text-gray-500 hover:text-gray-900 px-2 py-0.5 rounded border border-gray-200 cursor-pointer"
                      >
                        {copiedKey === "vault" ? "Copied" : "Copy"}
                      </button>
                      <a
                        href="https://sepolia.basescan.org/address/0xa969668F2dba4995a4F9078e335D09a0CA7F0Ea7"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11.5px] text-[#c067c9] hover:underline"
                      >
                        View
                      </a>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[13.5px] text-gray-900">
                        mUSD Debt Token
                      </div>
                      <div className="text-[11.5px] text-gray-500">
                        Base Sepolia (Chain ID 84532)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11.5px] text-gray-800 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                        0x22c7832ae38ebeb7003fa66b5184fc3361f3c2d1
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            "musd",
                            "0x22c7832ae38ebeb7003fa66b5184fc3361f3c2d1",
                          )
                        }
                        className="text-[11.5px] text-gray-500 hover:text-gray-900 px-2 py-0.5 rounded border border-gray-200 cursor-pointer"
                      >
                        {copiedKey === "musd" ? "Copied" : "Copy"}
                      </button>
                      <a
                        href="https://sepolia.basescan.org/address/0x22c7832ae38ebeb7003fa66b5184fc3361f3c2d1"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11.5px] text-[#c067c9] hover:underline"
                      >
                        View
                      </a>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[13.5px] text-gray-900">
                        BedrockCore Intelligent Contract
                      </div>
                      <div className="text-[11.5px] text-gray-500">
                        GenLayer Studio Next (Chain ID 61997)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11.5px] text-gray-800 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                        0x4423BC844C77437Ca5BE285f712E5c6369f2E351
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            "bedrock",
                            "0x4423BC844C77437Ca5BE285f712E5c6369f2E351",
                          )
                        }
                        className="text-[11.5px] text-gray-500 hover:text-gray-900 px-2 py-0.5 rounded border border-gray-200 cursor-pointer"
                      >
                        {copiedKey === "bedrock" ? "Copied" : "Copy"}
                      </button>
                      <a
                        href="https://explorer-studio-dev.genlayer.com/address/0x4423BC844C77437Ca5BE285f712E5c6369f2E351"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11.5px] text-[#c067c9] hover:underline"
                      >
                        View
                      </a>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[13.5px] text-gray-900">
                        Ethereum CollateralLock
                      </div>
                      <div className="text-[11.5px] text-gray-500">
                        Ethereum Sepolia (Chain ID 11155111)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11.5px] text-gray-800 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                        0xb171b11983f2cd5f9831184353db68f8a8a5c7a6
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            "lock",
                            "0xb171b11983f2cd5f9831184353db68f8a8a5c7a6",
                          )
                        }
                        className="text-[11.5px] text-gray-500 hover:text-gray-900 px-2 py-0.5 rounded border border-gray-200 cursor-pointer"
                      >
                        {copiedKey === "lock" ? "Copied" : "Copy"}
                      </button>
                      <a
                        href="https://sepolia.etherscan.io/address/0xb171b11983f2cd5f9831184353db68f8a8a5c7a6"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11.5px] text-[#c067c9] hover:underline"
                      >
                        View
                      </a>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[13.5px] text-gray-900">
                        Base Sepolia Bridge Receiver
                      </div>
                      <div className="text-[11.5px] text-gray-500">
                        Base Sepolia (Chain ID 84532)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11.5px] text-gray-800 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                        0x1ac0eba066459c31fac2e4bba234193bbc52f21b
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            "bridge",
                            "0x1ac0eba066459c31fac2e4bba234193bbc52f21b",
                          )
                        }
                        className="text-[11.5px] text-gray-500 hover:text-gray-900 px-2 py-0.5 rounded border border-gray-200 cursor-pointer"
                      >
                        {copiedKey === "bridge" ? "Copied" : "Copy"}
                      </button>
                      <a
                        href="https://sepolia.basescan.org/address/0x1ac0eba066459c31fac2e4bba234193bbc52f21b"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11.5px] text-[#c067c9] hover:underline"
                      >
                        View
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Next / Previous Article Navigation */}
            <div className="mt-14 pt-8 border-t border-gray-100 flex items-center justify-between">
              {prevArticle ? (
                <button
                  type="button"
                  onClick={() => handleSelectArticle(prevArticle.id)}
                  className="px-4 py-3 rounded-xl border border-gray-100 hover:border-gray-200 text-left transition-colors cursor-pointer group bg-white"
                >
                  <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
                    PREVIOUS
                  </div>
                  <div className="text-[13.5px] font-medium text-gray-900 group-hover:text-[#c067c9] transition-colors mt-0.5">
                    ← {prevArticle.title}
                  </div>
                </button>
              ) : (
                <div />
              )}

              {nextArticle && (
                <button
                  type="button"
                  onClick={() => handleSelectArticle(nextArticle.id)}
                  className="px-4 py-3 rounded-xl border border-gray-100 hover:border-gray-200 text-right transition-colors cursor-pointer group bg-white"
                >
                  <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
                    NEXT
                  </div>
                  <div className="text-[13.5px] font-medium text-gray-900 group-hover:text-[#c067c9] transition-colors mt-0.5">
                    {nextArticle.title} →
                  </div>
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
