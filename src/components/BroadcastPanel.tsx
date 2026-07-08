import { useState } from 'react';
import { Radio, Send } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, setDoc, doc } from 'firebase/firestore';

interface BroadcastPanelProps {
  onShowToast: (msg: string) => void;
}

const INDIAN_STATES_CITIES = [
  {
    stateName: 'Delhi NCR',
    cities: ['New Delhi', 'Noida', 'Gurugram', 'Faridabad']
  },
  {
    stateName: 'Maharashtra',
    cities: ['Mumbai', 'Pune', 'Nagpur']
  },
  {
    stateName: 'Karnataka',
    cities: ['Bengaluru', 'Mysuru']
  },
  {
    stateName: 'Uttar Pradesh',
    cities: ['Lucknow', 'Kanpur']
  }
];

export default function BroadcastPanel({ onShowToast }: BroadcastPanelProps) {
  const [targetState, setTargetState] = useState('Delhi NCR');
  const [targetCity, setTargetCity] = useState('New Delhi');
  const [grapStage, setGrapStage] = useState<number>(1);
  const [alertText, setAlertText] = useState('');
  const [sending, setSending] = useState(false);

  const handleStateChange = (stateName: string) => {
    setTargetState(stateName);
    const stateObj = INDIAN_STATES_CITIES.find(s => s.stateName === stateName);
    if (stateObj && stateObj.cities.length > 0) {
      setTargetCity(stateObj.cities[0]);
    } else {
      setTargetCity('All');
    }
  };

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertText.trim()) return;

    setSending(true);
    const alertId = `broadcast-${Date.now()}`;
    const cleanMsg = alertText.trim();

    const formattedText = `🛡️ [OFFICIAL WARNING] ${cleanMsg} (GRAP Stage ${grapStage} enforced)`;

    const broadcastData = {
      id: alertId,
      senderName: "CPCB / MCD Admin",
      avatar: "🏛️",
      senderId: "cpcb_mcd_admin_broadcast",
      state: targetState,
      city: targetCity,
      text: formattedText,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
      isUser: false,
      communityId: `${targetState.toLowerCase().replace(/\s+/g, '-')}_${targetCity.toLowerCase().replace(/\s+/g, '-')}`
    };

    try {
      await setDoc(doc(collection(db, 'community_messages'), alertId), broadcastData);
      
      const globalAlertId = `${alertId}-global`;
      await setDoc(doc(collection(db, 'community_messages'), globalAlertId), {
        ...broadcastData,
        id: globalAlertId,
        communityId: 'municipal_general',
        city: 'National Board'
      });

      setAlertText('');
      onShowToast(`📢 Official Broadcast sent to ${targetCity} (${targetState}) channels!`);
    } catch (err) {
      console.error("Broadcast write failed:", err);
      onShowToast("❌ Failed to broadcast alert message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col h-full shadow-sm">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200 mb-3">
        <Radio className="w-5 h-5 text-rose-500 animate-pulse" />
        <div>
          <h3 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">📢 BROADCAST CENTRE</h3>
          <p className="text-[9px] font-mono text-slate-500">Publish alerts directly to citizen channels</p>
        </div>
      </div>

      <form onSubmit={handleBroadcastSubmit} className="flex-1 flex flex-col gap-4 text-xs font-mono">
        
        {/* Targets Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[8.5px] font-bold text-slate-500 uppercase">TARGET REGION</label>
            <select
              value={targetState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-sky-500 text-slate-700 font-mono"
            >
              {INDIAN_STATES_CITIES.map((s) => (
                <option key={s.stateName} value={s.stateName}>
                  {s.stateName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[8.5px] font-bold text-slate-500 uppercase">TARGET MUNICIPALITY</label>
            <select
              value={targetCity}
              onChange={(e) => setTargetCity(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-sky-500 text-slate-700 font-mono"
            >
              {INDIAN_STATES_CITIES.find(s => s.stateName === targetState)?.cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              )) || <option value="All">All Cities</option>}
            </select>
          </div>
        </div>

        {/* GRAP Stages */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[8.5px] font-bold text-slate-500 uppercase flex justify-between">
            <span>🚨 GRAP PROTOCOL STAGE</span>
            <span className="text-[8.5px] text-amber-600 font-bold">STAGE {grapStage} ACTIVE</span>
          </label>
          
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((stage) => {
              const borderColors = [
                'border-emerald-250 hover:border-emerald-400',
                'border-amber-250 hover:border-amber-400',
                'border-orange-250 hover:border-orange-400',
                'border-rose-250 hover:border-rose-400'
              ];
              const selectColors = [
                'bg-emerald-50 border-emerald-500 text-emerald-700',
                'bg-amber-50 border-amber-500 text-amber-700',
                'bg-orange-50 border-orange-500 text-orange-700',
                'bg-rose-50 border-rose-500 text-rose-700'
              ];
              
              const isSelected = grapStage === stage;
              
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setGrapStage(stage)}
                  className={`py-2 rounded-xl border text-[9.5px] font-bold transition-all cursor-pointer text-center ${
                    isSelected ? selectColors[stage - 1] : `bg-slate-50/60 text-slate-400 ${borderColors[stage - 1]}`
                  }`}
                >
                  <div>Stage {stage}</div>
                  <div className="text-[6.5px] font-mono opacity-80 mt-0.5">
                    {stage === 1 && 'Poor'}
                    {stage === 2 && 'V. Poor'}
                    {stage === 3 && 'Severe'}
                    {stage === 4 && 'Severe+'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Advisory Text */}
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-[8.5px] font-bold text-slate-500 uppercase">ADVISORY MESSAGE DESCRIPTION</label>
          <textarea
            value={alertText}
            onChange={(e) => setAlertText(e.target.value)}
            placeholder="e.g. Commercial diesel generator sets prohibited across Noida. Halt non-essential brick kiln operations immediately."
            rows={4}
            className="flex-1 bg-slate-55 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-sky-500 text-slate-700 font-sans resize-none text-[11px] leading-relaxed placeholder-slate-400"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={sending || !alertText.trim()}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-500 hover:from-rose-450 hover:to-indigo-455 text-white font-bold text-[10.5px] tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-rose-100 hover:shadow-rose-200 active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {sending ? (
            <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>BROADCAST OFFICIAL WARNING</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
