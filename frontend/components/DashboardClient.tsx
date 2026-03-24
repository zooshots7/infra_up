"use client";
// FIX: This component uses DeckGL (WebGL/WebGPU) and Math.random() at module level.
// It must never run on the server — imported only via dynamic({ ssr: false }).

import React, { useState, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { HexagonLayer, ScatterplotLayer } from 'deck.gl';
import { Map } from 'react-map-gl/maplibre';
import "maplibre-gl/dist/maplibre-gl.css";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { AlertCircle, CheckCircle2, Clock, AlertTriangle, Layers } from 'lucide-react';

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

interface HoverInfo {
    x: number;
    y: number;
    object: ProjectNode;
}

const DIVISIONS = [
    "All Divisions",
    "Lucknow Division", "Kanpur Division", "Varanasi Division", "Agra Division", 
    "Meerut Division", "Gorakhpur Division", "Azamgarh Division", 
    "Bareilly Division", "Moradabad Division", "Saharanpur Division", 
    "Jhansi Division", "Chitrakoot Division", "Devipatan Division", 
    "Ayodhya Division", "Mirzapur Division", "Basti Division", "Prayagraj Division"
];

// FIX hydration: use a seeded deterministic generator instead of Math.random() at
// module level. Math.random() produces different values on server vs client, causing
// React hydration mismatches. A simple LCG seeded with a constant is stable across renders.
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

    return {
        id: `PRJ-${i}`,
        title: `Infrastructure Node ${i}`,
        division,
        lng,
        lat,
        authority,
        status,
        budget: Math.floor(rng() * 100) + 10,
    };
});

const complaintsRng = seededRandom(99);

const COMPLAINTS = Array.from({ length: 25 }).map((_, i) => ({
    id: `CPL-${i}`,
    division: DIVISIONS[Math.floor(complaintsRng() * (DIVISIONS.length - 1)) + 1],
    authority: (i % 3 === 0) ? 'Smart City Lucknow' : 'NHAI',
    issue: ["Pothole Hazard", "Delayed Work", "Water Logging", "No Safety Guards"][i % 4],
    date: "2026-03-22",
}));

