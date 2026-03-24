"use client";
// Next.js App Router: dynamic({ ssr: false }) requires a Client Component wrapper.
import dynamic from "next/dynamic";

const InfraMap = dynamic(() => import("@/components/InfraMap"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-24 h-24 border-4 border-blue-500/20 rounded-full" />
          <div className="absolute w-24 h-24 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-white font-black tracking-[0.2em] uppercase text-sm animate-pulse">
          Initializing Lucknow PostGIS...
        </p>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900">
      <InfraMap />
    </main>
  );
}
