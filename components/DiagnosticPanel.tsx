/**
 * Clinical metrics display panel with color-coded status indicators.
 */

import React from 'react';
import { Heart, Activity, BarChart3, AlertTriangle, CheckCircle, Timer, Waves, HeartPulse } from 'lucide-react';
import { PatientMetrics } from '../types';

interface DiagnosticPanelProps {
  metrics: PatientMetrics | null;
}

const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl h-48 flex flex-col items-center justify-center text-slate-400 gap-2">
        <Activity className="w-8 h-8 opacity-50" />
        <span className="text-sm font-medium">Upload scan to view diagnostics</span>
      </div>
    );
  }

  const getRhythmColor = (status: string) => {
    if (status.includes('Normal')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status.includes('Wide-Complex') || status.includes('URGENT')) return 'bg-red-100 text-red-700 border-red-200';
    if (status.includes('Flagged')) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getQRSStatus = (qrsWidth?: number) => {
    if (!qrsWidth) return { label: 'N/A', color: 'text-slate-400' };
    if (qrsWidth < 100) return { label: 'Normal', color: 'text-emerald-600' };
    if (qrsWidth < 120) return { label: 'Borderline', color: 'text-amber-600' };
    return { label: 'Wide', color: 'text-red-600' };
  };

  const getQTcStatus = (qtc?: number) => {
    if (!qtc) return { label: 'N/A', color: 'text-slate-400' };
    if (qtc < 350) return { label: 'Short', color: 'text-amber-600' };
    if (qtc <= 450) return { label: 'Normal', color: 'text-emerald-600' };
    if (qtc <= 480) return { label: 'Borderline', color: 'text-amber-600' };
    return { label: 'Prolonged', color: 'text-red-600' };
  };

  const getHRVStatus = (sdnn?: number) => {
    if (!sdnn) return { label: 'N/A', color: 'text-slate-400' };
    if (sdnn < 50) return { label: 'Low', color: 'text-red-600' };
    if (sdnn < 100) return { label: 'Moderate', color: 'text-amber-600' };
    return { label: 'Good', color: 'text-emerald-600' };
  };

  const qrsStatus = getQRSStatus(metrics.qrsWidth);
  const qtcStatus = getQTcStatus(metrics.qtcBazett);
  const hrvStatus = getHRVStatus(metrics.sdnn);

  return (
    <div className="space-y-6">
      {/* Clinical Warnings */}
      {metrics.clinicalWarnings && metrics.clinicalWarnings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-red-800">Clinical Alerts</h4>
              <ul className="mt-1 space-y-1">
                {metrics.clinicalWarnings.map((warning, idx) => (
                  <li key={idx} className="text-xs text-red-700">• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Heart Rate</span>
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500/10" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-bold text-slate-800 tracking-tight">{Math.round(metrics.bpm)}</span>
            <span className="text-sm font-medium text-slate-500">BPM</span>
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center gap-1">
            <Activity className="w-3 h-3" />
            <span>Real-time average</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Rhythm Status</span>
            <Activity className="w-5 h-5 text-[#005EB8]" />
          </div>
          <div className="mt-2">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${getRhythmColor(metrics.rhythmStatus)}`}>
              {metrics.rhythmStatus.includes('Flagged') || metrics.rhythmStatus.includes('Wide') ? 
                <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
              {metrics.rhythmStatus}
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400">Based on R-R interval variance</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Signal Quality</span>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
          <div className="w-full mt-4">
            <div className="flex justify-between mb-1">
              <span className="text-2xl font-bold text-slate-800">{Math.round(metrics.confidence)}%</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
                metrics.confidence >= 90 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                metrics.confidence >= 70 ? 'text-amber-600 bg-amber-50 border-amber-100' :
                'text-red-600 bg-red-50 border-red-100'
              }`}>
                {metrics.confidence >= 90 ? 'Excellent' : metrics.confidence >= 70 ? 'Good' : 'Poor'}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div className="bg-[#005EB8] h-2 rounded-full transition-all duration-500" 
                   style={{ width: `${metrics.confidence}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">QRS Duration</span>
            <Waves className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold text-slate-800">
              {metrics.qrsWidth ? Math.round(metrics.qrsWidth) : '—'}
            </span>
            <span className="text-sm font-medium text-slate-500">ms</span>
            <span className={`ml-auto text-xs font-semibold ${qrsStatus.color}`}>{qrsStatus.label}</span>
          </div>
          <div className="mt-3 text-xs text-slate-400">Normal: &lt;120ms • Wide: BBB/VT risk</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">QTc (Bazett)</span>
            <Timer className="w-5 h-5 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold text-slate-800">
              {metrics.qtcBazett ? Math.round(metrics.qtcBazett) : '—'}
            </span>
            <span className="text-sm font-medium text-slate-500">ms</span>
            <span className={`ml-auto text-xs font-semibold ${qtcStatus.color}`}>{qtcStatus.label}</span>
          </div>
          <div className="mt-3 text-xs text-slate-400">Normal: 350-450ms • Drug safety metric</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Heart Rate Variability</span>
            <HeartPulse className="w-5 h-5 text-teal-500" />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-800">
                  {metrics.sdnn ? Math.round(metrics.sdnn) : '—'}
                </span>
                <span className="text-xs text-slate-500">ms</span>
              </div>
              <div className="text-xs text-slate-400">SDNN</div>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-800">
                  {metrics.rmssd ? Math.round(metrics.rmssd) : '—'}
                </span>
                <span className="text-xs text-slate-500">ms</span>
              </div>
              <div className="text-xs text-slate-400">RMSSD</div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">Autonomic health</span>
            <span className={`text-xs font-semibold ${hrvStatus.color}`}>{hrvStatus.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticPanel;