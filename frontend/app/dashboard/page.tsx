"use client";
// Next.js App Router: dynamic({ ssr: false }) requires a Client Component wrapper.
import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("@/components/DashboardClient"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white font-bold tracking-widest uppercase text-sm animate-pulse">
          Loading Dashboard...
        </p>
      </div>
    </div>
  ),
});

export default function DashboardPage() {
  return <Dashboard />;
}
