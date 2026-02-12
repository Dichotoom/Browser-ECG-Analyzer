/**
 * Dual-chart visualization: ECG waveform with R-peaks and R-R interval tachogram.
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Area
} from 'recharts';
import { ECGPoint } from '../types';
import { Activity, TrendingUp } from 'lucide-react';

interface ECGDisplayProps {
  data: ECGPoint[];
}

const ChartContainer: React.FC<{ 
  title: string; 
  subtitle?: string; 
  icon: any; 
  color: string; 
  children: React.ReactNode 
}> = ({ title, subtitle, icon: Icon, color, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-72 overflow-hidden">
    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <h3 className="font-semibold text-sm text-slate-700">{title}</h3>
      </div>
      {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
    </div>
    <div className="flex-1 w-full relative">
      {children}
    </div>
  </div>
);

const ECGDisplay: React.FC<ECGDisplayProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {['ECG Signal with R-Peaks', 'Heart Rate Variability'].map((title, i) => (
           <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm h-72 flex items-center justify-center flex-col gap-3">
             <Activity className="w-8 h-8 text-slate-200" />
             <p className="text-slate-400 text-sm">Waiting for signal data...</p>
           </div>
         ))}
      </div>
    );
  }

  const peaks = data.filter(d => d.isPeak);

  // Calculate R-R intervals and instantaneous heart rate
  const rrData: { time: number; rr: number; hr: number; beatNum: number }[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const rrInterval = peaks[i].time - peaks[i-1].time;
    const instantHR = 60 / rrInterval;
    rrData.push({
      time: peaks[i].time,
      rr: Math.round(rrInterval * 1000),
      hr: Math.round(instantHR),
      beatNum: i
    });
  }

  const avgRR = rrData.length > 0 ? rrData.reduce((sum, d) => sum + d.rr, 0) / rrData.length : 0;
  const rrStd = rrData.length > 1 
    ? Math.sqrt(rrData.reduce((sum, d) => sum + Math.pow(d.rr - avgRR, 2), 0) / (rrData.length - 1))
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ECG Waveform with R-peak Markers */}
      <ChartContainer 
        title="ECG Signal (Lead II)" 
        subtitle={`${peaks.length} R-peaks detected`}
        icon={Activity} 
        color="text-[#005EB8]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="time" hide padding={{ left: 20 }}/>
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              labelStyle={{ color: '#64748b' }}
              itemStyle={{ color: '#333333', fontSize: '12px' }}
              formatter={(value: number, name: string) => {
                if (name === 'clean') return [value.toFixed(3) + ' mV', 'Amplitude'];
                return [value, name];
              }}
              labelFormatter={(label) => `Time: ${Number(label).toFixed(3)}s`}
            />
            <Line 
              type="monotone" 
              dataKey="clean" 
              stroke="#005EB8" 
              strokeWidth={1.5} 
              dot={false} 
              isAnimationActive={true}
              name="clean"
            />
            <Line 
              type="monotone"
              dataKey="clean"
              stroke="transparent"
              dot={(props) => {
                 const { cx, cy, index } = props;
                 if (data[index]?.isPeak) {
                   return (
                     <g key={index}>
                       <circle cx={cx} cy={cy} r={4} fill="#EF4444" stroke="white" strokeWidth={1.5} />
                     </g>
                   );
                 }
                 return <></>;
              }}
              activeDot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* R-R Interval Tachogram */}
      <ChartContainer 
        title="R-R Interval Tachogram" 
        subtitle={rrData.length > 0 ? `SDNN: ${rrStd.toFixed(0)}ms` : undefined}
        icon={TrendingUp} 
        color="text-emerald-600"
      >
        {rrData.length < 2 ? (
          <div className="h-full flex items-center justify-center flex-col gap-2">
            <TrendingUp className="w-6 h-6 text-slate-200" />
            <p className="text-slate-400 text-xs">Need more R-peaks for HRV analysis</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rrData} margin={{ top: 15, right: 15, left: 5, bottom: 25 }}>
              <defs>
                <linearGradient id="rrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="beatNum" 
                type="number"                 
                domain={['dataMin', 'dataMax']} 
                tickCount={10}               
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
                label={{ 
                  value: 'Beat Number', 
                  position: 'insideBottom', 
                  offset: -5, 
                  fontSize: 11, 
                  fill: '#64748b',
                  fontWeight: 500
                }}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
                tickFormatter={(value) => `${value}`}
                label={{ 
                  value: 'R-R Interval (ms)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  offset: -5, 
                  fontSize: 11, 
                  fill: '#64748b',
                  fontWeight: 500,
                  dx: 10,
                  dy: 45
                }}
                width={55}
                domain={[
                  (dataMin: number) => Math.floor((dataMin - 50) / 50) * 50,
                  (dataMax: number) => Math.ceil((dataMax + 50) / 50) * 50
                ]}
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: 'none', 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                  fontSize: '12px',
                  padding: '8px 12px'
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'rr') return [`${value} ms`, 'R-R Interval'];
                  return [`${value} BPM`, 'Instant HR'];
                }}
                labelFormatter={(label) => `Beat #${label}`}
              />
              <Area 
                type="monotone" 
                dataKey="rr" 
                stroke="#10b981" 
                strokeWidth={2}
                fill="url(#rrGradient)"
                dot={{ r: 3, fill: '#10b981', stroke: 'white', strokeWidth: 1 }}
                activeDot={{ r: 5, fill: '#059669' }}
                name="rr"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartContainer>
    </div>
  );
};

export default ECGDisplay;