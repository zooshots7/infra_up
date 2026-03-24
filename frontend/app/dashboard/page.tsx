// FIX: DeckGL accesses WebGL/WebGPU (maxTextureDimension2D) on import, which crashes
// during SSR because the server has no GPU context. Math.random() at module level in
// the dashboard component also caused React hydration mismatches.
// Solution: dynamic import with ssr: false — the dashboard only ever runs client-side.
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
