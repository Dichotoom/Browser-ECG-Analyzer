/**
 * Main application component with initialization flow and dashboard layout.
 */

import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import ECGDisplay from './components/ECGDisplay';
import DiagnosticPanel from './components/DiagnosticPanel';
import { AppView, ECGPoint, PatientMetrics } from './types';
import { useECGSystem, useECGProcessor } from './hooks/useECGSystem';
import { Loader2, AlertCircle, CheckCircle, Wifi } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [ecgData, setEcgData] = useState<ECGPoint[]>([]);
  const [metrics, setMetrics] = useState<PatientMetrics | null>(null);
  const [fileInfo, setFileInfo] = useState<any>(null);

  const { 
    isInitialized, 
    isInitializing, 
    initializationProgress, 
    initializationStage,
    error: initError,
    retry: retryInit
  } = useECGSystem();

  const {
    process,
    isProcessing,
    progress,
    progressMessage,
    error: processError
  } = useECGProcessor();

  const handleFileSelected = async (file: File) => {
    console.log('[App] Processing file:', file.name);

    const result = await process(file, (result) => {
      setEcgData(result.data);
      setMetrics(result.metrics);
      setFileInfo(result.fileInfo);

      console.log('[App] Processing complete:', {
        samples: result.data.length,
        peaks: result.data.filter(p => p.isPeak).length,
        bpm: result.metrics.bpm,
        rhythm: result.metrics.rhythmStatus
      });
    });

    if (result && result.fileInfo.warnings.length > 0) {
      console.warn('[App] Data warnings:', result.fileInfo.warnings);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
          <div className="flex flex-col items-center space-y-6">
            <div className="w-16 h-16 bg-[#005EB8] rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-slate-800">Initializing Processing Environment</h2>
              <p className="text-slate-600">{initializationStage}</p>
            </div>

            <div className="w-full">
              <div className="flex justify-between text-sm text-slate-600 mb-2">
                <span>Downloading libraries...</span>
                <span>{initializationProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#005EB8] transition-all duration-300"
                  style={{ width: `${initializationProgress}%` }}
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-slate-600 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Wifi className="w-3 h-3 text-blue-600" />
                <span className="font-semibold text-blue-800">One-time setup required</span>
              </div>
              Downloading Python runtime and signal processing libraries (~10 MB).
              After initialization, all processing runs client-side without server connection.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
          <div className="flex flex-col items-center space-y-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-slate-800">Initialization Failed</h2>
              <p className="text-slate-600 text-sm">{initError}</p>
            </div>

            <button
              onClick={retryInit}
              className="px-6 py-2 bg-[#005EB8] text-white rounded-lg hover:bg-[#004a93] transition-colors"
            >
              Retry Initialization
            </button>

            <div className="text-xs text-slate-500 text-center max-w-xs">
              Internet connection required for initial library download.
              The system downloads Pyodide runtime, NumPy, and SciPy from CDN (~10 MB total).
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (currentView !== AppView.DASHBOARD) {
      return (
        <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-4">
          <div className="text-4xl font-light text-slate-300">Feature Disabled</div>
          <p className="max-w-md text-center">
            This module is not implemented in the research prototype.
            Please return to "New Patient Scan" for ECG analysis.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-7xl mx-auto w-full">
        {isInitialized && !ecgData.length && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Processing Environment Ready
              </p>
              <p className="text-xs text-green-700 mt-1">
                Python signal processing runtime loaded. All ECG analysis runs client-side in your browser.
              </p>
            </div>
          </div>
        )}

        {processError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Processing Error</p>
              <p className="text-xs text-red-700 mt-1">{processError}</p>
            </div>
          </div>
        )}

        {fileInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">
                  {fileInfo.name}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {fileInfo.format.toUpperCase()} • {fileInfo.sampleRate} Hz • {fileInfo.duration.toFixed(1)}s • {(fileInfo.size / 1024).toFixed(1)} KB
                </p>
              </div>
              {fileInfo.warnings.length > 0 && (
                <div className="text-xs text-amber-700 max-w-xs">
                  <strong>Warnings:</strong> {fileInfo.warnings.join(', ')}
                </div>
              )}
            </div>
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-800">1. Data Import</h2>
            {isProcessing && (
              <span className="text-xs text-slate-500">
                {progressMessage} ({progress}%)
              </span>
            )}
          </div>
          <FileUpload 
            onFileSelected={handleFileSelected}
            isProcessing={isProcessing} 
          />
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-800">2. Signal Analysis</h2>
            {ecgData.length > 0 && fileInfo && (
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">
                Duration: {fileInfo.duration.toFixed(1)}s @ {fileInfo.sampleRate}Hz
              </span>
            )}
          </div>
          <ECGDisplay data={ecgData.slice(0, 10000)} />
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-800">3. Diagnostic Metrics</h2>
          </div>
          <DiagnosticPanel metrics={metrics} />
        </section>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;