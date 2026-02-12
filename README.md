# Browser-Based ECG Analysis System

A **privacy-preserving, client-side application** for clinical-grade ECG signal processing using a **Python WebAssembly (Wasm) runtime**.

## Architecture

The application runs entirely in the browser. When loaded for the first time, the Pyodide
runtime, NumPy and SciPy (~10 MB) are downloaded from CDN. After this one-time setup, all operations are performed locally without server communication.

## Core Algorithms

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

Validated against MIT-BIH Arrhythmia Database Record 119 using WFDB annotations.

| Metric | Result |
|--------|--------|
| Sensitivity | 94.89% |
| Positive Predictive Value | 99.95% |

## Disclaimer

Research prototype only. Not clinically validated. Not for medical diagnosis or treatment decisions.

## References

Pan, J., & Tompkins, W. J. (1985). A real-time QRS detection algorithm. *IEEE Transactions on Biomedical Engineering, 32*(3), 230–236. https://doi.org/10.1109/TBME.1985.325532
