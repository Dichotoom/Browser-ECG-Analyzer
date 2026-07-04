import numpy as np
from scipy import signal
from scipy.ndimage import uniform_filter1d

# ============================================================================
# ECG PREPROCESSING
# ============================================================================

def preprocess_ecg(raw_signal, fs=250, verbose=False):
    """Apply bandpass, notch, and baseline wander removal to raw ECG signal."""
    if verbose:
        print(f"[Preprocessing] Input signal: {len(raw_signal)} samples @ {fs} Hz")

    signal_array = np.array(raw_signal, dtype=np.float64)

    # Bandpass filter: 0.5-40 Hz (removes drift and high-frequency noise)
    nyquist = fs / 2.0
    low_cutoff = 0.5 / nyquist
    high_cutoff = 40.0 / nyquist
    b_band, a_band = signal.butter(4, [low_cutoff, high_cutoff], btype='band')
    filtered = signal.filtfilt(b_band, a_band, signal_array)

    # Notch filter: 60 Hz (removes powerline interference)
    notch_freq = 60.0
    b_notch, a_notch = signal.iirnotch(notch_freq / nyquist, 30.0)
    notched = signal.filtfilt(b_notch, a_notch, filtered)

    # Baseline wander removal via moving average subtraction
    window_samples = int(0.2 * fs)
    baseline = uniform_filter1d(notched, size=window_samples, mode='nearest')
    cleaned = notched - baseline

    # Signal quality estimation via SNR
    signal_power = np.var(cleaned)
    noise_removed = signal_array - cleaned
    noise_power = np.var(noise_removed)

    if noise_power == 0:
        snr_db = 100
    else:
        snr_db = 10 * np.log10(signal_power / noise_power)

    # Map SNR (typical range: 5-25 dB) to confidence percentage
    quality_percent = max(0, min(100, (snr_db - 5) * 5))

    filter_metrics = {
        'snr_db': float(snr_db),
        'confidence_score': float(quality_percent),
        'signal_std': float(np.std(cleaned))
    }

    return cleaned, filter_metrics


def pan_tompkins_detector(ecg_signal, fs=250, verbose=False):
    """
    Adaptive QRS detection using Pan-Tompkins algorithm with enhanced peak localization.
    
    Applies bandpass filtering, differentiation, squaring, integration, and adaptive 
    thresholding to detect R-peaks with amplitude validation.
    """
    if verbose:
        print(f"[Pan-Tompkins] Starting QRS detection on {len(ecg_signal)} samples")

    signal_array = np.array(ecg_signal, dtype=np.float64)

    # Bandpass filter: 5-15 Hz (optimized for QRS complex)
    nyquist = fs / 2.0
    low, high = 5.0 / nyquist, 15.0 / nyquist
    b_qrs, a_qrs = signal.butter(2, [low, high], btype='band')
    filtered_qrs = signal.filtfilt(b_qrs, a_qrs, signal_array)

    # Five-point derivative (Vectorized)
    h = np.array([-1.0, -2.0, 0.0, 2.0, 1.0]) / (8.0 / fs)
    derivative = np.convolve(filtered_qrs, h, mode='same')

    # Squaring function (emphasizes high frequencies)
    squared = derivative ** 2

    # Moving window integration (120 ms window)
    window_size = int(0.120 * fs) 
    integrated = np.convolve(squared, np.ones(window_size) / window_size, mode='same')

    # Adaptive thresholding with refractory period
    r_peaks = []
    signal_peaks = []
    noise_peaks = []
    
    robust_max = np.percentile(integrated, 98)
    threshold = 0.6 * robust_max
    
    refractory_samples = int(0.2 * fs)
    i = 1
    
    while i < len(integrated) - 1:
        # Detect local maxima in integrated signal
        if integrated[i] > integrated[i-1] and integrated[i] > integrated[i+1]:
            
            if integrated[i] > threshold:
                
                # Enforce refractory period
                if len(r_peaks) == 0 or (i - r_peaks[-1]) > refractory_samples:
                    
                    # Localize actual R-peak in original signal
                    search_window = int(0.08 * fs)
                    start_idx = max(0, i - search_window)
                    end_idx = min(len(signal_array), i + search_window)
                    
                    local_signal = signal_array[start_idx:end_idx]
                    if len(local_signal) > 0:
                        local_max_idx = np.argmax(local_signal)
                        actual_peak_idx = start_idx + local_max_idx
                        peak_val = signal_array[actual_peak_idx]

                        # Amplitude validation (reject low-amplitude detections)
                        if peak_val > (np.std(signal_array) * 0.5):
                            r_peaks.append(actual_peak_idx)
                            signal_peaks.append(integrated[i])
                            
                            # Update adaptive threshold
                            avg_signal_peak = np.mean(signal_peaks[-8:])
                            avg_noise_peak = np.mean(noise_peaks[-8:]) if noise_peaks else 0
                            threshold = avg_noise_peak + 0.40 * (avg_signal_peak - avg_noise_peak)
                            
                            i += refractory_samples
                            continue
            else:
                noise_peaks.append(integrated[i])
        i += 1

    r_peaks = np.array(r_peaks)

    # Calculate heart rate metrics
    if len(r_peaks) >= 2:
        rr_intervals = np.diff(r_peaks) / fs
        avg_rr = np.mean(rr_intervals)
        avg_bpm = 60.0 / avg_rr if avg_rr > 0 else 0
        detection_metrics = {
            'num_peaks': len(r_peaks),
            'avg_heart_rate_bpm': float(avg_bpm),
            'avg_rr_interval_s': float(avg_rr),
            'rr_std_s': float(np.std(rr_intervals)),
            'final_threshold': float(threshold)
        }
    else:
        detection_metrics = {'num_peaks': len(r_peaks), 'avg_heart_rate_bpm': 0.0, 'final_threshold': float(threshold)}

    return r_peaks, detection_metrics


