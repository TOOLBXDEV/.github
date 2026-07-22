"use client";

import dynamic from "next/dynamic";

const SalesMap = dynamic(() => import("./components/SalesMap"), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Loading heatmap...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <SalesMap />;
}
