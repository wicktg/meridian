"use client";

import React, { Suspense } from "react";
import Dashboard from "@/components/Dashboard";
import { useRouter, useSearchParams } from "next/navigation";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "Dashboard";

  return (
    <Dashboard onBackToLanding={() => router.push("/")} initialTab={tab} />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
