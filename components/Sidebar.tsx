/**
 * Application sidebar with navigation and branding.
 */

import React from 'react';
import { 
  Activity, 
  History, 
  Settings, 
  ShieldCheck, 
  Stethoscope 
} from 'lucide-react';
import { AppView } from '../types';

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const navItems = [
    { id: AppView.DASHBOARD, label: 'New Patient Scan', icon: Activity },
    { id: AppView.HISTORY, label: 'Historical Trends', icon: History },
    { id: AppView.SETTINGS, label: 'Settings', icon: Settings },
    { id: AppView.PRIVACY, label: 'Data Privacy Audit', icon: ShieldCheck },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen sticky top-0 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
      <div className="p-6 flex items-center gap-3 border-b border-slate-100">
        <div className="bg-[#005EB8] p-2 rounded-lg">
          <Stethoscope className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-slate-800 text-sm leading-tight">Browser ECG Analyzer</h1>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Research Prototype</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 mt-4">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                isActive 
                  ? 'bg-[#005EB8] text-white shadow-md shadow-blue-900/10' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-[#005EB8]'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-[#005EB8]'}`} />
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-6 border-t border-slate-100">
        <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 border border-slate-200">
          <p className="font-semibold mb-1">Research Use Only</p>
          Not validated for clinical diagnosis. For investigational purposes.
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;