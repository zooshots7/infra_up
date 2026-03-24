"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Carto's glyph server returns PBF type 4 which MapLibre 5.x can't parse.
// Fetch the style and replace glyphs URL with free demotiles server.
const GLYPH_URL = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';
async function patchedStyle(): Promise<object> {
  const res = await fetch('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json');
  const style = await res.json();
  style.glyphs = GLYPH_URL;
  return style;
}
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  AlertCircle, CheckCircle2, Clock, AlertTriangle,
  Layers, ArrowLeft, TrendingUp, IndianRupee,
  Activity, Building2, Droplets, Zap,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProjectNode {
  id: string; title: string; division: string;
  lng: number; lat: number; authority: string;
  status: string; budget: number; type: string;
}
interface Complaint {
  id: string; division: string; authority: string;
  issue: string; date: string; severity: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DIVISIONS = [
  "All Divisions",
  "Lucknow Division","Kanpur Division","Varanasi Division","Agra Division",
  "Meerut Division","Gorakhpur Division","Azamgarh Division","Bareilly Division",
  "Moradabad Division","Saharanpur Division","Jhansi Division","Chitrakoot Division",
  "Devipatan Division","Ayodhya Division","Mirzapur Division","Basti Division","Prayagraj Division"
];

const TYPES = ['ROAD','UTILITY','CONSTRUCTION'];
const AUTHORITIES = ['Smart City Lucknow','PWD_UP','NHAI','LDA','LMC','Jal Nigam'];

// ─── Seeded random (avoids SSR hydration mismatch) ───────────────────────────
function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

const rng = seededRng(42);
const MOCK_DATA: ProjectNode[] = Array.from({ length: 400 }).map((_, i) => {
  const isLucknow = i < 80;
  const div = isLucknow ? "Lucknow Division" : DIVISIONS[Math.floor(rng() * (DIVISIONS.length - 1)) + 1];
  const lng = div === "Lucknow Division" ? 80.8 + rng() * 0.3 : 77.5 + rng() * 6.5;
  const lat = div === "Lucknow Division" ? 26.7 + rng() * 0.3 : 24.8 + rng() * 5.0;
  const auth = AUTHORITIES[Math.floor(rng() * AUTHORITIES.length)];
  const type = TYPES[Math.floor(rng() * TYPES.length)];
  const status = rng() > 0.7 ? "Delayed" : "Active";
  return { id:`PRJ-${i}`, title:`Infrastructure Node ${i}`, division:div, lng, lat, authority:auth, status, budget:Math.floor(rng()*180)+10, type };
});

const crng = seededRng(99);
const COMPLAINTS: Complaint[] = Array.from({ length: 30 }).map((_, i) => ({
  id: `CPL-${String(i).padStart(3,'0')}`,
  division: DIVISIONS[Math.floor(crng() * (DIVISIONS.length - 1)) + 1],
  authority: AUTHORITIES[Math.floor(crng() * AUTHORITIES.length)],
  issue: ["Pothole Hazard","Delayed Work","Water Logging","No Safety Guards","Road Cave-in","Missing Barriers"][i % 6],
  date: `2026-03-${String(Math.floor(crng()*22)+1).padStart(2,'0')}`,
  severity: crng() > 0.6 ? "High" : crng() > 0.3 ? "Medium" : "Low",
}));

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, color }: { label:string; value:string|number; sub?:string; icon:React.ReactNode; color:string }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-black uppercase tracking-widest ${color}`}>{label}</p>
        <div className={`p-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 ${color}`}>{icon}</div>
      </div>
      <div>
        <p className={`text-3xl font-black tracking-tight ${color}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 font-semibold mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Map Panel ────────────────────────────────────────────────────────────────
const DIVISION_CENTERS: Record<string, [number, number]> = {
  'Lucknow Division':[80.9462,26.8467],'Kanpur Division':[80.3319,26.4499],
  'Varanasi Division':[82.9739,25.3176],'Agra Division':[78.0081,27.1767],
  'Prayagraj Division':[81.8463,25.4358],'Meerut Division':[77.7064,28.9845],
  'Gorakhpur Division':[83.3732,26.7606],'Bareilly Division':[79.4304,28.3670],
  'Ayodhya Division':[81.9771,26.7922],
};

