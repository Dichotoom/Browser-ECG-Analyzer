/**
 * High-level ECG processing service coordinating file parsing and analysis.
 */

import { getECGProcessor } from './ecgProcessor';
import { parseECGFile, validateECGData, type ParsedECGData } from './dataParser';
import type { ECGPoint, PatientMetrics, ProcessingConfig } from '../types';

export interface ECGServiceResult {
  data: ECGPoint[];
  metrics: PatientMetrics;
  rawMetrics: {
    filter_metrics: any;
    detection_metrics: any;
    arrhythmia_metrics: any;
  };
  fileInfo: {
    name: string;
    size: number;
    format: string;
    sampleRate: number;
    duration: number;
    warnings: string[];
  };
}

export interface ProcessingCallbacks {
  onProgress?: (stage: string, progress: number, message?: string) => void;
  onParsing?: () => void;
  onProcessing?: () => void;
  onComplete?: (result: ECGServiceResult) => void;
  onError?: (error: string) => void;
}

/**
 * Initialize Pyodide runtime and ECG processing modules.
 */
export async function initializeECGSystem(
  onProgress?: (stage: string, progress: number) => void
): Promise<void> {
  const processor = getECGProcessor();
  
  await processor.initialize((progress) => {
    if (onProgress) {
      let message = '';
      switch (progress.stage) {
        case 'loading_runtime':
          message = 'Loading Python runtime...';
          break;
        case 'loading_packages':
          message = 'Loading signal processing libraries...';
          break;
        case 'initializing_code':
          message = 'Initializing ECG algorithms...';
          break;
      }
      onProgress(message, progress.progress);
    }
  });
}

/**
 * Check processor readiness status.
 */
export function isECGSystemReady(): boolean {
  const processor = getECGProcessor();
  return processor.isReady();
}

/**
 * Execute complete ECG processing pipeline from file to metrics.
 */
export async function processECGFile(
  file: File,
  callbacks: ProcessingCallbacks = {}
): Promise<ECGServiceResult> {
  
  try {
    // Parse file
    if (callbacks.onProgress) {
      callbacks.onProgress('Parsing file...', 10);
    }
    if (callbacks.onParsing) {
      callbacks.onParsing();
    }

    const parsedData = await parseECGFile(file);
    
    if (callbacks.onProgress) {
      callbacks.onProgress('File parsed', 25);
    }

    // Validate data
    const validation = validateECGData(parsedData);
    
    if (!validation.valid) {
      throw new Error(`Invalid ECG data: ${validation.warnings.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      console.warn('[ECG Service] Data warnings:', validation.warnings);
    }

    // Ensure processor ready
    const processor = getECGProcessor();
    if (!processor.isReady()) {
      if (callbacks.onProgress) {
        callbacks.onProgress('Initializing processor...', 30);
      }
      await processor.initialize();
    }

    // Process signal
    if (callbacks.onProgress) {
      callbacks.onProgress('Processing ECG signal...', 40);
    }
    if (callbacks.onProcessing) {
      callbacks.onProcessing();
    }

    const config: ProcessingConfig = {
      sampleRate: parsedData.sampleRate,
      verbose: true
    };

    const result = await processor.processECG(
      parsedData.voltages,
      config,
      {
        onProgress: (progress) => {
          if (callbacks.onProgress) {
            const mappedProgress = 40 + (progress.progress * 0.5);
            callbacks.onProgress('Processing...', mappedProgress, progress.message);
          }
        }
      }
    );

    if (callbacks.onProgress) {
      callbacks.onProgress('Complete', 100);
    }

    // Format result
    const serviceResult: ECGServiceResult = {
      data: result.data,
      metrics: result.metrics,
      rawMetrics: result.rawMetrics,
      fileInfo: {
        name: file.name,
        size: file.size,
        format: parsedData.format,
        sampleRate: parsedData.sampleRate,
        duration: parsedData.duration,
        warnings: validation.warnings
      }
    };

    if (callbacks.onComplete) {
      callbacks.onComplete(serviceResult);
    }

    console.log('[ECG Service] Processing complete:', {
      peaks: result.data.filter(p => p.isPeak).length,
      bpm: result.metrics.bpm,
      rhythm: result.metrics.rhythmStatus,
      quality: result.metrics.confidence
    });

    return serviceResult;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ECG Service] Processing failed:', errorMessage);
    
    if (callbacks.onError) {
      callbacks.onError(errorMessage);
    }
    
    throw error;
  }
}

/**
 * Cleanup resources on application unmount.
 */
export function cleanupECGSystem(): void {
  const processor = getECGProcessor();
  processor.shutdown();
  console.log('[ECG Service] System cleaned up');
}