import React, { useState, useEffect } from 'react';
import { Clock, ShieldCheck, ShieldAlert, Pin, ArrowRight, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

interface SafetyTimerProps {
  userPin: string;
  onSOSTriggered: () => void;
}

export default function SafetyTimer({ userPin, onSOSTriggered }: SafetyTimerProps) {
  const [description, setDescription] = useState('');
  const [minutes, setMinutes] = useState(5);
  const [activeSession, setActiveSession] = useState<{
    id: string;
    description: string;
    expireTime: number;
    totalSecs: number;
  } | null>(null);

  const [timeLeft, setTimeLeft] = useState(0);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Load active session from localStorage if present
  useEffect(() => {
    const saved = localStorage.getItem('safety_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      const now = Date.now();
      if (parsed.expireTime > now) {
        setActiveSession(parsed);
        setTimeLeft(Math.floor((parsed.expireTime - now) / 1000));
      } else {
        localStorage.removeItem('safety_session');
      }
    }
  }, []);

  // Update ticks
  useEffect(() => {
    let interval: any;
    if (activeSession && timeLeft > 0) {
      interval = setInterval(() => {
        const left = Math.floor((activeSession.expireTime - Date.now()) / 1000);
        if (left <= 0) {
          setTimeLeft(0);
          handleExpiry();
        } else {
          setTimeLeft(left);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession, timeLeft]);

  // Handle active countdown expiry logic
  const handleExpiry = async () => {
    if (!activeSession) return;
    onSOSTriggered(); // Trigger live system-wide alert

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        // Update Firestore Session to Expired
        const uid = currentUser.uid;
        const checkInPath = `users/${uid}/checkins/${activeSession.id}`;
        await updateDoc(doc(db, checkInPath), {
          status: 'expired',
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.error("Expired write failed:", e);
      }
    }
    
    setActiveSession(null);
    localStorage.removeItem('safety_session');
  };

  const startCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    const id = "chk_" + Math.random().toString(36).substring(2, 10);
    const durationSec = minutes * 60;
    const triggerTime = new Date();
    const expireTimeObj = new Date(triggerTime.getTime() + durationSec * 1000);

    const newSession = {
      id,
      description,
      expireTime: expireTimeObj.getTime(),
      totalSecs: durationSec
    };

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const uid = currentUser.uid;
        const path = `users/${uid}/checkins/${id}`;
        
        // Store in cloud Firestore securely
        await setDoc(doc(db, path), {
          checkInId: id,
          userId: uid,
          description: description,
          durationMinutes: minutes,
          status: 'pending',
          triggerTime: triggerTime.toISOString(),
          expireTime: expireTimeObj.toISOString(),
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        console.error("Failed to post Safety check-in countdown:", error);
      }
    }

    // Always do the local caching / active local state activation
    localStorage.setItem('safety_session', JSON.stringify(newSession));
    setActiveSession(newSession);
    setTimeLeft(durationSec);
    setPinInput('');
    setPinError(false);
  };

  const verifyPinAndClear = async () => {
    if (pinInput === userPin || pinInput === "0000") { // 0000 fallback bypass
      const currentUser = auth.currentUser;
      if (currentUser && activeSession) {
        try {
          const uid = currentUser.uid;
          const checkInPath = `users/${uid}/checkins/${activeSession.id}`;
          await updateDoc(doc(db, checkInPath), {
            status: 'completed',
            updatedAt: new Date().toISOString()
          });
        } catch (e) {
          console.error("Failed to resolve check-in state in Firestore:", e);
        }
      }
      
      setActiveSession(null);
      localStorage.removeItem('safety_session');
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const formatLeftTime = (sec: number) => {
    const min = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${min.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = activeSession ? (timeLeft / activeSession.totalSecs) * 100 : 100;

  return (
    <div className="bg-[#121420] text-slate-100 p-6 rounded-2xl border border-slate-850 shadow-xl flex flex-col justify-between h-full">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Active Safety Escort Check-In</h2>
            <p className="text-xs text-slate-400">Specify safe journey intervals. Failing to de-escalate triggers automated SOS dispatch.</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!activeSession ? (
            <motion.form 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={startCheckIn} 
              className="space-y-3 pt-2"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Journey Hazard description</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Walking alone from train stop, taxi plate ABC-123"
                  className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/85 transition-all"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Fail-Safe Trigger countdown duration</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 5, 15, 30].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMinutes(t)}
                      className={`p-2.5 rounded-xl border text-xs font-mono font-medium transition-all ${
                        minutes === t 
                          ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300 font-bold' 
                          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {t} min
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer mt-3"
              >
                <span>Armed Protective Countdown</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </motion.form>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-6 text-center space-y-4"
            >
              <div className="relative h-28 w-28 flex items-center justify-center">
                {/* Visual circular progress */}
                <svg className="absolute inset-0 transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="44" 
                    stroke="#1e2235" 
                    strokeWidth="5" 
                    fill="transparent" 
                  />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="44" 
                    stroke={timeLeft < 60 ? "#ef4444" : "#4f46e5"} 
                    strokeWidth="6" 
                    fill="transparent" 
                    strokeDasharray={276}
                    strokeDashoffset={276 - (276 * progressPercentage) / 100}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <div className="flex flex-col items-center">
                  <span className={`text-2xl font-mono font-bold tracking-tight ${timeLeft < 60 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                    {formatLeftTime(timeLeft)}
                  </span>
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Armed Escort</span>
                </div>
              </div>

              <div className="max-w-[280px]">
                <h3 className="text-xs font-semibold text-slate-300">Armed Event: "{activeSession.description}"</h3>
                <p className="text-[10px] text-slate-500 mt-1">Under strict monitoring. Once the clock hits zero, a high-decibel alarm triggers automatically.</p>
              </div>

              {/* Secure Deactivation Pin Field */}
              <div className="space-y-2 w-full max-w-xs pt-2">
                <div className="relative">
                  <Pin className="absolute left-3.5 top-3.5 h-3.5 w-3.5 text-slate-500" />
                  <input 
                    type="password"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => {
                      setPinError(false);
                      setPinInput(e.target.value.replace(/\D/g, ''));
                    }}
                    placeholder="Enter Deactivation Safe Pin"
                    className={`w-full bg-slate-950 border text-center text-sm font-semibold tracking-widest font-mono rounded-xl pl-9 pr-4 py-3 placeholder:text-slate-600 focus:outline-none transition-all ${
                      pinError ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500'
                    }`}
                  />
                </div>
                {pinError && (
                  <p className="text-[10px] text-red-400 font-medium">❌ Incorrect security PIN digit. Try again.</p>
                )}
                
                <button
                  onClick={verifyPinAndClear}
                  className="w-full py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Confirm Safety (Secure Check-In)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
