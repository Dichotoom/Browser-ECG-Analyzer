/**
 * React hooks for ECG system initialization and file processing.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  initializeECGSystem, 
  isECGSystemReady, 
  cleanupECGSystem,
  processECGFile,
  type ProcessingCallbacks,
  type ECGServiceResult
} from '../services/ecgService';

interface ECGSystemState {
  isInitialized: boolean;
  isInitializing: boolean;
  initializationProgress: number;
  initializationStage: string;
  error: string | null;
}

/**
 * Initialize and manage Pyodide runtime lifecycle.
 */
export function useECGSystem() {
  const [state, setState] = useState<ECGSystemState>({
    isInitialized: false,
    isInitializing: false,
    initializationProgress: 0,
    initializationStage: 'Not started',
    error: null
  });

  const isInitializingRef = useRef(false);

  useEffect(() => {
    const initialize = async () => {
      if (isInitializingRef.current || state.isInitialized) {
        return;
      }

      isInitializingRef.current = true;

      setState(prev => ({
        ...prev,
        isInitializing: true,
        error: null
      }));

      try {
        await initializeECGSystem((stage, progress) => {
          setState(prev => ({
            ...prev,
            initializationProgress: progress,
            initializationStage: stage
          }));
        });

        setState(prev => ({
          ...prev,
          isInitialized: true,
          isInitializing: false,
          initializationProgress: 100,
          initializationStage: 'Ready'
        }));

      } catch (error) {
        console.error('[useECGSystem] Initialization failed:', error);
        setState(prev => ({
          ...prev,
          isInitializing: false,
          error: error instanceof Error ? error.message : String(error)
        }));
      } finally {
        isInitializingRef.current = false;
      }
    };

    initialize();

    return () => {
      // Worker persists for tab lifetime
    };
  }, []);

  const retry = useCallback(async () => {
    setState(prev => ({
      ...prev,
      error: null,
      isInitializing: true
    }));

    try {
      await initializeECGSystem((stage, progress) => {
        setState(prev => ({
          ...prev,
          initializationProgress: progress,
          initializationStage: stage
        }));
      });

      setState(prev => ({
        ...prev,
        isInitialized: true,
        isInitializing: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isInitializing: false,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }, []);

  return {
    ...state,
    retry
  };
}

/**
 * Process ECG files with progress tracking.
 */
export function useECGProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const process = useCallback(async (
    file: File,
    onComplete?: (result: ECGServiceResult) => void
  ): Promise<ECGServiceResult | null> => {
    setIsProcessing(true);
    setProgress(0);
    setProgressMessage('Starting...');
    setError(null);

    const callbacks: ProcessingCallbacks = {
      onProgress: (stage, prog, message) => {
        setProgress(prog);
        setProgressMessage(message || stage);
      },
      onError: (err) => {
        setError(err);
        setIsProcessing(false);
      }
    };

    try {
      const result = await processECGFile(file, callbacks);
      
      setIsProcessing(false);
      setProgress(100);
      setProgressMessage('Complete');
      
      if (onComplete) {
        onComplete(result);
      }
      
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setError(errorMsg);
      setIsProcessing(false);
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setProgress(0);
    setProgressMessage('');
    setError(null);
  }, []);

  return {
    process,
    reset,
    isProcessing,
    progress,
    progressMessage,
    error
  };
}