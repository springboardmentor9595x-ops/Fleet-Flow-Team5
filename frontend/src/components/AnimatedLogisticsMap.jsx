import React, { useState, useEffect } from "react";
import { Navigation, Truck, MapPin, Play, Pause, FastForward, ShieldAlert, CheckCircle2, Zap, Compass, Activity, Thermometer, Wind } from "lucide-react";

const routesData = [
  {
    id: "route-1",
    name: "Express North Line",
    origin: "Dallas, TX",
    originCoords: { x: 380, y: 320 },
    destination: "Chicago, IL",
    destCoords: { x: 550, y: 180 },
    waypoints: [
      { name: "Dallas Hub", x: 380, y: 320 },
      { name: "Little Rock Waypoint", x: 440, y: 270 },
      { name: "St. Louis Depot", x: 490, y: 220 },
      { name: "Chicago Logistics Center", x: 550, y: 180 },
    ],
    distance: "925 Miles",
    driver: "John Driver",
    truck: "Freightliner Cascadia #101",
    cargo: "High-Tech Electronics (18 Tons)",
    temp: "-4°C (Refrigerated)",
    eta: "3h 45m",
    color: "#38bdf8", // Sky blue
  },
  {
    id: "route-2",
    name: "Pacific Corridor",
    origin: "Los Angeles, CA",
    originCoords: { x: 120, y: 280 },
    destination: "Seattle, WA",
    destCoords: { x: 180, y: 80 },
    waypoints: [
      { name: "LA Port Hub", x: 120, y: 280 },
      { name: "Sacramento Station", x: 140, y: 200 },
      { name: "Portland Depot", x: 170, y: 120 },
      { name: "Seattle Terminal", x: 180, y: 80 },
    ],
    distance: "1,135 Miles",
    driver: "Sarah Connor",
    truck: "Volvo VNL 860 #102",
    cargo: "Medical Supplies & Vaccines",
    temp: "-18°C (Cryo Fleet)",
    eta: "5h 10m",
    color: "#34d399", // Emerald green
  },
  {
    id: "route-3",
    name: "Atlantic Cargo Main",
    origin: "Miami, FL",
    originCoords: { x: 720, y: 380 },
    destination: "New York, NY",
    destCoords: { x: 780, y: 140 },
    waypoints: [
      { name: "Miami Port", x: 720, y: 380 },
      { name: "Atlanta Central", x: 680, y: 290 },
      { name: "Washington DC Hub", x: 740, y: 200 },
      { name: "NYC Cargo Hub", x: 780, y: 140 },
    ],
    distance: "1,280 Miles",
    driver: "Marcus Vance",
    truck: "Peterbilt 579 #104",
    cargo: "Automotive Parts",
    temp: "+22°C (Ambient)",
    eta: "6h 20m",
    color: "#fbbf24", // Amber
  },
];

