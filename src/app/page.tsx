"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import Dashboard from "@/components/Dashboard";
import { useWeb3 } from "@/context/Web3Context";

export default function Home() {
  const [view, setView] = useState<"landing" | "loading" | "dashboard">(
    "landing",
  );
  const { account, connect, disconnect } = useWeb3();
  const router = useRouter();
  const prevAccountRef = useRef(account);

  // Dedicated 3-second loading timer: whenever loading screen appears, guaranteed redirect after 3 seconds
  useEffect(() => {
    if (view === "loading") {
      const timer = setTimeout(() => {
        setView("dashboard");
        router.push("/dashboard");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [view, router]);

  // When a wallet connects via ConnectKit on the landing page, transition to loading
  useEffect(() => {
    if (!prevAccountRef.current && account && view === "landing") {
      setView("loading");
    }
    prevAccountRef.current = account;
  }, [account, view]);

  const handleConnectWallet = async () => {
    // If already connected, transition directly through loading to dashboard
    if (account) {
      setView("loading");
      return;
    }

    // Opens standard ConnectKit modal
    await connect();
  };

  const handleDisconnect = () => {
    disconnect();
    setView("landing");
    router.push("/");
  };

  // Loading Screen: displays only the loading icon
  if (view === "loading") {
    return (
      <main className="relative min-h-screen w-full flex flex-col items-center justify-center film-grain select-none px-4">
        <div className="relative z-10 flex flex-col items-center justify-center">
          {/* Subtle spinning loader with Meridian accent */}
          <div className="w-10 h-10 rounded-full border-[2.5px] border-white/20 border-t-[#d87eb9] animate-spin" />
        </div>
      </main>
    );
  }

  // Dashboard Screen: displays replicated Dashboard
  if (view === "dashboard") {
    return <Dashboard onBackToLanding={handleDisconnect} />;
  }

  // Default Landing Page View
  return (
    <main className="relative min-h-screen w-full flex flex-col justify-between film-grain select-none">
      {/* Navigation Bar */}
      <Navbar onConnectWallet={handleConnectWallet} />

      {/* Hero Section: Centered Monospace Title, NAI Token Badge, Orbit Ring with 6 Crypto Tokens */}
      <HeroSection />
    </main>
  );
}
