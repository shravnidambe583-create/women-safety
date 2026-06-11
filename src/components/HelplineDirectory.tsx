import React from 'react';
import { Phone, Shield, Building2, HelpCircle } from 'lucide-react';

interface Helpline {
  name: string;
  number: string;
  description: string;
  category: 'National' | 'Emergency' | 'Counseling' | 'Defense';
}

const HELPLINES: Helpline[] = [
  {
    name: "Standard Direct Emergency Line",
    number: "911",
    description: "Connect immediately to police, ambulance, or fire dispatches",
    category: "Emergency"
  },
  {
    name: "National Domestic Violence Helpline",
    number: "1-800-799-7233",
    description: "Free, confidential 24/7 assistance for physical or verbal abuse guidelines",
    category: "National"
  },
  {
    name: "National Women Safety Desk",
    number: "1-800-555-0199",
    description: "Support for critical threats, night escort services, and localized support",
    category: "National"
  },
  {
    name: "Crisis Response Helpline",
    number: "988",
    description: "National suicide & emotional distress helpline",
    category: "Counseling"
  },
  {
    name: "Transit Safe-Ride Dispatch",
    number: "1-880-SAFE-RIDE",
    description: "Public localized night security escort systems and route dispatch desk",
    category: "Defense"
  },
  {
    name: "Women Support & Legal Counsel Office",
    number: "1-800-413-2000",
    description: "Confidential legal aid advice, mental state coaching response hubs",
    category: "Counseling"
  }
];

export default function HelplineDirectory() {
  const getIcon = (cat: string) => {
    switch (cat) {
      case 'Emergency': return <Shield className="h-5 w-5 text-red-400" />;
      case 'National': return <Building2 className="h-5 w-5 text-indigo-400" />;
      case 'Counseling': return <HelpCircle className="h-5 w-5 text-emerald-400" />;
      default: return <Phone className="h-5 w-5 text-amber-400" />;
    }
  };

  const handleCall = (num: string) => {
    // Attempt standard call mechanism inside security frame limits
    window.location.href = `tel:${num}`;
  };

  return (
    <div className="bg-[#121420] text-slate-100 p-6 rounded-2xl border border-slate-800 shadow-xl">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
          <Phone className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight font-sans">Emergency & Support Directory</h2>
          <p className="text-xs text-slate-400">Access instant, toll-free help desks directly from your device</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {HELPLINES.map((helpline, idx) => (
          <div 
            key={idx} 
            className="flex items-start justify-between p-4 bg-slate-900/50 hover:bg-slate-900 rounded-xl border border-slate-800/80 hover:border-indigo-500/30 transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="mt-1 p-2 bg-slate-800 rounded-lg">
                {getIcon(helpline.category)}
              </div>
              <div className="space-y-1">
                <span className="inline-block text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 font-mono rounded-full font-medium">
                  {helpline.category}
                </span>
                <h3 className="text-sm font-semibold text-slate-100 font-sans group-hover:text-indigo-400 transition-colors">
                  {helpline.name}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed max-w-[240px]">
                  {helpline.description}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleCall(helpline.number)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-xs text-white font-semibold rounded-lg shadow-sm transition-all"
            >
              <Phone className="h-3 w-3" />
              <span>{helpline.number}</span>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-slate-900/30 border border-amber-500/10 p-4 rounded-xl flex items-center gap-3">
        <span className="text-xl">💡</span>
        <p className="text-xs text-slate-400 leading-relaxed">
          <strong>Tip:</strong> In extreme scenarios, trigger the <span className="text-red-400 font-semibold font-sans">Red SOS Panic Switch</span>. It will broadcast your continuous coordinates to our server database and sound high-decibel alarms, alerting emergency networks.
        </p>
      </div>
    </div>
  );
}
