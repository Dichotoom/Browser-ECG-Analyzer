/**
 * TypeScript type definitions for ECG data structures and application state.
 */

export interface ECGPoint {
  time: number;
  voltage: number;
  clean?: number;
  isPeak?: boolean;
}

export interface PatientMetrics {
  bpm: number;
  rhythmStatus: 'Normal Sinus Rhythm' | 'Flagged: Irregular Rhythm' | 'Bradycardia' | 'Tachycardia' | 'Wide-Complex Tachycardia' | 'Analyzing...';
  confidence: number;
  lastScanDate: string;
  qrsWidth?: number;
  qtcBazett?: number;
  sdnn?: number;
  rmssd?: number;
  pnn50?: number;
  clinicalWarnings?: string[];
}

export interface ProcessingConfig {
  sampleRate?: number;
  verbose?: boolean;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  HISTORY = 'HISTORY',
  SETTINGS = 'SETTINGS',
  PRIVACY = 'PRIVACY'
}