# ============================================================================
# RHYTHM ANALYSIS
# ============================================================================

def detect_arrhythmia(r_peaks, fs=250, verbose=False):
    """
    Classify cardiac rhythm based on heart rate and RR interval variability.
    
    Hierarchical classification: irregularity takes precedence over rate-based categories.
    """
    if len(r_peaks) < 3:
        return "Insufficient data", {'cv': 0.0, 'mean_hr': 0.0}

    # Calculate RR interval statistics
    rr_intervals = np.diff(r_peaks) / fs
    mean_rr = np.mean(rr_intervals)
    std_rr = np.std(rr_intervals)
    cv = std_rr / mean_rr if mean_rr > 0 else 0 

    hr_values = 60.0 / rr_intervals
    mean_hr = np.mean(hr_values)

    # Rate-based classification
    if mean_hr < 60:
        rhythm_status = "Bradycardia"
    elif mean_hr > 100:
        rhythm_status = "Tachycardia"
    else:
        rhythm_status = "Normal Sinus Rhythm"

    # Override with irregularity assessment (higher priority)
    if cv >= 0.15:
        rhythm_status = "Flagged: Irregular Rhythm"
    elif cv >= 0.08 and "Normal" in rhythm_status:
        rhythm_status = "Borderline: Mild Irregularity"

    metrics = {
        'cv': float(cv),
        'mean_hr': float(mean_hr),
        'mean_rr_ms': float(mean_rr * 1000),
        'std_rr_ms': float(std_rr * 1000)
    }

    return rhythm_status, metrics


# ============================================================================
# WAVEFORM MORPHOLOGY
# ============================================================================

def measure_qrs_width(ecg_signal, r_peaks, fs=250, verbose=False):
    """
    Measure QRS complex duration using onset-to-offset detection.
    
    Identifies Q-wave onset and S-wave offset via slope analysis.
    """
    if len(r_peaks) < 2:
        return {'mean_qrs_ms': 0, 'std_qrs_ms': 0, 'qrs_interpretation': 'Insufficient data'}

    signal_array = np.array(ecg_signal, dtype=np.float64)
    qrs_widths = []

    for r_idx in r_peaks:
        # Define search window around R-peak
        pre_window = int(0.05 * fs)
        post_window = int(0.08 * fs)
        
        start_search = max(0, r_idx - pre_window)
        end_search = min(len(signal_array), r_idx + post_window)
        
        segment = signal_array[start_search:end_search]
        if len(segment) < 5: continue
        
        r_local = r_idx - start_search
        
        # Q-wave onset detection (backward slope analysis)
        q_onset = 0
        for i in range(r_local, 0, -1):
            if i < r_local - 2:
                slope = abs(segment[i] - segment[i-1])
                if slope < 0.005:
                    q_onset = i
                    break
        else:
            q_onset = 0

        # S-wave offset detection (forward from S-wave minimum)
        s_search_segment = segment[r_local:]
        s_point_local = np.argmin(s_search_segment)
        s_point_global = r_local + s_point_local
        
        s_offset = len(segment) - 1
        for i in range(s_point_global, len(segment) - 1):
            slope = abs(segment[i+1] - segment[i])
            if slope < 0.005: 
                s_offset = i
                break
        
        width_ms = (s_offset - q_onset) * 1000 / fs
        
        # Physiological range filter
        if 40 < width_ms < 200:
            qrs_widths.append(width_ms)

    if not qrs_widths:
        return {'mean_qrs_ms': 80, 'std_qrs_ms': 0, 'qrs_interpretation': 'Could not detect'}

    mean_qrs = np.mean(qrs_widths)
    
    # Clinical interpretation
    status = 'Normal'
    if mean_qrs >= 120: status = 'Wide QRS (BBB/Ventricular)'
    elif mean_qrs <= 60: status = 'Narrow (Normal)'
    
    return {
        'mean_qrs_ms': float(mean_qrs),
        'std_qrs_ms': float(np.std(qrs_widths)),
        'qrs_interpretation': status
    }


