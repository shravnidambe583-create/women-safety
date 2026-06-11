import React, { useState, useEffect, useRef } from 'react';
import { Send, ShieldAlert, Sparkles, User, HelpCircle, Loader2 } from 'lucide-react';
import { Message } from '../types';

interface GuardianChatProps {
  currentSituation?: string;
  userId?: string | null;
}

const PRESET_PROMPTS = [
  "I think someone is following me right now.",
  "Create a fake conversation script I can read out loud.",
  "Give me safe practices for riding a suspicious cab.",
  "I am entering a dark parking garage, what do I do?"
];

export default function GuardianChat({ currentSituation = '', userId = null }: GuardianChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "wel_1",
      sender: "guardian",
      text: "Hello, I am Guardian AI, your virtual safety coordinator. If you feel uncomfortable, type your situation below or choose a quick prompt. I can provide immediate micro-tactics, safety recommendations, or generate decoy verbal loops.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Auto-scroll to lowest message
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: "msg_" + Math.random().toString(36).substring(2, 9),
      sender: "user",
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          currentSituation: currentSituation,
          userId: userId
        })
      });
      const data = await response.json();
      
      const aiResponse: Message = {
        id: "msg_" + Math.random().toString(36).substring(2, 9),
        sender: "guardian",
        text: data.text || "Failed to analyze chat securely.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages((prev) => [...prev, aiResponse]);
    } catch (e: any) {
      console.error("Guardian AI communications offline:", e);
      setMessages((prev) => [
        ...prev,
        {
          id: "err_" + Math.random().toString(36).substring(2, 9),
          sender: "guardian",
          text: `🚨 Core systems offline. Simple Safe Recommendation: Find a brightly lit shop/cafe immediately. Do not head into residential alleyways. Try activating the physical deterrent siren or simulated decoy call.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#121420] text-slate-100 p-6 rounded-2xl border border-slate-850 shadow-xl flex flex-col h-[524px] justify-between">
      {/* Header */}
      <div className="border-b border-slate-800 pb-3.5 flex items-center gap-3">
        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
          <Sparkles className="h-5 w-5 animate-pulse" />
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-100 uppercase">Guardian AI Companion</h2>
          <p className="text-[11px] text-slate-400">Real-time protective tactics & active decoy generators</p>
        </div>
      </div>

      {/* Messages Container */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 my-4 overflow-y-auto space-y-3.5 pr-1 text-xs scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
      >
        {messages.map((m) => (
          <div 
            key={m.id} 
            className={`flex items-start gap-2.5 max-w-[85%] ${m.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
          >
            <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${m.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-indigo-400'}`}>
              {m.sender === 'user' ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            </div>
            
            <div className="space-y-1">
              <div 
                className={`p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                  m.sender === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}
              >
                {m.text}
              </div>
              <span className={`text-[9px] text-slate-500 font-mono block ${m.sender === 'user' ? 'text-right' : ''}`}>
                {m.timestamp}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-900/30 border border-slate-850 p-2.5 rounded-xl w-36">
            <Loader2 className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
            <span>AI generating advice...</span>
          </div>
        )}
      </div>

      {/* Preset prompt pills */}
      {messages.length === 1 && (
        <div className="py-2 border-t border-slate-900">
          <p className="text-[10px] text-slate-500 font-semibold mb-2 flex items-center gap-1">
            <HelpCircle className="h-3 w-3 text-slate-500" />
            <span>Select a micro-tactic to start helper advice:</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                className="text-[10px] px-3 py-1.5 bg-slate-900 hover:bg-slate-850 hover:text-slate-200 text-slate-400 rounded-full border border-slate-850 font-medium active:scale-95 transition-all cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Sender Form */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputText); }}
        className="flex items-center gap-2 border-t border-slate-800 pt-3"
      >
        <input 
          type="text" 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Describe your threat, cab plate, or surroundings..."
          className="flex-1 text-xs bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 placeholder:text-slate-500 text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
          disabled={loading}
        />
        <button
          type="submit"
          className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl active:scale-95 transition-all shrink-0 cursor-pointer disabled:opacity-50"
          disabled={loading || !inputText.trim()}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
