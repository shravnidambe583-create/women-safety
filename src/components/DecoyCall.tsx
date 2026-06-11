import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, User, Loader2, Volume2, ShieldCheck, Play, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CallPreset {
  id: string;
  name: string;
  character: string; // Voice actor preset matching our prompt values (Kore, Puck, Fenrir, Zephyr)
  script: string[];
  speechPrompt: string;
}

const PRESETS: CallPreset[] = [
  {
    id: 'dispatch',
    name: "Emergency Police Dispatch",
    character: "Zephyr",
    script: [
      "[Dispatch Voice]: Sentinel Safety Dispatcher 408 on line.",
      "[You]: Yes, I am on the public route.",
      "[Dispatch Voice]: Understood. We are tracking your live GPS stream. A backup response cruiser is currently moving towards your block. Keep walking towards the lit intersection.",
      "[You]: I see it. I'll stay on this sidewalk.",
      "[Dispatch Voice]: Affirmative. Stay visible; we are monitoring your line."
    ],
    speechPrompt: "Sentinel Safety Emergency dispatch online. We are tracking your live GPS stream. Cruiser 20 is currently moving towards your block. Keep walking towards the well-lit intersection, we have constant eyes on your coordinates."
  },
  {
    id: 'husband',
    name: "Supportive Husband / Partner",
    character: "Fenrir",
    script: [
      "[Husband Voice]: Hey! I'm literally just pulled up outside the cafe now.",
      "[You]: Okay great, I'm about a block away.",
      "[Husband Voice]: Perfect, I see you! I'm walking up the street to meet you now, keep walking towards me honey.",
      "[You]: I see you. Coming.",
      "[Husband Voice]: Got you. I can see the intersection now."
    ],
    speechPrompt: "Hey honey! I just parked and pulled up. I see you about a block away. I am getting out of the car and walking up the street to meet you right now. I'm right here!"
  },
  {
    id: 'father',
    name: "Protective Dad",
    character: "Charon",
    script: [
      "[Dad Voice]: Hey kiddo, I'm parked in front of the lobby right now.",
      "[You]: Almost there, Dad.",
      "[Dad Voice]: I'm leaving the headlight beams on so you can see. Just walk directly past the main gates.",
      "[You]: I see the lights now.",
      "[Dad Voice]: Great, keep moving. I've got the door open."
    ],
    speechPrompt: "Hey sweetheart, I'm parked right in front of the entrance lobby. I've left the high-beam headlights on so you can see. There are plenty of people around, just walk directly past the gates, I have eyes on you."
  }
];

