import { useState } from 'react';
import { Trash2, CheckCircle, Navigation, Check, Search, AlertTriangle, User, Calendar, MapPin, Eye } from 'lucide-react';
import { CitizenReport } from '../types';

interface IncidentIntakeProps {
  reports: CitizenReport[];
  selectedReportId: string | null;
  onSelectReport: (reportId: string | null) => void;
  onVerify: (reportId: string, submitterId: string) => Promise<void>;
  onDispatch: (reportId: string, vehicleType: string, recommendationText: string) => Promise<void>;
  onResolve: (reportId: string) => Promise<void>;
  onDismiss: (reportId: string) => Promise<void>;
}

type FilterType = 'ALL' | 'PENDING' | 'DISPATCHED' | 'RESOLVED';

export default function IncidentIntake({
  reports,
  selectedReportId,
  onSelectReport,
  onVerify,
  onDispatch,
  onResolve,
  onDismiss
}: IncidentIntakeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterType>('ALL');

  const selectedReport = reports.find(r => r.id === selectedReportId);

  // Filters
  const filteredReports = reports.filter(report => {
    const isVerified = report.verified;
    const status = report.status || (isVerified ? 'Resolved' : 'Pending');
    
    if (statusFilter === 'PENDING' && (isVerified || report.status === 'Dispatched' || report.status === 'Resolved')) return false;
    if (statusFilter === 'DISPATCHED' && report.status !== 'Dispatched') return false;
    if (statusFilter === 'RESOLVED' && report.status !== 'Resolved') return false;

    const matchesSearch = 
      report.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.senderName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const getEmoji = (cat: string) => {
    switch (cat) {
      case 'Trash': return '🗑️';
      case 'Leaf': return '🍂';
      case 'Factory': return '🏭';
      case 'Smoke': return '💨';
      case 'Dust': return '🏗️';
      case 'Vehicular': return '🚗';
      default: return '🚨';
    }
  };

  const getStatusBadgeClass = (report: CitizenReport) => {
    if (report.status === 'Resolved') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (report.status === 'Dispatched') {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse';
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col h-full overflow-hidden shadow-sm">
      
      {/* Search and Filters Header */}
      <div className="flex flex-col gap-3 pb-3 border-b border-slate-200 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-sky-600" />
            <div>
              <h3 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">📥 INCIDENT INTAKE</h3>
              <p className="text-[9px] font-mono text-slate-500">Live report ingestion queue ({filteredReports.length})</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by category, district, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[11px] font-sans placeholder-slate-450 focus:outline-none focus:border-sky-500 text-slate-700"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex border border-slate-200 bg-slate-50 p-0.5 rounded-lg">
          {(['ALL', 'PENDING', 'DISPATCHED', 'RESOLVED'] as FilterType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`flex-1 py-1 rounded-md text-[9px] font-mono font-bold transition-all cursor-pointer ${
                statusFilter === tab 
                  ? 'bg-white text-sky-600 border border-slate-200 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[580px] overflow-hidden">
        
        {/* Left Side: Scrollable Feed */}
        <div className="overflow-y-auto space-y-2 pr-1 h-full">
          {filteredReports.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10 font-mono text-[10px]">
              <AlertTriangle className="w-6 h-6 text-slate-450 mb-1.5" />
              <span>No reports found</span>
            </div>
          ) : (
            filteredReports.map((report) => {
              const isSelected = selectedReportId === report.id;
              const statusText = report.status || (report.verified ? 'Verified' : 'Pending');
              
              return (
                <div
                  key={report.id}
                  onClick={() => onSelectReport(report.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col gap-2 relative ${
                    isSelected 
                      ? 'bg-slate-50 border-sky-500 shadow-sm' 
                      : 'bg-white border-slate-200 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none">{getEmoji(report.category)}</span>
                      <div>
                        <h4 className="text-[11px] font-extrabold text-slate-800 tracking-wide uppercase">{report.category}</h4>
                        <span className="text-[8.5px] font-mono text-slate-500 flex items-center gap-0.5 mt-0.5">
                          <MapPin className="w-2.5 h-2.5 text-slate-400" />
                          {report.city}, {report.state}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full border ${getStatusBadgeClass(report)}`}>
                        {statusText.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10.5px] text-slate-600 line-clamp-2 leading-relaxed">
                    {report.description}
                  </p>

                  <div className="flex justify-between items-center text-[8.5px] font-mono text-slate-500 pt-1.5 border-t border-slate-100">
                    <span>By: <span className="text-slate-700 font-semibold">@{report.senderName}</span></span>
                    <span className="text-rose-600 font-bold">+{report.aqi} AQI Modifier</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Side: Detail Inspector */}
        <div className="h-full border-t md:border-t-0 md:border-l border-slate-200 md:pl-4 overflow-y-auto">
          {selectedReport ? (
            <div className="flex flex-col gap-4 h-full pr-1">
              
              {/* Photo Evidence with watermarking style */}
              <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center min-h-[160px] max-h-[220px]">
                {selectedReport.imageUrl ? (
                  <>
                    <img
                      src={selectedReport.imageUrl}
                      alt="Citizen Evidence"
                      className="w-full h-full object-cover"
                    />
                    {/* Watermark overlay */}
                    <div className="absolute bottom-2 left-2 right-2 bg-white/90 border border-slate-200 px-2 py-1.5 rounded text-[8px] font-mono text-slate-600 flex flex-col gap-0.5 pointer-events-none">
                      <div className="flex justify-between">
                        <span>
                          LAT/LON: {typeof selectedReport.lat === 'number' && typeof selectedReport.lon === 'number'
                            ? `${selectedReport.lat.toFixed(4)}, ${selectedReport.lon.toFixed(4)}`
                            : 'MOCK WATERMARK'}
                        </span>
                        <span>{formatTimestamp(selectedReport.createdAt)}</span>
                      </div>
                      <div className="flex justify-between text-[7px] text-slate-500">
                        <span>PROJECT: clean-air-citizen</span>
                        <span>VERIFIED: {selectedReport.verified ? 'YES' : 'PEER PENDING'}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-slate-400 font-mono text-[9px]">
                    <span className="text-2xl mb-1">🖼️</span>
                    <span>No evidence photo uploaded</span>
                  </div>
                )}
              </div>

              {/* Details Pane */}
              <div className="space-y-3 flex-1">
                <div className="flex justify-between items-start border-b border-slate-200 pb-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                      <span>{getEmoji(selectedReport.category)}</span>
                      <span>{selectedReport.category} INCIDENT REPORT</span>
                    </h3>
                    <p className="text-[9px] font-mono text-slate-550">ID: {selectedReport.id}</p>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-rose-700 bg-rose-50 border border-rose-250 px-2 py-0.5 rounded-lg">
                    +{selectedReport.aqi} AQI Impact
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[9.5px] font-mono">
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg">
                    <span className="text-[8px] text-slate-500 block mb-0.5 uppercase">SUBMITTER PROFILE</span>
                    <span className="text-slate-800 font-bold block flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-500" /> @{selectedReport.senderName}
                    </span>
                    <span className="text-slate-500 text-[8.5px] block mt-0.5">UID: {selectedReport.userId.substring(0, 8)}...</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg">
                    <span className="text-[8px] text-slate-500 block mb-0.5 uppercase">TIME SUBMITTED</span>
                    <span className="text-slate-800 font-bold block flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" /> {formatTimestamp(selectedReport.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex flex-col gap-1">
                  <span className="text-[8px] text-slate-500 uppercase tracking-wide">LOCATION DETAIL</span>
                  <span className="text-slate-800 text-[10px] font-mono flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-sky-600" /> {selectedReport.city}, {selectedReport.state}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex flex-col gap-1.5">
                  <span className="text-[8px] text-slate-500 uppercase tracking-wide">INCIDENT DETAILS</span>
                  <p className="text-[11px] text-slate-700 leading-relaxed font-sans">
                    {selectedReport.description}
                  </p>
                </div>

                {selectedReport.dispatchLogs && selectedReport.dispatchLogs.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex flex-col gap-1">
                    <span className="text-[8px] text-amber-700 font-bold tracking-wide uppercase">DISPATCH TELEMETRY LOG</span>
                    <div className="space-y-1">
                      {selectedReport.dispatchLogs.map((log, idx) => (
                        <div key={idx} className="text-[9px] font-mono text-slate-600 flex items-start gap-1 leading-snug">
                          <span className="text-amber-600">▶</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons Panel */}
              <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 mt-auto">
                <button
                  onClick={() => onVerify(selectedReport.id, selectedReport.userId)}
                  disabled={selectedReport.verified}
                  className={`py-2 rounded-xl text-[9px] font-mono font-bold border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    selectedReport.verified
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-600 opacity-60 cursor-not-allowed'
                      : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>{selectedReport.verified ? 'VERIFIED ✓' : 'VERIFY (+100)'}</span>
                </button>

                <button
                  onClick={() => {
                    let vt = 'Water-Mist Truck';
                    if (selectedReport.category === 'Dust') vt = 'Road Sweeper';
                    if (selectedReport.category === 'Vehicular') vt = 'Anti-Smog Gun';
                    onDispatch(selectedReport.id, vt, `Manually Dispatched MCD ${vt} unit under order of Command Centre.`);
                  }}
                  disabled={selectedReport.status === 'Dispatched' || selectedReport.status === 'Resolved'}
                  className={`py-2 rounded-xl text-[9px] font-mono font-bold border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    selectedReport.status === 'Dispatched' || selectedReport.status === 'Resolved'
                      ? 'bg-amber-50 border-amber-200 text-amber-600 opacity-60 cursor-not-allowed'
                      : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700'
                  }`}
                >
                  <Navigation className="w-4 h-4" />
                  <span>{selectedReport.status === 'Dispatched' ? 'DISPATCHED' : selectedReport.status === 'Resolved' ? 'LOCKED' : 'DISPATCH CREW'}</span>
                </button>

                <button
                  onClick={() => onResolve(selectedReport.id)}
                  disabled={selectedReport.status === 'Resolved'}
                  className={`py-2 rounded-xl text-[9px] font-mono font-bold border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    selectedReport.status === 'Resolved'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-650 opacity-60 cursor-not-allowed'
                      : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{selectedReport.status === 'Resolved' ? 'RESOLVED ✓' : 'RESOLVE TICKET'}</span>
                </button>
              </div>

              <div className="flex justify-end mt-1.5 pb-1">
                <button
                  onClick={() => onDismiss(selectedReport.id)}
                  className="text-[9px] font-mono text-slate-500 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Dismiss & Delete Hazard
                </button>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16 text-center font-mono text-[10px]">
              <Eye className="w-8 h-8 text-slate-300 mb-2" />
              <span>Select an incident from the feed to inspect details and deploy MCD mitigation crews.</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
