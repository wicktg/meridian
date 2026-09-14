import React from "react";
import OrbitRing from "./OrbitRing";
import { NaiCoin } from "./Scene3D";

export default function HeroSection() {
  return (
    <section className="relative w-full flex-1 flex flex-col items-center justify-center py-8 px-4 z-10">
      {/* Central Orbit & Hero Content Container */}
      <div className="relative w-full max-w-[720px] min-h-[460px] sm:min-h-[500px] flex flex-col items-center justify-center">
        {/* Orbital Ring & 6 Crypto Badges */}
        <OrbitRing className="inset-0" />

        {/* Central Text & NAI Token Badge */}
        <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-[560px]">
          {/* Headline */}
          <h1 className="text-white font-mono text-[22px] sm:text-[27px] md:text-[31px] font-bold leading-[1.4] tracking-wide select-none">
            <div>Money that gets smarter</div>
            <div>when the market gets riskier.</div>
          </h1>

          {/* Central NAI Coin */}
          <div className="mt-6 flex items-center justify-center select-none">
            <NaiCoin size={54} />
          </div>
        </div>
      </div>
    </section>
  );
}
