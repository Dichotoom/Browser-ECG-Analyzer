/**
 * Drag-and-drop file upload component with format validation.
 */

import React, { useRef, useState } from 'react';
import { UploadCloud, CheckCircle2, Loader2 } from 'lucide-react';

interface FileUploadProps {
  onFileSelected: (file: File) => Promise<void>;
  isProcessing: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelected, isProcessing }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await processFile(file);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    console.log('[FileUpload] Selected file:', file.name, file.type, file.size);
    
    const validExtensions = ['.csv', '.xml', '.txt'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValid) {
      alert(`Unsupported file format. Please upload ${validExtensions.join(', ')} files.`);
      return;
    }

    setSelectedFile(file);
    await onFileSelected(file);
  };

  const handleClick = () => {
    if (!isProcessing) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div 
      className={`relative w-full h-40 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden
        ${isDragging 
          ? 'border-[#005EB8] bg-blue-50/50' 
          : 'border-slate-300 bg-white hover:border-[#005EB8] hover:bg-slate-50'
        }
        ${isProcessing ? 'pointer-events-none' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileInput} 
        className="hidden" 
        accept=".csv,.json,.xml,.txt"
      />
      
      {isProcessing ? (
        <div className="flex flex-col items-center animate-pulse">
          <Loader2 className="w-10 h-10 text-[#005EB8] animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600">
            Processing {selectedFile?.name || 'ECG data'}...
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Running client-side signal analysis
          </p>
        </div>
      ) : selectedFile ? (
        <div className="flex flex-col items-center">
          <div className="p-3 rounded-full mb-3 bg-green-100">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-slate-700 font-medium text-sm mb-1">
            {selectedFile.name}
          </p>
          <p className="text-slate-400 text-xs">
            {(selectedFile.size / 1024).toFixed(1)} KB • Click to select another file
          </p>
        </div>
      ) : (
        <>
          <div className={`p-3 rounded-full mb-3 transition-colors ${isDragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
            <UploadCloud className={`w-6 h-6 ${isDragging ? 'text-[#005EB8]' : 'text-slate-400'}`} />
          </div>
          <p className="text-slate-700 font-medium text-sm mb-1">
            Drag and drop ECG data here
          </p>
          <p className="text-slate-400 text-xs px-4 text-center">
            Supports CSV (MIT-BIH, generic), XML (Philips/GE)
          </p>
          <p className="text-slate-400 text-xs mt-1">
            Data processed <span className="font-semibold text-green-600">client-side only</span> - never uploaded
          </p>
        </>
      )}
    </div>
  );
};

export default FileUpload;