def calculate_qt_interval(ecg_signal, r_peaks, fs=250, verbose=False):
    """
    Calculate QT interval using tangent method for T-wave offset detection.
    
    Applies Bazett's formula for rate correction (QTc).
    """
    if len(r_peaks) < 3:
        return {'mean_qt_ms': 0, 'mean_qtc_bazett_ms': 0, 'qt_risk_flag': False, 'qt_interpretation': 'N/A'}

    signal_array = np.array(ecg_signal, dtype=np.float64)
    qt_ms_list = []
    
    for i in range(len(r_peaks) - 1):
        r_idx = r_peaks[i]
        rr_sec = (r_peaks[i+1] - r_idx) / fs

        # Define T-wave search window
        t_start = r_idx + int(0.04 * fs)
        t_end_window = r_idx + int(0.45 * fs) 
        
        if t_end_window >= len(signal_array): continue
        
        # Locate T-wave peak
        t_window = signal_array[t_start:t_end_window]
        if len(t_window) == 0: continue
        
        t_peak_local = np.argmax(t_window)
        t_peak_idx = t_start + t_peak_local
        
        # Find maximum downslope (tangent method)
        slope_search_len = int(0.1 * fs)
        slope_search = signal_array[t_peak_idx : t_peak_idx + slope_search_len]
        
        if len(slope_search) < 2: continue
        
        slopes = np.diff(slope_search)
        min_slope_idx = np.argmin(slopes)
        max_slope = slopes[min_slope_idx]
        
        if max_slope == 0: continue
        
        # Calculate tangent-baseline intersection
        slope_point_idx = t_peak_idx + min_slope_idx
        slope_point_val = signal_array[slope_point_idx]
        
        t_end_idx = slope_point_idx - (slope_point_val / max_slope)
        
        q_start_idx = r_idx - int(0.03 * fs)
        
        qt_ms = (t_end_idx - q_start_idx) / fs * 1000
        
        # Physiological range filter
        if 200 < qt_ms < 600: 
            qt_ms_list.append(qt_ms)

    mean_qt = np.mean(qt_ms_list) if qt_ms_list else 0
    
    rr_intervals = np.diff(r_peaks) / fs
    mean_rr = np.mean(rr_intervals) if len(rr_intervals) > 0 else 1.0
    
    # Bazett's correction
    qtc_bazett = mean_qt / np.sqrt(mean_rr) if mean_rr > 0 else 0

    return {
        'mean_qt_ms': float(mean_qt),
        'mean_qtc_bazett_ms': float(qtc_bazett),
        'qt_risk_flag': qtc_bazett > 470,
        'qt_interpretation': 'Normal' if qtc_bazett < 450 else 'Prolonged QTc' if qtc_bazett < 500 else 'High Risk (Long QT)'
    }


def calculate_hrv_metrics(r_peaks, fs=250, verbose=False):
    """
    Calculate time-domain heart rate variability metrics with artifact rejection.
    
    Applies physiological RR interval filtering (300-1500 ms) to remove ectopic beats.
    """
    if len(r_peaks) < 3:
        return {
            'sdnn_ms': 0, 'rmssd_ms': 0, 'pnn50_percent': 0, 
            'mean_nn_ms': 0, 'cv_percent': 0,
            'hrv_interpretation': 'Insufficient data'
        }

    # Calculate RR intervals
    rr_samples = np.diff(r_peaks)
    rr_ms = (rr_samples / fs) * 1000

    # Apply physiological filter (40-200 bpm range)
    valid_indices = np.where((rr_ms > 300) & (rr_ms < 1500))[0]
    nn_intervals = rr_ms[valid_indices]

    if len(nn_intervals) < 2:
        return {
             'sdnn_ms': 0, 'rmssd_ms': 0, 'pnn50_percent': 0,
             'hrv_interpretation': 'High noise level - unstable RR'
        }

    # Standard deviation of NN intervals
    sdnn = np.std(nn_intervals, ddof=1)
    
    # Root mean square of successive differences
    diff_nn = np.diff(nn_intervals)
    rmssd = np.sqrt(np.mean(diff_nn ** 2))
    
    # Percentage of successive differences > 50 ms
    nn50 = np.sum(np.abs(diff_nn) > 50)
    pnn50 = (nn50 / len(diff_nn)) * 100 if len(diff_nn) > 0 else 0
    
    mean_nn = np.mean(nn_intervals)
    cv = (sdnn / mean_nn) * 100

    # Clinical interpretation (adjusted for short-term recordings)
    if sdnn < 20:
        interpretation = "Low HRV (Reduced variability)"
    elif sdnn < 100:
        interpretation = "Normal range for short-term recording"
    else:
        interpretation = "High Variability"

    return {
        'sdnn_ms': float(sdnn),
        'rmssd_ms': float(rmssd),
        'sdsd_ms': float(np.std(diff_nn)) if len(diff_nn) > 0 else 0,
        'pnn50_percent': float(pnn50),
        'pnn20_percent': 0.0,
        'mean_nn_ms': float(mean_nn),
        'cv_percent': float(cv),
        'nn_count': len(nn_intervals),
        'ectopic_removed': len(rr_ms) - len(nn_intervals),
        'hrv_interpretation': interpretation
    }