export default function DecoyCall() {
  const [activePreset, setActivePreset] = useState<CallPreset>(PRESETS[0]);
  const [callState, setCallState] = useState<'idle' | 'delaying' | 'ringing' | 'connected'>('idle');
  const [timer, setTimer] = useState<number>(0);
  const [soundBuffer, setSoundBuffer] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [currentScriptIdx, setCurrentScriptIdx] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const ringOscillatorRef = useRef<OscillatorNode | null>(null);

  // Audio loading for selected preset
  const loadPresetAudio = async (preset: CallPreset) => {
    setLoadingAudio(true);
    setSoundBuffer(null);
    try {
      const response = await fetch("/api/gemini/decoy-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptText: preset.speechPrompt,
          voiceCharacter: preset.character
        })
      });
      const data = await response.json();
      if (data.audioData) {
        setSoundBuffer(data.audioData);
      }
    } catch (e) {
      console.error("Failed to load decoy call TTS audio payload:", e);
    } finally {
      setLoadingAudio(false);
    }
  };

  useEffect(() => {
    loadPresetAudio(activePreset);
  }, [activePreset]);

  // Handle ringtone generator
  const startRingtone = () => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      audioContextRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(480, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      // Ring pulse
      gain.gain.setValueAtTime(0.2, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      ringOscillatorRef.current = osc;
    } catch (e) {
      console.error("No audio context for buzzer ring:", e);
    }
  };

  const stopRingtone = () => {
    try {
      ringOscillatorRef.current?.stop();
      ringOscillatorRef.current = null;
    } catch (e) {}
  };

  // Dispatch Delay
  const triggerCallDelay = (sec: number) => {
    setCallState('delaying');
    setTimer(sec);
  };

  useEffect(() => {
    let interval: any;
    if (callState === 'delaying' && timer > 0) {
      interval = setInterval(() => {
        setTimer((v) => v - 1);
      }, 1000);
    } else if (callState === 'delaying' && timer === 0) {
      setCallState('ringing');
      startRingtone();
    }
    return () => clearInterval(interval);
  }, [callState, timer]);

  // Duration Timer
  const [callDuration, setCallDuration] = useState(0);
  useEffect(() => {
    let interval: any;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setCallDuration((v) => v + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [callState]);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Play synthesized response audio on Accept
  const playPresetAudio = async () => {
    if (!soundBuffer) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      // Use 24000Hz as specified in Gemini TTS audio spec
      const ctx = new AudioContextClass({ sampleRate: 24000 });
      audioContextRef.current = ctx;

      const binaryStr = atob(soundBuffer);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const audioBuf = await ctx.decodeAudioData(bytes.buffer);
      const sourceNode = ctx.createBufferSource();
      sourceNode.buffer = audioBuf;
      sourceNode.connect(ctx.destination);
      sourceNode.start();
      sourceNodeRef.current = sourceNode;
    } catch (e) {
      console.error("Failed to play TTS buffer:", e);
    }
  };

  const handleAccept = () => {
    stopRingtone();
    setCallState('connected');
    setCurrentScriptIdx(0);
    playPresetAudio();
  };

  const handleDecline = () => {
    stopRingtone();
    sourceNodeRef.current?.stop();
    setCallState('idle');
  };

  return (
    <div className="bg-[#121420] text-slate-100 p-6 rounded-2xl border border-slate-850 shadow-xl relative overflow-hidden flex flex-col justify-between h-full">
      {callState === 'idle' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <Phone className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Interactive Decoy Call</h2>
              <p className="text-xs text-slate-400">Simulate immediate incoming phone calls with active AI-voiced responses to deter stalking.</p>
            </div>
          </div>

          <div className="space-y-2 mt-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest block">Choose Calling Persona</label>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setActivePreset(preset)}
                  className={`p-3 text-left rounded-xl border text-xs transition-all ${
                    activePreset.id === preset.id 
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-slate-100 font-semibold' 
                    : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <User className="h-4 w-4 mb-1 border rounded-md p-0.5 bg-slate-800" />
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {loadingAudio ? (
            <div className="flex items-center justify-center gap-2 py-3 bg-slate-900/30 border border-slate-800/80 rounded-xl text-xs text-slate-400">
              <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
              <span>Synthesizing voice response...</span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs px-3 py-2.5 bg-slate-900/55 border border-slate-850 rounded-xl">
              <div className="flex items-center gap-1.5 text-emerald-400 font-mono">
                <Volume2 className="h-3.5 w-3.5" />
                <span>Audio Synthesis Cached</span>
              </div>
              <span className="text-slate-500 font-medium">Model: TTS Flash</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => triggerCallDelay(2)}
              className="flex items-center justify-center gap-2 p-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs shadow-md active:scale-95 transition-all"
            >
              <Phone className="h-4 w-4" />
              <span>Call Me Immediately</span>
            </button>
            <button
              onClick={() => triggerCallDelay(10)}
              className="flex items-center justify-center gap-2 p-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs border border-slate-850 active:scale-95 transition-all"
            >
              <Phone className="h-4 w-4 text-emerald-400" />
              <span>Call In 10 Seconds</span>
            </button>
          </div>
        </div>
      )}

      {/* Delaying Countdown Screen */}
      {callState === 'delaying' && (
        <div className="flex flex-col items-center justify-center py-10 space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative h-16 w-16 bg-slate-900 rounded-full flex items-center justify-center text-emerald-400 text-xl font-mono font-bold border border-slate-800">
              {timer}s
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-sm font-semibold text-slate-200">Prepping Simulated Call</h3>
            <p className="text-xs text-slate-400">Lock your screen or act normal. We will trigger the rington loop.</p>
          </div>
          <button 
            onClick={handleDecline} 
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg active:scale-95 transition-all"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Realistic Ringing Screen */}
      <AnimatePresence>
        {callState === 'ringing' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#070b19] z-50 flex flex-col justify-between p-12 text-center"
          >
            <div className="space-y-3 pt-16">
              <div className="mx-auto h-24 w-24 bg-gradient-to-tr from-slate-850 to-slate-800 border border-slate-700 rounded-full flex items-center justify-center shadow-2xl">
                <User className="h-12 w-12 text-slate-300" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">{activePreset.name}</h1>
              <p className="text-xs text-emerald-400 font-mono tracking-wider uppercase animate-pulse">Incoming Voice Loop Call</p>
            </div>

            <div className="flex justify-around items-center max-w-sm mx-auto w-full pb-12">
              <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={handleDecline}
                  className="h-16 w-16 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all cursor-pointer"
                >
                  <PhoneOff className="h-7 w-7" />
                </button>
                <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">Decline</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={handleAccept}
                  className="h-16 w-16 bg-green-500 hover:bg-green-400 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all animate-bounce cursor-pointer"
                >
                  <Phone className="h-7 w-7" />
                </button>
                <span className="text-xs text-green-400 font-semibold uppercase tracking-wider animate-pulse">Answer</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connected Conversation Board */}
      <AnimatePresence>
        {callState === 'connected' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#060a15] z-50 flex flex-col justify-between p-8"
          >
            <div className="text-center pt-8 space-y-2">
              <h2 className="text-xl font-bold text-slate-100">{activePreset.name}</h2>
              <p className="text-xs text-emerald-400 font-mono">{formatDuration(callDuration)}</p>
              <div className="inline-flex gap-1 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] text-emerald-300 font-mono tracking-normal">
                <ShieldCheck className="h-3 w-3 mt-0.5" />
                <span>Audio Stream Synchronized</span>
              </div>
            </div>

            {/* Conversation Script Prompter */}
            <div className="my-6 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 shadow-inner flex-1 flex flex-col justify-center overflow-y-auto max-w-md mx-auto w-full">
              <p className="text-[10px] text-amber-400/80 font-mono uppercase tracking-wider mb-3 text-center border-b border-slate-800 pb-2">
                📢 LIVE DECOY CONVERSATION PROMPTER (Follow lines below)
              </p>
              <div className="space-y-3">
                {activePreset.script.map((line, idx) => (
                  <p 
                    key={idx} 
                    className={`text-xs leading-relaxed transition-all p-2 rounded-lg ${
                      line.startsWith('[You]:') 
                      ? 'text-indigo-300 bg-indigo-500/5 border-l-2 border-indigo-500 text-right font-medium' 
                      : 'text-slate-300 font-normal bg-slate-800/20'
                    }`}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 pb-8">
              <p className="text-xs text-slate-400 text-center max-w-xs">
                Hold the phone up to your ear or on speaker. Stalkers will hear the simulated counterpart speaking aloud.
              </p>
              <button 
                onClick={handleDecline}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full shadow-lg text-sm active:scale-95 transition-all"
              >
                <PhoneOff className="h-4 w-4" />
                <span>Hang Up</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
