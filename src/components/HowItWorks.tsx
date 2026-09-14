import React from "react";

export default function HowItWorks() {
  return (
    <section className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24 z-20">
      {/* Section Header */}
      <div className="flex flex-col items-center text-center mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/50 border border-white/80 backdrop-blur-md mb-3 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
          <span className="text-[11px] font-mono font-semibold tracking-[0.2em] uppercase text-zinc-700">
            Autonomous Pipeline
          </span>
        </div>
        <h2 className="text-[26px] sm:text-[32px] md:text-[36px] font-mono font-bold tracking-tight text-zinc-900">
          How It Works
        </h2>
        <p className="mt-3 text-[14px] sm:text-[15px] font-sans text-zinc-700 max-w-xl leading-relaxed">
          From raw market signals to autonomous on-chain execution without
          governance latency or admin keys.
        </p>
      </div>

      {/* Bento Grid Container with Animated Connecting Pipeline */}
      <div className="relative">
        {/* Desktop Connecting Pipeline Conduit (Smooth continuous path behind cards) */}
        <svg
          className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
          viewBox="0 0 960 520"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="pipelineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#c084fc" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* Segment 1: Card 1 right edge to Card 2 left edge */}
          <path
            d="M 390 145 L 414 145"
            fill="none"
            stroke="url(#pipelineGrad)"
            strokeWidth="2.2"
            strokeDasharray="5 4"
            className="animate-pipeline"
          />

          {/* Segment 2: Card 2 bottom to Card 3 right edge conduit */}
          <path
            d="M 687 290 L 687 318 Q 687 334 667 334 L 334 334 Q 314 334 314 350 L 314 420"
            fill="none"
            stroke="url(#pipelineGrad)"
            strokeWidth="1.8"
            strokeDasharray="5 4"
            className="animate-pipeline"
          />

          {/* Segment 3: Card 3 right edge to Card 4 left edge */}
          <path
            d="M 312 435 L 336 435"
            fill="none"
            stroke="url(#pipelineGrad)"
            strokeWidth="2.2"
            strokeDasharray="5 4"
            className="animate-pipeline"
          />
        </svg>

        {/* 4-Card Bento Grid */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* =========================================================
              CARD 1: DEPOSIT COLLATERAL (Top-Left, Medium, 5 Cols)
             ========================================================= */}
          <div
            className="lg:col-span-5 relative overflow-hidden rounded-[26px] p-6 sm:p-7 flex flex-col justify-between border border-white/80 transition-all duration-300"
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.62) 100%)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              boxShadow:
                "0 20px 40px -15px rgba(0, 0, 0, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)",
            }}
          >
            {/* Top Specular Glare Line */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />

            <div>
              {/* Header: Stage Tag & Custom Fanned Tokens Icon */}
              <div className="flex items-start justify-between gap-4 mb-5">
                <span className="text-[10.5px] font-mono font-semibold tracking-[0.16em] uppercase text-zinc-500">
                  // STAGE 01
                </span>

                {/* Custom Icon: Stack of 3 Fanned Overlapping Tokens */}
                <div className="relative w-12 h-10 flex items-center justify-center select-none">
                  {/* Back Token (Left Tilted) */}
                  <div
                    className="absolute -left-1 top-1 w-7 h-7 rounded-[8px] border border-white bg-gradient-to-br from-slate-700 to-slate-900 shadow-xs flex items-center justify-center transform -rotate-12"
                    title="ETH / Staked Collateral"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-white/90"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polygon
                        points="12 2 19 12 12 16 5 12 12 2"
                        fill="currentColor"
                        fillOpacity="0.3"
                      />
                      <polygon points="12 16 19 12 12 22 5 12 12 16" />
                    </svg>
                  </div>

                  {/* Middle Token (Right Tilted) */}
                  <div
                    className="absolute -right-1 top-0 w-7 h-7 rounded-[8px] border border-white bg-gradient-to-br from-amber-500 to-amber-700 shadow-xs flex items-center justify-center transform rotate-12"
                    title="WBTC / Native Reserves"
                  >
                    <span className="text-[11px] font-mono font-bold text-white leading-none">
                      ₿
                    </span>
                  </div>

                  {/* Front Token (Centered, Primary) */}
                  <div className="relative z-10 w-8 h-8 rounded-[9px] border border-white bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-800 shadow-sm flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Title & Body */}
              <h3 className="text-[20px] sm:text-[22px] font-mono font-bold text-zinc-900 tracking-tight leading-snug">
                Deposit Collateral
              </h3>
              <p className="mt-2.5 text-[13.5px] font-sans text-zinc-600 leading-relaxed">
                ETH, wstETH, and 4 more — locked, blended, and valued in real
                time.
              </p>
            </div>

            {/* Bottom Visual Accent: 6 Collateral Asset Chips */}
            <div className="mt-6 pt-4 border-t border-black/[0.05] flex items-center justify-between gap-1.5 flex-wrap">
              {["ETH", "wstETH", "WBTC", "USDC", "DAI", "LINK"].map((sym) => (
                <span
                  key={sym}
                  className="px-2 py-0.5 rounded-md bg-white/70 border border-black/[0.05] text-[10.5px] font-mono font-medium text-zinc-700"
                >
                  {sym}
                </span>
              ))}
            </div>
          </div>

          {/* Mobile connecting indicator */}
          <div className="lg:hidden flex justify-center -my-2">
            <svg className="w-5 h-6 text-white" viewBox="0 0 20 24" fill="none">
              <path
                d="M 10 0 L 10 20"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="animate-pipeline"
              />
              <polygon points="6,16 10,22 14,16" fill="rgba(255,255,255,0.9)" />
            </svg>
          </div>

          {/* =========================================================
              CARD 2: GENLAYER READS RISK (Hero of the Section, 7 Cols)
             ========================================================= */}
          <div
            className="lg:col-span-7 relative overflow-hidden rounded-[26px] p-6 sm:p-7 flex flex-col justify-between border border-white/80 transition-all duration-300"
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.82) 0%, rgba(255, 255, 255, 0.65) 100%)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              boxShadow:
                "0 20px 40px -15px rgba(0, 0, 0, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)",
            }}
          >
            {/* Top Specular Glare Line */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />

            <div>
              {/* Header: Stage Tag & Evaluation Indicator */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <span className="text-[10.5px] font-mono font-semibold tracking-[0.16em] uppercase text-purple-700">
                  // STAGE 02 · CONSENSUS CORE
                </span>

                {/* Evaluation Pill */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200/70 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                  <span className="text-[10.5px] font-mono font-semibold text-purple-800 uppercase tracking-wide">
                    Live Evaluation
                  </span>
                </div>
              </div>

              {/* Title & Body */}
              <h3 className="text-[21px] sm:text-[23px] font-mono font-bold text-zinc-900 tracking-tight leading-snug">
                GenLayer Reads the Market
              </h3>
              <p className="mt-2 text-[13.5px] sm:text-[14px] font-sans text-zinc-600 leading-relaxed">
                Validators independently evaluate live conditions — price,
                liquidity, disclosed risk — and reach consensus on what&apos;s
                actually happening. No single source decides.
              </p>
            </div>

            {/* Custom Mid-Scan Evidence Container (The Hero Visual) */}
            <div className="relative mt-5 rounded-xl bg-white/80 border border-black/[0.07] p-3.5 sm:p-4 overflow-hidden shadow-xs">
              {/* Animated Horizontal Laser Scan Beam */}
              <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-600 to-transparent pointer-events-none z-20 animate-scanner shadow-[0_0_8px_rgba(147,51,234,0.6)]" />
              <div className="absolute inset-x-0 h-10 bg-gradient-to-b from-purple-500/10 to-transparent pointer-events-none z-10 animate-scanner" />

              {/* Simulated Technical Evidence Data Tracks */}
              <div className="space-y-2 font-mono text-[11px] select-none">
                {/* Channel 1: Price Tick & Volatility */}
                <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.04]">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-700 font-bold">[TICK]</span>
                    <span className="text-zinc-700">ETH/USD $3,142.80</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">Spread: 0.018%</span>
                    <span className="text-emerald-600 font-semibold">
                      ✓ VERIFIED
                    </span>
                  </div>
                </div>

                {/* Channel 2: Liquidity Depth */}
                <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.04]">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-700 font-bold">[DEPTH]</span>
                    <span className="text-zinc-700">DEX Reserves $184.2M</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">Slippage &lt;0.04%</span>
                    <span className="text-emerald-600 font-semibold">
                      ✓ OPTIMAL
                    </span>
                  </div>
                </div>

                {/* Channel 3: Disclosed Risk & Consensus */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-700 font-bold">[RISK]</span>
                    <span className="text-zinc-700">
                      Collateral Health 284.6%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">Consensus: 64/64</span>
                    <span className="text-purple-700 font-bold">
                      100% QUORUM
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile connecting indicator */}
          <div className="lg:hidden flex justify-center -my-2">
            <svg className="w-5 h-6 text-white" viewBox="0 0 20 24" fill="none">
              <path
                d="M 10 0 L 10 20"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="animate-pipeline"
              />
              <polygon points="6,16 10,22 14,16" fill="rgba(255,255,255,0.9)" />
            </svg>
          </div>

          {/* =========================================================
              CARD 3: REGIME ASSIGNED (Bottom-Left, Small, 4 Cols)
             ========================================================= */}
          <div
            className="lg:col-span-4 relative overflow-hidden rounded-[26px] p-6 sm:p-7 flex flex-col justify-between border border-white/80 transition-all duration-300"
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.62) 100%)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              boxShadow:
                "0 20px 40px -15px rgba(0, 0, 0, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)",
            }}
          >
            {/* Top Specular Glare Line */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />

            <div>
              {/* Header: Stage Tag */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <span className="text-[10.5px] font-mono font-semibold tracking-[0.16em] uppercase text-zinc-500">
                  // STAGE 03
                </span>

                {/* Reused Stats-Strip Badge (Normal Regime Active) */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-300/80 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10.5px] font-mono font-bold text-emerald-700 uppercase tracking-wide">
                    Normal
                  </span>
                </div>
              </div>

              {/* Title & Body */}
              <h3 className="text-[19px] sm:text-[21px] font-mono font-bold text-zinc-900 tracking-tight leading-snug">
                Regime Classified
              </h3>
              <p className="mt-2 text-[13px] font-sans text-zinc-600 leading-relaxed">
                Conditions map to a named state — Normal, Defensive, or Crisis.
              </p>
            </div>

            {/* Visual Reused Regime Pill Track (Normal / Defensive / Crisis) */}
            <div className="mt-5 pt-4 border-t border-black/[0.05] flex items-center justify-between gap-1 select-none">
              <span className="px-2.5 py-1 rounded-md bg-emerald-100/90 text-emerald-800 border border-emerald-300 font-mono font-bold text-[11px]">
                ● Normal
              </span>
              <span className="px-2.5 py-1 rounded-md bg-white/50 text-zinc-400 border border-black/[0.04] font-mono text-[11px]">
                Defensive
              </span>
              <span className="px-2.5 py-1 rounded-md bg-white/50 text-zinc-400 border border-black/[0.04] font-mono text-[11px]">
                Crisis
              </span>
            </div>
          </div>

          {/* Mobile connecting indicator */}
          <div className="lg:hidden flex justify-center -my-2">
            <svg className="w-5 h-6 text-white" viewBox="0 0 20 24" fill="none">
              <path
                d="M 10 0 L 10 20"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="animate-pipeline"
              />
              <polygon points="6,16 10,22 14,16" fill="rgba(255,255,255,0.9)" />
            </svg>
          </div>

          {/* =========================================================
              CARD 4: POLICY ENFORCED (Bottom-Right, Medium, 8 Cols)
             ========================================================= */}
          <div
            className="lg:col-span-8 relative overflow-hidden rounded-[26px] p-6 sm:p-7 flex flex-col justify-between border border-white/80 transition-all duration-300"
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.62) 100%)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              boxShadow:
                "0 20px 40px -15px rgba(0, 0, 0, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)",
            }}
          >
            {/* Top Specular Glare Line */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />

            <div>
              {/* Header: Stage Tag & Custom Geometric Gear/Lock Icon */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <span className="text-[10.5px] font-mono font-semibold tracking-[0.16em] uppercase text-zinc-500">
                  // STAGE 04 · EXECUTION
                </span>

                {/* Custom Geometric Interlocking Gear & Lock Icon */}
                <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-white/80 border border-black/[0.06] shadow-xs select-none">
                  {/* Geometric 8-Tooth Gear */}
                  <svg
                    className="w-5 h-5 text-zinc-700"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>

                  {/* Geometric Interlocking Latch / Lock */}
                  <svg
                    className="w-4 h-4 text-purple-700"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
              </div>

              {/* Title & Body */}
              <h3 className="text-[20px] sm:text-[22px] font-mono font-bold text-zinc-900 tracking-tight leading-snug">
                Policy Executes On-Chain
              </h3>
              <p className="mt-2 text-[13.5px] font-sans text-zinc-600 leading-relaxed">
                Collateral ratios, mint caps, and fees update automatically. No
                vote. No admin key.
              </p>
            </div>

            {/* Telemetry Strip: Autonomous Enforced Rules */}
            <div className="mt-5 pt-4 border-t border-black/[0.05] grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
              <div className="p-2 rounded-xl bg-white/70 border border-black/[0.05]">
                <div className="text-[9.5px] font-semibold text-zinc-500 uppercase tracking-wider">
                  COLLATERAL RATIO
                </div>
                <div className="text-[12px] font-bold text-zinc-900 mt-0.5">
                  284.6% Auto
                </div>
              </div>
              <div className="p-2 rounded-xl bg-white/70 border border-black/[0.05]">
                <div className="text-[9.5px] font-semibold text-zinc-500 uppercase tracking-wider">
                  MINT CAP
                </div>
                <div className="text-[12px] font-bold text-zinc-900 mt-0.5">
                  $250.0M Max
                </div>
              </div>
              <div className="p-2 rounded-xl bg-white/70 border border-black/[0.05]">
                <div className="text-[9.5px] font-semibold text-zinc-500 uppercase tracking-wider">
                  GOVERNANCE DELAY
                </div>
                <div className="text-[12px] font-bold text-emerald-700 mt-0.5">
                  0s (Instant)
                </div>
              </div>
              <div className="p-2 rounded-xl bg-white/70 border border-black/[0.05]">
                <div className="text-[9.5px] font-semibold text-zinc-500 uppercase tracking-wider">
                  ADMIN KEY
                </div>
                <div className="text-[12px] font-bold text-purple-700 mt-0.5">
                  None (Immutable)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
