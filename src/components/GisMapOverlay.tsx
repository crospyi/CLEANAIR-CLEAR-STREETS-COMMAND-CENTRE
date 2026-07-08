import { useEffect, useRef, useState } from 'react';
import { Layers, Compass, RotateCw, Navigation, Sparkles } from 'lucide-react';
import { CitizenReport, AntiSmogVehicle } from '../types';

interface GisMapOverlayProps {
  reports: CitizenReport[];
  vehicles: AntiSmogVehicle[];
  selectedReportId: string | null;
  onSelectReport: (reportId: string | null) => void;
  onShowToast: (msg: string) => void;
}

export default function GisMapOverlay({
  reports,
  vehicles,
  selectedReportId,
  onSelectReport,
  onShowToast
}: GisMapOverlayProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [satelliteOpacity, setSatelliteOpacity] = useState(0.35);
  const [activeLayers, setActiveLayers] = useState({
    satellite: true,
    hotspots: true,
    vehicles: true,
  });

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const reportsLayerRef = useRef<any>(null);
  const satelliteLayerRef = useRef<any>(null);
  const vehiclesLayerRef = useRef<any>(null);

  const DELHI_COORDS = { lat: 28.6139, lon: 77.2090 };

  const getReportCoords = (report: CitizenReport): [number, number] => {
    const rAny = report as any;
    if (typeof rAny.lat === 'number' && typeof rAny.lon === 'number') {
      return [rAny.lat, rAny.lon];
    }
    const seed = report.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const latOffset = ((seed % 100) / 1000) - 0.05;
    const lonOffset = (((seed * 17) % 100) / 1000) - 0.05;
    return [DELHI_COORDS.lat + latOffset, DELHI_COORDS.lon + lonOffset];
  };

  const getCategoryTheme = (category: string) => {
    switch (category) {
      case 'Trash':
        return { color: '#ef4444', emoji: '🗑️', label: 'Garbage Fire' };
      case 'Leaf':
        return { color: '#f97316', emoji: '🍂', label: 'Biomass/Leaf Fire' };
      case 'Factory':
        return { color: '#a855f7', emoji: '🏭', label: 'Industrial Smoke' };
      case 'Smoke':
        return { color: '#ec4899', emoji: '💨', label: 'Tandoor Smoke' };
      case 'Dust':
        return { color: '#eab308', emoji: '🏗️', label: 'Construction Dust' };
      case 'Vehicular':
        return { color: '#3b82f6', emoji: '🚗', label: 'Vehicle Emissions' };
      default:
        return { color: '#10b981', emoji: '🚨', label: 'Incident' };
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) {
      console.warn("Leaflet library not loaded yet.");
      return;
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([DELHI_COORDS.lat, DELHI_COORDS.lon], 11);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      minZoom: 3,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;
    reportsLayerRef.current = L.layerGroup().addTo(map);
    satelliteLayerRef.current = L.layerGroup().addTo(map);
    vehiclesLayerRef.current = L.layerGroup().addTo(map);

    setMapLoaded(true);

    // Call invalidateSize after DOM renders to guarantee map tiles load
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Invalidate size on layout and data updates
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
    }
  }, [reports, selectedReportId, activeLayers.satellite, activeLayers.hotspots, activeLayers.vehicles]);

  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const L = (window as any).L;
    const reportsLayer = reportsLayerRef.current;
    reportsLayer.clearLayers();

    if (!activeLayers.hotspots) return;

    reports.forEach((report) => {
      const [lat, lon] = getReportCoords(report);
      const theme = getCategoryTheme(report.category);
      const hasImage = !!report.imageUrl;
      const pinHtml = `
        <div class="relative flex items-center justify-center w-10 h-10 rounded-full ${selectedReportId === report.id ? 'scale-125 z-50' : ''}">
          <div class="absolute inset-0 rounded-full radar-pulse-rose" style="animation-duration: 2.5s; background-color: ${theme.color}22;"></div>
          <div class="absolute -inset-1 rounded-full animate-ping opacity-25" style="animation-duration: 3s; background-color: ${theme.color};"></div>
          ${hasImage ? `
            <div class="relative border-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all duration-300 overflow-hidden bg-slate-100"
                 style="border-color: ${theme.color};">
              <img src="${report.imageUrl}" class="w-full h-full object-cover rounded-full" style="width: 100%; height: 100%; object-fit: cover;" />
              <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[9px] shadow-xs">
                ${theme.emoji}
              </div>
            </div>
          ` : `
            <div class="relative border-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md font-sans text-xs transition-all duration-300"
                 style="background-color: #ffffff; border-color: ${theme.color}; color: #000000;">
              ${theme.emoji}
            </div>
          `}
        </div>
      `;

      const customIcon = L.divIcon({
        html: pinHtml,
        className: 'custom-leaflet-pin',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const marker = L.marker([lat, lon], { icon: customIcon });

      const popupContent = `
        <div class="p-1 text-slate-800 font-sans min-w-[200px]">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" 
                  style="background-color: ${theme.color}15; color: ${theme.color}; border: 1px solid ${theme.color}25;">
              ${theme.label}
            </span>
            <span class="text-[9px] font-mono text-slate-500">${report.verified ? 'Verified ✓' : 'Pending'}</span>
          </div>
          <h4 class="text-xs font-bold text-slate-900 mt-1">${report.senderName} (${report.city})</h4>
          <p class="text-[10px] text-slate-655 mt-1 leading-normal">${report.description}</p>
          <div class="flex justify-between items-center text-[9px] font-mono text-slate-500 mt-2.5 pt-1.5 border-t border-slate-200">
            <span>Impact: <b class="text-rose-600">+${report.aqi} AQI</b></span>
            <span>Status: <b class="text-sky-600">${report.status || 'Pending'}</b></span>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('click', () => {
        onSelectReport(report.id);
      });

      reportsLayer.addLayer(marker);
    });
  }, [reports, activeLayers.hotspots, selectedReportId, mapLoaded]);

  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const L = (window as any).L;
    const satelliteLayer = satelliteLayerRef.current;
    satelliteLayer.clearLayers();

    if (!activeLayers.satellite) return;

    const plumes = [
      {
        center: [28.69, 77.15],
        radius: 4200,
        color: '#f43f5e',
        name: 'Stubble Burn Plume (Sentinel-5P Coarse Density)',
        density: 'High (0.86 mol/m² CO)'
      },
      {
        center: [28.53, 77.28],
        radius: 3500,
        color: '#d946ef',
        name: 'Okhla Industrial Area SO2 Plume',
        density: 'Medium-High (0.45 mol/m²)'
      },
      {
        center: [28.64, 77.06],
        radius: 2800,
        color: '#f97316',
        name: 'W-Delhi Dust Cloud (Sentinel-5P Aerosol)',
        density: 'Moderate (0.32 mol/m²)'
      }
    ];

    plumes.forEach((p) => {
      const circle = L.circle(p.center, {
        color: p.color,
        fillColor: p.color,
        fillOpacity: satelliteOpacity,
        weight: 1.5,
        dashArray: '5, 5',
        radius: p.radius
      });

      circle.bindPopup(`
        <div class="p-1 text-slate-800 font-sans">
          <h4 class="text-xs font-black text-rose-650 flex items-center gap-1">
            <Sparkles class="w-3.5 h-3.5 text-rose-600" /> SENTINEL-5P SATELLITE
          </h4>
          <p class="text-[10px] font-bold text-slate-900 mt-1">${p.name}</p>
          <div class="mt-1.5 space-y-0.5 text-[9px] font-mono text-slate-500">
            <div>Column Density: <span class="text-slate-800">${p.density}</span></div>
            <div>Scanned: <span class="text-slate-850">Live (Mock telemetry)</span></div>
          </div>
        </div>
      `);

      satelliteLayer.addLayer(circle);
    });
  }, [activeLayers.satellite, satelliteOpacity, mapLoaded]);

  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const L = (window as any).L;
    const vehiclesLayer = vehiclesLayerRef.current;
    vehiclesLayer.clearLayers();

    if (!activeLayers.vehicles) return;

    vehicles.forEach((vehicle) => {
      const vehicleEmoji = vehicle.type === 'Water-Mist Truck' ? '🚚' : vehicle.type === 'Road Sweeper' ? '🧹' : '🔫';
      const color = vehicle.status === 'Active' ? '#10b981' : vehicle.status === 'Dispatched' ? '#eab308' : '#94a3b8';

      const vehicleHtml = `
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full border shadow-md pulse-vehicle" 
             style="background-color: #ffffff; border-color: ${color}; color: black;">
          <div class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white" style="background-color: ${color};"></div>
          <span class="text-sm">${vehicleEmoji}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        html: vehicleHtml,
        className: 'custom-leaflet-vehicle',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([vehicle.lat, vehicle.lon], { icon: customIcon });

      marker.bindPopup(`
        <div class="p-1 text-slate-850 font-sans min-w-[150px]">
          <h4 class="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
            <Navigation class="w-3.5 h-3.5 text-sky-600" /> ${vehicle.name}
          </h4>
          <p class="text-[9px] font-mono text-slate-500 mt-0.5">${vehicle.type}</p>
          <div class="mt-2 space-y-0.5 text-[9px] font-mono text-slate-500 border-t border-slate-200 pt-1.5">
            <div class="flex justify-between"><span>Status:</span><span class="font-bold" style="color: ${color}">${vehicle.status}</span></div>
            <div class="flex justify-between"><span>Task:</span><span class="font-bold text-slate-800">${vehicle.currentTask || 'Idle Patrol'}</span></div>
            <div class="flex justify-between"><span>GPS:</span><span class="text-slate-600">${vehicle.lat.toFixed(4)}, ${vehicle.lon.toFixed(4)}</span></div>
          </div>
        </div>
      `);

      vehiclesLayer.addLayer(marker);
    });
  }, [vehicles, activeLayers.vehicles, mapLoaded]);

  const handleResetCenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([DELHI_COORDS.lat, DELHI_COORDS.lon], 11);
      onShowToast("📍 Reset GIS Grid coordinates to Central Delhi.");
    }
  };

  return (
    <div className="w-full flex flex-col bg-white border border-slate-200 rounded-2xl p-4 overflow-hidden relative shadow-sm">
      
      {/* Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 z-20">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-sky-600 animate-spin-slow" />
          <div>
            <h3 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">GIS COMMAND GRID</h3>
            <p className="text-[9px] font-mono text-slate-500">Live Geo-spatial telemetry overlaid on warm sepia raster</p>
          </div>
        </div>
        
        <button
          onClick={handleResetCenter}
          className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-350 bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
          title="Reset Map Center"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Map Area */}
      <div className="w-full h-[400px] mt-3 rounded-xl border border-slate-200 overflow-hidden relative dark-leaflet" ref={mapContainerRef}>
        {!mapLoaded && (
          <div className="absolute inset-0 bg-slate-50/95 flex flex-col items-center justify-center gap-3">
            <span className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></span>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Constructing GIS Grid...</span>
          </div>
        )}
      </div>

      {/* Map Filters Overlay */}
      <div className="absolute bottom-6 left-8 z-[1000] bg-white/95 border border-slate-200 rounded-xl p-3 flex flex-col gap-2.5 shadow-lg max-w-[200px] backdrop-blur-xl">
        <span className="text-[9px] font-bold font-mono tracking-wider text-slate-450 uppercase">LAYER SCOPES</span>
        
        <label className="flex items-center justify-between text-[10px] font-mono text-slate-650 cursor-pointer">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> Hotspots
          </span>
          <input
            type="checkbox"
            checked={activeLayers.hotspots}
            onChange={(e) => setActiveLayers({ ...activeLayers, hotspots: e.target.checked })}
            className="w-3.5 h-3.5 rounded accent-sky-600"
          />
        </label>

        <label className="flex items-center justify-between text-[10px] font-mono text-slate-650 cursor-pointer">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500"></span> MCD Fleet
          </span>
          <input
            type="checkbox"
            checked={activeLayers.vehicles}
            onChange={(e) => setActiveLayers({ ...activeLayers, vehicles: e.target.checked })}
            className="w-3.5 h-3.5 rounded accent-sky-600"
          />
        </label>

        <label className="flex items-center justify-between text-[10px] font-mono text-slate-655 cursor-pointer">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-fuchsia-500"></span> Sentinel-5P
          </span>
          <input
            type="checkbox"
            checked={activeLayers.satellite}
            onChange={(e) => setActiveLayers({ ...activeLayers, satellite: e.target.checked })}
            className="w-3.5 h-3.5 rounded accent-sky-600"
          />
        </label>

        {activeLayers.satellite && (
          <div className="flex flex-col gap-1 border-t border-slate-200 pt-2 mt-1">
            <span className="text-[8px] font-mono text-slate-450 flex justify-between">
              <span>Plume Opacity</span>
              <span>{Math.round(satelliteOpacity * 100)}%</span>
            </span>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={satelliteOpacity}
              onChange={(e) => setSatelliteOpacity(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-sky-600"
            />
          </div>
        )}
      </div>
    </div>
  );
}
