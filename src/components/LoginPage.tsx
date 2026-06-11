import React, { useState } from 'react';
import { 
  ShieldAlert, LogIn, User, Loader2, Sparkles, Clock, MapPin, 
  Wifi, WifiOff, Sun, Moon, Mail, Lock, UserPlus 
} from 'lucide-react';
import { motion } from 'motion/react';

interface LoginPageProps {
  onLogin: () => void;
  onGuestLogin: () => void;
  onEmailLogin: (email: string, pass: string) => Promise<void>;
  onEmailSignUp: (email: string, pass: string) => Promise<void>;
  authLoading: boolean;
  authError: string | null;
  isOnline: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function LoginPage({
  onLogin,
  onGuestLogin,
  onEmailLogin,
  onEmailSignUp,
  authLoading,
  authError,
  isOnline,
  theme,
  onToggleTheme
}: LoginPageProps) {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!email || !password) {
      setValidationError("Please fill out all credentials.");
      return;
    }

    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters.");
      return;
    }

    if (activeTab === 'signup') {
      if (password !== confirmPassword) {
        setValidationError("Passwords do not match.");
        return;
      }
      await onEmailSignUp(email, password);
    } else {
      await onEmailLogin(email, password);
    }
  };

  return (
    <div className="min-h-screen bg-[#070913] text-slate-100 flex flex-col justify-between antialiased relative overflow-hidden font-sans">
      {/* Decorative ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-rose-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header / Brand banner */}
      <header className="p-6 max-w-7xl w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-tr from-rose-600 to-rose-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-950/40">
            <ShieldAlert className="h-5.5 w-5.5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-widest font-sans text-slate-100 uppercase">Nidār</h1>
            <p className="text-[10px] text-rose-400 font-mono tracking-wider">Autonomous Emergency Safeguard System</p>
          </div>
        </div>

        {/* Network & Theme Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleTheme}
            className="p-1.5 bg-slate-900 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-400" />}
          </button>

          {isOnline ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/20 font-mono text-[9px] text-emerald-400 rounded-full border border-emerald-900/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>NETWORK OPERATIONAL</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-950/20 font-mono text-[9px] text-amber-400 rounded-full border border-amber-900/30">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>OFFLINE FALLBACK READY</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Form Area */}
      <main className="flex-1 max-w-md w-full mx-auto px-6 flex flex-col justify-center z-10 my-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="bg-[#121422]/90 border border-slate-900 rounded-3xl p-8 space-y-6 shadow-2xl relative"
        >
          {/* Cover highlight */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-indigo-500 to-rose-600 rounded-t-3xl" />

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-white uppercase">Secure Entry Portal</h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              Connect to Nidār to arm panic buttons, activate GPS live broadcasting, and unlock your Guardian AI chatbot companion.
            </p>
          </div>

          {/* Core Feature Bento Pills */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="bg-slate-950/60 border border-slate-900 p-2.5 rounded-xl flex flex-col items-center text-center space-y-1">
              <MapPin className="h-4 w-4 text-rose-500" />
              <span className="text-[9px] font-bold text-slate-200">GPS Sync</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-900 p-2.5 rounded-xl flex flex-col items-center text-center space-y-1">
              <Clock className="h-4 w-4 text-indigo-400" />
              <span className="text-[9px] font-bold text-slate-200">Discreet</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-900 p-2.5 rounded-xl flex flex-col items-center text-center space-y-1">
              <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse" />
              <span className="text-[9px] font-bold text-slate-200">Guardian AI</span>
            </div>
          </div>

          {/* Sign In vs Sign Up Tab Bar Selector */}
          <div className="bg-slate-950/50 p-1 border border-slate-900 rounded-xl grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setValidationError(null);
              }}
              className={`py-2 rounded-lg text-xs font-bold text-center transition-all cursor-pointer ${
                activeTab === 'signin'
                  ? 'bg-indigo-600 border border-indigo-500/20 text-white'
                  : 'text-slate-400 hover:text-slate-350'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setValidationError(null);
              }}
              className={`py-2 rounded-lg text-xs font-bold text-center transition-all cursor-pointer ${
                activeTab === 'signup'
                  ? 'bg-indigo-600 border border-indigo-500/20 text-white'
                  : 'text-slate-400 hover:text-slate-350'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  disabled={authLoading}
                  className="w-full bg-slate-950 text-slate-200 px-3 py-2.5 pl-10 rounded-xl border border-slate-900 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={authLoading}
                  className="w-full bg-slate-950 text-slate-200 px-3 py-2.5 pl-10 rounded-xl border border-slate-900 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  required
                />
              </div>
            </div>

            {activeTab === 'signup' && (
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Confirm Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={authLoading}
                    className="w-full bg-slate-950 text-slate-200 px-3 py-2.5 pl-10 rounded-xl border border-slate-900 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>
            )}

            {/* Error notifications */}
            {(validationError || authError) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-rose-950/20 border border-rose-900/40 p-3 rounded-xl text-xs space-y-1 text-rose-300"
              >
                <p className="font-bold uppercase tracking-wider text-[10px]">⚠️ Error Advisory</p>
                <p className="text-[11px] leading-relaxed text-slate-350">{validationError || authError}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full h-11 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md select-none disabled:opacity-55 cursor-pointer mt-2"
            >
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : activeTab === 'signin' ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              <span>{activeTab === 'signin' ? 'Sign In' : 'Create Secure Profile'}</span>
            </button>
          </form>

          {/* Social Providers Divider */}
          <div className="relative py-2 flex items-center justify-center">
            <div className="absolute inset-x-0 h-px bg-slate-900" />
            <span className="relative bg-[#121422] px-3 font-mono text-[9px] text-slate-500 uppercase tracking-widest font-semibold">Alternative Handshakes</span>
          </div>

          {/* Google & Click-to-Guest Quick Providers */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onLogin}
              disabled={authLoading}
              className="h-11 flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer text-indigo-400 hover:text-indigo-300"
              id="google-signin-btn-alt"
              title="Standard Google OAuth Authorization"
            >
              <LogIn className="h-4 w-4" />
              <span>Google</span>
            </button>

            <button
              onClick={onGuestLogin}
              disabled={authLoading}
              className="h-11 flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer text-rose-400 hover:text-rose-300"
              id="guest-signin-btn-alt"
              title="One Click Anonymous Session"
            >
              <User className="h-4 w-4" />
              <span>Guest Entry</span>
            </button>
          </div>

          {/* Sandboxed disclaimer */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900/50 text-[10px] text-slate-400 leading-normal space-y-1 text-center font-mono">
            <strong>Security Sandbox info</strong>
            <p>
              Under browser iFrames, OAuth Google popups are restricted. Standard Google Sign In may fail; you can use the direct <strong>Email & Password forms</strong> above or click <strong>Guest Entry</strong> to sign in.
            </p>
          </div>
        </motion.div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="p-6 text-center text-[9px] text-slate-500 font-mono z-10 border-t border-slate-950 bg-slate-950/20">
        <p>© 2026 Nidār Safety & Emergency Safeguard Portal. Sandboxed environment. Authorized access only.</p>
      </footer>
    </div>
  );
}
