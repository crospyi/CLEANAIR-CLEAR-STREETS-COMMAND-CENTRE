import { useState, useEffect } from 'react';
import { TrendingUp, BarChart3, Wind, AlertTriangle } from 'lucide-react';
import { CitizenReport } from '../types';

interface SpikesAnalyticsProps {
  reports: CitizenReport[];
}

export default function SpikesAnalytics({ reports }: SpikesAnalyticsProps) {
  const [windDirection, setWindDirection] = useState<'NW' | 'SE' | 'NE' | 'W'>('NW');
  const [windSpeed, setWindSpeed] = useState(14); // km/h
  const [predictions, setPredictions] = useState<number[]>([]);

  const totalReports = reports.length;
  
  const categoryCounts = reports.reduce((acc: Record<string, number>, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});

  const categoriesList = [
    { key: 'Trash', label: 'Garbage Burning', color: 'bg-rose-500', stroke: '#f43f5e', emoji: '🗑️' },
    { key: 'Factory', label: 'Industrial Plumes', color: 'bg-fuchsia-500', stroke: '#d946ef', emoji: '🏭' },
    { key: 'Dust', label: 'Construction Dust', color: 'bg-amber-500', stroke: '#eab308', emoji: '🏗️' },
    { key: 'Vehicular', label: 'Tailpipe Emissions', color: 'bg-blue-500', stroke: '#3b82f6', emoji: '🚗' },
    { key: 'Leaf', label: 'Biomass Burning', color: 'bg-orange-500', stroke: '#f97316', emoji: '🍂' },
    { key: 'Smoke', label: 'Tandoor/Cook Smoke', color: 'bg-pink-500', stroke: '#ec4899', emoji: '💨' }
  ];

  const avgAqiMod = totalReports > 0 
    ? Math.round(reports.reduce((sum, r) => sum + (r.aqi || 0), 0) / totalReports) 
    : 0;

  useEffect(() => {
    const baseAqi = 180 + avgAqiMod * 1.5;
    const windMultiplier = windDirection === 'NW' ? 1.25 : windDirection === 'W' ? 1.1 : windDirection === 'NE' ? 0.95 : 0.8;
    const speedFactor = windSpeed * 0.8;
    
    const baseCurve = [1.0, 1.15, 1.3, 0.9, 0.75, 1.1, 1.25];
    
    const calculated = baseCurve.map((mult, idx) => {
      const variance = 1 + (Math.sin(idx * 1.8) * 0.05);
      const val = Math.round(baseAqi * mult * windMultiplier * variance - (windDirection === 'SE' ? speedFactor : -speedFactor * 0.2));
      return Math.max(20, Math.min(500, val));
    });

    setPredictions(calculated);
  }, [reports, windDirection, windSpeed, avgAqiMod]);

  const handleRandomizeWind = () => {
    const dirs: ('NW' | 'SE' | 'NE' | 'W')[] = ['NW', 'SE', 'NE', 'W'];
    const nextDir = dirs[Math.floor(Math.random() * dirs.length)];
    const nextSpeed = Math.floor(Math.random() * 20) + 5;
    setWindDirection(nextDir);
    setWindSpeed(nextSpeed);
  };

  const width = 500;
  const height = 140;
  const padding = { top: 15, right: 25, bottom: 20, left: 35 };

  const getSvgPathPoints = () => {
    if (predictions.length === 0) return [];
    const stepX = (width - padding.left - padding.right) / (predictions.length - 1);
    
    return predictions.map((aqi, idx) => {
      const x = padding.left + idx * stepX;
      const y = height - padding.bottom - ((aqi / 500) * (height - padding.top - padding.bottom));
      return { x, y, val: aqi };
    });
  };

  const points = getSvgPathPoints();
  
  const linePath = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`
    : '';

  const timeLabels = ['Now', '+4h', '+8h', '+12h', '+16h', '+20h', '+24h'];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col h-full gap-4 shadow-sm">
      
      {/* 24-Hour Predictive Spikes section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-rose-600" />
            <div>
              <h3 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase font-bold">📈 24H PREDICTIVE AQI SPIKES</h3>
              <p className="text-[9px] font-mono text-slate-550">Predicted micro-level spikes based on active plumes</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRandomizeWind}
            className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-[9.5px] font-mono text-slate-550 hover:text-slate-800 cursor-pointer transition-all"
            title="Recalculate with different wind vectors"
          >
            <Wind className="w-3 h-3 text-sky-600 animate-pulse" />
            <span>Wind: {windDirection} {windSpeed} km/h</span>
          </button>
        </div>

        {/* Custom SVG Line Chart */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 relative flex items-center justify-center">
          {predictions.length > 0 ? (
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.00" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#eab308" />
                  <stop offset="100%" stopColor="#f43f5e" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[100, 200, 300, 400].map((yVal) => {
                const yCoord = height - padding.bottom - ((yVal / 500) * (height - padding.top - padding.bottom));
                return (
                  <g key={yVal}>
                    <line
                      x1={padding.left}
                      y1={yCoord}
                      x2={width - padding.right}
                      y2={yCoord}
                      stroke="rgba(148, 163, 184, 0.25)"
                      strokeWidth="1"
                      strokeDasharray="2, 4"
                    />
                    <text
                      x={padding.left - 8}
                      y={yCoord + 3}
                      fill="#94a3b8"
                      fontSize="7.5"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {yVal}
                    </text>
                  </g>
                );
              })}

              {/* Area */}
              <path d={areaPath} fill="url(#chartGradient)" />

              {/* Line */}
              <path
                d={linePath}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Points */}
              {points.map((p, idx) => (
                <g key={idx} className="group cursor-pointer">
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="6.5"
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="1.5"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="3.5"
                    fill="#ffffff"
                    stroke={p.val > 300 ? '#f43f5e' : p.val > 150 ? '#eab308' : '#10b981'}
                    strokeWidth="2"
                  />
                  <text
                    x={p.x}
                    y={p.y - 8}
                    fill={p.val > 300 ? '#e11d48' : p.val > 150 ? '#d97706' : '#059669'}
                    fontSize="7.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="opacity-60 group-hover:opacity-100 transition-opacity"
                  >
                    {p.val}
                  </text>
                </g>
              ))}

              {/* X Axis Line */}
              <line
                x1={padding.left}
                y1={height - padding.bottom}
                x2={width - padding.right}
                y2={height - padding.bottom}
                stroke="rgba(148, 163, 184, 0.5)"
                strokeWidth="1"
              />

              {/* X Axis Labels */}
              {points.map((p, idx) => (
                <text
                  key={idx}
                  x={p.x}
                  y={height - padding.bottom + 12}
                  fill="#94a3b8"
                  fontSize="7.5"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {timeLabels[idx]}
                </text>
              ))}
            </svg>
          ) : (
            <div className="h-[100px] flex items-center justify-center text-[10px] text-slate-405 font-mono">
              Generating Predictive Graph...
            </div>
          )}
        </div>

        {/* Spike Warning Box */}
        {predictions.length > 0 && Math.max(...predictions) > 280 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
            <div className="text-[9.5px] font-sans text-slate-650 leading-normal">
              <span className="font-bold text-rose-700">Critical AQI Spike Risk: </span>
              A PM2.5 density surge of <span className="font-mono text-rose-800 font-bold">{Math.max(...predictions)} AQI</span> is projected in the next 12 hours under active {windDirection} wind vectors. Stage III containment measures advised.
            </div>
          </div>
        )}
      </div>

      {/* Category Breakdown section */}
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
          <BarChart3 className="w-4 h-4 text-sky-650" />
          <h3 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase font-bold">🚨 EMISSIONS BY HAZARD TYPE</h3>
        </div>

        {totalReports === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[9.5px] text-slate-400 font-mono py-4">
            Awaiting incident ingest data...
          </div>
        ) : (
          <div className="space-y-2.5 mt-1">
            {categoriesList.map((cat) => {
              const count = categoryCounts[cat.key] || 0;
              const percentage = totalReports > 0 ? (count / totalReports) * 100 : 0;

              return (
                <div key={cat.key} className="flex flex-col gap-1 text-[9.5px] font-mono">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs leading-none">{cat.emoji}</span>
                      <span>{cat.label}</span>
                    </span>
                    <span className="text-[9px] text-slate-500">
                      <b className="text-slate-800 font-bold">{count}</b> reports ({Math.round(percentage)}%)
                    </span>
                  </div>
                  
                  <div className="w-full h-1.5 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500`}
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: cat.stroke,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
