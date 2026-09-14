import React from "react";
import Mascot from "./Mascot";

export default function BottomCard() {
  return (
    <div className="relative w-full max-w-[680px] md:max-w-[760px] mx-auto z-20">
      {/* Mascot perched on the top border of the card */}
      <div className="absolute -top-[38px] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-auto">
        <Mascot
          size={48}
          withGroundLine={true}
          className="transition-transform duration-300 hover:scale-110 hover:-translate-y-1 cursor-pointer"
        />
      </div>

      {/* Main Dark Card */}
      <div
        className="relative w-full rounded-t-[36px] pt-12 pb-10 px-8 text-center overflow-hidden border-t border-white/5"
        style={{
          backgroundColor: "#17112e",
        }}
      >
        {/* Text Heading */}
        <h2 className="text-white font-mono text-[19px] sm:text-[21px] md:text-[23px] font-bold leading-relaxed tracking-wider select-none">
          <div>Neocean Is A</div>
          <div>Decentralized Reserve Bank</div>
        </h2>

        {/* Bottom Right Purple Accent Tab */}
        <div
          className="absolute -bottom-1 -right-1 w-28 sm:w-36 h-12 sm:h-14 rounded-tl-[22px] pointer-events-none"
          style={{
            background: "linear-gradient(135deg, #8d48f6 0%, #b254f8 100%)",
          }}
        />
      </div>
    </div>
  );
}