# ============================================================================
# COMPLETE PIPELINE
# ============================================================================

def process_ecg_complete(raw_voltages, sample_rate=250, verbose=True):
    """
    Execute complete ECG analysis pipeline with clinical interpretation.
    
    Returns:
        dict: Contains cleaned signal, R-peak locations, and comprehensive metrics
    """
    if verbose:
        print("="*60)
        print("SOVEREIGN ECG SANDBOX - ENHANCED PROCESSING PIPELINE")
        print("="*60)

    raw_signal = np.array(raw_voltages, dtype=np.float64)

    # Signal preprocessing
    cleaned_signal, filter_metrics = preprocess_ecg(raw_signal, sample_rate, verbose)

    # R-peak detection
    r_peaks, detection_metrics = pan_tompkins_detector(cleaned_signal, sample_rate, verbose)

    # Rhythm classification
    rhythm_status, arrhythmia_metrics = detect_arrhythmia(r_peaks, sample_rate, verbose)

    # Morphology analysis
    qrs_metrics = measure_qrs_width(cleaned_signal, r_peaks, sample_rate, verbose)
    qt_metrics = calculate_qt_interval(cleaned_signal, r_peaks, sample_rate, verbose)
    hrv_metrics = calculate_hrv_metrics(r_peaks, sample_rate, verbose)

    # Clinical interpretation
    enhanced_rhythm = rhythm_status
    warnings = []

    if qrs_metrics['mean_qrs_ms'] > 120:
        if detection_metrics['avg_heart_rate_bpm'] > 100:
            enhanced_rhythm = "Wide-Complex Tachycardia - URGENT EVALUATION"
            warnings.append("Wide QRS with tachycardia requires immediate assessment")
        else:
            warnings.append(qrs_metrics['qrs_interpretation'])

    if qt_metrics['qt_risk_flag']:
        warnings.append(qt_metrics['qt_interpretation'])

    if hrv_metrics['sdnn_ms'] > 0 and hrv_metrics['sdnn_ms'] < 50:
        warnings.append("Low HRV detected - consider cardiac risk assessment")

    # Format for UI consumption
    ui_metrics = {
        "bpm": float(detection_metrics['avg_heart_rate_bpm']),
        "rhythmStatus": enhanced_rhythm,
        "confidence": float(filter_metrics['confidence_score']),
        "sdnn": float(hrv_metrics['sdnn_ms']),
        "rmssd": float(hrv_metrics['rmssd_ms']),
        "qtcBazett": float(qt_metrics['mean_qtc_bazett_ms']),
        "qrsWidth": float(qrs_metrics['mean_qrs_ms']),
        "pnn50": float(hrv_metrics['pnn50_percent']),
        "clinicalWarnings": warnings
    }

    if verbose:
        print("="*60)
        print(f"RESULTS: {len(r_peaks)} R-peaks detected")
        print(f"Heart Rate: {ui_metrics['bpm']:.1f} BPM")
        print(f"Rhythm: {ui_metrics['rhythmStatus']}")
        print(f"Confidence: {ui_metrics['confidence']:.1f}%")
        print("="*60)

    results = {
        'cleaned_signal': cleaned_signal.tolist(),
        'r_peak_indices': r_peaks.tolist(),
        'metrics': ui_metrics,
        'filter_metrics': filter_metrics,
        'detection_metrics': detection_metrics,
        'arrhythmia_metrics': arrhythmia_metrics,
        'qrs_metrics': qrs_metrics,
        'qt_metrics': qt_metrics,
        'hrv_metrics': hrv_metrics,
        'rhythm_status': enhanced_rhythm,
        'clinical_warnings': warnings,
        'sample_rate': sample_rate,
        'num_samples': len(raw_signal)
    }

    return results

print("[Python] Enhanced ECG processing module loaded successfully")
