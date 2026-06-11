import React, { useEffect, useRef, useState } from 'react';
import { MapPin, ShieldCheck, Share2, Compass, AlertTriangle, Radio } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';

interface SafeHub {
  name: string;
  lat: number;
  lng: number;
  type: 'police' | 'hospital' | 'shelter';
  address: string;
  phone: string;
}

const LOCAL_SAFE_HUBS: SafeHub[] = [
  { name: "Metropolitan Central Police Desk", lat: 37.7749, lng: -122.4194, type: "police", address: "850 Bryant St, San Francisco, CA", phone: "911" },
  { name: "Downtown Women Community Center", lat: 37.7812, lng: -122.4101, type: "shelter", address: "220 Golden Gate Ave, San Francisco, CA", phone: "1-800-555-0199" },
  { name: "St. Mary Medical Urgent Center", lat: 37.7701, lng: -122.4251, type: "hospital", address: "450 Stanyan St, San Francisco, CA", phone: "415-555-4000" },
  { name: "Neighborhood Shelter (24/7 Support)", lat: 37.7652, lng: -122.4152, type: "shelter", address: "105 Valencia St, San Francisco, CA", phone: "1-800-799-7233" }
];

interface LocationSharingProps {
  currentAlertId: string | null;
  theme?: 'light' | 'dark';
}

export default function LocationSharing({ currentAlertId, theme = 'dark' }: LocationSharingProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number }>({ lat: 37.7749, lng: -122.4194 }); // SF default
  const [status, setStatus] = useState<'acquiring' | 'ready' | 'failed'>('acquiring');
  const [copiedLink, setCopiedLink] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);

  // Poll geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('failed');
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;
      setCoords({ lat: latitude, lng: longitude, accuracy });
      setStatus('ready');

      // If active emergency alert, push latest coordinate live as breadcrumb inside cloud database
      if (currentAlertId) {
        updateAlertLocation(latitude, longitude);
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      console.warn("Geolocation access denied or timed out. Defaulting to safe simulation:", error.message);
      setStatus('ready'); // Fallback to preset mock coordinate
    };

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentAlertId]);

  // Update alert breadcrumbs tracking inside Firestore
  const updateAlertLocation = async (lat: number, lng: number) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const alertPath = `alerts/${currentAlertId}`;
      await updateDoc(doc(db, alertPath), {
        latitude: lat,
        longitude: lng,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Failed to sync live coords to firestore alert:", e);
    }
  };

  // Initialize and update Leaflet Map
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current || status !== 'ready') return;

    try {
      // Create Map if it doesn't exist
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapContainerRef.current, {
          center: [coords.lat, coords.lng],
          zoom: 14,
          zoomControl: false
        });

        // Add Elegant adaptative cartography mapping tiles
        const tileUrl = theme === 'light'
          ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

        L.tileLayer(tileUrl, {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(mapInstanceRef.current);

        // Add standard zoom control on right
        L.control.zoom({ position: 'topright' }).addTo(mapInstanceRef.current);

        // Plot Safe Zones & Police markers
        LOCAL_SAFE_HUBS.forEach((hub) => {
          const mColor = hub.type === 'police' ? '#ef4444' : hub.type === 'hospital' ? '#3b82f6' : '#10b981';
          const dotHtml = `<div style="background-color: ${mColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 8px ${mColor};"></div>`;
          const hubIcon = L.divIcon({
            className: 'custom-div-icon',
            html: dotHtml,
            iconSize: [12, 12]
          });

          L.marker([hub.lat, hub.lng], { icon: hubIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup(`
              <div class="text-slate-900 text-xs p-1">
                <strong class="font-bold font-sans">${hub.name}</strong><br/>
                <span class="text-[10px] text-slate-500">${hub.address}</span><br>
                <a href="tel:${hub.phone}" class="text-indigo-600 font-semibold text-[10px]">📞 Contact Help: ${hub.phone}</a>
              </div>
            `);
        });
      } else {
        // Just fly to new coordinates
        mapInstanceRef.current.setView([coords.lat, coords.lng], 14, { animate: true });
      }

      // Handle Current User Marker
      const ringHtml = `
        <div class="relative flex items-center justify-center">
          <div class="absolute h-6 w-6 bg-indigo-500/30 rounded-full animate-ping"></div>
          <div class="h-4 w-4 bg-indigo-600 rounded-full border-2 border-white shadow-lg"></div>
        </div>
      `;

      const userIcon = L.divIcon({
        className: 'user-glowing-marker',
        html: ringHtml,
        iconSize: [24, 24]
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([coords.lat, coords.lng]);
      } else {
        userMarkerRef.current = L.marker([coords.lat, coords.lng], { icon: userIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`
            <div class="text-slate-900 text-xs text-center">
              <strong class="font-sans">Your Live Location</strong><br>
              <span class="text-[10px] text-slate-500">Actively Monitored</span>
            </div>
          `);
      }

    } catch (err) {
      console.error("Leaflet map initialization failure inside frame:", err);
    }
  }, [coords, status, theme]);

  // Cleanup map instance on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        userMarkerRef.current = null;
      }
    };
  }, []);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/?alert=${currentAlertId || 'demo'}&lat=${coords.lat}&lng=${coords.lng}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="bg-[#121420] text-slate-100 p-6 rounded-2xl border border-slate-850 shadow-xl flex flex-col justify-between h-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Compass className={`h-6 w-6 ${currentAlertId ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Active Sentinel GPS Sharing</h2>
              <p className="text-xs text-slate-400">Failsafe GPS coordination with family networks and localized support docks.</p>
            </div>
          </div>
          {currentAlertId && (
            <span className="flex items-center gap-1 bg-red-500/15 text-red-400 px-2.5 py-1 text-[10px] font-bold font-mono rounded-full uppercase tracking-wider animate-pulse border border-red-500/20">
              <Radio className="h-3 w-3" />
              <span>Transmitting Live</span>
            </span>
          )}
        </div>

        {/* Custom Map Area */}
        <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 h-56 shadow-inner">
          {status === 'acquiring' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 text-xs text-slate-500">
              <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span>Calibrating secure GPS link...</span>
            </div>
          )}
          <div ref={mapContainerRef} key={theme} className="h-full w-full" />
        </div>

        {/* Location details */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900/40 border border-slate-850 rounded-xl">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Current Latitude</span>
            <p className="text-xs font-mono font-semibold text-slate-300">{coords.lat.toFixed(6)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Current Longitude</span>
            <p className="text-xs font-mono font-semibold text-slate-300">{coords.lng.toFixed(6)}</p>
          </div>
        </div>
      </div>

      <div className="pt-4 flex gap-2">
        <button
          onClick={handleCopyLink}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl active:scale-95 transition-all cursor-pointer"
        >
          <Share2 className="h-4 w-4 text-indigo-400" />
          <span>{copiedLink ? 'Copied Secure Tracker Link' : 'Secure Tracking Link'}</span>
        </button>
      </div>
    </div>
  );
}
