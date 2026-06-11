import React, { useEffect, useRef, useState } from 'react';
import { 
  Compass, MapPin, AlertTriangle, ShieldCheck, Eye, EyeOff, Navigation, 
  ArrowRight, Sparkles, Footprints, Info
} from 'lucide-react';

interface RouteStop {
  lat: number;
  lng: number;
  narrative?: string;
  isSafe?: boolean;
}

interface HazardArea {
  name: string;
  lat: number;
  lng: number;
  radius: number;
  type: 'dark' | 'low-activity';
  description: string;
}

interface SafeDestination {
  name: string;
  lat: number;
  lng: number;
  shortestDistance: string;
  safestDistance: string;
  safetyRating: string;
  hazardsAvoided: number;
  shortestPath: RouteStop[];
  safestPath: RouteStop[];
}

const SF_USER_START = { lat: 37.7749, lng: -122.4194 }; // SF Center

const HAZARD_ZONES: HazardArea[] = [
  { 
    name: "Golden Gate Alleyway Bypass", 
    lat: 37.7785, 
    lng: -122.4140, 
    radius: 95, 
    type: "dark", 
    description: "Poor Street Lamp coverage (Illumination: 12% - Dark Area)" 
  },
  { 
    name: "Industrial Alley East", 
    lat: 37.7725, 
    lng: -122.4110, 
    radius: 110, 
    type: "low-activity", 
    description: "Closed warehouses / extremely low foot activity (Low Activity Zone)" 
  }
];

const DESTINATIONS: SafeDestination[] = [
  {
    name: "Home (Residential Safe Hub)",
    lat: 37.7812,
    lng: -122.4080,
    shortestDistance: "1.2 miles",
    safestDistance: "1.6 miles",
    safetyRating: "98% Safest Rating",
    hazardsAvoided: 2,
    shortestPath: [
      { lat: 37.7749, lng: -122.4194, narrative: "Start walk from Hub", isSafe: true },
      { lat: 37.7785, lng: -122.4140, narrative: "Enter Dark Golden Gate Alleyway (ZERO LIGHT)", isSafe: false },
      { lat: 37.7812, lng: -122.4080, narrative: "Arrive home", isSafe: true }
    ],
    safestPath: [
      { lat: 37.7749, lng: -122.4194, narrative: "Head East on Market St (Highly Illuminated)", isSafe: true },
      { lat: 37.7760, lng: -122.4150, narrative: "Pass Central Transit block (Active bystander foot traffic)", isSafe: true },
      { lat: 37.7790, lng: -122.4110, narrative: "Turn left on 5th St (Frequent police cruiser passage)", isSafe: true },
      { lat: 37.7812, lng: -122.4080, narrative: "Arrive safely at your destination", isSafe: true }
    ]
  },
  {
    name: "Civic Transit subway link",
    lat: 37.7680,
    lng: -122.4120,
    shortestDistance: "0.9 miles",
    safestDistance: "1.1 miles",
    safetyRating: "96% Safest Rating",
    hazardsAvoided: 1,
    shortestPath: [
      { lat: 37.7749, lng: -122.4194, narrative: "Start at current spot", isSafe: true },
      { lat: 37.7725, lng: -122.4110, narrative: "Cut through Industrial Alley East (Low activity zone)", isSafe: false },
      { lat: 37.7680, lng: -122.4120, narrative: "Arrive at Subway Entrance", isSafe: true }
    ],
    safestPath: [
      { lat: 37.7749, lng: -122.4194, narrative: "Walk along 10th St Main Street (Fully lit)", isSafe: true },
      { lat: 37.7710, lng: -122.4168, narrative: "Pass St. Mary Medical Urgent Center (24/7 Security)", isSafe: true },
      { lat: 37.7685, lng: -122.4145, narrative: "Follow Mission St illuminated corridor", isSafe: true },
      { lat: 37.7680, lng: -122.4120, narrative: "Arrive at Subway Entrance (Heavily lit zone)", isSafe: true }
    ]
  }
];

