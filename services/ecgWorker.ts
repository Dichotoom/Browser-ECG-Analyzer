/**
 * Web Worker for ECG processing using Pyodide runtime.
 * Executes Python DSP algorithms in a separate thread to maintain UI responsiveness.
 */

import type { ECGPoint, ProcessingConfig, ProcessingResult } from '../types';
import pythonCode from './ecg_processor.py?raw';

type WorkerMessageType = 
  | 'INIT_PYODIDE'
  | 'PROCESS_ECG'
  | 'PREPROCESS_ONLY'
  | 'DETECT_PEAKS_ONLY'
  | 'SHUTDOWN';

type MainThreadMessageType =
  | 'PYODIDE_READY'
  | 'PYODIDE_LOADING_PROGRESS'
  | 'ECG_PROCESSED'
  | 'PREPROCESSING_COMPLETE'
  | 'PEAK_DETECTION_COMPLETE'
  | 'ERROR';

interface WorkerMessage {
  type: WorkerMessageType;
  data?: any;
  requestId?: string;
}

interface MainThreadMessage {
  type: MainThreadMessageType;
  data?: any;
  requestId?: string;
  error?: string;
}

let pyodideInstance: any = null;
let isPyodideReady = false;

/**
 * Initialize Pyodide runtime and load required packages.
 */
async function initializePyodide(): Promise<void> {
  try {
    console.log('[Worker] Starting Pyodide initialization...');

    self.postMessage({
      type: 'PYODIDE_LOADING_PROGRESS',
      data: { stage: 'loading_runtime', progress: 0 }
    } as MainThreadMessage);

    const { loadPyodide } = await import('https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.mjs');

    pyodideInstance = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/'
    });

    console.log('[Worker] Pyodide runtime loaded');

    self.postMessage({
      type: 'PYODIDE_LOADING_PROGRESS',
      data: { stage: 'loading_packages', progress: 30 }
    } as MainThreadMessage);

    console.log('[Worker] Loading numpy...');
    await pyodideInstance.loadPackage('numpy');

    self.postMessage({
      type: 'PYODIDE_LOADING_PROGRESS',
      data: { stage: 'loading_packages', progress: 60 }
    } as MainThreadMessage);

    console.log('[Worker] Loading scipy...');
    await pyodideInstance.loadPackage('scipy');

    self.postMessage({
      type: 'PYODIDE_LOADING_PROGRESS',
      data: { stage: 'initializing_code', progress: 90 }
    } as MainThreadMessage);

    console.log('[Worker] Loading ECG processing code...');

    await loadECGProcessingCode();

    isPyodideReady = true;

    console.log('[Worker] Pyodide initialization complete!');

    self.postMessage({
      type: 'PYODIDE_READY',
      data: { message: 'Pyodide and ECG processing modules loaded successfully' }
    } as MainThreadMessage);

  } catch (error) {
    console.error('[Worker] Pyodide initialization failed:', error);
    self.postMessage({
      type: 'ERROR',
      error: `Failed to initialize Pyodide: ${error}`
    } as MainThreadMessage);
  }
}

/**
 * Load Python ECG processing algorithms into Pyodide environment.
 */
async function loadECGProcessingCode(): Promise<void> {
  await pyodideInstance.runPythonAsync(pythonCode);
  console.log('[Worker] Python ECG processing code loaded');
}

/**
 * Execute complete ECG processing pipeline in Python.
 */
async function processECG(
  rawVoltages: number[],
  config: ProcessingConfig,
  requestId: string
): Promise<void> {
  if (!isPyodideReady || !pyodideInstance) {
    throw new Error('Pyodide not initialized. Call INIT_PYODIDE first.');
  }

  try {
    console.log(`[Worker] Processing ${rawVoltages.length} samples...`);

    pyodideInstance.globals.set('raw_voltages_js', rawVoltages);
    pyodideInstance.globals.set('sample_rate', config.sampleRate || 250);
    pyodideInstance.globals.set('verbose', config.verbose || false);

    const pythonScript = `
results = process_ecg_complete(raw_voltages_js, sample_rate, verbose)
results
`;

    const results = await pyodideInstance.runPythonAsync(pythonScript);

    const jsResults = results.toJs({ dict_converter: Object.fromEntries });

    console.log('[Worker] Processing complete');

    self.postMessage({
      type: 'ECG_PROCESSED',
      data: jsResults,
      requestId
    } as MainThreadMessage);

  } catch (error) {
    console.error('[Worker] Processing error:', error);
    self.postMessage({
      type: 'ERROR',
      error: `Processing failed: ${error}`,
      requestId
    } as MainThreadMessage);
  }
}

/**
 * Execute preprocessing only (no peak detection or analysis).
 */
async function preprocessOnly(
  rawVoltages: number[],
  config: ProcessingConfig,
  requestId: string
): Promise<void> {
  if (!isPyodideReady || !pyodideInstance) {
    throw new Error('Pyodide not initialized');
  }

  try {
    pyodideInstance.globals.set('raw_voltages_js', rawVoltages);
    pyodideInstance.globals.set('sample_rate', config.sampleRate || 250);

    const pythonScript = `
import numpy as np
raw_signal = np.array(raw_voltages_js, dtype=np.float64)
cleaned, metrics = preprocess_ecg(raw_signal, sample_rate, verbose=False)
{'cleaned_signal': cleaned.tolist(), 'metrics': metrics}
`;

    const results = await pyodideInstance.runPythonAsync(pythonScript);
    const jsResults = results.toJs({ dict_converter: Object.fromEntries });

    self.postMessage({
      type: 'PREPROCESSING_COMPLETE',
      data: jsResults,
      requestId
    } as MainThreadMessage);

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: `Preprocessing failed: ${error}`,
      requestId
    } as MainThreadMessage);
  }
}

/**
 * Main message handler for Worker communication.
 */
self.addEventListener('message', async (e: MessageEvent<WorkerMessage>) => {
  const { type, data, requestId } = e.data;

  try {
    switch (type) {
      case 'INIT_PYODIDE':
        await initializePyodide();
        break;

      case 'PROCESS_ECG':
        await processECG(data.rawVoltages, data.config || {}, requestId || '');
        break;

      case 'PREPROCESS_ONLY':
        await preprocessOnly(data.rawVoltages, data.config || {}, requestId || '');
        break;

      case 'SHUTDOWN':
        console.log('[Worker] Shutting down...');
        self.close();
        break;

      default:
        console.warn(`[Worker] Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error('[Worker] Error handling message:', error);
    self.postMessage({
      type: 'ERROR',
      error: `Worker error: ${error}`,
      requestId
    } as MainThreadMessage);
  }
});

console.log('[Worker] ECG Worker initialized and ready');