export default function Dashboard() {
    const [selectedDivision, setSelectedDivision] = useState("All Divisions");
    const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

    const filteredData = useMemo(() => {
        if (selectedDivision === "All Divisions") return MOCK_DATA;
        return MOCK_DATA.filter(d => d.division === selectedDivision);
    }, [selectedDivision]);

    const filteredComplaints = useMemo(() => {
        if (selectedDivision === "All Divisions") return COMPLAINTS;
        return COMPLAINTS.filter(c => c.division === selectedDivision);
    }, [selectedDivision]);

    // KPI Metrics
    const totalProjects = filteredData.length;
    const delayedProjects = filteredData.filter(d => d.status === "Delayed").length;
    const totalBudget = filteredData.reduce((acc, curr) => acc + curr.budget, 0);

    // Chart Data
    const chartData = [
        { name: 'Roads', Active: Math.floor(totalProjects * 0.4), Delayed: Math.floor(delayedProjects * 0.4) },
        { name: 'Water', Active: Math.floor(totalProjects * 0.3), Delayed: Math.floor(delayedProjects * 0.3) },
        { name: 'Power', Active: Math.floor(totalProjects * 0.3), Delayed: Math.floor(delayedProjects * 0.3) },
    ];

    const layers = [
        new HexagonLayer<ProjectNode>({
            id: 'heatmap',
            data: filteredData,
            getPosition: (d: ProjectNode) => [d.lng, d.lat],
            radius: 4000,
            elevationScale: 50,
            extruded: true,
            colorRange: [
                [254, 240, 217],
                [253, 204, 138],
                [252, 141, 89],
                [227, 74, 51],
                [179, 0, 0]
            ],
            opacity: 0.8,
            pickable: true
        }),
        new ScatterplotLayer<ProjectNode>({
            id: 'points',
            data: filteredData,
            getPosition: (d: ProjectNode) => [d.lng, d.lat],
            getFillColor: (d: ProjectNode) => d.authority === 'Smart City Lucknow' ? [255, 102, 0, 255] : [0, 150, 255, 150],
            getRadius: 3000,
            pickable: true,
            onHover: (info: unknown) => setHoverInfo(info as HoverInfo)
        })
    ];

    const smartCityBadge = (
        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase font-black tracking-widest bg-[#FF6600] text-white whitespace-nowrap shadow-md shadow-[#FF6600]/30 border border-[#FF6600]/50">
            Smart Cities Mission
        </span>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col font-sans">
            
            {/* Header Branding */}
            <header className="bg-white dark:bg-slate-800 shadow-sm px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 z-10 relative">
                <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                        src="https://upload.wikimedia.org/wikipedia/commons/e/e9/Seal_of_Uttar_Pradesh.svg" 
                        alt="UP Government Emblem" 
                        className="w-12 h-12"
                    />
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">Uttar Pradesh Infrastructure Monitor</h1>
                        <h2 className="text-sm font-bold text-slate-500 font-noto-deva leading-tight">उत्तर प्रदेश इन्फ्रास्ट्रक्चर मॉनिटर</h2>
                    </div>
                </div>
                
                {/* UP Division Filter */}
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Division:</span>
                    <select 
                        value={selectedDivision}
                        onChange={(e) => setSelectedDivision(e.target.value)}
                        className="bg-slate-100 dark:bg-slate-700/50 outline-none border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-2 font-semibold shadow-sm text-sm min-w-[200px]"
                    >
                        {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
            </header>

            <main className="flex-1 p-6 flex flex-col xl:flex-row gap-6 h-[calc(100vh-80px)] overflow-hidden">
                
                {/* Left Panel: Stats & Queue */}
                <div className="w-full xl:w-5/12 flex flex-col gap-6 overflow-y-auto pr-2 pb-6">
                    
                    {/* KPIs */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Projects</p>
                                    <h3 className="text-3xl font-black text-slate-800 dark:text-white">{totalProjects}</h3>
                                </div>
                                <Layers className="text-blue-500 opacity-80" size={24}/>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Delayed Warn</p>
                                    <h3 className="text-3xl font-black text-amber-500">{delayedProjects}</h3>
                                </div>
                                <AlertTriangle className="text-amber-500 opacity-80" size={24}/>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">Verified Issues</p>
                                    <h3 className="text-3xl font-black text-rose-500">{filteredComplaints.length}</h3>
                                </div>
                                <AlertCircle className="text-rose-500 opacity-80" size={24}/>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">Total CapEx</p>
                                    <h3 className="text-3xl font-black text-emerald-500">₹{totalBudget}Cr</h3>
                                </div>
                                <CheckCircle2 className="text-emerald-500 opacity-80" size={24}/>
                            </div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 h-72 shrink-0">
                        <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-4 tracking-wide uppercase">Project Pipeline Forecast</h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2}/>
                                <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false}/>
                                <YAxis tick={{fontSize: 12}} axisLine={false} tickLine={false}/>
                                <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#1e293b', color: '#fff'}}/>
                                <Legend wrapperStyle={{fontSize: '12px', fontWeight: 'bold'}}/>
                                <Bar dataKey="Active" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Delayed" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Complaints Queue */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex-1 overflow-hidden flex flex-col shrink-0 min-h-[300px]">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 sticky top-0">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-wide flex items-center gap-2 uppercase">
                                <Clock size={16} className="text-rose-500"/> Live Citizen Incident Queue
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

                {/* Right Panel: DeckGL Choropleth */}
                <div className="w-full xl:w-7/12 bg-slate-200 dark:bg-slate-800 rounded-2xl overflow-hidden shadow-inner relative min-h-[500px] border border-slate-200 dark:border-slate-700 z-0">
                    <DeckGL
                        initialViewState={{
                            longitude: 80.9462,
                            latitude: 26.8467,
                            zoom: 5.5,
                            pitch: 45,
                            bearing: -10
                        }}
                        controller={true}
                        layers={layers}
                    >
                        <Map 
                            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                        />
                    </DeckGL>
                    
                    {/* Tooltip */}
                    {hoverInfo && hoverInfo.object && (
                        <div 
                            className="absolute bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-2xl text-xs pointer-events-none z-50 transform -translate-x-1/2 -translate-y-[calc(100%+15px)] min-w-[200px]"
                            style={{ left: hoverInfo.x, top: hoverInfo.y }}
                        >
                            <h4 className="font-bold text-sm text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                                {hoverInfo.object.title}
                                {hoverInfo.object.authority === 'Smart City Lucknow' && smartCityBadge}
                            </h4>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-slate-600 dark:text-slate-300 mt-3 border-t border-slate-100 dark:border-slate-700 pt-2">
                                <span className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Status:</span>
                                <span className={hoverInfo.object.status === 'Active' ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>{hoverInfo.object.status}</span>
                                <span className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Budget:</span>
                                <span>₹{hoverInfo.object.budget} Cr</span>
                                <span className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Authority:</span>
                                <span>{hoverInfo.object.authority}</span>
                                <span className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Division:</span>
                                <span>{hoverInfo.object.division}</span>
                            </div>
                            
                            {/* Connector Triangle */}
                            <div className="absolute w-4 h-4 bg-white dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 transform rotate-45 left-1/2 -bottom-2 -translate-x-1/2"></div>
                        </div>
                    )}

                    {/* Overlay Title */}
                    <div className="absolute top-5 left-5 pointer-events-none bg-black/60 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 shadow-2xl">
                        <h3 className="text-white font-bold text-sm uppercase tracking-widest">Hexagon Density Heatmap</h3>
                        <p className="text-white/70 text-xs font-semibold mt-1">Live deployment spread across ({selectedDivision})</p>
                    </div>
                </div>

            </main>
        </div>
    );
}
