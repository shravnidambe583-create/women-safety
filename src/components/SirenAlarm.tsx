import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, ShieldAlert, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SirenAlarmProps {
  onStateChange?: (isActive: boolean) => void;
  externalActive?: boolean;
}

export default function SirenAlarm({ onStateChange, externalActive = false }: SirenAlarmProps) {
  const [isActive, setIsActive] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillator1Ref = useRef<OscillatorNode | null>(null);
  const oscillator2Ref = useRef<OscillatorNode | null>(null);
  const modulatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Synchronize with external active trigger (e.g. SOS button)
  useEffect(() => {
    if (externalActive !== isActive) {
      if (externalActive) {
        startSiren();
      } else {
        stopSiren();
      }
    }
  }, [externalActive]);

  const startSiren = () => {
    try {
      if (isActive) return;

      // Initialize Web Audio Context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      // Create primary oscillators and modulator for high-frequency warble
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const modulationGain = ctx.createGain();

      // Configure frequencies (Wailing Siren Tone)
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(650, ctx.currentTime);

      osc2.type = 'square';
      osc2.frequency.setValueAtTime(450, ctx.currentTime);

      // Low frequency oscillator for wail modulation
      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(2, ctx.currentTime); // 2Hz frequency swing
      modulationGain.gain.setValueAtTime(150, ctx.currentTime); // modulation depth

      // Connections
      modulator.connect(modulationGain);
      modulationGain.connect(osc1.frequency);
      modulationGain.connect(osc2.frequency);

      // Connect oscillators to main gain node
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Set moderate high volume level safely
      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.1);

      // Start sound sources
      modulator.start();
      osc1.start();
      osc2.start();

      oscillator1Ref.current = osc1;
      oscillator2Ref.current = osc2;
      modulatorRef.current = modulator;
      gainNodeRef.current = gainNode;
      setIsActive(true);
      if (onStateChange) onStateChange(true);
    } catch (e) {
      console.error("Failed to start critical audio siren:", e);
      // Fallback state trigger anyway
      setIsActive(true);
      if (onStateChange) onStateChange(true);
    }
  };

  const stopSiren = () => {
    setIsActive(false);
    if (onStateChange) onStateChange(false);

    try {
      if (gainNodeRef.current && audioContextRef.current) {
        gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, audioContextRef.current.currentTime);
        gainNodeRef.current.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.05);
      }

      setTimeout(() => {
        oscillator1Ref.current?.stop();
        oscillator2Ref.current?.stop();
        modulatorRef.current?.stop();
        audioContextRef.current?.close();

        oscillator1Ref.current = null;
        oscillator2Ref.current = null;
        modulatorRef.current = null;
        gainNodeRef.current = null;
        audioContextRef.current = null;
      }, 60);
    } catch (e) {
      console.error("Cleanup error during audio disconnect:", e);
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup audio context on unmount
      if (isActive) {
        stopSiren();
      }
    };
  }, [isActive]);

  return (
    <div className="bg-[#121420] text-slate-100 p-6 rounded-2xl border border-slate-850 shadow-xl flex flex-col justify-between h-full">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded-lg text-red-500 animate-pulse">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Sonic Deterrent Alarm</h2>
            <p className="text-xs text-slate-400">Emits continuous, extreme high-decibel siren wails to scare off threats.</p>
          </div>
        </div>

        {isActive ? (
          <div className="bg-red-500/15 border border-red-500/20 rounded-xl p-4 flex gap-3 items-start animate-beat">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <span className="font-bold text-red-300 block uppercase tracking-wider">High Frequency Alarm Active</span>
              <p>The system is pulsing maximum frequency audio to disorient any nearby intruder or attract crowd awareness.</p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex gap-3 items-start">
            <AlertCircle className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-400">
              <p>Keep your speaker volume turned to maximum. The sonic deterrent uses a synthesized wailing sweep optimized for physical volume speakers.</p>
            </div>
          </div>
        )}
      </div>

      <div className="pt-6">
        {isActive ? (
          <button
            onClick={stopSiren}
            className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 font-bold tracking-wide uppercase text-white rounded-xl shadow-lg border border-red-500/30 text-sm transition-all"
          >
            <VolumeX className="h-5 w-5 text-red-100 animate-bounce" />
            <span>Mute Alarm Voice</span>
          </button>
        ) : (
          <button
            onClick={startSiren}
            className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-850 hover:bg-slate-800 hover:from-slate-850 hover:to-slate-800 border border-red-900/30 active:scale-95 font-semibold text-red-400 rounded-xl shadow-sm text-sm transition-all"
          >
            <Volume2 className="h-5 w-5 text-red-400" />
            <span>Activate Sonic Alarm</span>
          </button>
        )
        }
      </div>

      {/* Screen strobe effect active on screen when siren is running */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.25, 0] }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, duration: 0.5, ease: "linear" }}
            className="fixed inset-0 bg-red-600 pointer-events-none z-50 mix-blend-color-dodge"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
