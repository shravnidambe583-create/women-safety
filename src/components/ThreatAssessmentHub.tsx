import React, { useState, useEffect } from 'react';
import { ShieldAlert, Sparkles, AlertOctagon, HelpCircle, Loader2, ArrowRightLeft, MapPin, CheckCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { ThreatAssessment } from '../types';

interface ThreatAssessmentHubProps {
  userId: string | null | undefined;
}

export default function ThreatAssessmentHub({ userId }: ThreatAssessmentHubProps) {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<ThreatAssessment | null>(null);
  const [history, setHistory] = useState<ThreatAssessment[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Retrieve current location for threat accuracy
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => {
          console.warn("Could not retrieve precise location for threat scan:", err.message);
        }
      );
    }
  }, []);

  // Sync historical threat logs from Firestore
  useEffect(() => {
    if (!userId) {
      setHistory([]);
      return;
    }

    try {
      const q = query(
        collection(db, "users", userId, "assessments"),
        orderBy("createdAt", "desc"),
        limit(10)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const logs: ThreatAssessment[] = [];
        snapshot.forEach((doc) => {
          logs.push(doc.data() as ThreatAssessment);
        });
        setHistory(logs);
      }, (err) => {
        console.error("Failed to stream threat assessment history:", err);
        handleFirestoreError(err, OperationType.GET, `users/${userId}/assessments`);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Error establishing Firestore threat logs stream:", err);
    }
  }, [userId]);

  const handleAssessThreat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || loading) return;

    setLoading(true);
    setCurrentResult(null);
    setErrorMsg('');

    try {
      const response = await fetch("/api/gemini/assess-threat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description,
          location: coords,
          userId: userId || null
        })
      });

      if (!response.ok) {
        throw new Error("Assessment server returned error status.");
      }

      const data = await response.json();
      setCurrentResult(data);
      setDescription('');
    } catch (err: any) {
      console.error("Threat evaluation request failed:", err);
      setErrorMsg(err.message || "Failed to analyze situation threat. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: number) => {
    if (level <= 3) return 'from-emerald-600/20 to-emerald-500/10 border-emerald-900/40 text-emerald-400';
    if (level <= 6) return 'from-amber-600/20 to-amber-500/10 border-amber-900/40 text-amber-400';
    if (level <= 8) return 'from-orange-650/20 to-orange-600/10 border-orange-950/40 text-orange-400';
    return 'from-red-650/20 to-red-600/10 border-red-950/40 text-red-400 animate-pulse';
  };

  return (
    <div className="space-y-6">
      {/* Search/Input Form */}
      <div className="bg-[#121420] p-6 rounded-2xl border border-slate-850 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3 justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider">AI Situational Threat Scan</h2>
          </div>
          <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
        </div>

        <form onSubmit={handleAssessThreat} className="space-y-4">
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Describe any high-suspicion behaviors, suspicious routes, or stalkers surrounding you. Our security engine conducts counter-threat classification, logs tactical countermeasures to your Firestore archives, and recommends custom vocal responses.
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. A suspicious white minivan with dark windows has parked near this bus stop and turned off its headlights..."
              disabled={loading}
              className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 min-h-[90px] transition-all"
              required
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-400 font-semibold uppercase font-mono">⚠️ {errorMsg}</p>
          )}

          <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-slate-500 bg-slate-950/40 px-3.5 py-2.5 rounded-lg border border-slate-900">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-indigo-400" />
              <span>Location Status: {coords ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : "Simulation Default"}</span>
            </div>
            <span>Database Sync: {userId ? "ONLINE" : "OFFLINE (Login Required)"}</span>
          </div>

          <button
            type="submit"
            disabled={loading || !description.trim()}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-wider text-xs rounded-xl shadow-lg transition-all active:scale-[0.98] outline-none flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Running Counter-Threat Evaluation...</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" />
                <span>Assess Live Surroundings Threat</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Active Assessment Result */}
      <AnimatePresence mode="wait">
        {currentResult && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.98, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -5 }}
            className={`p-6 rounded-2xl border bg-gradient-to-br ${getRiskColor(currentResult.riskLevel)} space-y-4`}
          >
            <div className="flex justify-between items-start gap-4">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block mb-0.5">Threat Severity Assessment</span>
                <h3 className="text-lg font-black uppercase tracking-wide flex items-center gap-2">
                  <AlertOctagon className="h-5.5 w-5.5" />
                  <span>{currentResult.severityText} Alert</span>
                  <span className="text-xs font-mono font-normal">({currentResult.riskLevel}/10 Risk Score)</span>
                </h3>
              </div>
              
              {currentResult.emergencyRecommended && (
                <span className="px-3 py-1 bg-red-650 text-white font-bold font-mono text-[9px] rounded-full uppercase tracking-wider animate-pulse border border-red-900/30">
                  RED SOS ADVISED
                </span>
              )}
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  Tactical Countermeasures Recommended
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-300 leading-relaxed">
                  {currentResult.tactics.map((t, idx) => (
                    <li key={idx} className="marker:text-indigo-400">{t}</li>
                  ))}
                </ul>
              </div>

              {currentResult.decoyResponse && (
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 space-y-1.5">
                  <h4 className="font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-450" />
                    Decoy Voice Loop Script
                  </h4>
                  <p className="italic text-slate-300 pl-3 border-l-2 border-rose-500/40 text-[11px] leading-relaxed">
                    "{currentResult.decoyResponse}"
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Historic Database Archives */}
      {userId && history.length > 0 && (
        <div className="bg-[#121420] p-6 rounded-2xl border border-slate-850 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Clock className="h-4.5 w-4.5 text-slate-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Logged Threat Scan Archives</h3>
          </div>

          <div className="space-y-3">
            {history.map((log) => (
              <div
                key={log.assessmentId}
                className="bg-slate-900/45 p-4 rounded-xl border border-slate-850 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 font-mono text-[9px] rounded-full uppercase tracking-wider font-semibold ${
                      log.riskLevel <= 3 ? 'bg-emerald-500/10 text-emerald-400' :
                      log.riskLevel <= 6 ? 'bg-amber-500/10 text-amber-400' :
                      log.riskLevel <= 8 ? 'bg-orange-500/10 text-orange-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      Level {log.riskLevel} - {log.severityText}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(log.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <p className="text-slate-300 italic text-[11px] line-clamp-2">"{log.description}"</p>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentResult(log)}
                  className="shrink-0 p-1.5 px-3 bg-slate-950 hover:bg-indigo-950/40 text-indigo-400 font-semibold border border-slate-850 hover:border-indigo-900/60 rounded-lg transition-all text-[11px]"
                >
                  View Solution
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
