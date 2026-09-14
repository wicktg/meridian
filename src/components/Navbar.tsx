"use client";

import React from "react";
import Link from "next/link";

interface NavbarProps {
  onConnectWallet?: () => void;
}

export default function Navbar({ onConnectWallet }: NavbarProps) {
  return (
    <header className="relative z-30 w-full px-6 md:px-12 lg:px-16 pt-6 pb-4 flex items-center justify-between">
      {/* Left side: Brand Logo */}
      <div className="flex items-center cursor-pointer group z-10">
        <img
          src="/meridian-logo.png"
          alt="Meridian Logo"
          className="h-4 sm:h-5 w-auto object-contain select-none"
        />
      </div>

      {/* Center Navigation Links - Centered in Header */}
      <nav className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center gap-8 text-[13.5px] font-sans font-medium z-10">
        <Link
          href="/docs"
          className="text-white/70 hover:text-white transition-colors duration-200"
        >
          Docs
        </Link>
        <a
          href="https://github.com/wicktg/meridian"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/70 hover:text-white transition-colors duration-200"
        >
          Github
        </a>
      </nav>

      {/* Right side: Connect Wallet Button */}
      <div className="flex items-center z-10">
        <button
          type="button"
          onClick={onConnectWallet}
          className="relative px-5 py-2 rounded-[10px] text-[13px] font-semibold text-white tracking-wide transition-all duration-300 hover:brightness-105 active:scale-95 border border-white/35 overflow-hidden cursor-pointer"
          style={{
            background:
              "linear-gradient(135deg, rgba(215, 140, 215, 0.45) 0%, rgba(245, 195, 170, 0.65) 100%)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {/* Subtle top glare */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          Connect Wallet
        </button>
      </div>
    </header>
  );
}