const AnimatedLogisticsMap = () => {
  const [selectedRoute, setSelectedRoute] = useState(routesData[0]);
  const [progress, setProgress] = useState(35); // 0 to 100%
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

  // Animate the vehicle moving along the path
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) return 0;
          return prev + 0.5 * speedMultiplier;
        });
      }, 50);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, speedMultiplier]);

  // Calculate current vehicle position on SVG map
  const getVehiclePosition = () => {
    const p = progress / 100;
    const x = selectedRoute.originCoords.x + (selectedRoute.destCoords.x - selectedRoute.originCoords.x) * p;
    const y = selectedRoute.originCoords.y + (selectedRoute.destCoords.y - selectedRoute.originCoords.y) * p;
    return { x, y };
  };

  const currentPos = getVehiclePosition();

  return (
    <div className="glass-panel-glow rounded-3xl p-6 border border-slate-800 space-y-6 relative overflow-hidden">
      {/* Background Subtle Gradient Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 blur-[140px] pointer-events-none rounded-full" />

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Live GPS Vehicle Movement & Logistics Route Tracker
                <span className="text-[10px] bg-sky-500/20 text-sky-300 font-semibold px-2.5 py-0.5 rounded-full border border-sky-500/30">
                  REAL-TIME TELEMETRY
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Interactive spatial visualization of freight transport moving between logistics hubs
              </p>
            </div>
          </div>
        </div>

        {/* Route Selectors & Playback Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-sky-400 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            {isPlaying ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
            <span>{isPlaying ? "Pause Simulation" : "Resume Movement"}</span>
          </button>

          <button
            onClick={() => setSpeedMultiplier((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1))}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sky-400 hover:bg-slate-800 transition-colors text-xs font-bold flex items-center gap-1"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>{speedMultiplier}x Speed</span>
          </button>
        </div>
      </div>

      {/* Route Switcher Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
        {routesData.map((r) => {
          const isSelected = selectedRoute.id === r.id;
          return (
            <button
              key={r.id}
              onClick={() => {
                setSelectedRoute(r);
                setProgress(15);
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                isSelected
                  ? "bg-slate-900/90 border-sky-500/60 shadow-lg shadow-sky-500/10 ring-1 ring-sky-500/30"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-extrabold text-white">{r.name}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: r.color }}
                />
              </div>
              <p className="text-xs text-sky-300 font-semibold">{r.origin} ➔ {r.destination}</p>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>{r.distance}</span>
                <span className="text-emerald-400 font-medium">{r.eta} ETA</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Interactive Map Visualizer Canvas */}
      <div className="relative h-96 rounded-2xl bg-slate-950 border border-slate-800/80 overflow-hidden shadow-inner flex flex-col justify-between">
        {/* Map Grid Pattern */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]" />

        {/* SVG Route Paths & Animated Markers */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 900 450">
          {/* Defs for gradients & filters */}
          <defs>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0D9488" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="1" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Draw all inactive routes subtle dashed lines */}
          {routesData.map((r) => (
            <line
              key={r.id}
              x1={r.originCoords.x}
              y1={r.originCoords.y}
              x2={r.destCoords.x}
              y2={r.destCoords.y}
              stroke={r.id === selectedRoute.id ? selectedRoute.color : "#334155"}
              strokeWidth={r.id === selectedRoute.id ? "3" : "1.5"}
              strokeDasharray={r.id === selectedRoute.id ? "none" : "4 4"}
              opacity={r.id === selectedRoute.id ? "0.9" : "0.3"}
              filter={r.id === selectedRoute.id ? "url(#glow)" : "none"}
            />
          ))}

          {/* Active Waypoints */}
          {selectedRoute.waypoints.map((wp, idx) => (
            <g key={idx} transform={`translate(${wp.x}, ${wp.y})`}>
              <circle r="6" fill="#0f172a" stroke={selectedRoute.color} strokeWidth="2" />
              <circle r="12" fill={selectedRoute.color} opacity="0.15" className="animate-ping" />
              <text y="-12" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold">
                {wp.name}
              </text>
            </g>
          ))}

          {/* MOVING VEHICLE MARKER ON SVG */}
          <g transform={`translate(${currentPos.x}, ${currentPos.y})`} filter="url(#glow)">
            {/* Outer Pulsating Beacon Circle */}
            <circle r="22" fill={selectedRoute.color} opacity="0.2" className="animate-ping" />
            <circle r="14" fill="#0f172a" stroke={selectedRoute.color} strokeWidth="2.5" />
            
            {/* Truck Icon SVG inline */}
            <g transform="translate(-8, -8) scale(0.75)">
              <path
                fill="#ffffff"
                d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"
              />
            </g>
          </g>
        </svg>

        {/* Top Info HUD Bar */}
        <div className="p-4 flex flex-wrap items-center justify-between gap-2 z-10 bg-gradient-to-b from-slate-950/90 to-transparent">
          <div className="flex items-center space-x-3">
            <span className="flex items-center gap-1.5 text-xs bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl font-bold text-white">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {selectedRoute.truck}
            </span>
            <span className="text-xs text-slate-300 font-medium">
              Driver: <strong className="text-sky-300">{selectedRoute.driver}</strong>
            </span>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-xl text-sky-400">
              POS: {currentPos.x.toFixed(0)}px, {currentPos.y.toFixed(0)}px
            </span>
            <span className="bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-xl text-emerald-400">
              PROGRESS: {progress.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Center Live Floating Telemetry Card overlaying the moving vehicle */}
        <div className="z-10 px-6 py-2 flex items-center justify-center">
          <div className="bg-slate-900/90 backdrop-blur-md border border-sky-500/30 rounded-2xl p-4 shadow-2xl flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <Truck className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Current Segment</p>
                <p className="text-sm font-bold text-white">{selectedRoute.origin} ➔ {selectedRoute.destination}</p>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-6 border-l border-slate-800 pl-6 text-xs">
              <div>
                <span className="text-slate-400 block">Cargo Load</span>
                <span className="font-bold text-amber-300">{selectedRoute.cargo}</span>
              </div>
              <div>
                <span className="text-slate-400 block flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-cyan-400" /> Climate control
                </span>
                <span className="font-bold text-cyan-300">{selectedRoute.temp}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Status</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> ON SCHEDULE
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Progress Bar HUD */}
        <div className="p-4 z-10 bg-gradient-to-t from-slate-950/90 to-transparent space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-sky-400" /> Origin: <strong className="text-white">{selectedRoute.origin}</strong>
            </span>
            <span className="text-sky-300 font-bold">{progress.toFixed(0)}% Completed</span>
            <span className="text-slate-400 flex items-center gap-1.5">
              Destination: <strong className="text-white">{selectedRoute.destination}</strong> <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            </span>
          </div>

          {/* Animated Glowing Progress Bar */}
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-emerald-400 to-amber-400 transition-all duration-300 shadow-lg shadow-sky-500/50"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimatedLogisticsMap;