function DashboardMap({ data, division }: { data: ProjectNode[]; division: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const geojson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type:'FeatureCollection',
    features: data.map(d => ({
      type:'Feature',
      geometry:{ type:'Point', coordinates:[d.lng, d.lat] },
      properties:{ ...d },
    })),
  }), [data]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    patchedStyle().then(style => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: style as maplibregl.StyleSpecification,
      center:[80.9462,26.8467], zoom:5.2, pitch:25,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass:false }), 'bottom-right');

    map.on('load', () => {
      map.addSource('pts', { type:'geojson', data:geojson });

      map.addLayer({ id:'heat', type:'heatmap', source:'pts', maxzoom:10,
        paint:{
          'heatmap-weight':1,
          'heatmap-intensity':['interpolate',['linear'],['zoom'],0,1,9,4],
          'heatmap-color':['interpolate',['linear'],['heatmap-density'],
            0,'rgba(99,102,241,0)',0.15,'rgba(139,92,246,0.5)',
            0.4,'rgba(59,130,246,0.8)',0.7,'rgba(16,185,129,0.9)',1,'rgba(245,158,11,1)'],
          'heatmap-radius':['interpolate',['linear'],['zoom'],0,18,9,40],
          'heatmap-opacity':0.9,
        },
      });

      map.addLayer({ id:'circles', type:'circle', source:'pts', minzoom:7,
        paint:{
          'circle-radius':['interpolate',['linear'],['zoom'],7,3,14,10],
          'circle-color':['match',['get','type'],
            'ROAD','#3b82f6','UTILITY','#a855f7','CONSTRUCTION','#f97316','#94a3b8'],
          'circle-opacity':0.9,
          'circle-stroke-color':'rgba(255,255,255,0.8)',
          'circle-stroke-width':1,
        },
      });

      const popup = new maplibregl.Popup({ offset:14, closeButton:false });
      map.on('mouseenter','circles',(e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0]; if(!f) return;
        const p = f.properties as Record<string,string>;
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number,number];
        const severityColor = p.status === 'Active' ? '#10b981' : '#f59e0b';
        popup.setLngLat(coords).setHTML(`
          <div style="font:600 12px/1.5 system-ui;min-width:160px;padding:2px 0">
            <div style="font-size:11px;font-weight:800;color:#f8fafc;margin-bottom:6px">${p.title}</div>
            <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px">
              <span style="color:#64748b;text-transform:uppercase;letter-spacing:.06em">Type</span><span style="color:#e2e8f0">${p.type}</span>
              <span style="color:#64748b;text-transform:uppercase;letter-spacing:.06em">Status</span><span style="color:${severityColor};font-weight:800">${p.status}</span>
              <span style="color:#64748b;text-transform:uppercase;letter-spacing:.06em">Budget</span><span style="color:#e2e8f0">₹${p.budget} Cr</span>
              <span style="color:#64748b;text-transform:uppercase;letter-spacing:.06em">Auth</span><span style="color:#e2e8f0">${p.authority}</span>
            </div>
          </div>`).addTo(map);
      });
      map.on('mouseleave','circles',() => { map.getCanvas().style.cursor=''; popup.remove(); });
    });
    return () => { map.remove(); mapRef.current = null; };
    }); // end patchedStyle().then()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current; if(!map || !map.isStyleLoaded()) return;
    const src = map.getSource('pts') as maplibregl.GeoJSONSource|undefined;
    src?.setData(geojson);
  }, [geojson]);

  useEffect(() => {
    const map = mapRef.current; if(!map) return;
    if(division === 'All Divisions') map.flyTo({ center:[80.9462,26.8467], zoom:5.2, essential:true });
    else if(DIVISION_CENTERS[division]) map.flyTo({ center:DIVISION_CENTERS[division], zoom:8.5, essential:true });
  }, [division]);

  // Legend
  const legend = [
    { color:'#3b82f6', label:'Road' },
    { color:'#a855f7', label:'Utility' },
    { color:'#f97316', label:'Construction' },
  ];

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <div ref={ref} className="absolute inset-0" />
      {/* Gradient overlay top */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-slate-900/60 to-transparent pointer-events-none z-10" />
      <div className="absolute top-4 left-4 z-20 pointer-events-none">
        <h3 className="text-white font-black text-sm uppercase tracking-widest drop-shadow-lg">Live Density Map</h3>
        <p className="text-white/60 text-[11px] font-semibold mt-0.5">{data.length} projects · {division}</p>
      </div>
      {/* Legend */}
      <div className="absolute bottom-12 left-4 z-20 bg-slate-900/80 backdrop-blur-md rounded-xl px-3 py-2 flex flex-col gap-1.5 border border-white/10">
        {legend.map(l => (
          <div key={l.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background:l.color }} />
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [division, setDivision] = useState("All Divisions");
  const [activeTab, setActiveTab] = useState<'incidents'|'analytics'>('incidents');

  const data = useMemo(() => division === "All Divisions" ? MOCK_DATA : MOCK_DATA.filter(d => d.division === division), [division]);
  const complaints = useMemo(() => division === "All Divisions" ? COMPLAINTS : COMPLAINTS.filter(c => c.division === division), [division]);

  const total = data.length;
  const delayed = data.filter(d => d.status === "Delayed").length;
  const active = data.filter(d => d.status === "Active").length;
  const budget = data.reduce((a,c) => a+c.budget, 0);

  const typeBreakdown = TYPES.map(t => ({ name:t, value: data.filter(d => d.type === t).length }));
  const TYPE_COLORS: Record<string,string> = { ROAD:'#3b82f6', UTILITY:'#a855f7', CONSTRUCTION:'#f97316' };

  const authorityData = AUTHORITIES.map(a => ({
    name: a.replace(' Division','').replace(' Lucknow','').replace('Smart City ','SC '),
    Active: data.filter(d => d.authority===a && d.status==='Active').length,
    Delayed: data.filter(d => d.authority===a && d.status==='Delayed').length,
  })).filter(a => a.Active + a.Delayed > 0);

  const severityCount = { High: complaints.filter(c=>c.severity==='High').length, Medium: complaints.filter(c=>c.severity==='Medium').length, Low: complaints.filter(c=>c.severity==='Low').length };

  const severityColor = (s: string) => s === 'High' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : s === 'Medium' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">

      {/* ── Header ── */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between z-20 relative">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://upload.wikimedia.org/wikipedia/commons/e/e9/Seal_of_Uttar_Pradesh.svg" alt="UP" className="w-10 h-10 opacity-90" />
          <div>
            <h1 className="text-base font-black tracking-tight text-white leading-tight">UP Infrastructure Intelligence</h1>
            <p className="text-[11px] text-slate-400 font-semibold tracking-wide">उत्तर प्रदेश इन्फ्रास्ट्रक्चर मॉनिटर · Real-time Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold transition-colors text-slate-300">
            <ArrowLeft size={14} /> Map View
          </Link>
          <select
            value={division}
            onChange={e => setDivision(e.target.value)}
            className="bg-slate-800 outline-none border border-slate-700 rounded-xl px-4 py-2 font-bold shadow-sm text-sm text-slate-200 min-w-[180px] focus:border-blue-500 transition-colors cursor-pointer"
          >
            {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </header>

      <main className="flex-1 flex flex-col xl:flex-row overflow-hidden">

        {/* ── Left Panel ── */}
        <div className="w-full xl:w-[480px] flex flex-col gap-0 overflow-y-auto border-r border-slate-800 bg-slate-900">

          {/* KPIs */}
          <div className="p-5 grid grid-cols-2 gap-3 border-b border-slate-800">
            <KpiCard label="Total Projects" value={total} icon={<Layers size={16}/>} color="text-blue-400" sub={`${active} active`} />
            <KpiCard label="Delayed" value={delayed} icon={<AlertTriangle size={16}/>} color="text-amber-400" sub={`${Math.round(delayed/total*100)||0}% of total`} />
            <KpiCard label="Incidents" value={complaints.length} icon={<AlertCircle size={16}/>} color="text-rose-400" sub={`${severityCount.High} high severity`} />
            <KpiCard label="CapEx" value={`₹${(budget/100).toFixed(0)}Cr`} icon={<IndianRupee size={16}/>} color="text-emerald-400" sub="total deployment" />
          </div>

          {/* Type Breakdown */}
          <div className="p-5 border-b border-slate-800">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Activity size={12}/> Project Type Breakdown</p>
            <div className="flex items-center gap-4">
              <div className="w-28 h-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={typeBreakdown} cx="50%" cy="50%" innerRadius={26} outerRadius={48} paddingAngle={3} dataKey="value">
                      {typeBreakdown.map(t => <Cell key={t.name} fill={TYPE_COLORS[t.name]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {typeBreakdown.map(t => (
                  <div key={t.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background:TYPE_COLORS[t.name] }}/>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                        {t.name === 'ROAD' ? <><Building2 size={10} className="inline mr-1"/>Road</> : t.name === 'UTILITY' ? <><Droplets size={10} className="inline mr-1"/>Utility</> : <><Zap size={10} className="inline mr-1"/>Construction</>}
                      </span>
                    </div>
                    <span className="text-xs font-black text-slate-200">{t.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Authority Chart */}
          <div className="p-5 border-b border-slate-800">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><TrendingUp size={12}/> Authority Breakdown</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={authorityData} layout="vertical" margin={{ left:8, right:16, top:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="2 2" horizontal={false} stroke="#1e293b"/>
                  <XAxis type="number" tick={{ fontSize:10, fill:'#64748b' }} axisLine={false} tickLine={false}/>
                  <YAxis type="category" dataKey="name" tick={{ fontSize:10, fill:'#94a3b8', fontWeight:700 }} axisLine={false} tickLine={false} width={52}/>
                  <RechartsTooltip contentStyle={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:8, fontSize:12 }} cursor={{ fill:'rgba(255,255,255,0.03)' }}/>
                  <Bar dataKey="Active" fill="#3b82f6" radius={[0,3,3,0]} stackId="a"/>
                  <Bar dataKey="Delayed" fill="#f59e0b" radius={[0,3,3,0]} stackId="a"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-800">
            {(['incidents','analytics'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors ${activeTab===tab ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}>
                {tab === 'incidents' ? `🚨 Incidents (${complaints.length})` : '📊 Analytics'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'incidents' ? (
              <div className="flex flex-col gap-2">
                {complaints.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                    <CheckCircle2 size={32} className="mb-2 text-emerald-600"/>
                    <p className="font-bold text-sm">No incidents in {division}</p>
                  </div>
                ) : complaints.map(c => (
                  <div key={c.id} className="p-3.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase">{c.id}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${severityColor(c.severity)}`}>{c.severity}</span>
                        <span className="text-[10px] text-slate-600 font-medium">{c.date}</span>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-slate-200 mb-1.5">{c.issue}</p>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{c.authority} · {c.division}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-2">
                  {[['High',severityCount.High,'rose'],['Medium',severityCount.Medium,'amber'],['Low',severityCount.Low,'emerald']].map(([s,v,c]) => (
                    <div key={s as string} className={`rounded-xl p-3 border bg-${c}-500/5 border-${c}-500/20 text-center`}>
                      <p className={`text-2xl font-black text-${c}-400`}>{v}</p>
                      <p className={`text-[10px] font-black text-${c}-500/70 uppercase tracking-wider mt-0.5`}>{s}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Status Split</p>
                  <div className="flex gap-2 items-center mb-2">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width:`${Math.round(active/total*100)||0}%`, flex:'none' }}/>
                    <div className="h-2 rounded-full bg-amber-500" style={{ width:`${Math.round(delayed/total*100)||0}%`, flex:'none' }}/>
                  </div>
                  <div className="flex gap-4 text-xs font-bold">
                    <span className="text-blue-400">● Active {active}</span>
                    <span className="text-amber-400">● Delayed {delayed}</span>
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Top Issues</p>
                  {['Pothole Hazard','Delayed Work','Water Logging','No Safety Guards'].map(issue => {
                    const count = complaints.filter(c => c.issue === issue).length;
                    const pct = complaints.length ? Math.round(count/complaints.length*100) : 0;
                    return (
                      <div key={issue} className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] text-slate-400 font-semibold w-28 shrink-0">{issue}</span>
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width:`${pct}%` }}/>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 w-6 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel: Map ── */}
        <div className="flex-1 min-h-[500px] xl:min-h-0 relative">
          <DashboardMap data={data} division={division} />
        </div>

      </main>
    </div>
  );
}
