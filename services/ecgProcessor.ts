/**
 * Main thread interface for Web Worker-based ECG processing using Pyodide.
 */

import type { ECGPoint, PatientMetrics, ProcessingConfig } from '../../types';

type WorkerStatus = 'uninitialized' | 'initializing' | 'ready' | 'processing' | 'error';

interface ProcessingProgress {
  stage: 'loading_runtime' | 'loading_packages' | 'initializing_code' | 'processing';
  progress: number;
  message?: string;
}

interface ProcessingCallbacks {
  onProgress?: (progress: ProcessingProgress) => void;
  onComplete?: (result: ProcessingResult) => void;
  onError?: (error: string) => void;
}

interface ProcessingResult {
  data: ECGPoint[];
  metrics: PatientMetrics;
  rawMetrics: {
    filter_metrics: any;
    detection_metrics: any;
    arrhythmia_metrics: any;
    qrs_metrics: any;
    qt_metrics: any;
    hrv_metrics: any;
  };
}

/**
 * Manages ECG processing pipeline in Web Worker environment.
 */
export class ECGProcessor {
  private worker: Worker | null = null;
  private status: WorkerStatus = 'uninitialized';
  private pendingRequests: Map<string, ProcessingCallbacks> = new Map();
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    console.log('[ECGProcessor] Initializing...');
  }

  /**
   * Initialize Pyodide runtime in Web Worker.
   */
  async initialize(onProgress?: (progress: ProcessingProgress) => void): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.status === 'ready') {
      console.log('[ECGProcessor] Already initialized');
      return Promise.resolve();
    }

    this.initializationPromise = new Promise((resolve, reject) => {
      try {
        this.status = 'initializing';

        this.worker = new Worker(
          new URL('./ecgWorker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.addEventListener('message', (e) => {
          this.handleWorkerMessage(e, onProgress);
        });

        this.worker.addEventListener('error', (e) => {
          console.error('[ECGProcessor] Worker error:', e);
          this.status = 'error';
          reject(new Error(`Worker error: ${e.message}`));
        });

        this.pendingRequests.set('__init__', {
          onProgress,
          onComplete: () => {
            this.status = 'ready';
            console.log('[ECGProcessor] Ready to process ECG data');
            resolve();
          },
          onError: (error) => {
            this.status = 'error';
            reject(new Error(error));
          }
        });

        this.worker.postMessage({ type: 'INIT_PYODIDE' });

      } catch (error) {
        this.status = 'error';
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * Route incoming Worker messages to appropriate handlers.
   */
  private handleWorkerMessage(
    e: MessageEvent,
    globalProgressCallback?: (progress: ProcessingProgress) => void
  ): void {
    const { type, data, requestId, error } = e.data;

    switch (type) {
      case 'PYODIDE_LOADING_PROGRESS':
        if (globalProgressCallback) {
          globalProgressCallback(data);
        }

        const initCallbacks = this.pendingRequests.get('__init__');
        if (initCallbacks?.onProgress) {
          initCallbacks.onProgress(data);
        }
        break;

      case 'PYODIDE_READY':
        const readyCallbacks = this.pendingRequests.get('__init__');
        if (readyCallbacks?.onComplete) {
          readyCallbacks.onComplete(data);
        }
        this.pendingRequests.delete('__init__');
        break;

      case 'ECG_PROCESSED':
        const processCallbacks = this.pendingRequests.get(requestId || '');
        if (processCallbacks) {
          const result = this.transformResults(data);
          if (processCallbacks.onComplete) {
            processCallbacks.onComplete(result);
          }
          this.pendingRequests.delete(requestId || '');
        }
        this.status = 'ready';
        break;

      case 'PREPROCESSING_COMPLETE':
        const preprocessCallbacks = this.pendingRequests.get(requestId || '');
        if (preprocessCallbacks?.onComplete) {
          preprocessCallbacks.onComplete(data);
        }
        this.pendingRequests.delete(requestId || '');
        this.status = 'ready';
        break;

      case 'ERROR':
        console.error('[ECGProcessor] Worker reported error:', error);

        if (requestId) {
          const errorCallbacks = this.pendingRequests.get(requestId);
          if (errorCallbacks?.onError) {
            errorCallbacks.onError(error);
          }
          this.pendingRequests.delete(requestId);
        }

        const initErrorCallbacks = this.pendingRequests.get('__init__');
        if (initErrorCallbacks?.onError) {
          initErrorCallbacks.onError(error);
          this.pendingRequests.delete('__init__');
        }

        this.status = 'error';
        break;

      default:
        console.warn('[ECGProcessor] Unknown message type:', type);
    }
  }

  /**
   * Transform Python results to application data structures.
   */
  private transformResults(pythonResults: any): ProcessingResult {
    const {
      cleaned_signal,
      r_peak_indices,
      filter_metrics,
      detection_metrics,
      arrhythmia_metrics,
      qrs_metrics,
      qt_metrics,
      hrv_metrics,
      clinical_warnings,
      rhythm_status,
      sample_rate
    } = pythonResults;

    // Build ECGPoint array
    const data: ECGPoint[] = [];
    const peakSet = new Set(r_peak_indices);

    for (let i = 0; i < cleaned_signal.length; i++) {
      data.push({
        time: parseFloat((i / sample_rate).toFixed(3)),
        voltage: cleaned_signal[i],
        clean: cleaned_signal[i],
        isPeak: peakSet.has(i)
      });
    }

    // Format metrics
    const metrics: PatientMetrics = {
      bpm: detection_metrics.avg_heart_rate_bpm,
      rhythmStatus: this.normalizeRhythmStatus(rhythm_status),
      confidence: this.calculateConfidence(filter_metrics),
      lastScanDate: new Date().toISOString(),
      qrsWidth: qrs_metrics?.mean_qrs_ms || undefined,
      qtcBazett: qt_metrics?.mean_qtc_bazett_ms || undefined,
      sdnn: hrv_metrics?.sdnn_ms || undefined,
      rmssd: hrv_metrics?.rmssd_ms || undefined,
      pnn50: hrv_metrics?.pnn50_percent || undefined,
      clinicalWarnings: clinical_warnings || []
    };

    return {
      data,
      metrics,
      rawMetrics: {
        filter_metrics,
        detection_metrics,
        arrhythmia_metrics,
        qrs_metrics,
        qt_metrics,
        hrv_metrics
      }
    };
  }

  /**
   * Map Python rhythm status to type-safe enum.
   */
  private normalizeRhythmStatus(
    status: string
  ): PatientMetrics['rhythmStatus'] {
    if (status.includes('Wide-Complex')) return 'Wide-Complex Tachycardia';
    if (status.includes('Normal Sinus')) return 'Normal Sinus Rhythm';
    if (status.includes('Bradycardia')) return 'Bradycardia';
    if (status.includes('Tachycardia')) return 'Tachycardia';
    if (status.includes('Irregular') || status.includes('Flagged')) return 'Flagged: Irregular Rhythm';
    return 'Analyzing...';
  }

  /**
   * Convert SNR to confidence percentage (60-98%).
   */
  private calculateConfidence(filterMetrics: any): number {
    const { snr_db } = filterMetrics;

    if (snr_db >= 30) return 98;
    if (snr_db >= 25) return 95;
    if (snr_db >= 20) return 92;
    if (snr_db >= 15) return 87;
    if (snr_db >= 10) return 80;
    return Math.max(60, Math.min(95, 60 + snr_db * 2));
  }

  /**
   * Execute complete ECG processing pipeline.
   */
  async processECG(
    rawVoltages: number[],
    config: ProcessingConfig = {},
    callbacks: ProcessingCallbacks = {}
  ): Promise<ProcessingResult> {
    if (this.status !== 'ready') {
      throw new Error('ECGProcessor not initialized. Call initialize() first.');
    }

    if (!this.worker) {
      throw new Error('Worker not available');
    }

    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.status = 'processing';

      this.pendingRequests.set(requestId, {
        onProgress: callbacks.onProgress,
        onComplete: (result) => {
          if (callbacks.onComplete) {
            callbacks.onComplete(result);
          }
          resolve(result);
        },
        onError: (error) => {
          if (callbacks.onError) {
            callbacks.onError(error);
          }
          reject(new Error(error));
        }
      });

      this.worker!.postMessage({
        type: 'PROCESS_ECG',
        data: {
          rawVoltages,
          config: {
            sampleRate: config.sampleRate || 250,
            verbose: config.verbose || false
          }
        },
        requestId
      });
    });
  }

  /**
   * Execute preprocessing only (no peak detection).
   */
  async preprocessOnly(
    rawVoltages: number[],
    config: ProcessingConfig = {}
  ): Promise<{ cleaned_signal: number[]; metrics: any }> {
    if (this.status !== 'ready') {
      throw new Error('ECGProcessor not initialized');
    }

    if (!this.worker) {
      throw new Error('Worker not available');
    }

    return new Promise((resolve, reject) => {
      const requestId = `preprocess_${Date.now()}`;

      this.pendingRequests.set(requestId, {
        onComplete: (result: any) => resolve(result),
        onError: (error: string) => reject(new Error(error))
      });

      this.worker!.postMessage({
        type: 'PREPROCESS_ONLY',
        data: { rawVoltages, config },
        requestId
      });
    });
  }

  /**
   * Get current processor status.
   */
  getStatus(): WorkerStatus {
    return this.status;
  }

  /**
   * Check if processor is ready.
   */
  isReady(): boolean {
    return this.status === 'ready';
  }

  /**
   * Terminate worker and release resources.
   */
  shutdown(): void {
    if (this.worker) {
      console.log('[ECGProcessor] Shutting down worker...');
      this.worker.postMessage({ type: 'SHUTDOWN' });
      this.worker.terminate();
      this.worker = null;
    }

    this.status = 'uninitialized';
    this.pendingRequests.clear();
    this.initializationPromise = null;
  }
}

let processorInstance: ECGProcessor | null = null;

/**
 * Get or create singleton ECGProcessor instance.
 */
export function getECGProcessor(): ECGProcessor {
  if (!processorInstance) {
    processorInstance = new ECGProcessor();
  }
  return processorInstance;
}

/**
 * Cleanup singleton instance.
 */
export function shutdownECGProcessor(): void {
  if (processorInstance) {
    processorInstance.shutdown();
    processorInstance = null;
  }
}