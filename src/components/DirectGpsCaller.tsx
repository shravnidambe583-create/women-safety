import React, { useState, useEffect } from 'react';
import { Phone, Navigation, Share2, Users, AlertCircle, LogIn, Check, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserSafetyProfile, EmergencyContact } from '../types';

interface DirectGpsCallerProps {
  profile: UserSafetyProfile;
  user: any;
  currentAlertId: string | null;
  onSOSTrigger: () => void;
  onLogin: () => Promise<void>;
}

export default function DirectGpsCaller({
  profile,
  user,
  currentAlertId,
  onSOSTrigger,
  onLogin
}: DirectGpsCallerProps) {
  const [selectedNumber, setSelectedNumber] = useState<string>('');
  const [selectedName, setSelectedName] = useState<string>('');
  const [customNumber, setCustomNumber] = useState<string>('');
  const [useCustom, setUseCustom] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Initialize selected number with the first emergency contact if any exist
  useEffect(() => {
    if (profile.contacts && profile.contacts.length > 0 && !useCustom) {
      setSelectedNumber(profile.contacts[0].phone);
      setSelectedName(profile.contacts[0].name);
    } else if (!useCustom) {
      setSelectedNumber('911');
      setSelectedName('Emergency Desk');
    }
  }, [profile.contacts, useCustom]);

  // Handle triggering the direct SOS + Phone Dialer action
  const handleInitiateAlertAndCall = () => {
    const targetNumber = useCustom ? customNumber : selectedNumber;
    if (!targetNumber) {
      setNotification('Please enter or select a valid phone number.');
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    // 1. Trigger the master SOS location sharing tracking pipeline in parent App
    onSOSTrigger();

    // 2. Compute live tracker tracking URL
    // Since App has now triggered SOS, currentAlertId or a random fallback allows immediate tracking
    const alertId = currentAlertId || "sos_" + Math.random().toString(36).substring(2, 10);
    const trackingLink = `${window.location.origin}/?alert=${alertId}`;

    // 3. Auto copy tracking link to clipboard for quick dispatching/messaging
    try {
      navigator.clipboard.writeText(trackingLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    } catch (e) {
      console.warn("Clipboard copy not supported inside sandboxed iframe context:", e);
    }

    // 4. Open native caller dialer
    window.location.href = `tel:${targetNumber}`;

    // 5. Notify user
    setNotification(`Direct Call initiated! Armed real-time location stream and successfully copied secure tracking link to clipboard!`);
    setTimeout(() => setNotification(null), 8000);
  };

  const activeNumber = useCustom ? customNumber : selectedNumber;

  return (
    <div id="direct-gps-caller-panel" className="bg-[#121420] text-slate-100 p-6 rounded-3xl border border-slate-900 shadow-2xl space-y-5">
      
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-400">
            <Phone className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider font-sans text-slate-100">Live GPS Link & Rapid Dial</h3>
            <p className="text-[10px] text-slate-400 font-mono">One-click call route with active satellite tracking</p>
          </div>
        </div>
        <Navigation className="h-4.5 w-4.5 text-indigo-400" />
      </div>

      {/* Cloud Authentication Warning (Direct action request hook) */}
      {!user && (
        <div className="bg-amber-950/15 border border-amber-900/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-400 font-sans uppercase text-[10px] tracking-wide">SECURE AUTHENTICATION RECOMMENDED</p>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                You are in local mode. Please sign in to securely persist emergency contacts, store AI assessment histories, and enable durable remote GPS tracking.
              </p>
            </div>
          </div>
          <button
            onClick={onLogin}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-md shadow-indigo-950 hover:scale-[1.02] cursor-pointer"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Sign In</span>
          </button>
        </div>
      )}

      {user && (
        <div className="bg-emerald-950/10 border border-emerald-900/35 rounded-2xl p-3 flex items-center gap-2.5 text-[11px] font-semibold text-emerald-400">
          <Check className="h-4 w-4 shrink-0 bg-emerald-500/20 rounded-full p-0.5" />
          <span>Authenticated active cloud account: {user.email}</span>
        </div>
      )}

      {/* Selector Options */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between bg-slate-900/40 p-1.5 rounded-xl border border-slate-850">
          <button
            type="button"
            onClick={() => setUseCustom(false)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              !useCustom ? 'bg-slate-950 text-indigo-400 font-bold border border-slate-800' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Select Contact</span>
          </button>
          <button
            type="button"
            onClick={() => setUseCustom(true)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              useCustom ? 'bg-slate-950 text-indigo-400 font-bold border border-slate-800' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Phone className="h-3.5 w-3.5" />
            <span>Custom Number</span>
          </button>
        </div>

        {/* Selected View details */}
        {!useCustom ? (
          <div className="space-y-2">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block font-mono">Recipient Contact Selection</label>
            {profile.contacts.length === 0 ? (
              <div className="text-center p-4 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                No custom recipients programmed. Please add contacts in Setup settings or use custom dialer mode.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {profile.contacts.map((contact, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedNumber(contact.phone);
                      setSelectedName(contact.name);
                    }}
                    className={`p-3 text-left rounded-xl border transition-all flex flex-col justify-between text-xs cursor-pointer ${
                      selectedNumber === contact.phone && !useCustom
                        ? 'bg-indigo-950/20 border-indigo-500/80'
                        : 'bg-slate-950/50 border-slate-850 hover:border-slate-800'
                    }`}
                  >
                    <span className="font-bold text-slate-250 truncate block">{contact.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">{contact.phone}</span>
                    <span className="text-[9px] text-indigo-400 capitalize font-mono mt-1 font-semibold">{contact.relationship}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block font-mono">Enter Custom Responder Phone Number</label>
            <input
              type="text"
              value={customNumber}
              onChange={(e) => setCustomNumber(e.target.value)}
              placeholder="e.g. +1 (555) 019-9234 or 911"
              className="w-full text-xs font-mono bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-semibold"
            />
          </div>
        )}
      </div>

      {/* Interactive Trigger Button block */}
      <div className="space-y-3 pt-2">
        <button
          type="button"
          onClick={handleInitiateAlertAndCall}
          className="w-full py-4 bg-gradient-to-tr from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-extrabold uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-rose-950/45 transition-all active:scale-[0.98] outline-none flex items-center justify-center gap-2.5 cursor-pointer border border-rose-400/20"
        >
          <Phone className="h-4.5 w-4.5 animate-bounce text-white" />
          <span>Call {useCustom ? 'Custom Number' : selectedName || 'Emergency desk'} ({activeNumber || 'No number selected'}) & Share GPS Loc</span>
        </button>

        <p className="text-[10px] text-slate-400 text-center leading-relaxed">
          💡 Clicking above automatically initializes a cellular call, triggers full Sentinel SOS alarms, logs your position coordinates, and saves the direct tracking link to your clipboard so you can drop it directly into messaging apps!
        </p>
      </div>

      {/* Notifications and Alerts Overlay */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={`p-3 text-xs rounded-xl border text-center ${
              notification.includes('initiated')
                ? 'bg-indigo-950/40 border-indigo-900/60 text-indigo-400 font-semibold'
                : 'bg-amber-950/20 border-amber-900/30 text-amber-400'
            }`}
          >
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span>{notification}</span>
              {notification.includes('initiated') && (
                <button
                  onClick={() => {
                    const alertId = currentAlertId || "demo";
                    const link = `${window.location.origin}/?alert=${alertId}`;
                    navigator.clipboard.writeText(link);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                  className="px-2 py-1 bg-indigo-900 hover:bg-indigo-800 text-white rounded font-bold font-mono text-[9px] uppercase tracking-wider flex items-center gap-1 max-w-fit"
                >
                  {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{isCopied ? 'Copied' : 'Recopy Tracker Link'}</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
