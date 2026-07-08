import { useState, useEffect } from 'react';
import { Sparkles, CheckCircle, ShieldAlert, Zap, AlertTriangle, Key, Cpu } from 'lucide-react';
import { CitizenReport } from '../types';
import { GoogleGenAI } from '@google/genai';

interface AiTriagePanelProps {
  reports: CitizenReport[];
  onDispatch: (reportId: string, vehicleType: string, recommendationText: string) => Promise<void>;
  onShowToast: (msg: string) => void;
}

interface PrioritizedTask {
  report: CitizenReport;
  priority: 'HIGHEST' | 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  reason: string;
  recommendation: string;
  isGenerating?: boolean;
}

export default function AiTriagePanel({
  reports,
  onDispatch,
  onShowToast
}: AiTriagePanelProps) {
  const [tasks, setTasks] = useState<PrioritizedTask[]>([]);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('GEMINI_API_KEY') || (import.meta as any).env.VITE_GEMINI_API_KEY || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [globalGenerating, setGlobalGenerating] = useState(false);

  // Local Heuristic prioritizing Engine
  const evaluateHeuristicPriority = (report: CitizenReport, allReports: CitizenReport[]): PrioritizedTask => {
    let score = 50;
    let reason = 'Standard municipal environmental event.';
    let priority: 'HIGHEST' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    let recommendation = '';

    const descLower = report.description.toLowerCase();
    const hasSensitiveKeyword = 
      descLower.includes('hospital') || 
      descLower.includes('school') || 
      descLower.includes('clinic') || 
      descLower.includes('college') ||
      descLower.includes('university') ||
      descLower.includes('child') || 
      descLower.includes('kid') || 
      descLower.includes('patient') ||
      descLower.includes('icu') ||
      descLower.includes('senior') ||
      descLower.includes('elderly') ||
      descLower.includes('resident') ||
      descLower.includes('housing') ||
      descLower.includes('market');

    if ((report.category === 'Factory' || report.category === 'Trash') && hasSensitiveKeyword) {
      priority = 'HIGHEST';
      score = 95;
      reason = `Critical combustion/chemical event (${report.category === 'Trash' ? 'Garbage Burning' : 'Industrial Smog'}) reported near sensitive population centers (hospitals/schools/housing).`;
      recommendation = `Dispatch nearest Water-Mist Cannon truck immediately. Alert environmental enforcement inspectors to levy emergency cease-operations penalty.`;
    } 
    else {
      const overlapping = allReports.filter(r => 
        r.id !== report.id && 
        r.status !== 'Resolved' &&
        r.city.toLowerCase() === report.city.toLowerCase() && 
        r.category === report.category
      );

      if (overlapping.length >= 1) {
        priority = 'HIGH';
        score = 80;
        reason = `Hotspot Alert: Multiple overlapping reports (${overlapping.length + 1} incidents) of ${report.category} in ${report.city} sector.`;
        
        if (report.category === 'Trash') {
          recommendation = `Deploy localized MCD trash patrol to extinguish fire and issue dumping citation in ${report.city}.`;
        } else if (report.category === 'Factory') {
          recommendation = `Inspect all small-scale smelting/kiln units in ${report.city}. Verify air scrubbers are active.`;
        } else if (report.category === 'Dust') {
          recommendation = `Deploy heavy Road Sweeping Unit to ${report.city}. Instruct construction project managers to apply water sprayers.`;
        } else {
          recommendation = `Deploy anti-smog gun vehicle to patrol and suppress emissions in the ${report.city} zone.`;
        }
      } 
      else if (report.category === 'Dust' || report.category === 'Vehicular') {
        priority = 'HIGH';
        score = 70;
        reason = `Standard environmental compliance: Active ${report.category === 'Dust' ? 'construction dust plume' : 'vehicle exhaust load'}.`;
        recommendation = report.category === 'Dust' 
          ? `Deploy Road Sweeping Unit and check compliance with green-net wrapping rules in ${report.city}.`
          : `Deploy local traffic enforcement to check PUC certifications for heavy trucks in ${report.city}.`;
      } 
      else {
        priority = 'MEDIUM';
        score = 55;
        reason = `Minor localized pollution source: ${report.category} emissions.`;
        
        if (report.category === 'Leaf') {
          recommendation = `Alert local park rangers to suppress green leaves burning and divert waste to composting yards.`;
        } else {
          recommendation = `Instruct local municipality sanitary inspector to monitor and extinguish ${report.category} sources.`;
        }
      }
    }

    return { report, priority, score, reason, recommendation };
  };

  useEffect(() => {
    const unverifiedReports = reports.filter(r => !r.verified && r.status !== 'Resolved' && r.status !== 'Dispatched');
    const evaluated = unverifiedReports.map(report => evaluateHeuristicPriority(report, reports));
    evaluated.sort((a, b) => b.score - a.score);
    setTasks(evaluated);
  }, [reports]);

  const handleSaveApiKey = (key: string) => {
    const cleanKey = key.trim();
    setApiKey(cleanKey);
    localStorage.setItem('GEMINI_API_KEY', cleanKey);
    if (cleanKey) {
      onShowToast("🔑 Gemini API Key saved locally.");
    } else {
      onShowToast("🔓 Gemini API Key removed. Reverting to Heuristic Engine.");
    }
  };

  const handleRefineWithGemini = async () => {
    if (!apiKey) {
      onShowToast("⚠️ Please enter a Gemini API Key to activate live AI generation.");
      return;
    }
    if (tasks.length === 0) {
      onShowToast("🍃 No active pending reports to analyze.");
      return;
    }

    setGlobalGenerating(true);
    const updatedTasks = [...tasks];

    try {
      const ai = new GoogleGenAI({ apiKey });

      const refinementPromises = tasks.map(async (task, index) => {
        updatedTasks[index] = { ...task, isGenerating: true };
        setTasks([...updatedTasks]);

        const prompt = `
          You are the Chief Environmental AI Officer for the Delhi MCD Command Centre.
          Analyze this citizen-reported air pollution incident:
          - Category: ${task.report.category}
          - Description: "${task.report.description}"
          - Location: ${task.report.city}, ${task.report.state}
          - Impact modifier: +${task.report.aqi} AQI

          Provide a professional 1-sentence action-plan recommendation for municipal responders.
          Keep it highly practical and concise. Focus on assigning assets (like "Water-Mist Cannon trucks", "Road Sweeping Units", "composting wardens", "pollution inspectors") and enforcement penalties. Do not write intros or outros.
        `;

        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });

          const responseText = response.text ? response.text.trim() : null;
          if (responseText) {
            updatedTasks[index] = {
              ...task,
              recommendation: responseText,
              reason: `✨ Live Gemini Triage: Context-aware analysis of local coordinates.`,
              isGenerating: false
            };
          }
        } catch (err: any) {
          console.error(err);
          updatedTasks[index] = {
            ...task,
            isGenerating: false,
            reason: `⚠️ Gemini failure: ${err.message || 'Unknown error'}. Local heuristic active.`
          };
        }
        setTasks([...updatedTasks]);
      });

      await Promise.all(refinementPromises);
      onShowToast("✨ AI Triage Checklist optimized via Google Gemini API.");
    } catch (err) {
      console.error(err);
      onShowToast("❌ Failed to contact Gemini API. Heuristic fallback is active.");
    } finally {
      setGlobalGenerating(false);
    }
  };

  const handleApproveDispatch = async (task: PrioritizedTask) => {
    let vehicleType = 'Water-Mist Truck';
    if (task.report.category === 'Dust') {
      vehicleType = 'Road Sweeper';
    } else if (task.report.category === 'Vehicular') {
      vehicleType = 'Anti-Smog Gun';
    }

    try {
      await onDispatch(task.report.id, vehicleType, task.recommendation);
      onShowToast(`🚀 Crew Dispatched: ${task.report.category} in ${task.report.city}.`);
    } catch (err) {
      console.error(err);
      onShowToast("❌ Failed to record crew dispatch.");
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col h-full overflow-hidden shadow-sm">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3 z-10">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-emerald-600 animate-pulse" />
          <div>
            <h3 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">🤖 AI PRIORITIZATION BOX</h3>
            <p className="text-[9px] font-mono text-slate-500">Auto-triage unverified citizen reports</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className={`p-1.5 rounded-lg border text-slate-500 hover:text-slate-800 transition-all cursor-pointer ${
              apiKey ? 'border-emerald-250 bg-emerald-50 text-emerald-750' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
            }`}
            title="Configure Gemini API Key"
          >
            <Key className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleRefineWithGemini}
            disabled={globalGenerating || tasks.length === 0}
            className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[10px] font-mono font-bold text-sky-700 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className={`w-3 h-3 ${globalGenerating ? 'animate-spin' : ''}`} />
            <span>Refine AI</span>
          </button>
        </div>
      </div>

      {/* API Key Modal Panel */}
      {showKeyInput && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 animate-fadeIn">
          <span className="text-[9px] font-bold font-mono text-slate-655 uppercase block mb-1">Set Google Gemini API Key</span>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="Paste your GEMINI_API_KEY..."
              value={apiKey}
              onChange={(e) => handleSaveApiKey(e.target.value)}
              className="flex-1 bg-white border border-slate-200 text-[11px] font-mono text-slate-800 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={() => setShowKeyInput(false)}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-250 text-slate-700 text-[10px] font-mono rounded-lg transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
          <p className="text-[8px] font-mono text-slate-500 mt-1.5 leading-relaxed">
            API key is stored client-side in localStorage and enables the <b>gemini-2.5-flash</b> model to generate context-specific hazard responses.
          </p>
        </div>
      )}

      {/* Task Checklist Feed */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {tasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-12 text-center text-slate-400 font-mono text-[10px]">
            <CheckCircle className="w-8 h-8 text-emerald-500/20 mb-2" />
            <span>Clear Grid Status:</span>
            <span className="text-slate-500 mt-0.5">No unverified incident tickets pending triage.</span>
          </div>
        ) : (
          tasks.map((task) => {
            const theme = task.priority === 'HIGHEST' 
              ? { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-250', shadow: 'shadow-rose-100/10' }
              : task.priority === 'HIGH'
              ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-250', shadow: 'shadow-amber-100/10' }
              : { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-250', shadow: 'shadow-blue-100/10' };

            return (
              <div 
                key={task.report.id} 
                className={`p-3.5 rounded-xl border bg-white hover:bg-slate-50/55 transition-all flex flex-col gap-2.5 shadow-sm relative ${theme.border} ${theme.shadow}`}
              >
                {/* Task Title Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full flex items-center gap-1 ${theme.bg} ${theme.text} border ${theme.border}`}>
                      {task.priority === 'HIGHEST' && <ShieldAlert className="w-2.5 h-2.5" />}
                      {task.priority === 'HIGH' && <AlertTriangle className="w-2.5 h-2.5" />}
                      {task.priority} (Score: {task.score})
                    </span>
                    <span className="text-[10px] font-mono text-slate-700 font-semibold">{task.report.city}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">{task.report.category}</span>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed italic pl-1 border-l border-slate-200">
                  "{task.report.description}"
                </p>

                <div className="text-[9px] font-mono text-slate-500 flex items-start gap-1">
                  <span className="text-emerald-600">►</span>
                  <span className="leading-tight">{task.reason}</span>
                </div>

                {/* Auto Recommendation Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mt-0.5 flex flex-col gap-1.5">
                  <span className="text-[8.5px] font-bold font-mono text-slate-550 tracking-wider uppercase flex items-center gap-1">
                    <Zap className="w-3 h-3 text-sky-600" /> RECOMMENDED RESPONSE:
                  </span>
                  
                  {task.isGenerating ? (
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 py-1">
                      <span className="w-3 h-3 border border-sky-500 border-t-transparent rounded-full animate-spin"></span>
                      <span>Gemini is generating mitigation plan...</span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-750 leading-normal font-sans">
                      {task.recommendation}
                    </p>
                  )}
                </div>

                <div className="flex justify-end mt-1">
                  <button
                    onClick={() => handleApproveDispatch(task)}
                    disabled={task.isGenerating}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[9.5px] font-bold font-mono transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>✓ APPROVE RECOMMENDATION & DISPATCH</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
