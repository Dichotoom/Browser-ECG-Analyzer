/**
 * ECG file parser supporting MIT-BIH CSV, generic CSV, and Philips XML formats.
 */

export interface ParsedECGData {
  voltages: number[];
  sampleRate: number;
  duration: number;
  format: 'mitbih' | 'csv' | 'xml' | 'unknown';
  metadata?: {
    recordName?: string;
    lead?: string;
    units?: string;
  };
}

/**
 * Parse MIT-BIH CSV format with automatic header detection and ADC conversion.
 */
export async function parseMITBIH_CSV(file: File): Promise<ParsedECGData> {
  const text = await file.text();
  const lines = text.trim().split('\n');
  
  if (lines.length < 2) {
    throw new Error('File is empty or has insufficient data');
  }

  const voltages: number[] = [];
  let sampleRate = 360;
  let hasHeader = false;
  let leadColumn = 1;

  const firstLine = lines[0].trim();
  const firstLineLower = firstLine.toLowerCase();
  
  if (
    firstLineLower.includes('time') || 
    firstLineLower.includes('sample') ||
    firstLineLower.includes('mlii') ||
    firstLineLower.includes('v1') ||
    firstLineLower.includes('v5')
  ) {
    hasHeader = true;
    
    const headers = firstLine.split(',').map(h => h.trim().toLowerCase());
    const mliiIndex = headers.findIndex(h => h.includes('mlii'));
    if (mliiIndex !== -1) {
      leadColumn = mliiIndex;
    }
  }

  const startLine = hasHeader ? 1 : 0;
  
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; 

    const values = line.split(',').map(v => v.trim());
    
    if (values.length < 2) {
      continue;
    }

    let voltage = parseFloat(values[leadColumn]);
    
    if (isNaN(voltage)) {
      continue;
    }

    // ADC to millivolt conversion for raw MIT-BIH data
    if (voltage > 100) {
        voltage = (voltage - 1024) / 200;
    }

    // Clamp outliers
    if (voltage > 5) voltage = 5;
    if (voltage < -5) voltage = -5;

    voltages.push(voltage);
  }

  if (voltages.length === 0) {
    throw new Error('No valid voltage data found in file');
  }

  const duration = voltages.length / sampleRate;

  console.log(`[Parser] MIT-BIH CSV parsed: ${voltages.length} samples, ${duration.toFixed(1)}s`);

  return {
    voltages,
    sampleRate,
    duration,
    format: 'mitbih',
    metadata: {
      recordName: file.name.replace(/\.[^/.]+$/, ''),
      lead: 'MLII',
      units: 'mV'
    }
  };
}

/**
 * Parse generic time-series CSV with sample rate estimation.
 */
