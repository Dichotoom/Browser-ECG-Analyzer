"""
MIT-BIH Arrhythmia Database Validation Script

This script downloads reference ECG records and cardiologist annotations from the PhysioNet MIT-BIH database 
using the `wfdb` library. It evaluates the accuracy (Sensitivity and Positive Predictive Value) of the 
Pan-Tompkins QRS detection algorithm implemented in `services/ecg_processor.py`.
"""

import os
import sys
import numpy as np
import wfdb

# Add the services directory to the path so we can import ecg_processor
services_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'services')
sys.path.append(services_path)
from ecg_processor import pan_tompkins_detector

def evaluate_detector(record_name):
    # Download and read the record from physionet
    record = wfdb.rdrecord(record_name, pn_dir='mitdb')
    annotation = wfdb.rdann(record_name, 'atr', pn_dir='mitdb')
    
    # Extract Lead 0 (usually MLII, which is best for QRS detection)
    signal = record.p_signal[:, 0]
    fs = record.fs
    
    # Run our pan-tompkins detector
    detected_peaks, _ = pan_tompkins_detector(signal, fs=fs, verbose=False)
    
    # Get ground truth peaks
    # Filter out non-beat annotations like ~, +, |, etc.
    valid_beat_symbols = ['N', 'L', 'R', 'B', 'A', 'a', 'J', 'S', 'V', 'r', 'F', 'e', 'j', 'n', 'E', '/', 'f', 'Q', '?']
    true_peaks = []
    for i, symbol in enumerate(annotation.symbol):
        if symbol in valid_beat_symbols:
            true_peaks.append(annotation.sample[i])
            
    true_peaks = np.array(true_peaks)
    
    # 100ms tolerance = 0.1 * fs
    tolerance = int(0.1 * fs)
    
    tp = 0
    fp = 0
    fn = 0
    
    # Match detected peaks to true peaks
    matched_true = set()
    for det_peak in detected_peaks:
        # Find closest true peak
        if len(true_peaks) == 0:
            fp += 1
            continue
            
        diffs = np.abs(true_peaks - det_peak)
        min_idx = np.argmin(diffs)
        
        if diffs[min_idx] <= tolerance and min_idx not in matched_true:
            tp += 1
            matched_true.add(min_idx)
        else:
            fp += 1
            
    fn = len(true_peaks) - len(matched_true)
    
    sens = tp / (tp + fn) if (tp + fn) > 0 else 0
    ppv = tp / (tp + fp) if (tp + fp) > 0 else 0
    
    return sens, ppv, tp, fp, fn

if __name__ == "__main__":
    records = ['105', '108', '102', '119', '203', '223']
    total_tp = 0
    total_fp = 0
    total_fn = 0

    print(f"{'Record':<10}{'Sensitivity':<15}{'PPV':<15}")
    print("-" * 40)
    for r in records:
        try:
            sens, ppv, tp, fp, fn = evaluate_detector(r)
            total_tp += tp
            total_fp += fp
            total_fn += fn
            print(f"{r:<10}{sens*100:>8.2f}%        {ppv*100:>8.2f}%")
        except Exception as e:
            print(f"{r:<10} Error: {e}")

    global_sens = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0
    global_ppv = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0
    print("-" * 40)
    print(f"{'Global':<10}{global_sens*100:>8.2f}%        {global_ppv*100:>8.2f}%")
