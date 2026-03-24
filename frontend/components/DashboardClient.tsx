"use client";
// DeckGL removed — it crashes on both WebGPU (maxTextureDimension2D) and MapLibre
// (map.getProjection() is Mapbox-only). Replaced with a pure MapLibre heatmap +
// circle layer which needs no WebGPU and has zero compatibility issues.

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { AlertCircle, CheckCircle2, Clock, AlertTriangle, Layers, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ProjectNode {
    id: string;
    title: string;
    division: string;
    lng: number;
    lat: number;
    authority: string;
    status: string;
    budget: number;
}

const DIVISIONS = [
    "All Divisions",
    "Lucknow Division", "Kanpur Division", "Varanasi Division", "Agra Division",
    "Meerut Division", "Gorakhpur Division", "Azamgarh Division",
    "Bareilly Division", "Moradabad Division", "Saharanpur Division",
    "Jhansi Division", "Chitrakoot Division", "Devipatan Division",
    "Ayodhya Division", "Mirzapur Division", "Basti Division", "Prayagraj Division"
];

// Seeded deterministic LCG — avoids Math.random() hydration mismatches.
function seededRandom(seed: number) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

const rng = seededRandom(42);
const MOCK_DATA: ProjectNode[] = Array.from({ length: 400 }).map((_, i) => {
    const isLucknow = i < 80;
    const divIndex = isLucknow ? 1 : Math.floor(rng() * (DIVISIONS.length - 1)) + 1;
    const division = DIVISIONS[divIndex];
    const lng = division === "Lucknow Division" ? 80.8 + rng() * 0.3 : 77.5 + rng() * 6.5;
    const lat = division === "Lucknow Division" ? 26.7 + rng() * 0.3 : 24.8 + rng() * 5.0;
    const authority = (i % 4 === 0 && division === "Lucknow Division") ? 'Smart City Lucknow' : 'PWD_UP';
    const status = rng() > 0.7 ? "Delayed" : "Active";
    return { id: `PRJ-${i}`, title: `Infrastructure Node ${i}`, division, lng, lat, authority, status, budget: Math.floor(rng() * 100) + 10 };
});

const complaintsRng = seededRandom(99);
const COMPLAINTS = Array.from({ length: 25 }).map((_, i) => ({
    id: `CPL-${i}`,
    division: DIVISIONS[Math.floor(complaintsRng() * (DIVISIONS.length - 1)) + 1],
    authority: (i % 3 === 0) ? 'Smart City Lucknow' : 'NHAI',
    issue: ["Pothole Hazard", "Delayed Work", "Water Logging", "No Safety Guards"][i % 4],
    date: "2026-03-22",
}));

// ─── MapLibre Heatmap Panel ───────────────────────────────────────────────────
function DashboardMap({ data, selectedDivision }: { data: ProjectNode[]; selectedDivision: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const popupRef = useRef<maplibregl.Popup | null>(null);

    // Build a stable GeoJSON FeatureCollection from filtered data
    const geojson = useMemo<GeoJSON.FeatureCollection>(() => ({
        type: 'FeatureCollection',
        features: data.map(d => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
            properties: {
                id: d.id, title: d.title, division: d.division,
                authority: d.authority, status: d.status, budget: d.budget,
                isSmartCity: d.authority === 'Smart City Lucknow' ? 1 : 0,
            },
        })),
    }), [data]);

    // Mount map once
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;
        const map = new maplibregl.Map({
            container: containerRef.current,
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            center: [80.9462, 26.8467],
            zoom: 5.5,
            pitch: 30,
            bearing: -10,
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

        map.on('load', () => {
            map.addSource('projects', { type: 'geojson', data: geojson });

            // Heatmap layer
            map.addLayer({
                id: 'projects-heat',
                type: 'heatmap',
                source: 'projects',
                maxzoom: 9,
                paint: {
                    'heatmap-weight': 1,
                    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
                    'heatmap-color': [
                        'interpolate', ['linear'], ['heatmap-density'],
                        0, 'rgba(254,240,217,0)',
                        0.2, 'rgba(253,204,138,0.6)',
                        0.4, 'rgba(252,141,89,0.8)',
                        0.6, 'rgba(227,74,51,0.9)',
                        1, 'rgba(179,0,0,1)',
                    ],
                    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 20, 9, 40],
                    'heatmap-opacity': 0.85,
                },
            });

            // Circle layer (visible at higher zoom)
            map.addLayer({
                id: 'projects-point',
                type: 'circle',
                source: 'projects',
                minzoom: 7,
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 4, 14, 10],
                    'circle-color': [
                        'case',
                        ['==', ['get', 'isSmartCity'], 1], '#ff6600',
                        '#0096ff',
                    ],
                    'circle-opacity': 0.85,
                    'circle-stroke-color': '#fff',
                    'circle-stroke-width': 1.2,
                },
            });

            // Click popup
            map.on('click', 'projects-point', (e) => {
                const feat = e.features?.[0];
                if (!feat) return;
                const { title, authority, status, budget, division } = feat.properties as Record<string, string>;
                const coords = (feat.geometry as GeoJSON.Point).coordinates as [number, number];
                if (popupRef.current) popupRef.current.remove();
                popupRef.current = new maplibregl.Popup({ offset: 12, closeButton: true, className: 'dash-popup' })
                    .setLngLat(coords)
                    .setHTML(`
                        <div style="font-family:sans-serif;min-width:180px;padding:4px 0">
                            <div style="font-size:13px;font-weight:800;color:#f8fafc;margin-bottom:8px;line-height:1.3">${title}</div>
                            <table style="width:100%;font-size:11px;border-collapse:collapse">
                                <tr><td style="color:#94a3b8;padding:2px 0;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Status</td><td style="color:${status === 'Active' ? '#10b981' : '#f59e0b'};font-weight:800">${status}</td></tr>
                                <tr><td style="color:#94a3b8;padding:2px 0;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Authority</td><td style="color:#e2e8f0;font-weight:600">${authority}</td></tr>
                                <tr><td style="color:#94a3b8;padding:2px 0;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Budget</td><td style="color:#e2e8f0;font-weight:600">₹${budget} Cr</td></tr>
                                <tr><td style="color:#94a3b8;padding:2px 0;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Division</td><td style="color:#e2e8f0;font-weight:600">${division}</td></tr>
                            </table>
                        </div>`)
                    .addTo(map);
            });
            map.on('mouseenter', 'projects-point', () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', 'projects-point', () => { map.getCanvas().style.cursor = ''; });
        });

        return () => { map.remove(); mapRef.current = null; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update source data when filter changes
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;
        const src = map.getSource('projects') as maplibregl.GeoJSONSource | undefined;
        if (src) src.setData(geojson);
    }, [geojson]);

    // Fly to division center when filter changes
    const DIVISION_CENTERS: Record<string, [number, number]> = {
        'Lucknow Division': [80.9462, 26.8467],
        'Kanpur Division': [80.3319, 26.4499],
        'Varanasi Division': [82.9739, 25.3176],
        'Agra Division': [78.0081, 27.1767],
        'Prayagraj Division': [81.8463, 25.4358],
        'Meerut Division': [77.7064, 28.9845],
        'Gorakhpur Division': [83.3732, 26.7606],
    };

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (selectedDivision === 'All Divisions') {
            map.flyTo({ center: [80.9462, 26.8467], zoom: 5.5, essential: true });
        } else if (DIVISION_CENTERS[selectedDivision]) {
            map.flyTo({ center: DIVISION_CENTERS[selectedDivision], zoom: 8, essential: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDivision]);

    return (
        <div className="relative w-full h-full">
            <div ref={containerRef} className="absolute inset-0 rounded-2xl" />
            <div className="absolute top-4 left-4 pointer-events-none bg-black/60 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 shadow-2xl z-10">
                <h3 className="text-white font-bold text-sm uppercase tracking-widest">Heatmap Density</h3>
                <p className="text-white/70 text-xs font-semibold mt-1">Infrastructure spread — {selectedDivision}</p>
            </div>
        </div>
    );
}

