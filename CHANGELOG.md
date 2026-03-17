# Changelog

## 0.1.0 — Initial release

- `createSmart402Guard(config)` — evaluation function factory
- `Smart402Client` — direct HTTP client for `POST /evaluate`
- `Smart402Denied`, `Smart402Unavailable` — error classes
- `fail_open` / `fail_closed` modes
- Full TypeScript types (`Smart402Config`, `EvaluateRequest`, `EvaluateResponse`, `PaymentRequirements`)
- Zero runtime dependencies — native `fetch`, Node 18+
- CJS + ESM + type declarations
