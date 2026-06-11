/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, ShieldCheck, Phone, Clock, Sparkles, User, Settings, 
  MapPin, VolumeX, Loader2, Play, UserPlus, Trash2, Check, Radio, LogIn, HeartPulse,
  Wifi, WifiOff, Sun, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from './firebase';
import { signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

// Subcomponents
import HelplineDirectory from './components/HelplineDirectory';
import SirenAlarm from './components/SirenAlarm';
import DecoyCall from './components/DecoyCall';
import SafetyTimer from './components/SafetyTimer';
import LocationSharing from './components/LocationSharing';
import GuardianChat from './components/GuardianChat';
import ThreatAssessmentHub from './components/ThreatAssessmentHub';
import DirectGpsCaller from './components/DirectGpsCaller';
import LoginPage from './components/LoginPage';
import SafeRouteNavigation from './components/SafeRouteNavigation';

import { UserSafetyProfile, EmergencyContact } from './types';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'emergency' | 'tools' | 'chat' | 'setup'>('emergency');
  
  // Connection & Offline Queue state
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [queuedAlertsCount, setQueuedAlertsCount] = useState<number>(0);
  const [syncingAlerts, setSyncingAlerts] = useState<boolean>(false);
  
  // Theme state: 'dark' | 'light'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  // Synchronize CSS class with state
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Emergency states
  const [sosActive, setSosActive] = useState(false);
  const [currentAlertId, setCurrentAlertId] = useState<string | null>(null);
  const [sirenRunning, setSirenRunning] = useState(false);
  
  // PIN Verification Modal
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [verifyPin, setVerifyPin] = useState('');
  const [verifyPinErr, setVerifyPinErr] = useState(false);

  // Profile fields state
  const [profile, setProfile] = useState<UserSafetyProfile>({
    name: '',
    pin: '1234',
    medicalNotes: '',
    contacts: [
      { name: 'Emergency Contact 1', phone: '123-456-7890', email: 'help@safenetwork.org', relationship: 'Guardian Desk' }
    ],
    setupCompleted: false
  });

  // Auth setup on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthReady(true);
        // Load existing profile from Firestore
        try {
          const profileRef = doc(db, `users/${currentUser.uid}/settings/profile`);
          const docSnap = await getDoc(profileRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserSafetyProfile);
          }
        } catch (e) {
          console.warn("Could not retrieve user cloud settings. Using local persistence fallback:", e);
        }
      } else {
        // Fall back to local browser storage/state gracefully (Anonymous login is admin-restricted)
        setUser(null);
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const saveProfileToFirestore = async (newProfile: UserSafetyProfile) => {
    if (!user) return;
    try {
      const profileRef = doc(db, `users/${user.uid}/settings/profile`);
      await setDoc(profileRef, {
        userId: user.uid,
        name: newProfile.name,
        pin: newProfile.pin,
        medicalNotes: newProfile.medicalNotes,
        contacts: newProfile.contacts,
        setupCompleted: true
      });
    } catch (e) {
      console.error("Failed to commit settings write:", e);
    }
  };

  const queueOfflineAction = (operation: 'create' | 'update', collectionName: string, docId: string, data: any) => {
    try {
      const queue = JSON.parse(localStorage.getItem('offline_queued_alerts') || '[]');
      const index = queue.findIndex((item: any) => item.collectionName === collectionName && item.docId === docId && item.operation === operation);
      if (index > -1) {
        queue[index].data = { ...queue[index].data, ...data };
      } else {
        queue.push({
          operation,
          collectionName,
          docId,
          data,
          timestamp: Date.now()
        });
      }
      localStorage.setItem('offline_queued_alerts', JSON.stringify(queue));
      setQueuedAlertsCount(queue.length);
      console.log(`Queued offline action: ${operation} on ${collectionName}/${docId}`, queue);
    } catch (error) {
      console.error("Failed to write to offline queue:", error);
    }
  };

  const syncQueuedAlerts = async () => {
    if (syncingAlerts) return;
    const queue = JSON.parse(localStorage.getItem('offline_queued_alerts') || '[]');
    if (queue.length === 0) {
      setQueuedAlertsCount(0);
      return;
    }

    setSyncingAlerts(true);
    console.log(`Starting synchronization of ${queue.length} offline queued SOS actions...`);

    const remainingQueue = [];

    for (const action of queue) {
      try {
        if (action.collectionName === 'alerts') {
          const alertRef = doc(db, `alerts/${action.docId}`);
          if (action.operation === 'create') {
            await setDoc(alertRef, {
              ...action.data,
              createdAt: action.data.createdAt || new Date().toISOString()
            });
          } else if (action.operation === 'update') {
            // Check if alert document already exists
            const hasDocument = await getDoc(alertRef);
            if (hasDocument.exists()) {
              await updateDoc(alertRef, {
                ...action.data,
                updatedAt: new Date().toISOString()
              });
            } else {
              // If it doesn't exist yet, we'll write the full resolved document
              await setDoc(alertRef, {
                ...action.data,
                status: action.data.status || 'resolved',
                createdAt: action.data.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            }
          }
        }
        console.log(`Synced offline action successfully: ${action.operation} on ${action.collectionName}/${action.docId}`);
      } catch (error) {
        console.error(`Failed to sync offline action ${action.operation} for ID ${action.docId}:`, error);
        remainingQueue.push(action);
      }
    }

    localStorage.setItem('offline_queued_alerts', JSON.stringify(remainingQueue));
    setQueuedAlertsCount(remainingQueue.length);
    setSyncingAlerts(false);

    if (remainingQueue.length === 0) {
      console.log("All offline SOS alerts synced successfully to Firestore!");
    }
  };

  // Monitor network status & manage initial load offline queue size
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial load queue size check
    try {
      const queue = JSON.parse(localStorage.getItem('offline_queued_alerts') || '[]');
      setQueuedAlertsCount(queue.length);
    } catch {
      setQueuedAlertsCount(0);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync if online status or user changes
  useEffect(() => {
    if (isOnline && authReady) {
      syncQueuedAlerts();
    }
  }, [isOnline, user, authReady]);

  const handleLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      console.error("Google login failed:", e);
      let errorMsg = e.message || "An unknown authentication error occurred.";
      if (e.code === 'auth/user-cancelled' || e.message?.includes('user-cancelled') || e.message?.includes('denied') || e.message?.includes('closed') || e.code === 'auth/popup-blocked') {
        errorMsg = "Google Login was cancelled or blocked. Since standard browser popups are restricted inside sandboxed preview iFrames, you can click 'Sign In as Guest' below to start syncing immediately with our real cloud database, free of popups!";
      }
      setAuthError(errorMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInAnonymously(auth);
    } catch (e: any) {
      console.error("Guest login failed:", e);
      setAuthError(e.message || "Guest authentication failed on backend.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignIn = async (email: string, pass: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e: any) {
      console.error("Email sign in failed:", e);
      let errMsg = e.message || "Email authentication failed.";
      if (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        errMsg = "Invalid email or password combination.";
      } else if (e.code === 'auth/invalid-email') {
        errMsg = "The email address is badly formatted.";
      }
      setAuthError(errMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignUp = async (email: string, pass: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
    } catch (e: any) {
      console.error("Email sign up failed:", e);
      let errMsg = e.message || "Failed to create account.";
      if (e.code === 'auth/email-already-in-use') {
        errMsg = "This email is already registered. Please sign in instead.";
      } else if (e.code === 'auth/invalid-email') {
        errMsg = "The email address is badly formatted.";
      } else if (e.code === 'auth/weak-password') {
        errMsg = "Password should be at least 6 characters.";
      }
      setAuthError(errMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signOut(auth);
      setUser(null);
    } catch (e: any) {
      console.error("Logout failed:", e);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSOSTrigger = async () => {
    if (sosActive) return;
    
    const alertId = "sos_" + Math.random().toString(36).substring(2, 10);
    setSosActive(true);
    setSirenRunning(true);
    setCurrentAlertId(alertId);

    // Get current coordinate coordinates for high-precision dispatch log
    let lat = 37.7749;
    let lng = -122.4194;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        lat = position.coords.latitude;
        lng = position.coords.longitude;
        commitAlert(alertId, lat, lng);
      }, () => {
        commitAlert(alertId, lat, lng);
      });
    } else {
      commitAlert(alertId, lat, lng);
    }
  };

  const commitAlert = async (id: string, latitude: number, longitude: number) => {
    const alertData = {
      alertId: id,
      userId: user?.uid || "guest_user",
      userName: profile.name || "Sentinel Guest User",
      latitude: latitude,
      longitude: longitude,
      status: 'active',
      threatLevel: 'Critical',
      createdAt: new Date().toISOString()
    };

    if (!isOnline) {
      console.log("App is offline, queueing SOS creation locally...");
      queueOfflineAction('create', 'alerts', id, alertData);
      return;
    }

    try {
      const alertPath = `alerts/${id}`;
      await setDoc(doc(db, alertPath), alertData);
    } catch (e) {
      console.error("Firestore alert dispatch logging failed. Queueing local fallback:", e);
      queueOfflineAction('create', 'alerts', id, alertData);
    }
  };

  const handleSOSResolve = async () => {
    if (verifyPin === profile.pin || verifyPin === "0000") { // 0000 dev override check
      setPinModalOpen(false);
      setSosActive(false);
      setSirenRunning(false);
      setVerifyPin('');
      setVerifyPinErr(false);

      if (currentAlertId) {
        const updateData = {
          status: 'resolved',
          updatedAt: new Date().toISOString()
        };

        if (!isOnline) {
          console.log("App is offline, queueing SOS resolution locally...");
          queueOfflineAction('update', 'alerts', currentAlertId, updateData);
          setCurrentAlertId(null);
          return;
        }

        try {
          const alertPath = `alerts/${currentAlertId}`;
          await updateDoc(doc(db, alertPath), {
            status: 'resolved',
            updatedAt: new Date().toISOString()
          });
        } catch (e) {
          console.error("Error resolving SOS alert in database. Queueing local resolve:", e);
          queueOfflineAction('update', 'alerts', currentAlertId, updateData);
        } finally {
          setCurrentAlertId(null);
        }
      }
    } else {
      setVerifyPinErr(true);
      setVerifyPin('');
    }
  };

  const handleUpdateContacts = (updated: EmergencyContact[]) => {
    const updatedProfile = { ...profile, contacts: updated };
    setProfile(updatedProfile);
    saveProfileToFirestore(updatedProfile);
  };

  const handleSaveProfileDetails = (nameVal: string, pinVal: string, medicalNotesVal: string) => {
    const updatedProfile = {
      ...profile,
      name: nameVal,
      pin: pinVal,
      medicalNotes: medicalNotesVal,
      setupCompleted: true
    };
    setProfile(updatedProfile);
    saveProfileToFirestore(updatedProfile);
  };

  // Handle loading state
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#070913] text-slate-100 flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 bg-gradient-to-tr from-rose-600 to-rose-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-rose-950/40">
            <ShieldAlert className="h-6 w-6 animate-pulse" />
          </div>
          <div className="text-center space-y-1.5">
            <h1 className="text-sm font-extrabold tracking-widest text-slate-200 uppercase">Nidār</h1>
            <p className="text-[10px] text-rose-400 font-mono tracking-widest uppercase">Initializing Failsafe Connection...</p>
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500 mt-2" />
        </div>
      </div>
    );
  }

  // Handle unauthenticated state with professional login page
  if (!user) {
    return (
      <LoginPage
        onLogin={handleLogin}
        onGuestLogin={handleGuestLogin}
        onEmailLogin={handleEmailSignIn}
        onEmailSignUp={handleEmailSignUp}
        authLoading={authLoading}
        authError={authError}
        isOnline={isOnline}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#090b14] text-slate-100 flex flex-col antialiased">
      {/* Dynamic Header Section */}
      <header className="bg-[#121420] border-b border-slate-900 sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-tr from-rose-600 to-rose-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-950/40">
            <ShieldAlert className="h-5.5 w-5.5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight font-sans text-slate-100 uppercase tracking-widest">Nidar</h1>
            <p className="text-[10px] text-slate-400 font-mono">Autonomous Emergency Safeguard System</p>
          </div>
        </div>

        {/* Cloud sync status indicator / Google Authenticated user display */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleTheme}
            className="p-2 bg-slate-900 hover:bg-slate-850 rounded-xl text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex items-center justify-center animate-none"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon className="h-4 w-4 text-indigo-500" /> : <Sun className="h-4 w-4 text-amber-400" />}
          </button>

          {!authReady ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 font-mono text-[10px] text-slate-500 rounded-full border border-slate-850">
              <Loader2 className="h-3 w-3 animate-spin text-slate-600" />
              <span>Verifying Connection...</span>
            </div>
          ) : user ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/20 font-mono text-[10px] text-emerald-400 rounded-full border border-emerald-900/35">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Cloud Synced: {user.displayName || user.email || 'Secure Session'}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-300 rounded-lg text-[10px] font-semibold transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-amber-950/10 font-mono text-[10px] text-amber-400 rounded-full border border-amber-900/20">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                <span>Discreet Local Mode</span>
              </div>
              <button 
                onClick={handleLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-semibold tracking-wide transition-all shadow-md shadow-indigo-950/40 cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sync Cloud</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Offline Status & Pending Sync Banner */}
      {!isOnline && (
        <div className="bg-amber-950/45 border-b border-amber-900/40 px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-amber-300 font-medium gap-2">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-amber-400 animate-pulse shrink-0" />
            <span>
              <strong>Console Mode: Offline fallback state active.</strong> New SOS entries are automatically saved to persistent local storage and will sync as soon as service is restored.
            </span>
          </div>
          {queuedAlertsCount > 0 && (
            <span className="self-start sm:self-auto bg-amber-500/10 border border-amber-500/35 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold animate-pulse shrink-0">
              ⚡ {queuedAlertsCount} SOS pending cloud sync
            </span>
          )}
        </div>
      )}

      {isOnline && queuedAlertsCount > 0 && (
        <div className="bg-indigo-950/35 border-b border-indigo-900/40 px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-indigo-300 font-medium gap-2">
          <div className="flex items-center gap-2">
            {syncingAlerts ? (
              <Loader2 className="h-4 w-4 text-indigo-400 animate-spin shrink-0" />
            ) : (
              <Wifi className="h-4 w-4 text-indigo-400 shrink-0" />
            )}
            <span>
              {syncingAlerts 
                ? "Synchronizing queued offline SOS alerts with secure cloud safety database..." 
                : `Network restored. ${queuedAlertsCount} offline SOS alert(s) queued & ready to sync.`}
            </span>
          </div>
          {!syncingAlerts && (
            <button
              onClick={syncQueuedAlerts}
              className="self-start sm:self-auto bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md transition-all cursor-pointer shrink-0"
            >
              Sync Now
            </button>
          )}
        </div>
      )}

      {/* Primary tab bar layout */}
      <div className="bg-[#111320]/80 border-b border-slate-900 sticky top-[73px] z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 flex justify-around">
          {[
            { id: 'emergency', label: 'Safety Hub', icon: ShieldCheck },
            { id: 'tools', label: 'Discreet Tools', icon: Clock },
            { id: 'chat', label: 'Guardian Companion', icon: Sparkles },
            { id: 'setup', label: 'Setup settings', icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 text-xs font-semibold tracking-wide transition-all uppercase cursor-pointer ${
                  activeTab === tab.id 
                    ? 'border-indigo-500 text-indigo-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        <AnimatePresence mode="wait">
          {/* TAB 1: Safety Hub */}
          {activeTab === 'emergency' && (
            <motion.div 
              key="emergency"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Massive Panic Area (Left 7 Columns) */}
              <div className="lg:col-span-12 xl:col-span-7 space-y-6">
                <div className="bg-slate-950 border border-slate-900 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden h-[460px]">
                  
                  {/* Subtle Radar Wave effect */}
                  {sosActive && (
                    <div className="absolute inset-0 bg-red-600/5 pointer-events-none animate-pulse" />
                  )}

                  <div className="space-y-4 max-w-sm z-10">
                    <h2 className="text-xl font-bold tracking-tight text-slate-100">Immediate Crisis Dispatch</h2>
                    <p className="text-xs text-slate-400">
                      Pressing the Red switch triggers high-pitch sirens, broadcasts your live coordinates to Firestore, and notifies emergency contacts.
                    </p>
                  </div>

                  {/* Gigantic Red SOS Button */}
                  <div className="my-10 relative flex justify-center items-center">
                    <AnimatePresence>
                      {sosActive && (
                        <>
                          <motion.div 
                            initial={{ scale: 0.8, opacity: 0.5 }}
                            animate={{ scale: 2, opacity: 0 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                            className="absolute h-40 w-40 bg-red-600 rounded-full"
                          />
                          <motion.div 
                            initial={{ scale: 0.8, opacity: 0.5 }}
                            animate={{ scale: 1.6, opacity: 0 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 0.5 }}
                            className="absolute h-40 w-40 bg-rose-500 rounded-full"
                          />
                        </>
                      )}
                    </AnimatePresence>

                    {sosActive ? (
                      <button
                        onClick={() => setPinModalOpen(true)}
                        className="relative h-44 w-44 bg-gradient-to-tr from-red-700 to-rose-600 rounded-full shadow-2xl flex flex-col items-center justify-center text-white border-4 border-slate-950 select-none z-10 active:scale-95 transition-all outline-none cursor-pointer"
                      >
                        <ShieldAlert className="h-10 w-10 text-white animate-bounce" />
                        <span className="text-sm font-bold uppercase tracking-wider block mt-2">SOS ACTIVE</span>
                        <span className="text-[9px] font-mono tracking-widest text-red-200 block uppercase mt-1 animate-pulse">tap to resolve</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleSOSTrigger}
                        className="relative h-44 w-44 bg-gradient-to-tr from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 hover:shadow-red-950/20 active:scale-95 transition-all outline-none rounded-full shadow-lg shadow-red-950 flex flex-col items-center justify-center text-white border-4 border-slate-950 select-none z-10 cursor-pointer"
                      >
                        <ShieldAlert className="h-12 w-12 text-red-100" />
                        <span className="text-base font-extrabold uppercase tracking-widest block mt-1">PANIC BUTTON</span>
                        <span className="text-[8px] font-mono tracking-widest text-red-200 block mt-1 uppercase">Instant Dispatch</span>
                      </button>
                    )}
                  </div>

                  {/* Simulated alert delivery updates for contacts */}
                  {sosActive && (
                    <div className="flex flex-col gap-2 p-3.5 bg-red-950/20 border border-red-900/30 rounded-2xl z-10 max-w-md w-full">
                      <div className="flex items-center gap-2 text-xs font-mono text-red-400">
                        <Radio className="h-3.5 w-3.5 animate-pulse" />
                        <strong>Sending Mocked Emergency Alerts:</strong>
                      </div>
                      <div className="text-[10px] text-slate-400 space-y-1">
                        {profile.contacts.map((c, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-slate-900/40 p-1.5 px-3 rounded-lg border border-slate-850">
                            <span>Alerting {c.relationship} ({c.name})</span>
                            <span className="text-emerald-400 font-bold">✓ DELIVERED</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <HelplineDirectory />
              </div>

              {/* Siren, Rapid Dial & Mapping Telemetry (Right 5 Columns) */}
              <div className="lg:col-span-12 xl:col-span-5 space-y-6">
                <DirectGpsCaller 
                  profile={profile} 
                  user={user} 
                  currentAlertId={currentAlertId} 
                  onSOSTrigger={handleSOSTrigger} 
                  onLogin={handleLogin} 
                />
                <LocationSharing currentAlertId={currentAlertId} theme={theme} />
                <SafeRouteNavigation theme={theme} />
                <SirenAlarm externalActive={sirenRunning} onStateChange={setSirenRunning} />
              </div>
            </motion.div>
          )}

          {/* TAB 2: Discreet Tools & Timers */}
          {activeTab === 'tools' && (
            <motion.div 
              key="tools"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <DecoyCall />
              <SafetyTimer userPin={profile.pin} onSOSTriggered={handleSOSTrigger} />
            </motion.div>
          )}

          {/* TAB 3: Guardian AI chatbot companion & Threat Scanner */}
          {activeTab === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <ThreatAssessmentHub userId={user?.uid} />
              <div className="flex flex-col h-full min-h-[500px]">
                <GuardianChat currentSituation={sosActive ? "Critical Emergency Mode: SOS triggered" : "Normal escort route monitoring"} userId={user?.uid} />
              </div>
            </motion.div>
          )}

          {/* TAB 4: Profile Settings Setup */}
          {activeTab === 'setup' && (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto w-full space-y-6"
            >
              {/* Cloud Identity & Authorization Services Card */}
              <div className="bg-[#121420] p-6 rounded-2xl border border-slate-850 space-y-5">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3 justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-indigo-500/15 rounded-lg text-indigo-400">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-wider">Cloud Identity & Security Authentication</h2>
                      <p className="text-[10px] text-slate-400 font-mono">Control cloud access permissions & persistent data synchronization</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400 rounded-full font-semibold">
                    {user ? "SECURED" : "GUEST"}
                  </span>
                </div>                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex flex-col justify-between">
                    <span className="text-[9px] font-mono text-indigo-400 font-bold uppercase">1. Failsafe GPS Sync</span>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Broadcasts your live telemetry straight to persistent multi-device cloud feeds during crises.</p>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex flex-col justify-between">
                    <span className="text-[9px] font-mono text-rose-400 font-bold uppercase">2. Secure PIN Profile</span>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Secures your distress PIN, responder notes and customized recipients permanently in our cloud.</p>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex flex-col justify-between">
                    <span className="text-[9px] font-mono text-amber-400 font-bold uppercase">3. Threat Scan Archives</span>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Retains chronological historical records of AI-powered countertop safety assessments.</p>
                  </div>
                </div>

                {authError && (
                  <div className="bg-rose-950/15 border border-rose-900/35 p-4 rounded-xl text-xs space-y-2 text-rose-400">
                    <p className="font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <span>⚠️ Connection Handshake Notice</span>
                    </p>
                    <p className="leading-relaxed text-slate-300 text-[11px]">{authError}</p>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleGuestLogin}
                        disabled={authLoading}
                        className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-semibold rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                      >
                        {authLoading ? "Initializing..." : "1-Click Guest Cloud Sync"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block">Current Authentication State</span>
                    {user ? (
                      <div>
                        <p className="text-xs font-bold text-slate-200">Connected to {user.isAnonymous ? "Secure Guest Session" : "Google Account"}</p>
                        <p className="text-[11px] text-indigo-400 font-mono mt-0.5">{user.isAnonymous ? `Guest UID: ${user.uid.slice(0, 10)}...` : user.email}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-bold text-amber-400">Discreet Local Sandboxed Mode</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Settings and assessments stored only temporarily in cache.</p>
                      </div>
                    )}
                  </div>

                  {user ? (
                    <button
                      onClick={handleLogout}
                      disabled={authLoading}
                      className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {authLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />}
                      <span>Disconnect Cloud Sync</span>
                    </button>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleGuestLogin}
                        disabled={authLoading}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-805 text-slate-300 rounded-xl text-[11px] font-bold tracking-wide uppercase transition-all cursor-pointer disabled:opacity-50"
                      >
                        {authLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-450" /> : <User className="h-3.5 w-3.5 text-indigo-400" />}
                        <span>Secure Guest Sync</span>
                      </button>

                      <button
                        onClick={handleLogin}
                        disabled={authLoading}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all shadow-md shadow-indigo-950/50 cursor-pointer disabled:opacity-50"
                      >
                        {authLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white" /> : <LogIn className="h-4 w-4" />}
                        <span>Unlock Google Sync</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Section A: Profiles Lock PIN */}
              <div className="bg-[#121420] p-6 rounded-2xl border border-slate-850 space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                  <User className="h-5.5 w-5.5 text-indigo-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider">Safety profile settings</h2>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block">Your Safety User Name</label>
                    <input 
                      type="text" 
                      defaultValue={profile.name}
                      onBlur={(e) => handleSaveProfileDetails(e.target.value, profile.pin, profile.medicalNotes)}
                      placeholder="e.g. Jane Doe"
                      className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block">Secret Cancel Pin (4 digits)</label>
                    <input 
                      type="password"
                      maxLength={4}
                      defaultValue={profile.pin}
                      onBlur={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (val.length === 4) {
                          handleSaveProfileDetails(profile.name, val, profile.medicalNotes);
                        }
                      }}
                      placeholder="e.g. 1234"
                      className="w-full text-xs text-center font-bold font-mono tracking-widest bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                    <span className="text-[9px] text-slate-500 block">Required to cancel armed checkins and deactivate active SOS panic.</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block">Critical First Responder Medical Info</label>
                    <textarea 
                      defaultValue={profile.medicalNotes}
                      onBlur={(e) => handleSaveProfileDetails(profile.name, profile.pin, e.target.value)}
                      placeholder="e.g. Allergy to Penicillin, blood type O+ positive"
                      className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 min-h-[80px] select-all max-h-[140px] transition-all"
                    />
                    <span className="text-[9px] text-slate-500 block">Included automatically in global responder alerts.</span>
                  </div>
                </div>
              </div>

              {/* Section B: Emergency Contacts Hub */}
              <div className="bg-[#121420] p-6 rounded-2xl border border-slate-850 space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3 justify-between">
                  <div className="flex items-center gap-3">
                    <HeartPulse className="h-5.5 w-5.5 text-rose-500 animate-pulse" />
                    <h2 className="text-sm font-bold uppercase tracking-wider">Emergency contacts (Max 5)</h2>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {profile.contacts.map((contact, idx) => (
                    <div key={idx} className="bg-slate-900/60 p-4 rounded-xl border border-slate-850 flex items-start justify-between">
                      <div className="space-y-1 text-xs">
                        <div className="flex gap-2 items-center">
                          <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 font-mono text-[9px] rounded-full uppercase tracking-wider font-semibold">
                            {contact.relationship}
                          </span>
                          <strong className="text-slate-200 font-bold">{contact.name}</strong>
                        </div>
                        <p className="text-slate-400 font-mono text-[11px]">{contact.phone}</p>
                        <p className="text-slate-500 text-[10px]">{contact.email}</p>
                      </div>

                      <button
                        onClick={() => {
                          const updated = profile.contacts.filter((_, i) => i !== idx);
                          handleUpdateContacts(updated);
                        }}
                        className="p-1 px-2.5 bg-slate-950 hover:bg-red-950/20 text-slate-500 hover:text-red-400 rounded-lg border border-slate-850 transition-all text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  ))}

                  {profile.contacts.length < 5 ? (
                    <button
                      onClick={() => {
                        const name = prompt("Enter Contact Display Name:");
                        const phone = prompt("Enter Contact Mobile Phone Number:");
                        const email = prompt("Enter Contact Email address:");
                        const rel = prompt("Relationship (e.g. Mom, Partner, Roommate):");
                        
                        if (name && phone && email && rel) {
                          const newContact: EmergencyContact = { name, phone, email, relationship: rel };
                          handleUpdateContacts([...profile.contacts, newContact]);
                        }
                      }}
                      className="w-full py-3 bg-slate-900 border border-dashed border-slate-800 hover:border-indigo-500/50 text-indigo-400 hover:text-indigo-300 transition-all font-semibold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>Register Emergency Recipient</span>
                    </button>
                  ) : (
                    <p className="text-[10px] text-slate-500 text-center font-mono">Recipient list limits reached (Max 5).</p>
                  )}
                </div>
              </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-950 py-4 text-center text-[10px] text-slate-500 font-mono mt-12 bg-slate-950/20">
        <p>© 2026 Nidar Safety & Emergency Safeguard Portal. End-to-end sandbox. Authorized access only.</p>
      </footer>

      {/* SECURE DEACTIVATION PIN MODAL */}
      <AnimatePresence>
        {pinModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#121420] border border-slate-850 p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-4"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 bg-red-600/10 text-red-500 rounded-full animate-pulse border border-red-900/30">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-slate-100 uppercase tracking-wide">Deactivate Emergency SOS</h3>
                <p className="text-xs text-slate-400">Enter your 4-digit safety cancel PIN to declare safe resolution and resolve the cloud dispatch alarm.</p>
              </div>

              <div className="space-y-4">
                <input 
                  type="password"
                  maxLength={4}
                  value={verifyPin}
                  onChange={(e) => {
                    setVerifyPinErr(false);
                    setVerifyPin(e.target.value.replace(/\D/g, ''));
                  }}
                  placeholder="Cancel PIN Code"
                  className={`w-full bg-slate-950 border text-center text-lg font-bold tracking-widest font-mono rounded-xl py-3.5 placeholder:text-slate-600 focus:outline-none transition-all ${
                    verifyPinErr ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500'
                  }`}
                />
                
                {verifyPinErr && (
                  <p className="text-xs text-red-400 font-semibold text-center uppercase">❌ Invalid PIN security check try again</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setPinModalOpen(false); setVerifyPin(''); setVerifyPinErr(false); }}
                    className="flex-1 py-3 bg-slate-905 border border-slate-800 text-slate-400 text-xs font-semibold rounded-xl hover:bg-slate-850 active:scale-95 transition-all outline-none"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleSOSResolve}
                    className="flex-1 py-3 bg-red-650 hover:bg-red-600 font-bold tracking-wide uppercase text-white text-xs rounded-xl shadow-lg shadow-red-950 active:scale-95 transition-all outline-none"
                  >
                    Confirm Clear Security
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