// ─── Main Dashboard Component ─────────────────────────────────────────────────
export default function Dashboard() {
    const [selectedDivision, setSelectedDivision] = useState("All Divisions");

    const filteredData = useMemo(() => {
        if (selectedDivision === "All Divisions") return MOCK_DATA;
        return MOCK_DATA.filter(d => d.division === selectedDivision);
    }, [selectedDivision]);

    const filteredComplaints = useMemo(() => {
        if (selectedDivision === "All Divisions") return COMPLAINTS;
        return COMPLAINTS.filter(c => c.division === selectedDivision);
    }, [selectedDivision]);

    const totalProjects = filteredData.length;
    const delayedProjects = filteredData.filter(d => d.status === "Delayed").length;
    const totalBudget = filteredData.reduce((acc, curr) => acc + curr.budget, 0);

    const chartData = [
        { name: 'Roads',  Active: Math.floor(totalProjects * 0.4), Delayed: Math.floor(delayedProjects * 0.4) },
        { name: 'Water',  Active: Math.floor(totalProjects * 0.3), Delayed: Math.floor(delayedProjects * 0.3) },
        { name: 'Power',  Active: Math.floor(totalProjects * 0.3), Delayed: Math.floor(delayedProjects * 0.3) },
    ];

    const smartCityBadge = (
        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase font-black tracking-widest bg-[#FF6600] text-white whitespace-nowrap shadow-md shadow-[#FF6600]/30 border border-[#FF6600]/50">
            Smart Cities Mission
        </span>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col font-sans">

            {/* Header */}
            <header className="bg-white dark:bg-slate-800 shadow-sm px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 z-10 relative">
                <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="https://upload.wikimedia.org/wikipedia/commons/e/e9/Seal_of_Uttar_Pradesh.svg" alt="UP Seal" className="w-12 h-12" />
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">Uttar Pradesh Infrastructure Monitor</h1>
                        <h2 className="text-sm font-bold text-slate-500 leading-tight">उत्तर प्रदेश इन्फ्रास्ट्रक्चर मॉनिटर</h2>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-sm font-bold transition-colors">
                        <ArrowLeft size={16} /> Map
                    </Link>
                    <span className="text-sm font-semibold text-slate-500 uppercase tracking-widest hidden sm:inline">Division:</span>
                    <select
                        value={selectedDivision}
                        onChange={(e) => setSelectedDivision(e.target.value)}
                        className="bg-slate-100 dark:bg-slate-700/50 outline-none border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-2 font-semibold shadow-sm text-sm min-w-[180px]"
                    >
                        {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
            </header>

            <main className="flex-1 p-6 flex flex-col xl:flex-row gap-6 h-[calc(100vh-80px)] overflow-hidden">

                {/* Left Panel */}
                <div className="w-full xl:w-5/12 flex flex-col gap-6 overflow-y-auto pr-2 pb-6">

                    {/* KPIs */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Projects</p>
                                    <h3 className="text-3xl font-black text-slate-800 dark:text-white">{totalProjects}</h3>
                                </div>
                                <Layers className="text-blue-500 opacity-80" size={24} />
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Delayed Warn</p>
                                    <h3 className="text-3xl font-black text-amber-500">{delayedProjects}</h3>
                                </div>
                                <AlertTriangle className="text-amber-500 opacity-80" size={24} />
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">Verified Issues</p>
                                    <h3 className="text-3xl font-black text-rose-500">{filteredComplaints.length}</h3>
                                </div>
                                <AlertCircle className="text-rose-500 opacity-80" size={24} />
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">Total CapEx</p>
                                    <h3 className="text-3xl font-black text-emerald-500">₹{totalBudget}Cr</h3>
                                </div>
                                <CheckCircle2 className="text-emerald-500 opacity-80" size={24} />
                            </div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 h-72 shrink-0">
                        <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-4 tracking-wide uppercase">Project Pipeline Forecast</h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#1e293b', color: '#fff' }} />
                                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                                <Bar dataKey="Active" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Delayed" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Complaints Queue */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex-1 overflow-hidden flex flex-col shrink-0 min-h-[300px]">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 sticky top-0">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-wide flex items-center gap-2 uppercase">
                                <Clock size={16} className="text-rose-500" /> Live Citizen Incident Queue
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                            {filteredComplaints.length === 0 ? (
                                <p className="text-center text-slate-400 mt-10 text-sm font-semibold">No issues flagged in {selectedDivision}.</p>
                            ) : filteredComplaints.map(c => (
                                <div key={c.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400 tracking-wider uppercase bg-rose-100 dark:bg-rose-500/20 px-2 py-0.5 rounded">{c.id}</span>
                                        <span className="text-xs text-slate-400 font-medium">{c.date}</span>
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white leading-tight mb-2 flex flex-wrap items-center gap-2">
                                        {c.issue}
                                        {c.authority === 'Smart City Lucknow' && smartCityBadge}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-widest flex items-center gap-2">
                                        <span>Auth: {c.authority}</span> • <span>{c.division}</span>
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Panel: MapLibre Heatmap */}
                <div className="w-full xl:w-7/12 bg-slate-800 rounded-2xl overflow-hidden shadow-inner relative min-h-[500px] border border-slate-200 dark:border-slate-700">
                    <DashboardMap data={filteredData} selectedDivision={selectedDivision} />
                </div>

            </main>
        </div>
    );
}
