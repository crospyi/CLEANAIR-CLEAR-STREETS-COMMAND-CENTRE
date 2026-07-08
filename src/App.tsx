import { useState, useEffect } from 'react';
import { Shield, Activity, ShieldCheck, CheckCircle, Navigation, Radio, Users, Volume2, VolumeX, LogIn, LogOut, AlertTriangle } from 'lucide-react';
import { db, auth, googleProvider } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  increment,
  arrayUnion,
  setDoc
} from 'firebase/firestore';
import { CitizenReport, AntiSmogVehicle } from './types';
import AiTriagePanel from './components/AiTriagePanel';
import IncidentIntake from './components/IncidentIntake';
import GisMapOverlay from './components/GisMapOverlay';
import BroadcastPanel from './components/BroadcastPanel';
import SpikesAnalytics from './components/SpikesAnalytics';

const DELHI_COORDS = { lat: 28.6139, lon: 77.2090 };

type OperationTab = 'incidents' | 'map' | 'analytics';

export default function App() {
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<OperationTab>('incidents');

  // Auth state
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Audio & Toast State
  const [audioFeedback, setAudioFeedback] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Anti-Smog Fleet State (Simulated GIS Movement)
  const [vehicles, setVehicles] = useState<AntiSmogVehicle[]>([
    {
      id: 'v1',
      name: 'Mist-Cannon Dwarka',
      type: 'Water-Mist Truck',
      lat: 28.5920,
      lon: 77.0460,
      status: 'Idle'
    },
    {
      id: 'v2',
      name: 'Road-Sweeper Noida-62',
      type: 'Road Sweeper',
      lat: 28.6250,
      lon: 77.3680,
      status: 'Idle'
    },
    {
      id: 'v3',
      name: 'Anti-Smog Gun CPCB',
      type: 'Anti-Smog Gun',
      lat: 28.5620,
      lon: 77.2810,
      status: 'Idle'
    }
  ]);

  // Audio sound feedback generator
  const playSound = (freq: number, duration: number, oscType: OscillatorType = 'sine') => {
    if (!audioFeedback) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = oscType;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Context block:", e);
    }
  };

  // Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // 1. Firebase Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  // 2. Real-time Firestore synchronization for Citizen Reports
  useEffect(() => {
    const q = query(
      collection(db, 'reports'),
      orderBy('createdAt', 'desc'),
      limit(80)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: CitizenReport[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          ...data
        } as CitizenReport);
      });
      setReports(list);
      setLoading(false);
      
      // Play alert chime if a new pending report arrives
      if (list.length > reports.length && reports.length > 0) {
        playSound(587.33, 0.25, 'triangle'); // high D note warning
        showToast("⚠️ Ingest Gateway: New micro-emission report uploaded by citizen.");
      }
    }, (err) => {
      console.error("Firestore sync error:", err);
      setLoading(false);
      showToast("❌ Connection error: Failed to sync reports from Firestore.");
    });

    return () => unsubscribe();
  }, [reports.length]);

  // 3. Simulated MCD Vehicle Navigation Pathfinding toward incidents
  useEffect(() => {
    const interval = setInterval(() => {
      setVehicles((prevVehicles) => {
        return prevVehicles.map((vehicle) => {
          if ((vehicle.status === 'Dispatched' || vehicle.status === 'Active') && vehicle.currentTask) {
            const reportId = vehicle.currentTask;
            const targetReport = reports.find(r => r.id === reportId);
            
            if (targetReport && targetReport.status !== 'Resolved') {
              const seed = targetReport.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
              const targetLat = DELHI_COORDS.lat + (((seed % 100) / 1000) - 0.05);
              const targetLon = DELHI_COORDS.lon + ((((seed * 17) % 100) / 1000) - 0.05);

              const dLat = targetLat - vehicle.lat;
              const dLon = targetLon - vehicle.lon;
              const distance = Math.sqrt(dLat * dLat + dLon * dLon);

              if (distance < 0.003) {
                return {
                  ...vehicle,
                  lat: targetLat,
                  lon: targetLon,
                  status: 'Active',
                };
              } else {
                return {
                  ...vehicle,
                  lat: vehicle.lat + dLat * 0.10,
                  lon: vehicle.lon + dLon * 0.10
                };
              }
            } else {
              return {
                ...vehicle,
                status: 'Idle',
                currentTask: undefined
              };
            }
          }

          const patrolAngle = (Date.now() / 15000) + (vehicle.id === 'v1' ? 0 : vehicle.id === 'v2' ? 2 : 4);
          const patrolRadius = 0.0006;
          const baseLat = vehicle.id === 'v1' ? 28.5920 : vehicle.id === 'v2' ? 28.6250 : 28.5620;
          const baseLon = vehicle.id === 'v1' ? 77.0460 : vehicle.id === 'v2' ? 77.3680 : 77.2810;
          
          return {
            ...vehicle,
            lat: baseLat + Math.cos(patrolAngle) * patrolRadius,
            lon: baseLon + Math.sin(patrolAngle) * patrolRadius
          };
        });
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [reports]);

  // Authenticate user with Google Popup
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      playSound(523.25, 0.15, 'sine');
      showToast("🏛️ Welcome Officer! High-authority admin console verified.");
    } catch (err) {
      console.error(err);
      showToast("❌ Google Auth cancelled or failed.");
    }
  };

  // Sign out user
  const handleSignOut = async () => {
    await signOut(auth);
    playSound(261.63, 0.2, 'sine');
    showToast("🔒 Securely logged out of administrative console.");
  };

  // Action 1: Verify Report (rewards submitter +100 points)
  const handleVerifyReport = async (reportId: string, submitterId: string) => {
    if (!user) {
      playSound(220, 0.15, 'sawtooth');
      showToast("⚠️ Authentication Required: Sign in with Google to perform official verification.");
      return;
    }

    try {
      const reportRef = doc(db, 'reports', reportId);
      await updateDoc(reportRef, {
        verified: true
      });

      if (submitterId) {
        const userRef = doc(db, 'users', submitterId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          await updateDoc(userRef, {
            points: increment(100)
          });
        }
      }

      // Send automated notification in read-only municipal channel to notify the user
      const report = reports.find(r => r.id === reportId);
      if (report) {
        const msgId = `update-${Date.now()}`;
        const timestampStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const updateMsg = {
          id: msgId,
          senderName: "🏛️ Municipal Authority",
          senderId: "municipal_authority",
          avatar: "🏛️",
          state: report.state,
          city: report.city,
          text: `📢 @${report.senderName}, your report on "${report.category}" has been verified by the Municipal Authority. Thank you for your contribution!`,
          timestamp: timestampStr,
          createdAt: Date.now(),
          communityId: 'municipal_updates'
        };
        await setDoc(doc(collection(db, 'community_messages'), msgId), updateMsg);
      }

      playSound(659.25, 0.12, 'sine');
      showToast("✅ Incident verified! +100 points awarded to citizen submitter.");
    } catch (err) {
      console.error(err);
      showToast("❌ Failed to verify report in Firestore.");
    }
  };

  // Action 2: Dispatch Crew
  const handleDispatchCrew = async (reportId: string, vehicleType: string, recommendationText: string) => {
    if (!user) {
      playSound(220, 0.15, 'sawtooth');
      showToast("⚠️ Authentication Required: Sign in with Google to dispatch MCD crews.");
      return;
    }

    try {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = `[${timestamp}] Dispatched ${vehicleType}. Mission: ${recommendationText}`;

      const reportRef = doc(db, 'reports', reportId);
      await updateDoc(reportRef, {
        status: 'Dispatched',
        dispatchLogs: arrayUnion(logEntry)
      });

      setVehicles((prev) => {
        let found = false;
        return prev.map((v) => {
          if (!found && v.type === vehicleType) {
            found = true;
            return {
              ...v,
              status: 'Dispatched',
              currentTask: reportId
            };
          }
          return v;
        });
      });

      // Send automated notification in read-only municipal channel to notify the user
      const report = reports.find(r => r.id === reportId);
      if (report) {
        const msgId = `update-${Date.now()}`;
        const timestampStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const updateMsg = {
          id: msgId,
          senderName: "🏛️ Municipal Authority",
          senderId: "municipal_authority",
          avatar: "🏛️",
          state: report.state,
          city: report.city,
          text: `🚚 Dispatch Alert for @${report.senderName}: A ${vehicleType} has been dispatched to coordinate response to your "${report.category}" report in ${report.city}. Mission: ${recommendationText}`,
          timestamp: timestampStr,
          createdAt: Date.now(),
          communityId: 'municipal_updates'
        };
        await setDoc(doc(collection(db, 'community_messages'), msgId), updateMsg);
      }

      playSound(440, 0.18, 'sine');
      showToast(`🚚 Dispatch approved! MCD ${vehicleType} routing to coordinates.`);
    } catch (err) {
      console.error(err);
      showToast("❌ Dispatch order rejected by database.");
    }
  };

  // Action 3: Resolve Ticket
  const handleResolveReport = async (reportId: string) => {
    if (!user) {
      playSound(220, 0.15, 'sawtooth');
      showToast("⚠️ Authentication Required: Sign in with Google to resolve tickets.");
      return;
    }

    try {
      const reportRef = doc(db, 'reports', reportId);
      await updateDoc(reportRef, {
        status: 'Resolved',
        verified: true
      });

      setVehicles(prev => prev.map(v => 
        v.currentTask === reportId 
          ? { ...v, status: 'Idle', currentTask: undefined } 
          : v
      ));

      // Send automated notification in read-only municipal channel to notify the user
      const report = reports.find(r => r.id === reportId);
      if (report) {
        const msgId = `update-${Date.now()}`;
        const timestampStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const updateMsg = {
          id: msgId,
          senderName: "🏛️ Municipal Authority",
          senderId: "municipal_authority",
          avatar: "🏛️",
          state: report.state,
          city: report.city,
          text: `✅ Resolution Update: The "${report.category}" report submitted by @${report.senderName} in ${report.city} has been resolved. Containment/cleanup completed.`,
          timestamp: timestampStr,
          createdAt: Date.now(),
          communityId: 'municipal_updates'
        };
        await setDoc(doc(collection(db, 'community_messages'), msgId), updateMsg);
      }

      playSound(880, 0.15, 'sine');
      showToast("❇️ incident resolved. Containment systems reported clean.");
    } catch (err) {
      console.error(err);
      showToast("❌ Failed to close ticket.");
    }
  };

  // Action 4: Dismiss / Delete
  const handleDismissReport = async (reportId: string) => {
    if (!user) {
      playSound(220, 0.15, 'sawtooth');
      showToast("⚠️ Authentication Required: Sign in to dismiss incidents.");
      return;
    }
    if (!window.confirm("Are you sure you want to dismiss and delete this hazard?")) return;

    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setSelectedReportId(null);
      playSound(329.63, 0.25, 'sine');
      showToast("🗑️ Incident report dismissed and removed from global ingestion.");
    } catch (err) {
      console.error(err);
      showToast("❌ Failed to delete report document.");
    }
  };

  const verifiedCount = reports.filter(r => r.verified).length;
  const pendingCount = reports.filter(r => !r.verified && r.status !== 'Resolved').length;
  const activeMcdVehicles = vehicles.filter(v => v.status !== 'Idle').length;

  return (
    <div className="w-full min-h-screen flex flex-col bg-[#FAF9F6] text-slate-800 font-sans relative cyber-scan pb-12 animate-fadeIn">
      
      {/* Toast Notification HUD */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[9999] bg-white border border-sky-500/80 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 max-w-sm animate-fadeIn backdrop-blur-xl">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>
          <span className="text-[10px] font-mono tracking-wide text-slate-755">{toastMessage}</span>
        </div>
      )}

      {/* Header Panel */}
      <header className="h-[60px] border-b border-slate-200 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-30 relative shadow-xs">
        {/* Title */}
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-sky-650 animate-pulse" />
          <div>
            <h1 className="text-sm font-black font-mono tracking-widest bg-gradient-to-r from-sky-600 via-emerald-600 to-indigo-600 bg-clip-text text-transparent uppercase">
              CLEANAIR & CLEAR STREETS COMMAND CENTRE
            </h1>
            <p className="text-[9px] font-mono text-slate-450">MCD Delhi High-Authority Operations Control Console</p>
          </div>
        </div>

        {/* Live system state badges */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[9px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-slate-500">INGEST GATEWAY:</span>
            <span className="text-slate-700 font-bold">ONLINE</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[9px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            <span className="text-slate-500">SATELLITE SYNC:</span>
            <span className="text-slate-700 font-bold">STABLE</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[9px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-slate-500">MCD FLEET:</span>
            <span className="text-slate-700 font-bold">PATHFINDING</span>
          </div>
        </div>

        {/* Auth status & Audio Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAudioFeedback(!audioFeedback)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
            title={audioFeedback ? "Mute interface feedback" : "Unmute interface feedback"}
          >
            {audioFeedback ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {authLoading ? (
            <span className="w-4 h-4 border border-slate-400 border-t-transparent rounded-full animate-spin"></span>
          ) : user ? (
            <div className="flex items-center gap-2.5">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-850">{user.displayName || 'Official Admin'}</span>
                <span className="text-[8px] font-mono text-emerald-600">MCD Official ✓</span>
              </div>
              <img
                src={user.photoURL || 'https://api.dicebear.com/7.x/identicon/svg?seed=admin'}
                alt="Profile"
                className="w-7 h-7 rounded-full border border-slate-200"
              />
              <button
                onClick={handleSignOut}
                className="p-1.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-500 hover:text-rose-600 rounded-lg transition-all cursor-pointer"
                title="Disconnect Administrative Credentials"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[10px] font-mono font-bold tracking-wider flex items-center gap-1.5 shadow-md shadow-sky-950/10 transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>OFFICER SIGN IN</span>
            </button>
          )}
        </div>
      </header>

      {/* Top statistics dashboard widget */}
      <div className="bg-[#FAF9F6] px-6 py-3 border-b border-slate-200 shrink-0 grid grid-cols-1 md:grid-cols-4 gap-4 z-20">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex flex-col justify-between shadow-xs">
          <span className="text-[8.5px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1">
            <Activity className="w-3 h-3 text-sky-600" /> TOTAL INCIDENTS INGESTED
          </span>
          <div className="flex justify-between items-baseline mt-1.5">
            <span className="text-xl font-extrabold font-mono tracking-tight text-slate-800">{reports.length}</span>
            <span className="text-[8.5px] font-mono text-slate-455">Last 24h</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex flex-col justify-between shadow-xs">
          <span className="text-[8.5px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" /> OFFICIALLY VERIFIED
          </span>
          <div className="flex justify-between items-baseline mt-1.5">
            <span className="text-xl font-extrabold font-mono tracking-tight text-emerald-600">{verifiedCount}</span>
            <span className="text-[8.5px] font-mono text-slate-455">Points Disbursed</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex flex-col justify-between shadow-xs">
          <span className="text-[8.5px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-600 animate-pulse" /> PENDING TRIAGE
          </span>
          <div className="flex justify-between items-baseline mt-1.5">
            <span className="text-xl font-extrabold font-mono tracking-tight text-rose-600">{pendingCount}</span>
            <span className="text-[8.5px] font-mono text-rose-500 font-bold">Priority Triage Active</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex flex-col justify-between shadow-xs">
          <span className="text-[8.5px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1">
            <Navigation className="w-3 h-3 text-amber-500 animate-spin-slow" /> ACTIVE MCD VEHICLES
          </span>
          <div className="flex justify-between items-baseline mt-1.5">
            <span className="text-xl font-extrabold font-mono tracking-tight text-amber-600">{activeMcdVehicles} / {vehicles.length}</span>
            <span className="text-[8.5px] font-mono text-slate-455">Realtime GPS Tracking</span>
          </div>
        </div>
      </div>

      {/* Operations Navigation Tab Bar */}
      <div className="px-6 border-b border-slate-200 bg-white/70 py-1.5 flex gap-2 shrink-0 z-20 shadow-xs">
        <button
          onClick={() => setActiveTab('incidents')}
          className={`px-4 py-2 text-xs font-mono font-black tracking-wide rounded-xl border transition-all cursor-pointer ${
            activeTab === 'incidents'
              ? 'bg-sky-50 border-sky-300 text-sky-700 shadow-xs'
              : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          📋 INCIDENT CONTROL & TRIAGE
        </button>

        <button
          onClick={() => setActiveTab('map')}
          className={`px-4 py-2 text-xs font-mono font-black tracking-wide rounded-xl border transition-all cursor-pointer ${
            activeTab === 'map'
              ? 'bg-sky-50 border-sky-300 text-sky-700 shadow-xs'
              : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          🗺️ GIS COMMAND GRID
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 text-xs font-mono font-black tracking-wide rounded-xl border transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-sky-50 border-sky-300 text-sky-700 shadow-xs'
              : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          📈 ANALYTICS & ALERTS
        </button>
      </div>

      {/* Main Command Dashboard Panels Layout */}
      <main className="flex-1 p-6 relative z-10 bg-[#FAF9F6] min-h-0">
        {loading ? (
          <div className="w-full h-[300px] flex flex-col items-center justify-center gap-3">
            <span className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></span>
            <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Ingesting Firestore Collections...</span>
          </div>
        ) : (
          <div className="w-full">
            
            {/* Tab 1: Incident Ingest & Triage */}
            {activeTab === 'incidents' && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start animate-fadeIn">
                <div className="lg:col-span-2">
                  <AiTriagePanel
                    reports={reports}
                    onDispatch={handleDispatchCrew}
                    onShowToast={showToast}
                  />
                </div>
                <div className="lg:col-span-3">
                  <IncidentIntake
                    reports={reports}
                    selectedReportId={selectedReportId}
                    onSelectReport={setSelectedReportId}
                    onVerify={handleVerifyReport}
                    onDispatch={handleDispatchCrew}
                    onResolve={handleResolveReport}
                    onDismiss={handleDismissReport}
                  />
                </div>
              </div>
            )}

            {/* Tab 2: GIS Command Grid Map & Fleet Status */}
            {activeTab === 'map' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start animate-fadeIn">
                <div className="lg:col-span-3">
                  <GisMapOverlay
                    reports={reports}
                    vehicles={vehicles}
                    selectedReportId={selectedReportId}
                    onSelectReport={setSelectedReportId}
                    onShowToast={showToast}
                  />
                </div>
                <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-4">
                  <h3 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase flex items-center gap-1.5 border-b border-slate-200 pb-2">
                    <Navigation className="w-4 h-4 text-amber-500 animate-pulse" /> LIVE FLEET STATUS
                  </h3>
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] pr-1">
                    {vehicles.map((v) => {
                      const color = v.status === 'Active' ? 'text-emerald-600 bg-emerald-50' : v.status === 'Dispatched' ? 'text-amber-600 bg-amber-50' : 'text-slate-500 bg-slate-50';
                      return (
                        <div key={v.id} className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col gap-1.5 text-[10px] font-mono shadow-inner">
                          <div className="flex justify-between font-bold text-slate-800">
                            <span>{v.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${color}`}>
                              {v.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-slate-450 text-[9px]">{v.type}</div>
                          <div className="text-slate-500 text-[8.5px] mt-0.5 flex justify-between">
                            <span>Coord:</span>
                            <span>{v.lat.toFixed(4)}, {v.lon.toFixed(4)}</span>
                          </div>
                          {v.currentTask && (
                            <div className="text-[8.5px] text-sky-700 bg-sky-50 border border-sky-100 rounded px-1.5 py-1 mt-1 flex flex-col gap-0.5 leading-snug">
                              <span className="font-bold">ACTIVE INCIDENT DISPATCH:</span>
                              <span className="text-[7.5px] truncate">Incident: {v.currentTask}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Analytics & Broadcast Panel */}
            {activeTab === 'analytics' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-fadeIn">
                <SpikesAnalytics reports={reports} />
                <BroadcastPanel onShowToast={showToast} />
              </div>
            )}

          </div>
        )}
      </main>

    </div>
  );
}