interface SafeRouteNavigationProps {
  theme?: 'light' | 'dark';
}

export default function SafeRouteNavigation({ theme = 'dark' }: SafeRouteNavigationProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const shortestPolyRef = useRef<any>(null);
  const safestPolyRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const circleRefs = useRef<any[]>([]);

  const [activeDestIdx, setActiveDestIdx] = useState<number>(0);
  const [routeType, setRouteType] = useState<'safest' | 'shortest'>('safest');
  const [showHazards, setShowHazards] = useState<boolean>(true);
  
  // Walk Simulation State
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationIndex, setSimulationIndex] = useState<number>(0);
  const [simulatedCoords, setSimulatedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const selectedDestination = DESTINATIONS[activeDestIdx];
  const activePath = routeType === 'safest' ? selectedDestination.safestPath : selectedDestination.shortestPath;

  // Render Leaflet Map
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;

    try {
      if (!mapInstanceRef.current) {
        // Build map instance
        mapInstanceRef.current = L.map(mapRef.current, {
          center: [SF_USER_START.lat, SF_USER_START.lng],
          zoom: 14,
          zoomControl: false,
          scrollWheelZoom: false
        });

        // Add Leaflet cartographer adaptative styles
        const tileUrl = theme === 'light'
          ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

        L.tileLayer(tileUrl, {
          attribution: '&copy; CartoDB',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(mapInstanceRef.current);

        L.control.zoom({ position: 'topright' }).addTo(mapInstanceRef.current);
      }

      // Clear old polylines & hazard zones
      if (shortestPolyRef.current) mapInstanceRef.current.removeLayer(shortestPolyRef.current);
      if (safestPolyRef.current) mapInstanceRef.current.removeLayer(safestPolyRef.current);
      circleRefs.current.forEach(c => mapInstanceRef.current.removeLayer(c));
      circleRefs.current = [];

      // Render Hazard Areas (low-lit and low-activity zones)
      if (showHazards) {
        HAZARD_ZONES.forEach((hazard) => {
          const color = hazard.type === 'dark' ? '#f59e0b' : '#ef4444'; // Orange for dark, Red for low-activity
          const circle = L.circle([hazard.lat, hazard.lng], {
            color: color,
            fillColor: color,
            fillOpacity: 0.15,
            radius: hazard.radius,
            weight: 2,
            dashArray: '3, 4'
          }).addTo(mapInstanceRef.current);

          circle.bindPopup(`
            <div class="text-slate-900 text-xs p-1">
              <strong class="font-bold text-red-650 flex items-center gap-1">⚠️ ${hazard.name}</strong>
              <p class="text-[10px] text-slate-650 mt-1">${hazard.description}</p>
            </div>
          `);
          circleRefs.current.push(circle);
        });
      }

      // Setup coordinates for routes
      const safestLatLngs = selectedDestination.safestPath.map(p => [p.lat, p.lng]);
      const shortestLatLngs = selectedDestination.shortestPath.map(p => [p.lat, p.lng]);

      // Render Unsafe Shortest path: Red Dashed line
      shortestPolyRef.current = L.polyline(shortestLatLngs, {
        color: '#ef4444',
        weight: 3.5,
        dashArray: '6, 8',
        opacity: routeType === 'shortest' ? 0.9 : 0.35
      }).addTo(mapInstanceRef.current);

      shortestPolyRef.current.bindPopup(`
        <div class="text-xs p-1 text-slate-900 font-sans">
          <strong class="text-red-650">UNSAFE Shortest Path</strong><br/>
          <span>Cuts through unlit, low-activity alleys.</span>
        </div>
      `);

      // Render Safe Route: glowing solid green line
      safestPolyRef.current = L.polyline(safestLatLngs, {
        color: '#10b981',
        weight: 5,
        opacity: routeType === 'safest' ? 1.0 : 0.4,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(mapInstanceRef.current);

      safestPolyRef.current.bindPopup(`
        <div class="text-xs p-1 text-slate-900 font-sans">
          <strong class="text-emerald-600">Illuminated Safe Guard route</strong><br/>
          <span>Maximizes lighting and bystander visibility.</span>
        </div>
      `);

      // Handle custom markers
      const customL = L;
      const startRing = `
        <div class="relative flex items-center justify-center">
          <div class="h-3 w-3 bg-indigo-500 rounded-full border-2 border-white shadow-md"></div>
        </div>
      `;
      const endRing = `
        <div class="relative flex items-center justify-center">
          <div class="h-4.5 w-4.5 bg-rose-600 rounded-lg border-2 border-white rotate-45 shadow-lg flex items-center justify-center">
            <div class="-rotate-45 text-[8px] text-white font-extrabold">H</div>
          </div>
        </div>
      `;

      // Draw fixed Start and End points
      const startIcon = customL.divIcon({ html: startRing, iconSize: [12, 12], className: 'map-start' });
      const endIcon = customL.divIcon({ html: endRing, iconSize: [18, 18], className: 'map-end' });

      // Clean bounds fit
      const routeBounds = customL.latLngBounds([...safestLatLngs, ...shortestLatLngs]);
      mapInstanceRef.current.fitBounds(routeBounds, { padding: [35, 35] });

    } catch (e) {
      console.warn("Leaflet Safe Route initializer error:", e);
    }
  }, [selectedDestination, routeType, showHazards, theme]);

  // Handle simulation marker animation
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current) return;

    const userIconHtml = `
      <div class="relative flex items-center justify-center">
        <div class="absolute h-8.5 w-8.5 bg-emerald-500/30 rounded-full animate-ping"></div>
        <div class="h-5 w-5 bg-emerald-600 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white">
          <Footprints className="h-3 w-3 animate-bounce" />
        </div>
      </div>
    `;

    const simIcon = L.divIcon({
      className: 'simulating-walker-icon',
      html: userIconHtml,
      iconSize: [34, 34]
    });

    const currentSimulationCoords = simulatedCoords || SF_USER_START;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([currentSimulationCoords.lat, currentSimulationCoords.lng]);
    } else {
      userMarkerRef.current = L.marker([currentSimulationCoords.lat, currentSimulationCoords.lng], { icon: simIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup(`
          <div class="text-slate-900 text-xs p-1">
            <strong>Escort Simulation Active</strong>
          </div>
        `);
    }

    if (isSimulating) {
      mapInstanceRef.current.setView([currentSimulationCoords.lat, currentSimulationCoords.lng], 15, { animate: true });
    }
  }, [simulatedCoords, isSimulating]);

  // Clean-up on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        userMarkerRef.current = null;
      }
    };
  }, []);

  // Run walk simulation ticker
  const startSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimulationIndex(0);
    setSimulatedCoords(activePath[0]);

    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      if (idx < activePath.length) {
        setSimulationIndex(idx);
        setSimulatedCoords(activePath[idx]);
      } else {
        clearInterval(interval);
        setIsSimulating(false);
        alert(`You have simulated arrived safely at: ${selectedDestination.name}!`);
      }
    }, 4500);
  };

  return (
    <div className="bg-[#121420] text-slate-100 p-6 rounded-3xl border border-slate-850 shadow-2xl flex flex-col justify-between h-full space-y-6" id="safe-route-navigator">
      <div className="space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Compass className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">Safe Escort Walk Navigation</h2>
              <p className="text-[10px] text-slate-400 font-mono">Dynamic route rating avoiding unlit suburbs & cold blocks</p>
            </div>
          </div>
        </div>

        {/* Destination Selection Grid */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block font-mono">Select Safety Destination</label>
          <div className="grid grid-cols-2 gap-2">
            {DESTINATIONS.map((dest, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveDestIdx(idx);
                  setSimulationIndex(0);
                  setSimulatedCoords(null);
                }}
                className={`px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-tight text-left transition-all relative border flex flex-col justify-between cursor-pointer ${
                  activeDestIdx === idx 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-950/20' 
                    : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-300'
                }`}
              >
                <span>{dest.name.split(" ")[0]}</span>
                <span className={`text-[9px] font-mono mt-1 ${activeDestIdx === idx ? 'text-indigo-200' : 'text-slate-500'}`}>
                  {dest.safestDistance} ({dest.safetyRating.split(" ")[0]})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Mapping Node */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-850 bg-slate-950 h-56 shadow-inner z-10">
          <div ref={mapRef} key={theme} className="h-full w-full" />
          
          {/* Hazards Overlay Legend badge */}
          <button 
            onClick={() => setShowHazards(!showHazards)}
            className="absolute bottom-3 left-3 z-[1000] px-3 py-1.5 bg-slate-950/90 hover:bg-slate-900 text-[10px] font-mono font-bold text-slate-300 rounded-lg border border-slate-800 transition-all cursor-pointer flex items-center gap-1.5"
          >
            {showHazards ? <Eye className="h-3.5 w-3.5 text-rose-500" /> : <EyeOff className="h-3.5 w-3.5 text-slate-500" />}
            <span>Hazards: {showHazards ? 'On-Map Visible' : 'Hidden'}</span>
          </button>
        </div>

        {/* Comparator Switcher */}
        <div className="bg-slate-950 p-1.5 border border-slate-900 rounded-xl grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setRouteType('safest')}
            className={`py-2 rounded-lg text-xs font-bold text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              routeType === 'safest' 
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Illuminated Safe Way ({selectedDestination.safestDistance})</span>
          </button>
          
          <button
            onClick={() => setRouteType('shortest')}
            className={`py-2 rounded-lg text-xs font-bold text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              routeType === 'shortest' 
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold' 
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Shortest Way ({selectedDestination.shortestDistance})</span>
          </button>
        </div>

        {/* Tactical Narrative Guidance for active route */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-widest font-semibold">
            <span>Walking Narrative Steps</span>
            <span className={routeType === 'safest' ? 'text-emerald-400' : 'text-rose-500'}>
              {routeType === 'safest' ? '✨ ILLUMINATED BYSTANDER SIGHT' : '⚠️ HIGH DARK ALLEY HAZARD'}
            </span>
          </div>

          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {activePath.map((stop, sIdx) => (
              <div 
                key={sIdx} 
                className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-xs transition-all ${
                  simulationIndex === sIdx && isSimulating
                    ? 'bg-indigo-950/30 border-indigo-500/40 text-slate-200'
                    : stop.isSafe 
                      ? 'bg-slate-950/40 border-slate-900/40 text-slate-300' 
                      : 'bg-rose-950/10 border-rose-950/20 text-rose-300 font-medium'
                }`}
              >
                <div className={`mt-0.5 h-4.5 w-4.5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                  simulationIndex === sIdx && isSimulating 
                    ? 'bg-indigo-500 text-white animate-spin'
                    : stop.isSafe 
                      ? 'bg-slate-900 text-indigo-400' 
                      : 'bg-rose-500 text-white'
                }`}>
                  {sIdx + 1}
                </div>
                <div className="flex-1 space-y-0.5">
                  <p className="leading-snug">{stop.narrative}</p>
                  <span className="text-[9px] font-mono text-slate-500 flex items-center gap-1">
                    <span>GPS: {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}</span>
                    <span>•</span>
                    <span className={stop.isSafe ? 'text-emerald-500' : 'text-rose-500 font-bold'}>
                      {stop.isSafe ? 'Illumination High / Secure' : 'Dark Passage Zone'}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Walk Simulator Activation triggers */}
      <div className="pt-2">
        <button
          onClick={startSimulation}
          disabled={isSimulating}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-indigo-950/30 disabled:opacity-50 select-none cursor-pointer"
        >
          {isSimulating ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Simulating Walking Escort (Step {simulationIndex + 1}/{activePath.length})...</span>
            </>
          ) : (
            <>
              <Navigation className="h-4 w-4 text-indigo-200" />
              <span>Begin Safe Walk Simulation Route</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
