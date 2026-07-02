# Localized Screenshot Performance Observations

This document records measured Chrome Web Store localized screenshot upload timings. Treat these as operational evidence, not synthetic benchmarks: browser focus, CWS response time, existing dashboard state, retry mode, and audit timing can all affect wall-clock results.

## 2026-07-02 YouTube Mix Blocker Run

Source observations:

- Six-worker parallel localized screenshot run: `37m 55s`.
- One-worker localized screenshot run: `44m 55s`.
- Project scale: Chrome Web Store localized screenshots for the YouTube Mix Blocker listing, approximately 66 locales and 198 localized screenshots.

Derived numbers:

| Metric | Six workers | One worker | Difference |
| --- | ---: | ---: | ---: |
| Wall-clock time | 37m 55s | 44m 55s | 7m 00s faster |
| Total seconds | 2,275s | 2,695s | 420s faster |
| Speedup versus one worker | 1.18x | 1.00x | 15.6% faster |
| Approx. seconds per localized screenshot | 11.49s | 13.61s | 2.12s faster |
| Approx. seconds per locale | 34.47s | 40.83s | 6.36s faster |

Interpretation:

- Six workers are currently the fastest observed end-to-end option, but the gain is modest rather than proportional to worker count.
- The likely limiting factor is the coordinated media mutation gate: workers can prepare, navigate, and audit in parallel, but actual CWS delete/upload mutations are serialized to avoid persistence failures.
- The result supports keeping parallel mode as the preferred supervised bulk-upload feature, while preserving single-worker upload as the simpler and lower-variance baseline.
- Future performance work should target reducing non-mutating overhead, stale/minimized-tab recovery, and audit/retry clarity before attempting to loosen the media gate.

Notes:

- The screenshots behind this observation showed slightly different reported end states while still providing useful wall-clock comparison data. The six-worker panel reported a completed audited parallel run around `37m 55s`; the one-worker panel showed final verification around `44m 55s`.
- Do not infer that six workers are six times faster. For CWS localized screenshot uploads, serialized media writes dominate enough that parallelism mainly improves the surrounding navigation, waiting, audit, and recovery time.