export async function parseGenericCSV(file: File): Promise<ParsedECGData> {
  const text = await file.text();
  const lines = text.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('File is empty or has insufficient data');
  }

  const voltages: number[] = [];
  const times: number[] = [];
  let hasHeader = false;

  const firstLine = lines[0].trim().toLowerCase();
  if (firstLine.includes('time') || firstLine.includes('voltage') || firstLine.includes('ecg')) {
    hasHeader = true;
  }

  const startLine = hasHeader ? 1 : 0;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());
    
    if (values.length < 2) continue;

    const time = parseFloat(values[0]);
    const voltage = parseFloat(values[1]);

    if (!isNaN(time) && !isNaN(voltage)) {
      times.push(time);
      voltages.push(voltage);
    }
  }

  if (voltages.length === 0) {
    throw new Error('No valid data found in CSV');
  }

  // Estimate sample rate from time intervals
  let sampleRate = 250;
  if (times.length > 1) {
    const intervals = [];
    for (let i = 1; i < Math.min(100, times.length); i++) {
      intervals.push(times[i] - times[i-1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (avgInterval > 0) {
      sampleRate = Math.round(1 / avgInterval);
    }
  }

  const duration = voltages.length / sampleRate;

  console.log(`[Parser] Generic CSV parsed: ${voltages.length} samples @ ${sampleRate}Hz, ${duration.toFixed(1)}s`);

  return {
    voltages,
    sampleRate,
    duration,
    format: 'csv',
    metadata: {
      recordName: file.name.replace(/\.[^/.]+$/, ''),
      units: 'mV'
    }
  };
}

/**
 * Parse Philips XML format with waveform extraction.
 */
export async function parsePhilipsXML(file: File): Promise<ParsedECGData> {
  const text = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, 'text/xml');

  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid XML format');
  }

  const waveformNodes = xmlDoc.querySelectorAll('waveformdata, WaveFormData, lead');
  
  if (waveformNodes.length === 0) {
    throw new Error('No waveform data found in XML');
  }

  const voltages: number[] = [];
  let sampleRate = 250;

  const sampleRateNode = xmlDoc.querySelector('samplerate, SampleRate');
  if (sampleRateNode) {
    const rate = parseFloat(sampleRateNode.textContent || '250');
    if (!isNaN(rate)) {
      sampleRate = rate;
    }
  }

  for (const node of Array.from(waveformNodes)) {
    const dataText = node.textContent || '';
    const values = dataText.split(/[\s,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
    voltages.push(...values);
  }

  if (voltages.length === 0) {
    throw new Error('No valid waveform data extracted from XML');
  }

  const duration = voltages.length / sampleRate;

  console.log(`[Parser] Philips XML parsed: ${voltages.length} samples @ ${sampleRate}Hz`);

  return {
    voltages,
    sampleRate,
    duration,
    format: 'xml',
    metadata: {
      recordName: file.name.replace(/\.[^/.]+$/, ''),
      units: 'mV'
    }
  };
}

/**
 * Auto-detect file format and parse with fallback strategy.
 */
export async function parseECGFile(file: File): Promise<ParsedECGData> {
  const fileName = file.name.toLowerCase();

  console.log(`[Parser] Parsing file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

  try {
    if (fileName.endsWith('.xml')) {
      return await parsePhilipsXML(file);
    } else if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
      try {
        return await parseMITBIH_CSV(file);
      } catch (error) {
        console.warn('[Parser] MIT-BIH format failed, trying generic CSV...', error);
        return await parseGenericCSV(file);
      }
    } else {
      throw new Error(`Unsupported file format: ${fileName}`);
    }
  } catch (error) {
    console.error('[Parser] Parsing failed:', error);
    throw new Error(`Failed to parse ECG file: ${error}`);
  }
}

/**
 * Validate parsed ECG data for quality and completeness.
 */
export function validateECGData(data: ParsedECGData): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (data.voltages.length < 100) {
    warnings.push('Very short signal (< 100 samples). Results may be unreliable.');
  }

  // Compute amplitude range
  let max = -Infinity;
  let min = Infinity;
  
  for (let i = 0; i < data.voltages.length; i++) {
    const v = data.voltages[i];
    if (v > max) max = v;
    if (v < min) min = v;
  }
  
  if (max > 100 || min < -100) {
    warnings.push('Voltage values seem unusually large. Data might be in raw ADC units instead of mV.');
  }

  if (max < 0.1 && min > -0.1 && max !== min) {
    warnings.push('Voltage values seem unusually small. Check units.');
  }

  const range = max - min;
  if (range < 0.001) {
    warnings.push('Signal appears flat (no variation detected).');
  }

  if (data.sampleRate < 100) {
    warnings.push('Sample rate < 100 Hz. ECG analysis requires at least 100 Hz.');
  }

  if (data.sampleRate > 1000) {
    warnings.push('Sample rate > 1000 Hz. Consider downsampling for performance.');
  }

  if (data.duration < 2) {
    warnings.push('Signal duration < 2 seconds. At least 4-5 seconds recommended for reliable analysis.');
  }

  const valid = warnings.length === 0 || warnings.every(w => !w.includes('requires'));

  return { valid, warnings };
}