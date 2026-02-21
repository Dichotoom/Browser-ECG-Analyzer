# Browser-Based ECG Analysis System

A **privacy-preserving, client-side application** for clinical-grade ECG signal processing using a **Python WebAssembly (Wasm) runtime**.

## Architecture

The application runs entirely in the browser. When loaded for the first time, the Pyodide
runtime, NumPy and SciPy (~10 MB) are downloaded from CDN. After this one-time setup, all operations are performed locally without server communication.

## Core Algorithms

All algorithms use **validated SciPy implementations** via Pyodide, avoiding JavaScript reimplementation and potential numerical errors.

- **Pan-Tompkins QRS Detection**  
  Implements the reference 1985 algorithm with **adaptive thresholding** and **five-point differentiation**.

- **Heart Rate Variability (HRV)**  
  Automated calculation of **SDNN, RMSSD, and pNN50 metrics** with artifact rejection.

- **QRS Morphology**  
  Duration measurement via slope-based onset/offset detection.

- **QTc Interval**  
  Bazett correction via tangent method T-wave offset detection.

- **Rhythm Classification**  
  Coefficient of variation threshold with hierarchical rate-based classification.

## Quick Start

Requires **Node.js 18+** and an internet connection for the initial setup.
```bash
npm install
npm run dev
```

## Usage

Upload an ECG recording (`.csv` or `.xml`). The system will parse the file, run the signal processing pipeline, and display results.

## Validation

Validated against MIT-BIH Arrhythmia Database using WFDB reference annotations (100ms tolerance, filtered for valid beat symbols).

**Multi-record validation (n=6):**

| Record | Sensitivity | PPV |
|--------|------------|-----|
| 105 | 98.56% | 96.57% |
| 108 | 84.52% | 95.39% |
| 102 | 100.00% | 100.00% |
| 119 | 100.00% | 99.95% |
| 203 | 89.16% | 97.72% |
| 223 | 99.50% | 100.00% |
| **Global** | **95.42%** | **98.35%** |

## Disclaimer

Research prototype only. Not clinically validated. Not for medical diagnosis or treatment decisions.

## References

Pan, J., & Tompkins, W. J. (1985). A real-time QRS detection algorithm. *IEEE Transactions on Biomedical Engineering, 32*(3), 230–236. https://doi.org/10.1109/TBME.1985.325532
