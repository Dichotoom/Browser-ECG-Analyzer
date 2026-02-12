/**
 * Application header with breadcrumb navigation and user context.
 */

import React from 'react';
import { Lock, User } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-2">
         <span className="text-slate-400 text-sm">Dashboard</span>
         <span className="text-slate-300">/</span>
         <span className="text-slate-600 font-medium text-sm">Live Analysis</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
          <div className="bg-green-100 p-1 rounded-full">
            <Lock className="w-3 h-3 text-green-700" />
          </div>
          <span className="text-xs font-semibold text-green-800">Client-Side Processing Active</span>
        </div>

        <div className="h-6 w-px bg-slate-200"></div>

        <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-700">Dr. Van Der Berg</p>
            <p className="text-xs text-slate-500">General Practitioner</p>
          </div>
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 border border-slate-300">
            <User className="w-5 h-5" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;